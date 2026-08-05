import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { SLAService } from '../services/sla.service'
import { WORKFLOW_PERMISSIONS } from '../types'
import { BusinessError, NotFoundError } from '../utils/errors'
import { DossierStatus, Role } from '@prisma/client'

const slaService = new SLAService()

const delayReportSchema = z.object({
  motif: z.enum(['COUPURE_INTERNET','COUPURE_ELECTRICITE','ATTENTE_CLIENT','ATTENTE_ADMINISTRATION','ATTENTE_SGS','AUTRE']),
  explication: z.string().min(10),
})

export const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all workflow steps for a dossier
  fastify.get('/dossier/:dossierId', { preHandler: [authenticate] }, async (request, reply) => {
    const { dossierId } = request.params as { dossierId: string }
    const steps = await slaService.getStepStatus(dossierId)
    return reply.send({ success: true, data: steps })
  })

  // Block a step (require manual intervention)
  fastify.patch('/step/:stepId/block', { preHandler: [authenticate] }, async (request, reply) => {
    const { stepId } = request.params as { stepId: string }
    const body = request.body as { raison: string }

    const step = await prisma.workflowStep.findUnique({ where: { id: stepId } })
    if (!step) throw new NotFoundError('Étape workflow', stepId)

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { statut: 'BLOQUE' },
    })

    await prisma.workflowAction.create({
      data: {
        workflowStepId: stepId,
        userId: request.currentUser.id,
        action: 'BLOQUE',
        commentaire: body?.raison,
      },
    })

    return reply.send({ success: true, message: 'Étape bloquée' })
  })

  // Resume a blocked step
  fastify.patch('/step/:stepId/resume', { preHandler: [authenticate] }, async (request, reply) => {
    const { stepId } = request.params as { stepId: string }

    const step = await prisma.workflowStep.findUnique({ where: { id: stepId } })
    if (!step) throw new NotFoundError('Étape workflow', stepId)
    if (step.statut !== 'BLOQUE') throw new BusinessError('L\'étape n\'est pas bloquée')

    await prisma.workflowStep.update({ where: { id: stepId }, data: { statut: 'EN_COURS' } })

    await prisma.workflowAction.create({
      data: { workflowStepId: stepId, userId: request.currentUser.id, action: 'REPRISE' },
    })

    return reply.send({ success: true })
  })

  // Toggle proof requirement for a step
  fastify.patch('/step/:stepId/proof-required', { preHandler: [authenticate, authorize(['DIRECTEUR_GENERAL', 'RESPONSABLE_EXPLOITATION'] as Role[])] }, async (request, reply) => {
    const { stepId } = request.params as { stepId: string }
    const body = request.body as { preuveRequise: boolean }

    const step = await prisma.workflowStep.findUnique({ where: { id: stepId } })
    if (!step) throw new NotFoundError('Étape workflow', stepId)

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { preuveRequise: body.preuveRequise },
    })

    return reply.send({ success: true })
  })

  // Submit delay report for a late step
  fastify.post('/step/:stepId/delay-report', { preHandler: [authenticate] }, async (request, reply) => {
    const { stepId } = request.params as { stepId: string }
    const data = delayReportSchema.parse(request.body)

    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: { dossier: { select: { id: true } } },
    })
    if (!step) throw new NotFoundError('Étape workflow', stepId)
    if (!step.delaiDepasse) throw new BusinessError('L\'étape n\'est pas en retard')

    const report = await prisma.delayReport.create({
      data: {
        dossierId: step.dossierId,
        etape: step.etape,
        userId: request.currentUser.id,
        motif: data.motif,
        explication: data.explication,
        retardMinutes: step.retardMinutes || 0,
      },
    })

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { motifRetard: data.motif, explicationRetard: data.explication },
    })

    return reply.status(201).send({ success: true, data: report })
  })

  // Get SLA overview for all active dossiers
  fastify.get('/sla-overview', { preHandler: [authenticate] }, async (request, reply) => {
    const steps = await prisma.workflowStep.findMany({
      where: { statut: 'EN_COURS' },
      include: {
        dossier: { select: { numero: true, client: true, priorite: true, site: true } },
      },
      orderBy: { debutAt: 'asc' },
    })

    const now = new Date()
    const enriched = steps.map((step) => {
      const elapsed = step.debutAt ? (now.getTime() - step.debutAt.getTime()) / 3600000 : 0
      const pct = step.slaHeures > 0 ? (elapsed / step.slaHeures) * 100 : 0
      return {
        ...step,
        elapsedHours: Math.round(elapsed * 10) / 10,
        pctUtilise: Math.round(pct),
        statut_sla: pct >= 100 ? 'RETARD' : pct >= 75 ? 'RISQUE' : 'OK',
      }
    })

    return reply.send({ success: true, data: enriched })
  })
}
