import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import type { CreateIncidentInput } from "@/lib/validations/incident";

export async function createIncident(organizationId: string, declaredById: string, input: CreateIncidentInput) {
  if (input.hospitalizationId) {
    const hospitalization = await prisma.hospitalization.findFirst({ where: { id: input.hospitalizationId, organizationId } });
    if (!hospitalization) throw new NotFoundError("Hospitalisation introuvable");
  }

  return prisma.incident.create({ data: { organizationId, declaredById, ...input } });
}

export async function listIncidents(organizationId: string, filters?: { type?: string; severite?: string }) {
  return prisma.incident.findMany({
    where: { organizationId, type: filters?.type as never, severite: filters?.severite as never },
    include: {
      declaredBy: { select: { firstName: true, lastName: true, role: true } },
      hospitalization: { select: { patient: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
