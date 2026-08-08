import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { getExpiryAlerts, getReorderAlerts } from "@/services/pharmacie.service";

// Bornes de journée calculées en UTC de bout en bout — les clés de
// regroupement du graphique (toISOString().slice(0, 10)) sont elles-mêmes en
// UTC ; mélanger un découpage en heure locale avec des clés UTC décale le
// dernier jour dès que le fuseau serveur n'est pas UTC+0.
function dayRange(daysAgo: number): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo + 1));
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  return { from, to };
}

// Variation en % entre deux valeurs — null si la base de comparaison est
// nulle (rien à diviser), pour ne jamais afficher un delta inventé.
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function computeKpis(organizationId: string, from: Date, to: Date) {
  const [invoicesInPeriod, paymentsValidated, itemsByPole, beds, claimsEnCours] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId, createdAt: { gte: from, lt: to } },
      select: { montantTotal: true },
    }),
    prisma.payment.findMany({
      where: { organizationId, validatedAt: { gte: from, lt: to } },
      select: { montant: true },
    }),
    prisma.invoiceItem.findMany({
      where: { invoice: { organizationId, createdAt: { gte: from, lt: to } } },
      select: { pole: true, montant: true },
    }),
    prisma.bed.findMany({ where: { organizationId }, select: { status: true } }),
    prisma.insuranceClaim.findMany({
      where: { organizationId, status: { in: ["EN_PREPARATION", "TRANSMIS"] } },
      select: { montant: true },
    }),
  ]);

  const caFacture = invoicesInPeriod.reduce((sum, i) => sum.plus(i.montantTotal), new Decimal(0));
  const caEncaisse = paymentsValidated.reduce((sum, p) => sum.plus(p.montant), new Decimal(0));

  const caParPole: Record<string, string> = {};
  for (const item of itemsByPole) {
    const current = new Decimal(caParPole[item.pole] ?? 0);
    caParPole[item.pole] = current.plus(item.montant).toString();
  }

  const litsOccupes = beds.filter((b) => b.status === "OCCUPE").length;
  const tauxOccupationLits = beds.length > 0 ? Number(((litsOccupes / beds.length) * 100).toFixed(1)) : 0;

  const creancesAssurances = claimsEnCours.reduce((sum, c) => sum.plus(c.montant), new Decimal(0));

  return {
    periode: { from, to },
    caFacture: caFacture.toString(),
    caEncaisse: caEncaisse.toString(),
    caParPole,
    occupationLits: { total: beds.length, occupes: litsOccupes, tauxPourcent: tauxOccupationLits },
    creancesAssurances: creancesAssurances.toString(),
  };
}

