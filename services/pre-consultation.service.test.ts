import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { NotFoundError, ConflictError } from "@/lib/api-error";

// L'IA (Gemini) n'est jamais appelée en test — on contrôle sa réponse pour
// vérifier la logique métier (chiffrement, statuts, tri, idempotence) sans
// dépendre d'un réseau ni d'une clé API.
vi.mock("@/lib/integrations/ai", () => ({ runTriageTurn: vi.fn() }));

import { runTriageTurn } from "@/lib/integrations/ai";
import {
  createSession,
  postPatientMessage,
  getSessionForPatient,
  listSessionsForStaff,
  getSessionDetail,
  markReviewed,
  convertToAppointment,
} from "@/services/pre-consultation.service";

const runTriageTurnMock = vi.mocked(runTriageTurn);

describe("Pré-consultation IA", () => {
  let organizationId: string;
  let patientId: string;
  let practitionerId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Préconsultation", slug: `test-preconsult-${Date.now()}` } });
    organizationId = organization.id;

    const patient = await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-PRECONSULT-${Date.now()}`, firstName: "Patient", lastName: "Test", sexe: "F", dateNaissance: new Date("1995-06-01") },
    });
    patientId = patient.id;

    const practitioner = await prisma.user.create({
      data: { organizationId, email: `medecin-preconsult-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Awa", lastName: "Diallo", role: "MEDECIN" },
    });
    practitionerId = practitioner.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("chiffre le contenu des messages au repos et conclut la session quand l'IA le décide", async () => {
    runTriageTurnMock.mockResolvedValueOnce({ reply: "Avez-vous de la fièvre ?", done: false });
    runTriageTurnMock.mockResolvedValueOnce({
      reply: "Merci, votre pré-consultation est enregistrée.",
      done: true,
      severity: "ORANGE",
      summary: "Toux et fièvre depuis 2 jours, pas de signe de gravité.",
    });

    const session = await createSession(organizationId, patientId, "Toux persistante");
    expect(session.status).toBe("EN_COURS");

    const turn1 = await postPatientMessage(organizationId, patientId, session.id, "J'ai une toux depuis 2 jours");
    expect(turn1.done).toBe(false);

    const turn2 = await postPatientMessage(organizationId, patientId, session.id, "Oui, 38.5°C");
    expect(turn2.done).toBe(true);
    expect(turn2.severity).toBe("ORANGE");

    // Le contenu est bien chiffré en base — pas de texte en clair stocké.
    const rawMessages = await prisma.preConsultationMessage.findMany({ where: { sessionId: session.id } });
    expect(rawMessages.every((m) => !m.content.includes("toux") && !m.content.includes("fièvre"))).toBe(true);

    const detail = await getSessionDetail(organizationId, session.id);
    expect(detail.status).toBe("EN_ATTENTE_REVUE");
    expect(detail.summary).toContain("Toux et fièvre");
    expect(detail.messages.map((m) => m.content)).toContain("J'ai une toux depuis 2 jours");
  });

  it("ne renvoie jamais la synthèse (summary) côté patient", async () => {
    runTriageTurnMock.mockResolvedValueOnce({ reply: "Merci.", done: true, severity: "VERT", summary: "Synthèse confidentielle" });

    const session = await createSession(organizationId, patientId);
    await postPatientMessage(organizationId, patientId, session.id, "Petite douleur au dos");

    const patientView = await getSessionForPatient(organizationId, patientId, session.id);
    expect(patientView).not.toHaveProperty("summary");
  });

  it("refuse de poster un message sur une session déjà clôturée", async () => {
    runTriageTurnMock.mockResolvedValueOnce({ reply: "Merci.", done: true, severity: "VERT", summary: "RAS" });

    const session = await createSession(organizationId, patientId);
    await postPatientMessage(organizationId, patientId, session.id, "Ça va mieux");

    await expect(postPatientMessage(organizationId, patientId, session.id, "Un dernier message")).rejects.toThrow(ConflictError);
  });

  it("ne recrée pas le message patient si l'appel IA a échoué juste après sa persistance (idempotence du retry)", async () => {
    runTriageTurnMock.mockRejectedValueOnce(new Error("Gemini indisponible"));
    runTriageTurnMock.mockResolvedValueOnce({ reply: "Compris.", done: true, severity: "VERT", summary: "RAS" });

    const session = await createSession(organizationId, patientId);
    await expect(postPatientMessage(organizationId, patientId, session.id, "J'ai mal à la tête")).rejects.toThrow();

    await postPatientMessage(organizationId, patientId, session.id, "J'ai mal à la tête");

    const patientMessages = await prisma.preConsultationMessage.findMany({ where: { sessionId: session.id, role: "PATIENT" } });
    expect(patientMessages).toHaveLength(1);
  });

  it("trie les sessions staff par sévérité (ROUGE en premier)", async () => {
    runTriageTurnMock.mockResolvedValueOnce({ reply: "OK", done: true, severity: "VERT", summary: "RAS" });
    runTriageTurnMock.mockResolvedValueOnce({ reply: "OK", done: true, severity: "ROUGE", summary: "Douleur thoracique" });

    const vertSession = await createSession(organizationId, patientId);
    await postPatientMessage(organizationId, patientId, vertSession.id, "Rien de grave");

    const rougeSession = await createSession(organizationId, patientId);
    await postPatientMessage(organizationId, patientId, rougeSession.id, "Douleur thoracique intense");

    const sessions = await listSessionsForStaff(organizationId, {});
    const rougeIndex = sessions.findIndex((s) => s.id === rougeSession.id);
    const vertIndex = sessions.findIndex((s) => s.id === vertSession.id);
    expect(rougeIndex).toBeLessThan(vertIndex);
  });

  it("marquer comme revu est idempotent", async () => {
    runTriageTurnMock.mockResolvedValueOnce({ reply: "OK", done: true, severity: "VERT", summary: "RAS" });
    const session = await createSession(organizationId, patientId);
    await postPatientMessage(organizationId, patientId, session.id, "Ça va");

    const first = await markReviewed(organizationId, session.id, practitionerId);
    expect(first.status).toBe("REVUE");

    const second = await markReviewed(organizationId, session.id, practitionerId);
    expect(second.status).toBe("REVUE");
  });

  it("convertit une session en rendez-vous et la marque CONVERTIE", async () => {
    runTriageTurnMock.mockResolvedValueOnce({ reply: "OK", done: true, severity: "ORANGE", summary: "RAS" });
    const session = await createSession(organizationId, patientId);
    await postPatientMessage(organizationId, patientId, session.id, "Douleur modérée");

    const appointment = await convertToAppointment(organizationId, session.id, practitionerId, {
      practitionerId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      duration: 30,
    });

    expect(appointment.patientId).toBe(patientId);

    const detail = await getSessionDetail(organizationId, session.id);
    expect(detail.status).toBe("CONVERTIE");
    expect(detail.appointmentId).toBe(appointment.id);

    await expect(
      convertToAppointment(organizationId, session.id, practitionerId, { practitionerId, scheduledAt: new Date(), duration: 30 }),
    ).rejects.toThrow(ConflictError);
  });

  it("lève NotFoundError pour une session d'une autre organisation", async () => {
    const otherOrg = await prisma.organization.create({ data: { name: "Autre Clinique", slug: `test-other-${Date.now()}` } });
    await expect(getSessionDetail(otherOrg.id, "session-inexistante")).rejects.toThrow(NotFoundError);
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
