import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/auth";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import { ForbiddenError } from "@/lib/rbac";
import { getMobileMoneyProvider } from "@/lib/integrations/mobile-money";
import type { CreatePaymentInput, CloseCashSessionInput } from "@/lib/validations/caisse";

// Débloque les consultations verrouillées (EN_ATTENTE_CAISSE) rattachées à
// une facture désormais soldée. Partagé entre la validation aveugle par un
// second utilisateur et la confirmation automatique par un fournisseur
// Mobile Money (voir confirmMobileMoneyPayment ci-dessous).
async function unlockConsultationsIfInvoicePaid(tx: Prisma.TransactionClient, invoiceId: string, paymentId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
  if (invoice.status !== "PAYEE") return;

  const consultationIds = [...new Set(invoice.items.map((item) => item.consultationId).filter((id): id is string => !!id))];
  if (consultationIds.length === 0) return;

  await tx.consultation.updateMany({
    where: { id: { in: consultationIds }, status: "EN_ATTENTE_CAISSE" },
    data: { status: "EN_COURS", unlockedByPaymentId: paymentId, unlockedAt: new Date(), startedAt: new Date() },
  });
}

export async function registerPayment(params: {
  organizationId: string;
  cashierId: string;
  input: CreatePaymentInput;
}) {
  const { organizationId, cashierId, input } = params;

  const [invoice, cashSession] = await Promise.all([
    prisma.invoice.findFirst({ where: { id: input.invoiceId, organizationId } }),
    prisma.cashSession.findFirst({ where: { id: input.cashSessionId, organizationId } }),
  ]);
  if (!invoice) throw new NotFoundError("Facture introuvable");
  if (!cashSession) throw new NotFoundError("Session de caisse introuvable");
  if (cashSession.status !== "OUVERTE") throw new ConflictError("La session de caisse est clôturée");
  if (cashSession.cashierId !== cashierId) throw new ForbiddenError("Cette session de caisse appartient à un autre caissier");
  if (invoice.status === "PAYEE") throw new ConflictError("Facture déjà soldée");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        cashSessionId: cashSession.id,
        mode: input.mode,
        montant: input.montant,
        reference: input.reference,
        cashierId,
      },
    });

    const montantPaye = new Decimal(invoice.montantPaye).plus(input.montant);
    const isFullyPaid = montantPaye.greaterThanOrEqualTo(invoice.montantPartPatient);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        montantPaye: montantPaye.toString(),
        status: isFullyPaid ? "PAYEE" : "PARTIELLEMENT_PAYEE",
      },
    });

    return payment;
  });
}

// Cœur du dispositif anti-fraude: un second utilisateur habilité (jamais le
// caissier qui a encaissé) confirme le paiement via son propre PIN. Ce n'est
// qu'à cet instant que les consultations liées à la facture sont débloquées
// côté médecin — l'écran du médecin reste verrouillé tant que ce n'est pas fait.
export async function validatePaymentBlind(params: {
  organizationId: string;
  paymentId: string;
  validatorId: string;
  pin: string;
}) {
  const { organizationId, paymentId, validatorId, pin } = params;

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, organizationId },
    include: { invoice: { include: { items: true } } },
  });
  if (!payment) throw new NotFoundError("Paiement introuvable");
  if (payment.validatedById) throw new ConflictError("Paiement déjà validé");
  if (payment.cashierId === validatorId) {
    throw new ForbiddenError("La validation doit être effectuée par un second utilisateur habilité, distinct du caissier");
  }

  const validator = await prisma.user.findFirst({ where: { id: validatorId, organizationId } });
  if (!validator?.pinHash) throw new ConflictError("Aucun PIN de caisse configuré pour cet utilisateur");
  if (!(await verifyPin(validator.pinHash, pin))) {
    throw new ForbiddenError("PIN invalide");
  }

  return prisma.$transaction(async (tx) => {
    const validated = await tx.payment.update({
      where: { id: payment.id },
      data: { validatedById: validatorId, validatedAt: new Date() },
    });

    await unlockConsultationsIfInvoicePaid(tx, payment.invoiceId, validated.id);

    return validated;
  });
}

