import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSatisfaction, getSatisfactionStats } from "@/services/satisfaction.service";

describe("Satisfaction patient (NPS)", () => {
  let organizationId: string;
  let patientId: string;
  const from = new Date(Date.UTC(2026, 0, 1));
  const to = new Date(Date.UTC(2026, 1, 1));

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test NPS", slug: `test-nps-${Date.now()}` } });
    organizationId = organization.id;

    const patient = await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-NPS-${Date.now()}`, firstName: "Patient", lastName: "NPS", sexe: "M", dateNaissance: new Date("1990-01-01") },
    });
    patientId = patient.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("ne renvoie aucun NPS quand il n'y a aucune réponse", async () => {
    const stats = await getSatisfactionStats(organizationId, from, to);
    expect(stats.totalReponses).toBe(0);
    expect(stats.nps).toBeNull();
  });

  it("calcule le NPS standard: %promoteurs - %détracteurs", async () => {
    // 2 promoteurs (9,10), 1 passif (7), 1 détracteur (3) -> (2-1)/4 = 25%
    for (const score of [9, 10, 7, 3]) {
      const satisfaction = await createSatisfaction(organizationId, { patientId, score });
      await prisma.patientSatisfaction.update({ where: { id: satisfaction.id }, data: { createdAt: new Date(Date.UTC(2026, 0, 15)) } });
    }

    const stats = await getSatisfactionStats(organizationId, from, to);
    expect(stats.totalReponses).toBe(4);
    expect(stats.nps).toBe(25);
    expect(stats.scoreMoyen).toBe(7.3);
  });
});
