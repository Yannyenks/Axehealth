import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { DossierService } from '../services/dossier.service'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { Role } from '@prisma/client'

const dossierService = new DossierService()

const ALL_ROLES: Role[] = [
  'DIRECTEUR_GENERAL','RESPONSABLE_EXPLOITATION','RESPONSABLE_LOGISTIQUE',
  'RESPONSABLE_VALIDATION','RESPONSABLE_SORTIES','SERVICE_ADMINISTRATIF',
  'COMPTABLE','RESPONSABLE_DOUANIER',
]

const CREATE_ROLES: Role[] = ['DIRECTEUR_GENERAL','RESPONSABLE_EXPLOITATION','SERVICE_ADMINISTRATIF']
const EDIT_ROLES: Role[] = ['DIRECTEUR_GENERAL','RESPONSABLE_EXPLOITATION','RESPONSABLE_VALIDATION','RESPONSABLE_SORTIES','SERVICE_ADMINISTRATIF']

const createSchema = z.object({
  client: z.string().min(2),
  compagnie: z.enum(['MSC','COSCO','MAERSK','CMA_CGM']),
  marchandise: z.string().min(2),
  site: z.enum(['DOUALA','KRIBI']),
  priorite: z.enum(['HAUTE','MOYENNE','BASSE']).default('MOYENNE'),
  dateArrivee: z.string(),
  dateLimiteSortie: z.string().optional(),
  notes: z.string().optional(),
  responsableId: z.string(),
  diId: z.string().optional(),
  numeroDI: z.string().optional(),
  conteneurs: z.array(z.object({
    numero: z.string(),
    type: z.string().optional(),
    taille: z.enum(['X20','X40','X40HC','X45']).optional(),
  })).optional(),
})

const updateSchema = z.object({
  client: z.string().optional(),
  marchandise: z.string().optional(),
  priorite: z.enum(['HAUTE','MOYENNE','BASSE']).optional(),
  responsableId: z.string().optional(),
  notes: z.string().optional(),
  dateLimiteSortie: z.string().optional(),
  montantTaxes: z.number().optional(),
  montantHonoraires: z.number().optional(),
  montantRedevances: z.number().optional(),
})

export const dossierRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const result = await dossierService.findAll({
      status: q.status,
      site: q.site,
      compagnie: q.compagnie,
      priorite: q.priorite,
      responsableId: q.responsableId,
      search: q.search,
      page: parseInt(q.page || '1'),
      limit: parseInt(q.limit || '20'),
    })
    return reply.send({ success: true, ...result })
  })

  fastify.get('/kanban', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await dossierService.getKanbanData()
    return reply.send({ success: true, data })
  })

  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const dossier = await dossierService.findById(id)
    return reply.send({ success: true, data: dossier })
  })

  fastify.post('/', { preHandler: [authenticate, authorize(CREATE_ROLES)] }, async (request, reply) => {
    const data = createSchema.parse(request.body)
    const dossier = await dossierService.create({
      ...data,
      createurId: request.currentUser.id,
    })
    return reply.status(201).send({ success: true, data: dossier })
  })

  fastify.put('/:id', { preHandler: [authenticate, authorize(EDIT_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateSchema.parse(request.body)
    const dossier = await dossierService.updateDossier(id, data, request.currentUser.id)
    return reply.send({ success: true, data: dossier })
  })

  fastify.post('/:id/advance', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { commentaire?: string }
    const dossier = await dossierService.advanceStatus(id, request.currentUser.id, body?.commentaire)
    return reply.send({ success: true, data: dossier })
  })

  fastify.post('/:id/comments', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { message: string }
    if (!body?.message?.trim()) {
      return reply.status(400).send({ success: false, message: 'Le commentaire ne peut pas être vide' })
    }
    const comment = await dossierService.addComment(id, request.currentUser.id, body.message)
    return reply.status(201).send({ success: true, data: comment })
  })

  fastify.post('/:id/link-di', { preHandler: [authenticate, authorize(EDIT_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { diId: string }
    const dossier = await dossierService.linkDI(id, body.diId, request.currentUser.id)
    return reply.send({ success: true, data: dossier })
  })
}
