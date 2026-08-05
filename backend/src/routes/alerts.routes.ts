import { FastifyPluginAsync } from 'fastify'
import { AlertService } from '../services/alert.service'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { Role } from '@prisma/client'

const alertService = new AlertService()

export const alertRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const result = await alertService.findAll({
      lu: q.lu !== undefined ? q.lu === 'true' : undefined,
      severity: q.severity,
      type: q.type,
      page: parseInt(q.page || '1'),
      limit: parseInt(q.limit || '50'),
    })
    return reply.send({ success: true, ...result })
  })

  fastify.patch('/:id/read', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const alert = await alertService.markAsRead(id)
    return reply.send({ success: true, data: alert })
  })

  fastify.patch('/read-all', { preHandler: [authenticate] }, async (request, reply) => {
    await alertService.markAllAsRead()
    return reply.send({ success: true })
  })

  fastify.patch('/:id/resolve', {
    preHandler: [authenticate, authorize(['DIRECTEUR_GENERAL', 'RESPONSABLE_EXPLOITATION'] as Role[])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const alert = await alertService.resolve(id)
    return reply.send({ success: true, data: alert })
  })

  fastify.get('/stats', { preHandler: [authenticate] }, async (request, reply) => {
    const { prisma } = await import('../config/database')
    const [total, critical, warning, unread, resolue] = await Promise.all([
      prisma.alert.count(),
      prisma.alert.count({ where: { severity: 'CRITICAL', resolue: false } }),
      prisma.alert.count({ where: { severity: 'WARNING', resolue: false } }),
      prisma.alert.count({ where: { lu: false } }),
      prisma.alert.count({ where: { resolue: true } }),
    ])
    return reply.send({ success: true, data: { total, critical, warning, unread, resolue } })
  })
}
