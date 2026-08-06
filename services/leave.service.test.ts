import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import { createLeaveRequest, listLeaveRequests, updateLeaveStatus, cancelLeaveRequest } from "@/services/leave.service";

describe("Congés — demande, approbation, chevauchement", () => {
  let organizationId: string;
  let employeeId: string;
  let rhId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Congés", slug: `test-conges-${Date.now()}` } });
    organizationId = organization.id;

    const employee = await prisma.user.create({
      data: { organizationId, email: `employe-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Employe", lastName: "Test", role: "INFIRMIER" },
    });
    employeeId = employee.id;

    const rh = await prisma.user.create({
      data: { organizationId, email: `rh-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "RH", lastName: "Test", role: "RH" },
    });
    rhId = rh.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("crée une demande de congé en attente", async () => {
    const leave = await createLeaveRequest(organizationId, employeeId, {
      type: "CONGE_PAYE",
      dateDebut: new Date("2026-09-01"),
      dateFin: new Date("2026-09-10"),
    });
    expect(leave.status).toBe("EN_ATTENTE");
  });

  it("refuse une demande dont les dates chevauchent une demande déjà active", async () => {
    await expect(
      createLeaveRequest(organizationId, employeeId, { type: "CONGE_MALADIE", dateDebut: new Date("2026-09-05"), dateFin: new Date("2026-09-15") }),
    ).rejects.toThrow(ConflictError);
  });

  it("le RH approuve la demande, qui n'est plus modifiable ensuite", async () => {
    const leaves = await listLeaveRequests(organizationId, { userId: employeeId, status: "EN_ATTENTE" });
    const leave = leaves[0];

    const approved = await updateLeaveStatus(organizationId, leave.id, rhId, "APPROUVE");
    expect(approved.status).toBe("APPROUVE");
    expect(approved.approvedById).toBe(rhId);

    await expect(updateLeaveStatus(organizationId, leave.id, rhId, "REJETE")).rejects.toThrow(ConflictError);
  });

  it("l'employé peut annuler sa propre demande mais pas celle d'un autre", async () => {
    const leave = await createLeaveRequest(organizationId, employeeId, { type: "AUTRE", dateDebut: new Date("2026-11-01"), dateFin: new Date("2026-11-02") });

    await expect(cancelLeaveRequest(organizationId, leave.id, rhId)).rejects.toThrow(NotFoundError); // pas le propriétaire

    const cancelled = await cancelLeaveRequest(organizationId, leave.id, employeeId);
    expect(cancelled.status).toBe("ANNULE");
  });
});
