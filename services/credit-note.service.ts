import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import type { CreateCreditNoteInput } from "@/lib/validations/credit-note";

// Un avoir réduit la part patient restant due — jamais la part assurance,
// qui suit son propre cycle de bordereau (voir insurance.service.ts) et ne
// doit pas être ajustée unilatéralement côté caisse. Le montant ne peut pas
// dépasser la part patient totale de la facture: au-delà, ce n'est plus un
// avoir mais une facture à annuler entièrement.
export async function issueCreditNote(organizationId: string, createdById: string, input: CreateCreditNoteInput) {
  const invoice = await prisma.invoice.findFirst({ where: { id: input.invoiceId, organizationId } });
  if (!invoice) throw new NotFoundError("Facture introuvable");
  if (invoice.status === "ANNULEE") throw new ConflictError("Cette facture est annulée");

  const montant = new Decimal(input.montant);
  if (montant.greaterThan(invoice.montantPartPatient)) {
    throw new ConflictError("Le montant de l'avoir ne peut pas dépasser la part patient de la facture");
  }

  return prisma.$transaction(async (tx) => {
    const creditNote = await tx.creditNote.create({
      data: { organizationId, invoiceId: invoice.id, createdById, montant, motif: input.motif, note: input.note },
    });

    const nouvelleMontantPartPatient = invoice.montantPartPatient.minus(montant);
    const status = nouvelleMontantPartPatient.lessThanOrEqualTo(invoice.montantPaye)
      ? "PAYEE"
      : invoice.montantPaye.greaterThan(0)
        ? "PARTIELLEMENT_PAYEE"
        : "EN_ATTENTE_PAIEMENT";

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { montantPartPatient: nouvelleMontantPartPatient, status },
    });

    return creditNote;
  });
}

export async function listCreditNotesForInvoice(organizationId: string, invoiceId: string) {
  return prisma.creditNote.findMany({
    where: { organizationId, invoiceId },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
}