// Initie un paiement Mobile Money auprès du fournisseur (MTN, Orange, Wave)
// puis l'enregistre comme paiement en attente — la confirmation effective
// arrive de façon asynchrone via le webhook fournisseur.
export async function initiateMobileMoneyPayment(params: {
  organizationId: string;
  cashierId: string;
  input: CreatePaymentInput & { phoneNumber: string };
}) {
  const { organizationId, cashierId, input } = params;

  if (input.mode === "ESPECES" || input.mode === "CARTE" || input.mode === "VIREMENT") {
    throw new ConflictError("Mode de paiement non éligible à l'initiation Mobile Money");
  }

  const provider = getMobileMoneyProvider(input.mode);
  const result = await provider.initiatePayment({
    amount: input.montant,
    currency: "XAF",
    phoneNumber: input.phoneNumber,
    reference: input.invoiceId,
  });

  if (result.status === "FAILED") {
    throw new ConflictError("L'initiation du paiement Mobile Money a échoué auprès du fournisseur");
  }

  return registerPayment({
    organizationId,
    cashierId,
    input: { ...input, reference: result.providerReference },
  });
}

// Confirmation asynchrone reçue du fournisseur Mobile Money (webhook). Le
// fournisseur fait ici office de tiers de confiance : à la différence de la
// validation aveugle par un second employé, aucun PIN n'est requis — la
// preuve de paiement vient de l'opérateur télécom lui-même.
export async function confirmMobileMoneyPayment(params: { providerReference: string; success: boolean }) {
  // La référence provient du fournisseur (transactionId retourné à l'initiation)
  // et est unique tous établissements confondus — pas besoin de organizationId
  // pour la retrouver, contrairement aux autres opérations de ce service qui
  // sont toujours scoping par tenant explicitement.
  const payment = await prisma.payment.findFirst({ where: { reference: params.providerReference } });
  if (!payment) throw new NotFoundError("Paiement introuvable pour cette référence fournisseur");
  if (payment.validatedById !== null || payment.validatedAt !== null) {
    return payment; // déjà confirmé, idempotent
  }
  if (!params.success) {
    return payment; // échec fournisseur: le paiement reste non validé, à réconcilier manuellement
  }

  return prisma.$transaction(async (tx) => {
    const validated = await tx.payment.update({
      where: { id: payment.id },
      data: { validatedAt: new Date() },
    });

    await unlockConsultationsIfInvoicePaid(tx, payment.invoiceId, validated.id);

    return validated;
  });
}

export async function closeCashSessionWithPin(params: {
  organizationId: string;
  cashSessionId: string;
  cashierId: string;
  input: CloseCashSessionInput;
}) {
  const { organizationId, cashSessionId, cashierId, input } = params;

  const cashSession = await prisma.cashSession.findFirst({ where: { id: cashSessionId, organizationId } });
  if (!cashSession) throw new NotFoundError("Session de caisse introuvable");
  if (cashSession.status !== "OUVERTE") throw new ConflictError("Session déjà clôturée");
  if (cashSession.cashierId !== cashierId) throw new ForbiddenError("Seul le titulaire de la session (ou un administrateur) peut la clôturer");

  const cashier = await prisma.user.findFirst({ where: { id: cashierId, organizationId } });
  if (!cashier?.pinHash) throw new ConflictError("Aucun PIN de caisse configuré pour cet utilisateur");
  if (!(await verifyPin(cashier.pinHash, input.pin))) {
    throw new ForbiddenError("PIN invalide");
  }

  const cashPayments = await prisma.payment.aggregate({
    where: { cashSessionId, mode: "ESPECES" },
    _sum: { montant: true },
  });

  const montantClotureTheorique = new Decimal(cashSession.montantOuverture).plus(cashPayments._sum.montant ?? 0);
  const ecart = new Decimal(input.montantClotureReel).minus(montantClotureTheorique);

  return prisma.cashSession.update({
    where: { id: cashSessionId },
    data: {
      status: "CLOTUREE",
      montantClotureTheorique: montantClotureTheorique.toString(),
      montantClotureReel: input.montantClotureReel,
      ecart: ecart.toString(),
      pinVerifiedAt: new Date(),
      closedAt: new Date(),
    },
  });
}
