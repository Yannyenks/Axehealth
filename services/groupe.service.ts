import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { getSatisfactionStats } from "@/services/satisfaction.service";

export interface GroupeComparatifEntry {
  organizationId: string;
  nom: string;
  patients: number;
  consultations: number;
  caEncaisse: string;
  tauxOccupationLits: number;
  nps: number | null;
}

// Une organisation sans groupe n'est pas une erreur (la plupart des
// cliniques sont autonomes) — retourne une liste vide plutôt que de lever
// une exception, pour laisser l'UI afficher un état neutre.
export async function getGroupeComparatif(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<{ groupe: { id: string; nom: string } | null; organisations: GroupeComparatifEntry[] }> {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { groupId: true } });
  if (!organization?.groupId) {
    return { groupe: null, organisations: [] };
  }

  const [groupe, siblings] = await Promise.all([
    prisma.organizationGroup.findUnique({ where: { id: organization.groupId }, select: { id: true, name: true } }),
    prisma.organization.findMany({ where: { groupId: organization.groupId }, select: { id: true, name: true } }),
  ]);
  if (!groupe) {
    return { groupe: null, organisations: [] };
  }

  const organisations = await Promise.all(
    siblings.map(async (org): Promise<GroupeComparatifEntry> => {
      const [patients, consultations, payments, beds, satisfaction] = await Promise.all([
        prisma.patient.count({ where: { organizationId: org.id } }),
        prisma.consultation.count({ where: { organizationId: org.id, status: "TERMINEE", endedAt: { gte: from, lt: to } } }),
        prisma.payment.findMany({ where: { organizationId: org.id, validatedAt: { gte: from, lt: to } }, select: { montant: true } }),
        prisma.bed.findMany({ where: { organizationId: org.id }, select: { status: true } }),
        getSatisfactionStats(org.id, from, to),
      ]);

      const caEncaisse = payments.reduce((sum, p) => sum.plus(p.montant), new Decimal(0));
      const litsOccupes = beds.filter((b) => b.status === "OCCUPE").length;
      const tauxOccupationLits = beds.length > 0 ? Number(((litsOccupes / beds.length) * 100).toFixed(1)) : 0;

      return {
        organizationId: org.id,
        nom: org.name,
        patients,
        consultations,
        caEncaisse: caEncaisse.toString(),
        tauxOccupationLits,
        nps: satisfaction.nps,
      };
    }),
  );

  return { groupe: { id: groupe.id, nom: groupe.name }, organisations };
}
