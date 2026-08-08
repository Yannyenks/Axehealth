import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import type { CreateLeaveRequestInput } from "@/lib/validations/leave";

// Chaque employé demande son propre congé — pas de champ userId exposé côté
// création, pour qu'il soit structurellement impossible de créer une
// demande au nom de quelqu'un d'autre en falsifiant le corps de la requête.
export async function createLeaveRequest(organizationId: string, userId: string, input: CreateLeaveRequestInput) {
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      organizationId,
      userId,
      status: { in: ["EN_ATTENTE", "APPROUVE"] },
      dateDebut: { lte: input.dateFin },
      dateFin: { gte: input.dateDebut },
    },
  });
  if (overlapping) throw new ConflictError("Une demande de congé chevauchante existe déjà pour cette période");

  return prisma.leaveRequest.create({ data: { organizationId, userId, ...input } });
}

export async function listLeaveRequests(organizationId: string, filters?: { userId?: string; status?: string }) {
  return prisma.leaveRequest.findMany({
    where: { organizationId, userId: filters?.userId, status: filters?.status as never },
    include: { user: { select: { firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateLeaveStatus(organizationId: string, leaveId: string, approvedById: string, status: "APPROUVE" | "REJETE") {
  const leave = await prisma.leaveRequest.findFirst({ where: { id: leaveId, organizationId } });
  if (!leave) throw new NotFoundError("Demande de congé introuvable");
  if (leave.status !== "EN_ATTENTE") throw new ConflictError("Cette demande a déjà été traitée");

  return prisma.leaveRequest.update({
    where: { id: leaveId },
    data: { status, approvedById, approvedAt: new Date() },
  });
}

export async function cancelLeaveRequest(organizationId: string, leaveId: string, userId: string) {
  const leave = await prisma.leaveRequest.findFirst({ where: { id: leaveId, organizationId, userId } });
  if (!leave) throw new NotFoundError("Demande de congé introuvable");
  if (leave.status === "REJETE") throw new ConflictError("Cette demande est déjà rejetée");

  return prisma.leaveRequest.update({ where: { id: leaveId }, data: { status: "ANNULE" } });
}
