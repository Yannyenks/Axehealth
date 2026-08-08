import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import type { ComputePayrollInput, CreateShiftInput } from "@/lib/validations/rh";

export async function createShift(organizationId: string, input: CreateShiftInput) {
  const user = await prisma.user.findFirst({ where: { id: input.userId, organizationId } });
  if (!user) throw new NotFoundError("Employé introuvable");

  return prisma.shift.create({ data: { organizationId, ...input } });
}

export async function getPlanning(organizationId: string, from: Date, to: Date) {
  return prisma.shift.findMany({
    where: { organizationId, startAt: { gte: from }, endAt: { lte: to } },
    include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { startAt: "asc" },
  });
}

function periodRange(periode: string): { from: Date; to: Date } {
  const [year, month] = periode.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from, to };
}

// Salaire fixe: cotisations salariales déduites du brut selon un taux
// configurable (voir lib/validations/rh.ts). Rétrocession: pourcentage
// appliqué au chiffre d'affaires des consultations réalisées par le
// praticien vacataire sur la période, tel que facturé (pôle "Consultation").
export async function computePayroll(organizationId: string, input: ComputePayrollInput) {
  const user = await prisma.user.findFirst({ where: { id: input.userId, organizationId } });
  if (!user) throw new NotFoundError("Employé introuvable");

  const existing = await prisma.payroll.findFirst({
    where: { organizationId, userId: input.userId, periode: input.periode, type: input.type },
  });
  if (existing) throw new ConflictError("Une paie existe déjà pour cet employé sur cette période");

  if (input.type === "SALAIRE_FIXE") {
    const salaireBrut = new Decimal(input.salaireBrut);
    const cotisationsCnps = salaireBrut.mul(input.tauxCotisationCnps).div(100);
    const netAPayer = salaireBrut.minus(cotisationsCnps);

    return prisma.payroll.create({
      data: {
        organizationId,
        userId: input.userId,
        periode: input.periode,
        type: "SALAIRE_FIXE",
        salaireBrut,
        cotisationsCnps,
        netAPayer,
      },
    });
  }

  const { from, to } = periodRange(input.periode);

  const items = await prisma.invoiceItem.findMany({
    where: {
      pole: "Consultation",
      consultation: { medecinId: input.userId, organizationId },
      invoice: { createdAt: { gte: from, lt: to } },
    },
    select: { montant: true },
  });

  const chiffreAffaires = items.reduce((sum, item) => sum.plus(item.montant), new Decimal(0));
  const retrocessionMontant = chiffreAffaires.mul(input.retrocessionTaux).div(100);

  return prisma.payroll.create({
    data: {
      organizationId,
      userId: input.userId,
      periode: input.periode,
      type: "RETROCESSION",
      retrocessionTaux: input.retrocessionTaux,
      retrocessionMontant,
      netAPayer: retrocessionMontant,
    },
  });
}

export async function updatePayrollStatus(organizationId: string, payrollId: string, status: "VALIDE" | "PAYE") {
  const payroll = await prisma.payroll.findFirst({ where: { id: payrollId, organizationId } });
  if (!payroll) throw new NotFoundError("Fiche de paie introuvable");
  if (payroll.status === "PAYE") throw new ConflictError("Cette paie a déjà été payée");

  return prisma.payroll.update({ where: { id: payrollId }, data: { status } });
}
