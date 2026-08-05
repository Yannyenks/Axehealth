import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { authenticate } from '../middleware/authenticate'
import { NotFoundError } from '../utils/errors'

const createSchema = z.object({
  numero: z.string().min(3),
  type: z.string().optional(),
  taille: z.enum(['X20','X40','X40HC','X45']).optional(),
  notes: z.string().optional(),
})

const updateSchema = z.object({
  statut: z.enum(['EN_ATTENTE','EN_TRANSIT','SORTI','RETOURNE']).optional(),
  notes: z.string().optional(),
})

export const containerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dossier/:dossierId', { preHandler: [authenticate] }, async (request, reply) => {
    const { dossierId } = request.params as { dossierId: string }
    const containers = await prisma.container.findMany({
      where: { dossierId },
      include: {
        gatePasses: {
          include: { emetteur: { select: { nom: true, prenom: true } } },
          orderBy: { dateEmission: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ success: true, data: containers })
  })

  fastify.post('/dossier/:dossierId', { preHandler: [authenticate] }, async (request, reply) => {
    const { dossierId } = request.params as { dossierId: string }
    const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } })
    if (!dossier) throw new NotFoundError('Dossier', dossierId)

    const data = createSchema.parse(request.body)
    const container = await prisma.container.create({
      data: { ...data, dossierId },
    })

    await prisma.auditLog.create({
      data: {
        dossierId,
        userId: request.currentUser.id,
        action: 'CONTAINER_AJOUTE',
        details: { numero: data.numero },
      },
    })

    return reply.status(201).send({ success: true, data: container })
  })

  fastify.patch('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateSchema.parse(request.body)

    const container = await prisma.container.findUnique({ where: { id } })
    if (!container) throw new NotFoundError('Container', id)

    const updated = await prisma.container.update({ where: { id }, data })

    await prisma.auditLog.create({
      data: {
        dossierId: container.dossierId,
        userId: request.currentUser.id,
        action: 'CONTAINER_MODIFIE',
        details: { containerId: id, ...data },
      },
    })

    return reply.send({ success: true, data: updated })
  })

  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const container = await prisma.container.findUnique({ where: { id } })
    if (!container) throw new NotFoundError('Container', id)

    await prisma.container.delete({ where: { id } })
    return reply.send({ success: true, message: 'Container supprimé' })
  })
}
