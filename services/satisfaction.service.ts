import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";
import type { CreateSatisfactionInput } from "@/lib/validations/satisfaction";

export async function createSatisfaction(organizationId: string, input: CreateSatisfactionInput) {
  const patient = await prisma.patient.findFirst({ where: { id: input.patientId, organizationId } });
  if (!patient) throw new NotFoundError("Patient introuvable");

  return prisma.patientSatisfaction.create({ data: { organizationId, ...input } });
}

// NPS standard: % promoteurs (9-10) moins % détracteurs (0-6), les scores
// 7-8 ("passifs") ne comptent ni pour ni contre. Retourne null si aucune
// réponse — jamais un NPS à 0 qui laisserait croire à une vraie mesure.
export async function getSatisfactionStats(organizationId: string, from: Date, to: Date) {
  const responses = await prisma.patientSatisfaction.findMany({
    where: { organizationId, createdAt: { gte: from, lt: to } },
    select: { score: true },
  });

  if (responses.length === 0) {
    return { totalReponses: 0, nps: null, scoreMoyen: null };
  }

  const promoteurs = responses.filter((r) => r.score >= 9).length;
  const detracteurs = responses.filter((r) => r.score <= 6).length;
  const nps = Math.round(((promoteurs - detracteurs) / responses.length) * 100);
  const scoreMoyen = Number((responses.reduce((sum, r) => sum + r.score, 0) / responses.length).toFixed(1));

  return { totalReponses: responses.length, nps, scoreMoyen };
}
