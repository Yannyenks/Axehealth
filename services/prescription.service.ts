import type { Patient, Prescription, PrescriptionItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Alerte non exhaustive et non substituable à une base pharmacologique
// certifiée (type Vidal/Thériaque) — signale uniquement des cas simples et
// vérifiables à partir des données déjà en base: allergie déclarée du
// patient, ou répétition d'une même molécule récemment prescrite.
export async function checkInteractionAlert(
  patient: Pick<Patient, "id" | "allergies">,
  item: { denomination: string },
): Promise<string | null> {
  const normalized = item.denomination.trim().toLowerCase();

  const allergyMatch = patient.allergies.find((allergie) => normalized.includes(allergie.trim().toLowerCase()));
  if (allergyMatch) {
    return `Allergie déclarée par le patient: ${allergyMatch}`;
  }

  const recentSamePrescription = await prisma.prescriptionItem.findFirst({
    where: {
      prescription: { patientId: patient.id },
      denomination: { equals: item.denomination, mode: "insensitive" },
    },
    orderBy: { id: "desc" },
  });
  if (recentSamePrescription) {
    return `Déjà prescrit récemment pour ce patient: ${item.denomination} — vérifier la posologie cumulée`;
  }

  return null;
}

export async function createPrescriptionWithAlerts(params: {
  consultationId: string;
  patientId: string;
  prescripteurId: string;
  items: { stockItemId?: string; denomination: string; posologie: string; duree?: string; quantite: number }[];
}): Promise<Prescription & { items: PrescriptionItem[] }> {
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: params.patientId },
    select: { id: true, allergies: true },
  });

  const itemsWithAlerts = await Promise.all(
    params.items.map(async (item) => ({
      ...item,
      interactionAlert: await checkInteractionAlert(patient, item),
    })),
  );

  return prisma.prescription.create({
    data: {
      consultationId: params.consultationId,
      patientId: params.patientId,
      prescripteurId: params.prescripteurId,
      items: { create: itemsWithAlerts },
    },
    include: { items: true },
  });
}
