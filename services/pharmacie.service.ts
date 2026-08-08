import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import { splitInvoiceAmount } from "@/services/insurance.service";
import type { SellCounterInput } from "@/lib/validations/pharmacie";

type TxClient = Prisma.TransactionClient;

// FEFO (First Expired, First Out): consomme en priorité les lots dont la
// date de péremption est la plus proche. Lève ConflictError si le stock
// cumulé sur tous les lots est insuffisant — aucune consommation partielle
// n'est appliquée dans ce cas (tout ou rien, dans la transaction appelante).
async function consumeFefo(
  tx: TxClient,
  params: { organizationId: string; stockItemId: string; quantite: number; type: StockMovementType; createdById: string; motif?: string; site?: string },
): Promise<void> {
  const lots = await tx.stockLot.findMany({
    where: { stockItemId: params.stockItemId, quantite: { gt: 0 }, site: params.site },
    orderBy: { datePeremption: "asc" },
  });

  let remaining = params.quantite;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const taken = Math.min(lot.quantite, remaining);

    await tx.stockLot.update({ where: { id: lot.id }, data: { quantite: lot.quantite - taken } });
    await tx.stockMovement.create({
      data: {
        organizationId: params.organizationId,
        stockItemId: params.stockItemId,
        stockLotId: lot.id,
        type: params.type,
        quantite: -taken,
        motif: params.motif,
        createdById: params.createdById,
      },
    });

    remaining -= taken;
  }

  if (remaining > 0) {
    throw new ConflictError("Stock insuffisant pour honorer cette quantité");
  }
}

export async function receiveStock(params: {
  organizationId: string;
  stockItemId: string;
  numeroLot: string;
  quantite: number;
  datePeremption: Date;
  site: string;
  createdById: string;
}) {
  const stockItem = await prisma.stockItem.findFirst({ where: { id: params.stockItemId, organizationId: params.organizationId } });
  if (!stockItem) throw new NotFoundError("Article introuvable");

  return prisma.$transaction(async (tx) => {
    const lot = await tx.stockLot.create({
      data: {
        stockItemId: params.stockItemId,
        numeroLot: params.numeroLot,
        quantite: params.quantite,
        datePeremption: params.datePeremption,
        site: params.site,
      },
    });

    await tx.stockMovement.create({
      data: {
        organizationId: params.organizationId,
        stockItemId: params.stockItemId,
        stockLotId: lot.id,
        type: "ENTREE",
        quantite: params.quantite,
        createdById: params.createdById,
      },
    });

    return lot;
  });
}

// Transfert inter-sites: consomme en FEFO au site source (jamais de
// prélèvement partiel si le site source n'a pas assez), puis reconstitue un
// lot identique (même numéro de lot et péremption) au site destination —
// fusionné dans un lot existant du même numéro s'il y en a déjà un là-bas.
export async function transferStock(params: {
  organizationId: string;
  stockItemId: string;
  createdById: string;
  siteSource: string;
  siteDestination: string;
  quantite: number;
}) {
  const { organizationId, stockItemId, createdById, siteSource, siteDestination, quantite } = params;

  if (siteSource === siteDestination) throw new ConflictError("Le site source et le site destination doivent être différents");

  const stockItem = await prisma.stockItem.findFirst({ where: { id: stockItemId, organizationId } });
  if (!stockItem) throw new NotFoundError("Article introuvable");

  return prisma.$transaction(async (tx) => {
    const sourceLots = await tx.stockLot.findMany({
      where: { stockItemId, site: siteSource, quantite: { gt: 0 } },
      orderBy: { datePeremption: "asc" },
    });

    let remaining = quantite;
    const transferred: { numeroLot: string; datePeremption: Date; quantite: number }[] = [];

    for (const lot of sourceLots) {
      if (remaining <= 0) break;
      const taken = Math.min(lot.quantite, remaining);

      await tx.stockLot.update({ where: { id: lot.id }, data: { quantite: lot.quantite - taken } });
      await tx.stockMovement.create({
        data: {
          organizationId,
          stockItemId,
          stockLotId: lot.id,
          type: "TRANSFERT",
          quantite: -taken,
          motif: `Transfert vers ${siteDestination}`,
          createdById,
        },
      });

      transferred.push({ numeroLot: lot.numeroLot, datePeremption: lot.datePeremption, quantite: taken });
      remaining -= taken;
    }

    if (remaining > 0) {
      throw new ConflictError(`Stock insuffisant au site "${siteSource}" pour ce transfert`);
    }

    for (const part of transferred) {
      const existingDestLot = await tx.stockLot.findFirst({
        where: { stockItemId, site: siteDestination, numeroLot: part.numeroLot, datePeremption: part.datePeremption },
      });

      const destLot = existingDestLot
        ? await tx.stockLot.update({ where: { id: existingDestLot.id }, data: { quantite: existingDestLot.quantite + part.quantite } })
        : await tx.stockLot.create({
            data: { stockItemId, site: siteDestination, numeroLot: part.numeroLot, datePeremption: part.datePeremption, quantite: part.quantite },
          });

      await tx.stockMovement.create({
        data: {
          organizationId,
          stockItemId,
          stockLotId: destLot.id,
          type: "TRANSFERT",
          quantite: part.quantite,
          motif: `Transfert depuis ${siteSource}`,
          createdById,
        },
      });
    }

    return { quantiteTransferee: quantite, lots: transferred.length };
  });
}

