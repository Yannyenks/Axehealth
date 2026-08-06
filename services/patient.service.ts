import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import type { CreatePatientInput, UpdatePatientInput } from "@/lib/validations/patient";

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
  const { force, ...data } = input;
  void force; // déjà consommé par l'appelant pour décider s'il fallait vérifier les doublons

  return prisma.patient.create({ data: { organizationId, patientNumber, ...data } });
}

// Journalise l'avant/après dans AuditLog — c'est l'historique de
// modification du dossier: aucune table dédiée, la source de vérité reste
// le journal d'audit immuable déjà utilisé pour toute action sensible.
export async function updatePatient(organizationId: string, patientId: string, input: UpdatePatientInput) {
  const before = await prisma.patient.findFirst({ where: { id: patientId, organizationId } });
  if (!before) throw new NotFoundError("Patient introuvable");

  const changed: Record<string, { avant: unknown; apres: unknown }> = {};
  for (const [key, value] of Object.entries(input)) {
    const beforeValue = (before as unknown as Record<string, unknown>)[key];
    if (value !== undefined && JSON.stringify(beforeValue) !== JSON.stringify(value)) {
      changed[key] = { avant: beforeValue, apres: value };
    }
  }

  const updated = await prisma.patient.update({ where: { id: patientId }, data: input });

  return { updated, changed };
}
