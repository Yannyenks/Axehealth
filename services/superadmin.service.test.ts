import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import {
  listOrganizationsWithUsage,
  setOrganizationActive,
  setOrganizationPlan,
  getOrCreateSupportUser,
  getPlatformKpis,
} from "@/services/superadmin.service";
import { listTeamMembers } from "@/services/team.service";

describe("Console super-admin", () => {
  let organizationId: string;
  const slug = `test-superadmin-${Date.now()}`;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Entreprise Test SuperAdmin", slug } });
    organizationId = organization.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("liste les organisations avec leurs compteurs d'usage", async () => {
    const organizations = await listOrganizationsWithUsage();
    const org = organizations.find((o) => o.id === organizationId);

    expect(org).toBeDefined();
    expect(org?.isActive).toBe(true);
    expect(org?.ecritures).toBe(0);
    expect(org?.utilisateurs).toBe(0);
  });

  it("suspend puis réactive une organisation", async () => {
    const suspended = await setOrganizationActive(organizationId, false);
    expect(suspended.isActive).toBe(false);

    const reactivated = await setOrganizationActive(organizationId, true);
    expect(reactivated.isActive).toBe(true);
  });

  it("lève une NotFoundError pour une organisation inexistante", async () => {
    await expect(setOrganizationActive("inexistant-id", true)).rejects.toThrow(NotFoundError);
  });

  it("change l'offre d'une organisation", async () => {
    const updated = await setOrganizationPlan(organizationId, "PRO");
    expect(updated.plan).toBe("PRO");
  });

  it("expose des KPI plateforme cohérents", async () => {
    const kpis = await getPlatformKpis();
    expect(kpis.totalOrganizations).toBeGreaterThanOrEqual(1);
    expect(kpis.activeOrganizations).toBeLessThanOrEqual(kpis.totalOrganizations);
    expect(kpis.planBreakdown).toHaveLength(3);
    expect(kpis.signupsByMonth).toHaveLength(6);
    expect(kpis.mrrEstimateUsd).toBeGreaterThanOrEqual(0);
  });
});

describe("Compte support (mode assistance)", () => {
  let organizationId: string;
  const slug = `test-support-account-${Date.now()}`;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Entreprise Test Assistance", slug } });
    organizationId = organization.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("crée un compte support réel de l'organisation, réutilisé de façon idempotente", async () => {
    const first = await getOrCreateSupportUser(organizationId);
    expect(first.organizationId).toBe(organizationId);
    expect(first.role).toBe("ADMIN");
    expect(first.isSupportAccount).toBe(true);

    const second = await getOrCreateSupportUser(organizationId);
    expect(second.id).toBe(first.id);

    const total = await prisma.user.count({ where: { organizationId, isSupportAccount: true } });
    expect(total).toBe(1);
  });

  it("n'apparaît jamais dans l'équipe vue par le client", async () => {
    await getOrCreateSupportUser(organizationId);
    const members = await listTeamMembers(organizationId);
    expect(members.some((m) => m.email.startsWith("support+"))).toBe(false);
  });
});
