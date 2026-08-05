import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { authenticate } from '../middleware/authenticate'
import { NotFoundError, ForbiddenError } from '../utils/errors'

const createConvSchema = z.object({
  titre: z.string().min(2),
  type: z.enum(['DOSSIER','GENERAL','URGENCE']).default('GENERAL'),
  dossierId: z.string().optional(),
  participantIds: z.array(z.string()).min(1),
})

const sendMessageSchema = z.object({
  contenu: z.string().min(1),
})

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
  // List conversations for current user
  fastify.get('/conversations', { preHandler: [authenticate] }, async (request, reply) => {
    const convs = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: request.currentUser.id } },
      },
      include: {
        dossier: { select: { numero: true, client: true } },
        participants: {
          include: { user: { select: { id: true, nom: true, prenom: true, role: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { auteur: { select: { nom: true, prenom: true } } },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Compute unread per conversation
    const enriched = await Promise.all(
      convs.map(async (conv) => {
        const participant = conv.participants.find((p) => p.userId === request.currentUser.id)
        const unread = await prisma.message.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: participant?.lastReadAt || new Date(0) },
            auteurId: { not: request.currentUser.id },
          },
        })
        return { ...conv, unread }
      }),
    )

    return reply.send({ success: true, data: enriched })
  })

  // Create conversation
  fastify.post('/conversations', { preHandler: [authenticate] }, async (request, reply) => {
    const data = createConvSchema.parse(request.body)
    const allParticipants = Array.from(new Set([...data.participantIds, request.currentUser.id]))

    const conv = await prisma.conversation.create({
      data: {
        titre: data.titre,
        type: data.type,
        dossierId: data.dossierId,
        participants: {
          create: allParticipants.map((userId) => ({ userId })),
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, nom: true, prenom: true } } } },
      },
    })

    return reply.status(201).send({ success: true, data: conv })
  })

  // Get messages in a conversation
  fastify.get('/conversations/:id/messages', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const q = request.query as { page?: string; limit?: string }
    const page = parseInt(q.page || '1')
    const limit = parseInt(q.limit || '50')

    // Check participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: request.currentUser.id } },
    })
    if (!participant) throw new ForbiddenError('Vous n\'êtes pas membre de cette conversation')

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: id },
        include: { auteur: { select: { id: true, nom: true, prenom: true, role: true } } },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where: { conversationId: id } }),
    ])

    // Mark as read
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: request.currentUser.id } },
      data: { lastReadAt: new Date() },
    })

    return reply.send({ success: true, data: messages, meta: { total, page, limit } })
  })

  // Send message
  fastify.post('/conversations/:id/messages', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { contenu } = sendMessageSchema.parse(request.body)

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: request.currentUser.id } },
    })
    if (!participant) throw new ForbiddenError('Vous n\'êtes pas membre de cette conversation')

    const message = await prisma.message.create({
      data: { conversationId: id, auteurId: request.currentUser.id, contenu },
      include: { auteur: { select: { id: true, nom: true, prenom: true, role: true } } },
    })

    // Update conversation updatedAt
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } })

    // Notify other participants
    const others = await prisma.conversationParticipant.findMany({
      where: { conversationId: id, userId: { not: request.currentUser.id } },
      select: { userId: true },
    })

    if (others.length > 0) {
      await prisma.notification.createMany({
        data: others.map((p) => ({
          userId: p.userId,
          type: 'MESSAGE' as const,
          titre: 'Nouveau message',
          message: `${request.currentUser.nom} ${request.currentUser.prenom}: ${contenu.substring(0, 80)}...`,
          data: { conversationId: id, messageId: message.id },
        })),
      })
    }

    return reply.status(201).send({ success: true, data: message })
  })

  // Add participant to conversation
  fastify.post('/conversations/:id/participants', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { userId: string }

    const conv = await prisma.conversation.findUnique({ where: { id } })
    if (!conv) throw new NotFoundError('Conversation', id)

    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: id, userId: body.userId } },
      update: {},
      create: { conversationId: id, userId: body.userId },
    })

    return reply.send({ success: true })
  })
}
