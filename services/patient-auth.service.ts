import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/api-error";
import { hashPassword } from "@/lib/auth";
import type { PatientSignupInput } from "@/lib/validations/patient-auth";

export async function resolveActiveOrganizationBySlug(slug: string) {
  const organization = await prisma.organization.findUnique({ where: { slug } });
  if (!organization || !organization.isActive) throw new NotFoundError("Établissement introuvable");
  return organization;
}

// Décision d'attache-ou-création volontairement stricte: contrairement au
// dédoublonnage côté staff (services/patient.service.ts::findPotentialDuplicates,
// permissif car décidé par un humain), un rattachement automatique en
// self-service ne peut se faire que si TOUT correspond exactement
// (organisation + nom + prénom + date de naissance + email) ET que la fiche
// n'a encore jamais été activée pour l'auto-connexion (passwordHash null).
// Un simple nom+date de naissance ne suffit jamais: n'importe qui connaissant
// ces deux informations pourrait sinon revendiquer le DPI d'un tiers et lire
// sa PHI. Tout autre chevauchement crée une nouvelle fiche plutôt que de
// fusionner silencieusement — un doublon administratif se corrige à
// l'accueil, une fuite de PHI ne se corrige pas.
export async function signupPatient(input: PatientSignupInput) {
  const organization = await resolveActiveOrganizationBySlug(input.organizationSlug);

  const existing = await prisma.patient.findFirst({
    where: {
      organizationId: organization.id,
      firstName: { equals: input.firstName, mode: "insensitive" },
      lastName: { equals: input.lastName, mode: "insensitive" },
      dateNaissance: input.dateNaissance,
      email: { equals: input.email, mode: "insensitive" },
    },
  });

  if (existing) {
    if (existing.passwordHash) {
      throw new ConflictError("Un compte existe déjà pour cette adresse email dans cet établissement");
    }
    return prisma.patient.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(input.password) },
    });
  }

  const patientNumber = `PAT-${Date.now()}`;
  return prisma.patient.create({
    data: {
      organizationId: organization.id,
      patientNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      sexe: input.sexe,
      dateNaissance: input.dateNaissance,
      phone: input.phone,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    },
  });
}
