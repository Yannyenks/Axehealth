import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError } from "@/lib/api-error";
import { createConsultationWithInvoice } from "@/services/consultation.service";
import { createLabRequest, listPendingLabRequests, startLabRequest, submitLabResult } from "@/services/lab.service";

describe("Laboratoire / imagerie — cycle de vie d'une demande d'examen", () => {
  let organizationId: string;
  let medecinId: string;
  let patientId: string;
  let consultationId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Labo", slug: `test-labo-${Date.now()}` } });
    organizationId = organization.id;

    const medecin = await prisma.user.create({
      data: { organizationId, email: `medecin-labo-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Jean", lastName: "Test", role: "MEDECIN" },
    });
    medecinId = medecin.id;

    const patient = await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-LABO-${Date.now()}`, firstName: "Patient", lastName: "Labo", sexe: "M", dateNaissance: new Date("1975-01-01") },
    });
    patientId = patient.id;

    // Consultation non payante: démarre directement EN_COURS, pas de verrou caisse à gérer ici.
    const consultation = await createConsultationWithInvoice(organizationId, medecinId, {
      patientId,
      medecinId,
      motif: "Bilan",
      isPayant: false,
    });
    consultationId = consultation.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("suit le cycle complet: demande -> en cours -> résultat disponible", async () => {
    const labRequest = await createLabRequest(organizationId, consultationId, { type: "LABORATOIRE", libelle: "NFS" });
    expect(labRequest.status).toBe("DEMANDE");

    const pending = await listPendingLabRequests(organizationId);
    expect(pending.some((lr) => lr.id === labRequest.id)).toBe(true);

    const started = await startLabRequest(organizationId, labRequest.id);
    expect(started.status).toBe("EN_COURS");

    await expect(startLabRequest(organizationId, labRequest.id)).rejects.toThrow(ConflictError); // déjà démarré

    const completed = await submitLabResult(organizationId, labRequest.id, { resultat: "Hémoglobine 13.5 g/dL — normal" });
    expect(completed.status).toBe("RESULTAT_DISPONIBLE");
    expect(completed.completedAt).not.toBeNull();

    const stillPending = await listPendingLabRequests(organizationId);
    expect(stillPending.some((lr) => lr.id === labRequest.id)).toBe(false); // sorti de la worklist une fois résultat rendu
  });
});
