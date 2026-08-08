import { Decimal } from "@prisma/client/runtime/library";
import type { AlertMetric } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import { getExpiryAlerts, getReorderAlerts } from "@/services/pharmacie.service";
import type { CreateAlertRuleInput } from "@/lib/validations/alert-rule";

export async function createAlertRule(organizationId: string, createdById: string, input: CreateAlertRuleInput) {
  return prisma.alertRule.create({
    data: { organizationId, createdById, ...input },
  });
}

export async function listAlertRules(organizationId: string) {
  return prisma.alertRule.findMany({
    where: { organizationId },
    include: { triggerLogs: { orderBy: { triggeredAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
}

export async function setAlertRuleActive(organizationId: string, alertRuleId: string, isActive: boolean) {
  const rule = await prisma.alertRule.findFirst({ where: { id: alertRuleId, organizationId } });
  if (!rule) throw new NotFoundError("Règle d'alerte introuvable");
  return prisma.alertRule.update({ where: { id: alertRuleId }, data: { isActive } });
}

// Calcule la valeur courante d'une métrique pour une organisation. Chaque
// métrique est délibérément un scalaire unique (pas une liste) pour rester
// comparable à un seuil simple — les métriques de stock résument déjà
// plusieurs articles (minimum de jours, nombre d'articles sous seuil).
async function evaluateMetric(organizationId: string, metric: AlertMetric): Promise<number> {
  switch (metric) {
    case "CA_JOUR": {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const invoices = await prisma.invoice.findMany({ where: { organizationId, createdAt: { gte: from, lt: to } }, select: { montantTotal: true } });
      return invoices.reduce((sum, i) => sum.plus(i.montantTotal), new Decimal(0)).toNumber();
    }
    case "CREANCES_ASSURANCES": {
      const claims = await prisma.insuranceClaim.findMany({
        where: { organizationId, status: { in: ["EN_PREPARATION", "TRANSMIS"] } },
        select: { montant: true },
      });
      return claims.reduce((sum, c) => sum.plus(c.montant), new Decimal(0)).toNumber();
    }
    case "TAUX_OCCUPATION_LITS": {
      const beds = await prisma.bed.findMany({ where: { organizationId }, select: { status: true } });
      if (beds.length === 0) return 0;
      return Number(((beds.filter((b) => b.status === "OCCUPE").length / beds.length) * 100).toFixed(1));
    }
    case "STOCK_JOURS_AVANT_PEREMPTION": {
      const lots = await getExpiryAlerts(organizationId, 365);
      if (lots.length === 0) return Infinity;
      const now = Date.now();
      return Math.min(...lots.map((lot) => Math.floor((lot.datePeremption.getTime() - now) / (1000 * 60 * 60 * 24))));
    }
    case "STOCK_SOUS_SEUIL_REAPPRO": {
      const items = await getReorderAlerts(organizationId);
      return items.length;
    }
    case "ECART_CAISSE_CLOTURE": {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const sessions = await prisma.cashSession.findMany({
        where: { organizationId, status: "CLOTUREE", closedAt: { gte: from } },
        select: { ecart: true },
      });
      if (sessions.length === 0) return 0;
      return Math.max(...sessions.map((s) => Math.abs(Number(s.ecart ?? 0))));
    }
  }
}

function isTriggered(value: number, operator: "SUPERIEUR_A" | "INFERIEUR_A", threshold: number): boolean {
  return operator === "SUPERIEUR_A" ? value > threshold : value < threshold;
}

// Appelée par le cron Vercel (voir vercel.json + app/api/cron/evaluer-alertes)
// et réutilisable pour une vérification manuelle depuis l'UI. Un
// déclenchement crée une entrée d'historique à chaque appel où la
// condition est vraie — la déduplication d'affichage (ex: "toutes les 15
// min max") revient à l'UI/au consommateur, pas à cette fonction.
export async function evaluateOrganizationAlertRules(organizationId: string) {
  const rules = await prisma.alertRule.findMany({ where: { organizationId, isActive: true } });
  const triggered: { rule: (typeof rules)[number]; value: number }[] = [];

  const cache = new Map<AlertMetric, number>();
  for (const rule of rules) {
    if (!cache.has(rule.metric)) {
      cache.set(rule.metric, await evaluateMetric(organizationId, rule.metric));
    }
    const value = cache.get(rule.metric)!;

    if (isTriggered(value, rule.operator, rule.threshold.toNumber())) {
      await prisma.alertTriggerLog.create({ data: { alertRuleId: rule.id, value } });
      triggered.push({ rule, value });
    }
  }

  return triggered;
}

export async function evaluateAllOrganizations() {
  const organizations = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } });
  let totalTriggered = 0;
  for (const org of organizations) {
    const triggered = await evaluateOrganizationAlertRules(org.id);
    totalTriggered += triggered.length;
  }
  return { organizationsChecked: organizations.length, alertsTriggered: totalTriggered };
}