// Agrégats de type RMA/SNIS: activité par nature d'acte sur la période, base
// pour la déclaration statistique réglementaire. La nomenclature exacte des
// champs RMA/SNIS varie selon le pays/l'autorité sanitaire — cette sortie
// fournit les compteurs bruts à mapper vers le formulaire officiel local.
export async function getActivityReport(organizationId: string, from: Date, to: Date) {
  const [totalConsultations, consultationsParDiagnostic, totalHospitalisations, labRequestsParType] = await Promise.all([
    prisma.consultation.count({ where: { organizationId, createdAt: { gte: from, lt: to }, status: "TERMINEE" } }),
    prisma.consultation.groupBy({
      by: ["diagnosticCim"],
      where: { organizationId, createdAt: { gte: from, lt: to }, status: "TERMINEE", diagnosticCim: { not: null } },
      _count: { _all: true },
    }),
    prisma.hospitalization.count({ where: { organizationId, admittedAt: { gte: from, lt: to } } }),
    prisma.labRequest.groupBy({
      by: ["type"],
      where: { consultation: { organizationId }, createdAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
  ]);

  return {
    periode: { from, to },
    totalConsultations,
    consultationsParDiagnostic: consultationsParDiagnostic.map((c) => ({ cim: c.diagnosticCim, count: c._count._all })),
    totalHospitalisations,
    examensParType: labRequestsParType.map((l) => ({ type: l.type, count: l._count._all })),
  };
}

// Série des recettes par pôle sur `days` jours — utilisée par le graphique
// dédié (filtre de période 7/30/90j indépendant du reste du dashboard, voir
// GET /api/dashboards/revenue-series).
export async function getRevenueSeries(organizationId: string, days: 7 | 30 | 90) {
  const startDate = dayRange(days - 1).from;

  const revenueItems = await prisma.invoiceItem.findMany({
    where: { invoice: { organizationId, createdAt: { gte: startDate } } },
    select: { pole: true, montant: true, invoice: { select: { createdAt: true } } },
  });

  const dayBuckets: { date: string; values: Record<string, Decimal> }[] = Array.from({ length: days }, (_, i) => {
    const d = dayRange(days - 1 - i).from;
    return { date: d.toISOString().slice(0, 10), values: {} };
  });
  const poles = new Set<string>();
  for (const item of revenueItems) {
    const dateKey = item.invoice.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.find((b) => b.date === dateKey);
    if (!bucket) continue;
    poles.add(item.pole);
    bucket.values[item.pole] = (bucket.values[item.pole] ?? new Decimal(0)).plus(item.montant);
  }

  return {
    revenueSeries: dayBuckets.map((b) => ({
      date: b.date,
      ...Object.fromEntries([...poles].map((pole) => [pole, (b.values[pole] ?? new Decimal(0)).toString()])),
    })),
    poles: [...poles],
  };
}

// Vue d'ensemble du tableau de bord direction: chaque delta n'est calculé
// que lorsqu'une vraie base de comparaison existe (jour précédent) — pas de
// tendance inventée pour les métriques sans historique exploitable
// (occupation des lits, créances) : elles s'affichent en valeur brute.
export async function getDashboardOverview(organizationId: string) {
  const today = dayRange(0);
  const yesterday = dayRange(1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [invoicesToday, invoicesYesterday, consultationsToday, consultationsYesterday, beds, rooms, claimsEnCours, payments] = await Promise.all([
    prisma.invoice.findMany({ where: { organizationId, createdAt: { gte: today.from, lt: today.to } }, select: { montantTotal: true } }),
    prisma.invoice.findMany({ where: { organizationId, createdAt: { gte: yesterday.from, lt: yesterday.to } }, select: { montantTotal: true } }),
    prisma.consultation.count({ where: { organizationId, status: "TERMINEE", endedAt: { gte: today.from, lt: today.to } } }),
    prisma.consultation.count({ where: { organizationId, status: "TERMINEE", endedAt: { gte: yesterday.from, lt: yesterday.to } } }),
    prisma.bed.findMany({ where: { organizationId }, select: { status: true } }),
    prisma.room.findMany({
      where: { organizationId },
      include: { department: { select: { name: true } }, beds: { select: { status: true } } },
    }),
    prisma.insuranceClaim.findMany({ where: { organizationId, status: { in: ["EN_PREPARATION", "TRANSMIS"] } }, select: { montant: true } }),
    prisma.payment.findMany({
      where: { organizationId, validatedAt: { gte: thirtyDaysAgo } },
      select: { mode: true, montant: true },
    }),
  ]);

  const caFactureToday = invoicesToday.reduce((sum, i) => sum.plus(i.montantTotal), new Decimal(0));
  const caFactureYesterday = invoicesYesterday.reduce((sum, i) => sum.plus(i.montantTotal), new Decimal(0));

  const litsOccupes = beds.filter((b) => b.status === "OCCUPE").length;
  const tauxOccupationLits = beds.length > 0 ? Number(((litsOccupes / beds.length) * 100).toFixed(1)) : 0;

  const creancesAssurances = claimsEnCours.reduce((sum, c) => sum.plus(c.montant), new Decimal(0));

  const paymentTotal = payments.reduce((sum, p) => sum.plus(p.montant), new Decimal(0));
  const paymentByMode = new Map<string, Decimal>();
  for (const p of payments) {
    paymentByMode.set(p.mode, (paymentByMode.get(p.mode) ?? new Decimal(0)).plus(p.montant));
  }
  const paymentBreakdown = [...paymentByMode.entries()].map(([mode, montant]) => ({
    mode,
    montant: montant.toString(),
    pourcent: paymentTotal.isZero() ? 0 : Number(montant.div(paymentTotal).mul(100).toFixed(1)),
  }));

  const deptMap = new Map<string, { occupes: number; total: number }>();
  for (const room of rooms) {
    const key = room.department?.name ?? "Non affecté";
    const entry = deptMap.get(key) ?? { occupes: 0, total: 0 };
    entry.total += room.beds.length;
    entry.occupes += room.beds.filter((b) => b.status === "OCCUPE").length;
    deptMap.set(key, entry);
  }
  const occupationParService = [...deptMap.entries()].map(([service, v]) => ({ service, ...v }));

  const [peremption, reappro] = await Promise.all([getExpiryAlerts(organizationId, 30), getReorderAlerts(organizationId)]);
  const alertes = [
    ...peremption.slice(0, 3).map((lot) => ({
      type: "PEREMPTION" as const,
      label: `Péremption imminente (FEFO)`,
      detail: `${lot.stockItem.nom} — lot ${lot.numeroLot}, ${lot.quantite} unités le ${lot.datePeremption.toLocaleDateString("fr-FR")}`,
    })),
    ...reappro.slice(0, 2).map((item) => ({
      type: "REAPPRO" as const,
      label: "Seuil de réapprovisionnement atteint",
      detail: `${item.nom} — ${item.quantiteDisponible} restants (seuil ${item.seuilReappro})`,
    })),
  ];

  return {
    statTiles: {
      caFactureToday: caFactureToday.toString(),
      caFactureTodayDeltaPct: pctChange(caFactureToday.toNumber(), caFactureYesterday.toNumber()),
      consultationsToday,
      consultationsTodayDeltaPct: pctChange(consultationsToday, consultationsYesterday),
      occupationLits: { total: beds.length, occupes: litsOccupes, tauxPourcent: tauxOccupationLits },
      creancesAssurances: creancesAssurances.toString(),
    },
    paymentBreakdown,
    occupationParService,
    alertes,
  };
}
