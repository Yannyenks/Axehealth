import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import { listOrganizationsWithUsage, setOrganizationActive } from "@/services/superadmin.service";

describe("Console super-admin", () => {
  let organizationId: string;
  const slug = `test-superadmin-${Date.now()}`;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test SuperAdmin", slug } });
    organizationId = organization.id;

    await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-SA-${Date.now()}`, firstName: "Patient", lastName: "SuperAdmin", sexe: "F", dateNaissance: new Date("1990-01-01") },
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("liste les organisations avec leurs compteurs d'usage", async () => {
    const organizations = await listOrganizationsWithUsage();
    const org = organizations.find((o) => o.id === organizationId);

    expect(org).toBeDefined();
    expect(org?.isActive).toBe(true);
    expect(org?.patients).toBe(1);
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
});
