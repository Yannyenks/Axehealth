import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";

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
