import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { DIService } from '../services/di.service'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { DI_MANAGE_ROLES, DI_VALIDATE_ROLES } from '../types'

const diService = new DIService()

const createSchema = z.object({
  client: z.string().min(2),
  montantTotal: z.number().positive(),
  dateExpiration: z.string(),
  notes: z.string().optional(),
})

const operationSchema = z.object({
  dossierId: z.string(),
  nombreConteneurs: z.number().int().positive().default(1),
  montant: z.number().positive(),
  factureNumero: z.string().optional(),
  commentaire: z.string().optional(),
})

export const diRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── DI CRUD ──────────────────────────────────────────────────────────────

  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const result = await diService.findAll({
      client: q.client,
      statut: q.statut,
      page: parseInt(q.page || '1'),
      limit: parseInt(q.limit || '20'),
    })
    return reply.send({ success: true, ...result })
  })

  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const di = await diService.findById(id)
    return reply.send({ success: true, data: di })
  })

  fastify.get('/:id/history', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const history = await diService.getConsumptionHistory(id)
    return reply.send({ success: true, data: history })
  })

  fastify.post('/', { preHandler: [authenticate, authorize(DI_MANAGE_ROLES)] }, async (request, reply) => {
    const data = createSchema.parse(request.body)
    const di = await diService.create(data)
    return reply.status(201).send({ success: true, data: di })
  })

  fastify.put('/:id', { preHandler: [authenticate, authorize(DI_MANAGE_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = createSchema.partial().parse(request.body)
    const di = await diService.update(id, data)
    return reply.send({ success: true, data: di })
  })

  // ─── DI Operations ────────────────────────────────────────────────────────

  fastify.post('/:id/operations', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = operationSchema.parse(request.body)
    const op = await diService.createOperation({ diId: id, ...data })
    return reply.status(201).send({ success: true, data: op })
  })

  fastify.patch('/operations/:opId/validate', { preHandler: [authenticate, authorize(DI_VALIDATE_ROLES)] }, async (request, reply) => {
    const { opId } = request.params as { opId: string }
    const result = await diService.validateOperation(opId, request.currentUser.id)
    return reply.send({ success: true, data: result })
  })

  fastify.patch('/operations/:opId/reject', { preHandler: [authenticate, authorize(DI_VALIDATE_ROLES)] }, async (request, reply) => {
    const { opId } = request.params as { opId: string }
    const body = request.body as { motif?: string }
    const result = await diService.rejectOperation(opId, request.currentUser.id, body?.motif)
    return reply.send({ success: true, data: result })
  })

  // Upload facture for a DI operation
  fastify.post('/operations/:opId/facture', { preHandler: [authenticate] }, async (request, reply) => {
    const { opId } = request.params as { opId: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ success: false, message: 'Aucun fichier fourni' })

    const { DocumentService } = await import('../services/document.service')
    const docService = new DocumentService()

    const buffer = await data.toBuffer()
    docService.validateFile(data.mimetype, buffer.byteLength)
    const { url } = await docService.saveFile(buffer, data.filename, data.mimetype)

    const { prisma } = await import('../config/database')
    const updated = await prisma.dIOperation.update({
      where: { id: opId },
      data: { factureUrl: url },
    })

    return reply.send({ success: true, data: updated })
  })
}
