import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { USER_MANAGE_ROLES } from '../types'
import { NotFoundError, ConflictError } from '../utils/errors'
import { paginate } from '../utils/helpers'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nom: z.string().min(2),
  prenom: z.string().min(2),
  role: z.enum(['DIRECTEUR_GENERAL','RESPONSABLE_EXPLOITATION','RESPONSABLE_LOGISTIQUE',
    'RESPONSABLE_VALIDATION','RESPONSABLE_SORTIES','SERVICE_ADMINISTRATIF','COMPTABLE','RESPONSABLE_DOUANIER']),
  site: z.enum(['DOUALA', 'KRIBI']),
  telephone: z.string().optional(),
})

const updateUserSchema = createUserSchema.partial().omit({ password: true })

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  const adminGuard = [authenticate, authorize(USER_MANAGE_ROLES)]

  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as { site?: string; role?: string; actif?: string; page?: string; limit?: string }
    const page = parseInt(query.page || '1')
    const limit = parseInt(query.limit || '20')
    const { skip, take } = paginate(page, limit)

    const where: any = {
      ...(query.site && { site: query.site }),
      ...(query.role && { role: query.role }),
      ...(query.actif !== undefined && { actif: query.actif === 'true' }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, nom: true, prenom: true,
          role: true, site: true, telephone: true, actif: true, lastLogin: true, createdAt: true,
          _count: { select: { dossiersResponsable: true } },
        },
        orderBy: { nom: 'asc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({ success: true, data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
  })

  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, nom: true, prenom: true,
        role: true, site: true, telephone: true, actif: true, lastLogin: true, createdAt: true,
        dossiersResponsable: {
          select: { id: true, numero: true, client: true, status: true, priorite: true },
          orderBy: { dateCreation: 'desc' },
          take: 10,
        },
        _count: { select: { dossiersResponsable: true, workflowActions: true } },
      },
    })
    if (!user) throw new NotFoundError('Utilisateur', id)
    return reply.send({ success: true, data: user })
  })

  fastify.post('/', { preHandler: adminGuard }, async (request, reply) => {
    const data = createUserSchema.parse(request.body)
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new ConflictError(`Email ${data.email} déjà utilisé`)

    const hashed = await bcrypt.hash(data.password, 12)
    const user = await prisma.user.create({
      data: { ...data, email: data.email.toLowerCase(), password: hashed },
      select: { id: true, email: true, nom: true, prenom: true, role: true, site: true, actif: true },
    })

    await prisma.auditLog.create({
      data: { userId: request.currentUser.id, action: 'USER_CREE', details: { email: data.email, role: data.role } },
    })

    return reply.status(201).send({ success: true, data: user })
  })

  fastify.put('/:id', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateUserSchema.parse(request.body)

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundError('Utilisateur', id)

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, nom: true, prenom: true, role: true, site: true, telephone: true, actif: true },
    })

    await prisma.auditLog.create({
      data: { userId: request.currentUser.id, action: 'USER_MODIFIE', details: { targetId: id, ...data } },
    })

    return reply.send({ success: true, data: updated })
  })

  fastify.patch('/:id/toggle-actif', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (id === request.currentUser.id) {
      return reply.status(400).send({ success: false, message: 'Vous ne pouvez pas désactiver votre propre compte' })
    }
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundError('Utilisateur', id)

    const updated = await prisma.user.update({
      where: { id },
      data: { actif: !user.actif },
      select: { id: true, actif: true, nom: true, prenom: true },
    })

    return reply.send({ success: true, data: updated })
  })

  fastify.patch('/:id/reset-password', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { newPassword: string }
    const hashed = await bcrypt.hash(body.newPassword, 12)
    await prisma.user.update({ where: { id }, data: { password: hashed } })
    await prisma.refreshToken.deleteMany({ where: { userId: id } })
    return reply.send({ success: true, message: 'Mot de passe réinitialisé' })
  })

  fastify.get('/me/notifications', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as { lu?: string }
    const notifs = await prisma.notification.findMany({
      where: {
        userId: request.currentUser.id,
        ...(query.lu !== undefined && { lu: query.lu === 'true' }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unreadCount = await prisma.notification.count({ where: { userId: request.currentUser.id, lu: false } })
    return reply.send({ success: true, data: notifs, unreadCount })
  })

  fastify.patch('/me/notifications/:id/read', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.notification.update({ where: { id }, data: { lu: true } })
    return reply.send({ success: true })
  })

  fastify.patch('/me/notifications/read-all', { preHandler: [authenticate] }, async (request, reply) => {
    await prisma.notification.updateMany({ where: { userId: request.currentUser.id, lu: false }, data: { lu: true } })
    return reply.send({ success: true })
  })
}
