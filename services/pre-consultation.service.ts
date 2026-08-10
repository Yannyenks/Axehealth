import type { PreConsultationStatus, TriageSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/api-error";
import { encrypt, decrypt } from "@/lib/encryption";
import { runTriageTurn, type TriageHistoryEntry } from "@/lib/integrations/ai";
import type { ConvertToAppointmentInput, ConvertToConsultationInput } from "@/lib/validations/pre-consultation";
import { createConsultationWithInvoice } from "@/services/consultation.service";

// Au-delà de ce nombre de tours patient sans conclusion de l'IA, on force
// une classification ORANGE (jamais VERT: mieux vaut sur-trier que
// sous-trier) plutôt que de laisser la conversation tourner indéfiniment —
// la session est alors marquée pour revue prioritaire par le staff.
const MAX_PATIENT_TURNS = 12;

function computeAge(dateNaissance: Date): number {
  const diff = Date.now() - dateNaissance.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

// Déchiffre un message pour affichage — jamais renvoyé tel quel depuis la
// base. Contrairement à decryptAntecedents (qui peut renvoyer null), un
// message de chat doit toujours produire une chaîne affichable: on masque
// silencieusement plutôt que de faire planter tout le transcript, et on
// journalise côté serveur pour investigation.
function decryptMessageContent(encrypted: string): string {
  try {
    return decrypt(encrypted);
  } catch {
    console.warn("PreConsultationMessage: échec de déchiffrement, contenu masqué");
    return "[message chiffré illisible]";
  }
}

function decryptSummary(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch {
    console.warn("PreConsultationSession: échec de déchiffrement de la synthèse");
    return null;
  }
}

// ============================================================================
// Côté patient
// ============================================================================

export async function createSession(organizationId: string, patientId: string, motifPatient?: string) {
  return prisma.preConsultationSession.create({
    data: { organizationId, patientId, motifPatient },
  });
}

export async function listSessionsForPatient(organizationId: string, patientId: string) {
  return prisma.preConsultationSession.findMany({
    where: { organizationId, patientId },
    select: { id: true, status: true, severity: true, motifPatient: true, startedAt: true, completedAt: true },
    orderBy: { startedAt: "desc" },
  });
}

export async function getSessionForPatient(organizationId: string, patientId: string, sessionId: string) {
  const session = await prisma.preConsultationSession.findFirst({
    where: { id: sessionId, organizationId, patientId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new NotFoundError("Pré-consultation introuvable");

  // La synthèse (summary) est un artefact réservé au staff — jamais exposée
  // au patient, même dans sa propre session.
  const { summary: _summary, messages, ...rest } = session;
  void _summary;
  return { ...rest, messages: messages.map((m) => ({ id: m.id, role: m.role, content: decryptMessageContent(m.content), createdAt: m.createdAt })) };
}

// Chemin idempotent en cas d'échec de l'appel IA après persistance du
// message patient: si le dernier message de la session est déjà un message
// PATIENT sans réponse IA, on ne recrée pas de message — on relance l'appel
// IA sur l'historique existant. Évite de dupliquer le tour patient au retry.
export async function postPatientMessage(organizationId: string, patientId: string, sessionId: string, content: string) {
  const session = await prisma.preConsultationSession.findFirst({
    where: { id: sessionId, organizationId, patientId },
    include: { patient: { select: { dateNaissance: true, sexe: true } } },
  });
  if (!session) throw new NotFoundError("Pré-consultation introuvable");
  if (session.status !== "EN_COURS") throw new ConflictError("Cette pré-consultation est déjà clôturée");

  const lastMessage = await prisma.preConsultationMessage.findFirst({ where: { sessionId }, orderBy: { createdAt: "desc" } });

  if (!lastMessage || lastMessage.role !== "PATIENT") {
    await prisma.preConsultationMessage.create({ data: { sessionId, role: "PATIENT", content: encrypt(content) } });
  }

  const rawHistory = await prisma.preConsultationMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
  const history: TriageHistoryEntry[] = rawHistory.map((m) => ({ role: m.role, content: decryptMessageContent(m.content) }));
  const patientTurns = history.filter((h) => h.role === "PATIENT").length;

  let result = await runTriageTurn({
    patientContext: { age: computeAge(session.patient.dateNaissance), sexe: session.patient.sexe },
    history,
  });

  if (!result.done && patientTurns >= MAX_PATIENT_TURNS) {
    result = {
      reply: "Merci pour ces informations. Votre pré-consultation est transmise à l'équipe médicale pour un avis rapproché.",
      done: true,
      severity: "ORANGE",
      summary: `Classification automatique après ${MAX_PATIENT_TURNS} échanges sans conclusion de l'IA — nécessite une revue prioritaire par le staff. Voir le transcript complet de la session.`,
    };
  }

  await prisma.preConsultationMessage.create({ data: { sessionId, role: "IA", content: encrypt(result.reply) } });

  if (result.done) {
    await prisma.preConsultationSession.update({
      where: { id: sessionId },
      data: {
        status: "EN_ATTENTE_REVUE",
        severity: result.severity,
        summary: result.summary ? encrypt(result.summary) : undefined,
        completedAt: new Date(),
      },
    });
  }

  return { reply: result.reply, done: result.done, severity: result.severity };
}

// ============================================================================
// Côté staff
// ============================================================================

const SEVERITY_ORDER: Record<string, number> = { ROUGE: 0, ORANGE: 1, VERT: 2 };

export async function listSessionsForStaff(organizationId: string, filters: { status?: PreConsultationStatus; severity?: TriageSeverity }) {
  const sessions = await prisma.preConsultationSession.findMany({
    where: { organizationId, status: filters.status, severity: filters.severity },
    include: { patient: { select: { firstName: true, lastName: true, patientNumber: true } } },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  // Prisma ne trie pas nativement par ordre d'enum personnalisé — le jeu de
  // sessions actives par établissement reste petit, donc un tri en mémoire
  // est suffisant (à revoir avec une colonne severityRank si le volume
  // grandit significativement).
  return sessions.sort((a, b) => {
    const rank = (SEVERITY_ORDER[a.severity ?? ""] ?? 3) - (SEVERITY_ORDER[b.severity ?? ""] ?? 3);
    return rank !== 0 ? rank : b.startedAt.getTime() - a.startedAt.getTime();
  });
}

export async function getSessionDetail(organizationId: string, sessionId: string) {
  const session = await prisma.preConsultationSession.findFirst({
    where: { id: sessionId, organizationId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, dateNaissance: true, sexe: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) throw new NotFoundError("Pré-consultation introuvable");

  return {
    ...session,
    summary: decryptSummary(session.summary),
    messages: session.messages.map((m) => ({ id: m.id, role: m.role, content: decryptMessageContent(m.content), createdAt: m.createdAt })),
  };
}

export async function markReviewed(organizationId: string, sessionId: string, userId: string) {
  const session = await prisma.preConsultationSession.findFirst({ where: { id: sessionId, organizationId } });
  if (!session) throw new NotFoundError("Pré-consultation introuvable");
  if (session.status === "REVUE" || session.status === "CONVERTIE") return session; // idempotent

  return prisma.preConsultationSession.update({
    where: { id: sessionId },
    data: { status: "REVUE", reviewedById: userId, reviewedAt: new Date() },
  });
}

// Deux appels séparés (pas une transaction unique): createConsultationWithInvoice
// ouvre déjà sa propre transaction, et l'englober dans une seconde
// nécessiterait de refactorer ce service existant pour accepter un client
// transactionnel injecté. Si la mise à jour de la session échoue après coup,
// la consultation existe correctement — seul le lien administratif manque,
// récupérable manuellement.
export async function convertToConsultation(organizationId: string, sessionId: string, userId: string, input: ConvertToConsultationInput) {
  const session = await prisma.preConsultationSession.findFirst({ where: { id: sessionId, organizationId } });
  if (!session) throw new NotFoundError("Pré-consultation introuvable");
  if (session.status === "CONVERTIE") throw new ConflictError("Cette pré-consultation a déjà été convertie");

  const consultation = await createConsultationWithInvoice(organizationId, userId, {
    patientId: session.patientId,
    medecinId: input.medecinId,
    motif: session.motifPatient ?? "Consultation suite à pré-consultation IA",
    isPayant: input.isPayant,
    montant: input.montant,
  });

  await prisma.preConsultationSession.update({
    where: { id: sessionId },
    data: { status: "CONVERTIE", consultationId: consultation.id, reviewedById: userId, reviewedAt: new Date() },
  });

  return consultation;
}

// Aucune route de création de RDV n'existe aujourd'hui dans le code — un
// prisma.appointment.create direct ici reste minimal plutôt que d'inventer
// un module de gestion des rendez-vous complet, hors périmètre de cette
// itération.
export async function convertToAppointment(organizationId: string, sessionId: string, userId: string, input: ConvertToAppointmentInput) {
  const session = await prisma.preConsultationSession.findFirst({ where: { id: sessionId, organizationId } });
  if (!session) throw new NotFoundError("Pré-consultation introuvable");
  if (session.status === "CONVERTIE") throw new ConflictError("Cette pré-consultation a déjà été convertie");

  const appointment = await prisma.appointment.create({
    data: {
      organizationId,
      patientId: session.patientId,
      practitionerId: input.practitionerId,
      scheduledAt: input.scheduledAt,
      duration: input.duration,
      motif: input.motif ?? session.motifPatient ?? "RDV suite à pré-consultation IA",
    },
  });

  await prisma.preConsultationSession.update({
    where: { id: sessionId },
    data: { status: "CONVERTIE", appointmentId: appointment.id, reviewedById: userId, reviewedAt: new Date() },
  });

  return appointment;
}
