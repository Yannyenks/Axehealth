import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import type { CreateLabRequestInput } from "@/lib/validations/lab";

// LabRequest ne porte pas organizationId directement (il appartient à une
// Consultation) — chaque fonction ci-dessous passe systématiquement par la
// consultation pour garantir l'isolation multi-tenant, comme partout
// ailleurs dans le code.
export async function createLabRequest(organizationId: string, consultationId: string, input: CreateLabRequestInput) {
  const consultation = await prisma.consultation.findFirst({ where: { id: consultationId, organizationId } });
  if (!consultation) throw new NotFoundError("Consultation introuvable");
  if (consultation.status === "EN_ATTENTE_CAISSE") throw new ConflictError("Consultation verrouillée: en attente de validation caisse");

  return prisma.labRequest.create({ data: { consultationId, ...input } });
}

export async function listLabRequestsForConsultation(organizationId: string, consultationId: string) {
  const consultation = await prisma.consultation.findFirst({ where: { id: consultationId, organizationId } });
  if (!consultation) throw new NotFoundError("Consultation introuvable");

  return prisma.labRequest.findMany({ where: { consultationId }, orderBy: { createdAt: "desc" } });
}

// Worklist du laboratoire/de l'imagerie pour toute l'organisation — c'est
// l'écran de travail du biologiste, pas une vue par consultation.
export async function listPendingLabRequests(organizationId: string, type?: "LABORATOIRE" | "IMAGERIE") {
  return prisma.labRequest.findMany({
    where: {
      consultation: { organizationId },
      status: { in: ["DEMANDE", "EN_COURS"] },
      type,
    },
    include: {
      consultation: { select: { patient: { select: { firstName: true, lastName: true, patientNumber: true } }, medecin: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function startLabRequest(organizationId: string, labRequestId: string) {
  const labRequest = await prisma.labRequest.findFirst({ where: { id: labRequestId, consultation: { organizationId } } });
  if (!labRequest) throw new NotFoundError("Demande d'examen introuvable");
  if (labRequest.status !== "DEMANDE") throw new ConflictError("Cette demande n'est plus en attente");

  return prisma.labRequest.update({ where: { id: labRequestId }, data: { status: "EN_COURS" } });
}

export async function submitLabResult(organizationId: string, labRequestId: string, input: { resultat: string; resultatFileUrl?: string }) {
  const labRequest = await prisma.labRequest.findFirst({ where: { id: labRequestId, consultation: { organizationId } } });
  if (!labRequest) throw new NotFoundError("Demande d'examen introuvable");
  if (labRequest.status === "ANNULE") throw new ConflictError("Cette demande a été annulée");

  return prisma.labRequest.update({
    where: { id: labRequestId },
    data: { resultat: input.resultat, resultatFileUrl: input.resultatFileUrl, status: "RESULTAT_DISPONIBLE", completedAt: new Date() },
  });
}
