import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getGroupeComparatif } from "@/services/groupe.service";

describe("Comparatif inter-cliniques (groupe)", () => {
  let soloOrgId: string;
  let groupId: string;
  let orgAId: string;
  let orgBId: string;
  const from = new Date(Date.UTC(2026, 0, 1));
  const to = new Date(Date.UTC(2026, 1, 1));

  beforeAll(async () => {
    const solo = await prisma.organization.create({ data: { name: "Clinique Solo", slug: `test-solo-${Date.now()}` } });
    soloOrgId = solo.id;

    const groupe = await prisma.organizationGroup.create({ data: { name: "Groupe Test" } });
    groupId = groupe.id;

    const orgA = await prisma.organization.create({ data: { name: "Clinique A", slug: `test-groupe-a-${Date.now()}`, groupId } });
    const orgB = await prisma.organization.create({ data: { name: "Clinique B", slug: `test-groupe-b-${Date.now()}`, groupId } });
    orgAId = orgA.id;
    orgBId = orgB.id;

    await prisma.patient.create({
      data: { organizationId: orgAId, patientNumber: `PAT-GA-${Date.now()}`, firstName: "Patient", lastName: "A", sexe: "M", dateNaissance: new Date("1990-01-01") },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [soloOrgId, orgAId, orgBId] } } });
    await prisma.organizationGroup.delete({ where: { id: groupId } });
  });

  it("renvoie une liste vide quand l'organisation n'appartient à aucun groupe", async () => {
    const comparatif = await getGroupeComparatif(soloOrgId, from, to);
    expect(comparatif.groupe).toBeNull();
    expect(comparatif.organisations).toEqual([]);
  });

  it("renvoie toutes les organisations soeurs du groupe avec leurs compteurs", async () => {
    const comparatif = await getGroupeComparatif(orgAId, from, to);
    expect(comparatif.groupe?.nom).toBe("Groupe Test");
    expect(comparatif.organisations).toHaveLength(2);

    const entryA = comparatif.organisations.find((o) => o.organizationId === orgAId);
    const entryB = comparatif.organisations.find((o) => o.organizationId === orgBId);
    expect(entryA?.patients).toBe(1);
    expect(entryB?.patients).toBe(0);
    expect(entryA?.nps).toBeNull();
  });
});