// Vente au comptoir: décrémente le stock en FEFO immédiatement et génère la
// facture correspondante (pôle "Pharmacie"), réglée ensuite via le circuit
// caisse générique (POST /api/caisse/paiements).
export async function sellCounter(params: {
  organizationId: string;
  createdById: string;
  input: SellCounterInput;
}) {
  const { organizationId, createdById, input } = params;

  const [stockItems, patient] = await Promise.all([
    prisma.stockItem.findMany({ where: { organizationId, id: { in: input.items.map((i) => i.stockItemId) } } }),
    prisma.patient.findFirst({ where: { id: input.patientId, organizationId } }),
  ]);
  if (stockItems.length !== input.items.length) {
    throw new NotFoundError("Un ou plusieurs articles sont introuvables");
  }
  if (!patient) throw new NotFoundError("Patient introuvable");

  return prisma.$transaction(async (tx) => {
    let montantTotal = new Decimal(0);
    const invoiceItemsData: { pole: string; libelle: string; quantite: number; prixUnitaire: Decimal; montant: Decimal }[] = [];

    for (const line of input.items) {
      const stockItem = stockItems.find((s) => s.id === line.stockItemId)!;

      await consumeFefo(tx, {
        organizationId,
        stockItemId: stockItem.id,
        quantite: line.quantite,
        type: "SORTIE_VENTE",
        createdById,
        motif: "Vente au comptoir",
      });

      const montant = stockItem.prixVente.mul(line.quantite);
      montantTotal = montantTotal.plus(montant);

      invoiceItemsData.push({ pole: "Pharmacie", libelle: stockItem.nom, quantite: line.quantite, prixUnitaire: stockItem.prixVente, montant });
    }

    const numero = `PH-${Date.now()}`;
    const { montantPartPatient, montantPartAssurance, insuranceProviderId } = await splitInvoiceAmount(patient, montantTotal.toNumber());

    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        patientId: input.patientId,
        numero,
        status: "EN_ATTENTE_PAIEMENT",
        montantTotal,
        montantPartPatient,
        montantPartAssurance,
        insuranceProviderId,
        createdById,
        items: { create: invoiceItemsData },
      },
      include: { items: true },
    });

    return invoice;
  });
}

// Dispensation sur ordonnance interne: décrémente le stock en FEFO et
// horodate la ligne de prescription. Si l'item n'est pas rattaché à un
// article catalogué (denomination libre), aucun mouvement de stock n'est
// généré — seule la dispensation est actée.
export async function dispensePrescriptionItem(params: { organizationId: string; prescriptionItemId: string; userId: string }) {
  const item = await prisma.prescriptionItem.findFirst({
    where: { id: params.prescriptionItemId },
    include: { prescription: { include: { consultation: true } } },
  });
  if (!item || item.prescription.consultation.organizationId !== params.organizationId) {
    throw new NotFoundError("Ligne de prescription introuvable");
  }
  if (item.dispensedAt) throw new ConflictError("Cette ligne a déjà été dispensée");

  return prisma.$transaction(async (tx) => {
    if (item.stockItemId) {
      await consumeFefo(tx, {
        organizationId: params.organizationId,
        stockItemId: item.stockItemId,
        quantite: item.quantite,
        type: "SORTIE_DISPENSATION",
        createdById: params.userId,
        motif: `Dispensation ordonnance ${item.prescriptionId}`,
      });
    }

    return tx.prescriptionItem.update({
      where: { id: item.id },
      data: { dispensedAt: new Date(), dispensedById: params.userId },
    });
  });
}

export async function getExpiryAlerts(organizationId: string, daysThreshold = 30) {
  const limit = new Date();
  limit.setDate(limit.getDate() + daysThreshold);

  return prisma.stockLot.findMany({
    where: {
      quantite: { gt: 0 },
      datePeremption: { lte: limit },
      stockItem: { organizationId },
    },
    include: { stockItem: { select: { nom: true, code: true } } },
    orderBy: { datePeremption: "asc" },
  });
}

export async function getReorderAlerts(organizationId: string) {
  const stockItems = await prisma.stockItem.findMany({
    where: { organizationId },
    include: { lots: { select: { quantite: true } } },
  });

  return stockItems
    .map((item) => ({
      ...item,
      quantiteDisponible: item.lots.reduce((sum, lot) => sum + lot.quantite, 0),
    }))
    .filter((item) => item.quantiteDisponible <= item.seuilReappro);
}
