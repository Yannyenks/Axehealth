import { Decimal } from "@prisma/client/runtime/library";
import type { Patient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import type { CreateProviderInput } from "@/lib/validations/insurance";

export async function createProvider(organizationId: string, input: CreateProviderInput) {
  return prisma.insuranceProvider.create({ data: { organizationId, ...input } });
}

export async function listProviders(organizationId: string) {
  return prisma.insuranceProvider.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
}

// Répartit un montant facturable entre part patient et part assurance selon
// le taux du patient (négocié individuellement) ou, à défaut, le taux par
// défaut du prestataire assigné. Un patient sans assurance renseignée
// reste à 100% à sa charge — jamais de taux inventé.
export async function splitInvoiceAmount(
  patient: Pick<Patient, "insuranceProviderId" | "tiersPayantRate">,
  montantTotal: number,
): Promise<{ montantPartPatient: Decimal; montantPartAssurance: Decimal; insuranceProviderId: string | null }> {
  const total = new Decimal(montantTotal);

  if (!patient.insuranceProviderId) {
    return { montantPartPatient: total, montantPartAssurance: new Decimal(0), insuranceProviderId: null };
  }

  const provider = await prisma.insuranceProvider.findUniqueOrThrow({ where: { id: patient.insuranceProviderId } });
  const rate = patient.tiersPayantRate ?? provider.tauxPriseEnCharge;

  const montantPartAssurance = total.mul(rate).div(100).toDecimalPlaces(2);
  const montantPartPatient = total.minus(montantPartAssurance);

  return { montantPartPatient, montantPartAssurance, insuranceProviderId: patient.insuranceProviderId };
}

// Bordereau de transmission: une facture ne peut générer qu'un seul
// dossier assurance (contrainte unique invoiceId), et seulement si elle
// porte effectivement une part assurance à réclamer.
export async function createClaimForInvoice(organizationId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } });
  if (!invoice) throw new NotFoundError("Facture introuvable");
  if (!invoice.insuranceProviderId) throw new ConflictError("Cette facture n'est pas liée à une assurance");
  if (invoice.montantPartAssurance.isZero()) throw new ConflictError("Aucune part assurance à réclamer sur cette facture");

  const existing = await prisma.insuranceClaim.findUnique({ where: { invoiceId } });
  if (existing) throw new ConflictError("Un dossier assurance existe déjà pour cette facture");

  return prisma.insuranceClaim.create({
    data: {
      organizationId,
      invoiceId,
      insuranceProviderId: invoice.insuranceProviderId,
      montant: invoice.montantPartAssurance,
      numeroBordereau: `BDX-${Date.now()}`,
    },
  });
}

export async function listClaims(organizationId: string, status?: string) {
  return prisma.insuranceClaim.findMany({
    where: { organizationId, status: status as never },
    include: {
      insuranceProvider: { select: { name: true } },
      invoice: { select: { numero: true, patient: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function updateClaimStatus(organizationId: string, claimId: string, status: "TRANSMIS" | "ACCEPTE" | "REJETE" | "PAYE") {
  const claim = await prisma.insuranceClaim.findFirst({ where: { id: claimId, organizationId } });
  if (!claim) throw new NotFoundError("Dossier assurance introuvable");

  return prisma.insuranceClaim.update({
    where: { id: claimId },
    data: {
      status,
      transmisAt: status === "TRANSMIS" ? new Date() : claim.transmisAt,
      reponduAt: ["ACCEPTE", "REJETE", "PAYE"].includes(status) ? new Date() : claim.reponduAt,
    },
  });
}
