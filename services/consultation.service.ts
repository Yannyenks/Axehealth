import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import { splitInvoiceAmount } from "@/services/insurance.service";
import type { CreateConsultationInput } from "@/lib/validations/consultation";

// Une consultation payante démarre verrouillée (EN_ATTENTE_CAISSE) et génère
// dans le même mouvement la facture qui la débloquera: c'est cette facture
// que le caissier encaisse puis qu'un second utilisateur valide (voir
// services/caisse.service.ts) pour faire passer la consultation en EN_COURS.
export async function createConsultationWithInvoice(organizationId: string, createdById: string, input: CreateConsultationInput) {
  const patient = await prisma.patient.findFirst({ where: { id: input.patientId, organizationId } });
  if (!patient) throw new NotFoundError("Patient introuvable");

  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.create({
      data: {
        organizationId,
        patientId: input.patientId,
        medecinId: input.medecinId,
        appointmentId: input.appointmentId,
        motif: input.motif,
        status: input.isPayant ? "EN_ATTENTE_CAISSE" : "EN_COURS",
        startedAt: input.isPayant ? undefined : new Date(),
      },
    });

    if (input.isPayant && input.montant) {
      const { montantPartPatient, montantPartAssurance, insuranceProviderId } = await splitInvoiceAmount(patient, input.montant);

      await tx.invoice.create({
        data: {
          organizationId,
          patientId: input.patientId,
          numero: `CS-${Date.now()}`,
          status: "EN_ATTENTE_PAIEMENT",
          montantTotal: input.montant,
          montantPartPatient,
          montantPartAssurance,
          insuranceProviderId,
          createdById,
          items: {
            create: [
              {
                consultationId: consultation.id,
                pole: "Consultation",
                libelle: input.motif ?? "Consultation médicale",
                quantite: 1,
                prixUnitaire: input.montant,
                montant: input.montant,
              },
            ],
          },
        },
      });
    }

    return consultation;
  });
}
