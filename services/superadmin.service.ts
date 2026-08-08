import { randomBytes } from "crypto";
import type { OrgPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { NotFoundError } from "@/lib/api-error";
import { PLAN_DEFINITIONS } from "@/lib/plans";

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Vue plateforme: un super-admin ne charge jamais les données métier d'un
// tenant (écritures comptables, tiers...), seulement des compteurs d'usage
// — il n'obtient pas d'accès implicite au contenu d'une organisation qui
// n'est pas la sienne, uniquement à des métadonnées de gestion. (L'accès
// complet, volontaire et tracé, passe uniquement par le mode assistance —
// voir startAssistanceSession ci-dessous.)
export async function listOrganizationsWithUsage() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      plan: true,
      createdAt: true,
      // Un compte support (assistance) ne doit jamais gonfler le compteur
      // d'utilisateurs vu par la plateforme ou par le client.
      _count: { select: { users: { where: { isSupportAccount: false } }, journalEntries: true } },
    },
  });

  return organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    isActive: org.isActive,
    plan: org.plan,
    createdAt: org.createdAt,
    utilisateurs: org._count.users,
    ecritures: org._count.journalEntries,
  }));
}

export async function setOrganizationActive(organizationId: string, isActive: boolean) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new NotFoundError("Organisation introuvable");

  return prisma.organization.update({ where: { id: organizationId }, data: { isActive } });
}

// Changement d'offre appliqué immédiatement, sans flux de confirmation —
// cohérent avec l'absence de facturation réelle branchée pour l'instant
// (voir README, section "Offres / scaffold commercial").
export async function setOrganizationPlan(organizationId: string, plan: OrgPlan) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new NotFoundError("Organisation introuvable");

  return prisma.organization.update({ where: { id: organizationId }, data: { plan } });
}

// Compte technique réel appartenant à l'organisation ciblée, un seul par
// organisation (email déterministe → idempotent), utilisé uniquement pour
// les sessions d'assistance (voir app/api/superadmin/organisations/[id]/assistance).
// Comme ce User appartient réellement à l'organisation, toute la logique
// RBAC/écritures existante (assertSameOrganization, décompte d'admins
// actifs, etc.) continue de fonctionner sans aucune modification.
export async function getOrCreateSupportUser(organizationId: string) {
  const email = `support+${organizationId}@axecompta.internal`;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  // Mot de passe aléatoire jamais communiqué à personne: la connexion via
  // /api/auth/login est de toute façon rejetée pour isSupportAccount — ce
  // hash n'existe que pour satisfaire la contrainte du schéma.
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));

  return prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash,
      firstName: "Support",
      lastName: "AxeCompta",
      role: "ADMIN",
      isSupportAccount: true,
    },
  });
}

export interface PlatformKpis {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
  newOrganizationsThisMonth: number;
  planBreakdown: { plan: OrgPlan; count: number }[];
  mrrEstimateUsd: number;
  signupsByMonth: { month: string; count: number }[];
}

// KPI de pilotage plateforme. mrrEstimateUsd est une estimation déclarative
// (nb d'organisations actives par offre × prix indicatif de lib/plans.ts) —
// aucun paiement réel n'est branché (voir README, scaffold commercial).
export async function getPlatformKpis(): Promise<PlatformKpis> {
  const from = startOfMonth();
  const sixMonthsAgo = new Date(from.getFullYear(), from.getMonth() - 5, 1);

  const [totalOrgs, activeOrgs, byPlan, totalUsers, newOrgsThisMonth, recentOrgs] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.organization.groupBy({ by: ["plan"], where: { isActive: true }, _count: true }),
    prisma.user.count({ where: { isSupportAccount: false } }),
    prisma.organization.count({ where: { createdAt: { gte: from } } }),
    prisma.organization.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
  ]);

  const countByPlan = new Map(byPlan.map((g) => [g.plan, g._count]));
  const mrrEstimateUsd = PLAN_DEFINITIONS.reduce(
    (sum, plan) => sum + (plan.priceMonthlyUsd ?? 0) * (countByPlan.get(plan.id) ?? 0),
    0,
  );

  const signupsByMonth = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const monthStart = new Date(from.getFullYear(), from.getMonth() - offset, 1);
    const monthEnd = new Date(from.getFullYear(), from.getMonth() - offset + 1, 1);
    const count = recentOrgs.filter((o) => o.createdAt >= monthStart && o.createdAt < monthEnd).length;
    // Construit "AAAA-MM" à partir des composants locaux — jamais
    // toISOString() ici, qui convertit en UTC et décale le mois d'une unité
    // sur un serveur dont le fuseau a un décalage positif (ex: minuit local
    // devient la veille en UTC).
    const month = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
    return { month, count };
  });

  return {
    totalOrganizations: totalOrgs,
    activeOrganizations: activeOrgs,
    suspendedOrganizations: totalOrgs - activeOrgs,
    totalUsers,
    newOrganizationsThisMonth: newOrgsThisMonth,
    planBreakdown: PLAN_DEFINITIONS.map((plan) => ({ plan: plan.id, count: countByPlan.get(plan.id) ?? 0 })),
    mrrEstimateUsd,
    signupsByMonth,
  };
}
