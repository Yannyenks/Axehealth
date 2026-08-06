import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { NotFoundError } from "@/lib/api-error";
import { createIncident, listIncidents } from "@/services/incident.service";

describe("Incidents qualité", () => {
  let organizationId: string;
  let infirmierId: string;
  let hospitalizationId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Incidents", slug: `test-incidents-${Date.now()}` } });
    organizationId = organization.id;

    const infirmier = await prisma.user.create({
      data: { organizationId, email: `infirmier-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "David", lastName: "Test", role: "INFIRMIER" },
    });
    infirmierId = infirmier.id;

    const patient = await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-INC-${Date.now()}`, firstName: "Patient", lastName: "Incident", sexe: "M", dateNaissance: new Date("1970-01-01") },
    });

    const room = await prisma.room.create({ data: { organizationId, numero: `R-${Date.now()}`, type: "CHAMBRE_SIMPLE" } });
    const bed = await prisma.bed.create({ data: { organizationId, roomId: room.id, numero: "1" } });

    const hospitalization = await prisma.hospitalization.create({
      data: { organizationId, patientId: patient.id, bedId: bed.id },
    });
    hospitalizationId = hospitalization.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("déclare un incident lié à une hospitalisation", async () => {
    const incident = await createIncident(organizationId, infirmierId, {
      hospitalizationId,
      type: "CHUTE",
      severite: "MODERE",
      description: "Chute lors du transfert vers la salle de bain",
      actionsCorrectives: "Mise en place d'une aide à la marche",
    });
    expect(incident.type).toBe("CHUTE");

    const incidents = await listIncidents(organizationId);
    expect(incidents.some((i) => i.id === incident.id)).toBe(true);
  });

  it("permet un incident non lié à une hospitalisation (ex: erreur en ambulatoire)", async () => {
    const incident = await createIncident(organizationId, infirmierId, {
      type: "ERREUR_MEDICAMENTEUSE",
      severite: "MAJEUR",
      description: "Confusion entre deux patients homonymes",
    });
    expect(incident.hospitalizationId).toBeNull();
  });

  it("filtre par type et par sévérité", async () => {
    const chutes = await listIncidents(organizationId, { type: "CHUTE" });
    expect(chutes.every((i) => i.type === "CHUTE")).toBe(true);

    const majeurs = await listIncidents(organizationId, { severite: "MAJEUR" });
    expect(majeurs.every((i) => i.severite === "MAJEUR")).toBe(true);
  });

  it("refuse une hospitalisation d'une autre organisation", async () => {
    const otherOrg = await prisma.organization.create({ data: { name: "Autre Clinique", slug: `autre-${Date.now()}` } });
    await expect(
      createIncident(organizationId, infirmierId, { hospitalizationId: "cuid-invalide-inexistant", type: "AUTRE", severite: "MINEUR", description: "test" }),
    ).rejects.toThrow(NotFoundError);
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
