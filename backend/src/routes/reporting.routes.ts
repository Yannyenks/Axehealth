import { FastifyPluginAsync } from 'fastify'
import { ReportingService } from '../services/reporting.service'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { REPORTING_ROLES } from '../types'
import { prisma } from '../config/database'

const reportingService = new ReportingService()

export const reportingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/kpis', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await reportingService.getKPIs()
    return reply.send({ success: true, data })
  })

  fastify.get('/sla-performance', { preHandler: [authenticate, authorize(REPORTING_ROLES)] }, async (request, reply) => {
    const data = await reportingService.getSLAPerformance()
    return reply.send({ success: true, data })
  })

  fastify.get('/employees', { preHandler: [authenticate, authorize(REPORTING_ROLES)] }, async (request, reply) => {
    const data = await reportingService.getEmployeePerformance()
    return reply.send({ success: true, data })
  })

  fastify.get('/weekly-activity', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await reportingService.getWeeklyActivity()
    return reply.send({ success: true, data })
  })

  fastify.get('/di-overview', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await reportingService.getDIOverview()
    return reply.send({ success: true, data })
  })

  fastify.get('/financial-summary', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await reportingService.getFinancialSummary()
    return reply.send({ success: true, data })
  })

  fastify.get('/delay-reports', { preHandler: [authenticate, authorize(REPORTING_ROLES)] }, async (request, reply) => {
    const q = request.query as { userId?: string; etape?: string; limit?: string }
    const data = await reportingService.getDelayReports({
      userId: q.userId,
      etape: q.etape as any,
      limit: q.limit ? parseInt(q.limit) : 50,
    })
    return reply.send({ success: true, data })
  })

  // Late dossiers
  fastify.get('/retards', { preHandler: [authenticate] }, async (request, reply) => {
    const lateSteps = await prisma.workflowStep.findMany({
      where: { delaiDepasse: true, statut: { not: 'TERMINE' } },
      include: {
        dossier: {
          select: {
            id: true, numero: true, client: true, compagnie: true, priorite: true, site: true,
            responsable: { select: { nom: true, prenom: true } },
          },
        },
      },
      orderBy: { retardMinutes: 'desc' },
    })
    return reply.send({ success: true, data: lateSteps })
  })

  // Audit log
  fastify.get('/audit', { preHandler: [authenticate, authorize(REPORTING_ROLES)] }, async (request, reply) => {
    const q = request.query as { dossierId?: string; userId?: string; page?: string }
    const page = parseInt(q.page || '1')
    const limit = 50

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          ...(q.dossierId && { dossierId: q.dossierId }),
          ...(q.userId && { userId: q.userId }),
        },
        include: {
          user: { select: { nom: true, prenom: true, role: true } },
          dossier: { select: { numero: true, client: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({
        where: {
          ...(q.dossierId && { dossierId: q.dossierId }),
          ...(q.userId && { userId: q.userId }),
        },
      }),
    ])

    return reply.send({ success: true, data: logs, meta: { total, page, limit } })
  })

  // Site comparison
  fastify.get('/par-site', { preHandler: [authenticate] }, async (request, reply) => {
    const [douala, kribi] = await Promise.all([
      prisma.dossier.groupBy({ by: ['status'], where: { site: 'DOUALA' }, _count: { id: true } }),
      prisma.dossier.groupBy({ by: ['status'], where: { site: 'KRIBI' }, _count: { id: true } }),
    ])
    return reply.send({ success: true, data: { douala, kribi } })
  })
}
