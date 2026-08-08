import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import { encrypt, decrypt } from "@/lib/encryption";
import type { CreatePatientInput, UpdatePatientInput } from "@/lib/validations/patient";

interface Antecedents {
  familiaux?: string;
  chirurgicaux?: string;
  medicaux?: string;
}

function encryptAntecedents(antecedents?: Antecedents): string | undefined {
  return antecedents ? encrypt(JSON.stringify(antecedents)) : undefined;
}

// Déchiffre pour affichage — jamais renvoyé tel quel depuis la base. Un
// enregistrement créé avant l'activation du chiffrement (ou une valeur
// corrompue) ne doit pas faire planter la fiche patient : on masque
// silencieusement plutôt que de renvoyer une erreur 500 sur tout le dossier.
export function decryptAntecedents(encrypted: string | null): Antecedents | null {
  if (!encrypted) return null;
  try {
    return JSON.parse(decrypt(encrypted));
  } catch {
    return null;
  }
}

// Dédoublonnage volontairement permissif: même nom+prénom+date de naissance,
// ou même téléphone — ce sont des indices, pas une certitude (deux vrais
// jumeaux existent). Le créateur reste décisionnaire via `force`, on ne
// bloque jamais silencieusement une création légitime.
export async function findPotentialDuplicates(organizationId: string, input: Pick<CreatePatientInput, "firstName" | "lastName" | "dateNaissance" | "phone">) {
  return prisma.patient.findMany({
    where: {
      organizationId,
      OR: [
        { firstName: { equals: input.firstName, mode: "insensitive" }, lastName: { equals: input.lastName, mode: "insensitive" }, dateNaissance: input.dateNaissance },
        ...(input.phone ? [{ phone: input.phone }] : []),
      ],
    },
    select: { id: true, patientNumber: true, firstName: true, lastName: true, dateNaissance: true, phone: true },
  });
}

export async function createPatient(organizationId: string, input: CreatePatientInput) {
  const patientNumber = `PAT-${Date.now()}`;
  const { force, antecedents, ...data } = input;
  void force; // déjà consommé par l'appelant pour décider s'il fallait vérifier les doublons

  return prisma.patient.create({
    data: { organizationId, patientNumber, ...data, antecedents: encryptAntecedents(antecedents) },
  });
}

// Journalise l'avant/après dans AuditLog — c'est l'historique de
// modification du dossier: aucune table dédiée, la source de vérité reste
// le journal d'audit immuable déjà utilisé pour toute action sensible.
// Les antécédents (PHI chiffrée) ne sont jamais journalisés en clair —
// seul le fait qu'ils ont changé est noté.
export async function updatePatient(organizationId: string, patientId: string, input: UpdatePatientInput) {
  const before = await prisma.patient.findFirst({ where: { id: patientId, organizationId } });
  if (!before) throw new NotFoundError("Patient introuvable");

  const { antecedents, ...rest } = input;

  const changed: Record<string, { avant: unknown; apres: unknown }> = {};
  for (const [key, value] of Object.entries(rest)) {
    const beforeValue = (before as unknown as Record<string, unknown>)[key];
    if (value !== undefined && JSON.stringify(beforeValue) !== JSON.stringify(value)) {
      changed[key] = { avant: beforeValue, apres: value };
    }
  }
  if (antecedents !== undefined) {
    changed.antecedents = { avant: "[chiffré]", apres: "[modifié]" };
  }

  const updated = await prisma.patient.update({
    where: { id: patientId },
    data: { ...rest, antecedents: antecedents !== undefined ? encryptAntecedents(antecedents) : undefined },
  });

  return { updated, changed };
}
