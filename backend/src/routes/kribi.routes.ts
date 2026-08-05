import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { KRIBI_ROLES } from '../types'
import { NotFoundError } from '../utils/errors'
import { generateBonNumber, generateGatePassNumber } from '../utils/helpers'

const createBonSchema = z.object({
  dossierId: z.string(),
  type: z.enum(['DOUANE','COMPAGNIE_PAK','PORTUAIRE_PAD']),
  numero: z.string().optional(),
  montant: z.number().optional(),
})

const createGatePassSchema = z.object({
  dossierId: z.string(),
  containerId: z.string().optional(),
  chauffeur: z.string().min(2),
  telephone: z.string().min(8),
  destination: z.string().min(2),
})

const dailyReportSchema = z.object({
  rapport: z.string().min(10),
  date: z.string().optional(),
})

export const kribiRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Bons ─────────────────────────────────────────────────────────────────

  fastify.get('/bons', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const where: any = {
      ...(q.dossierId && { dossierId: q.dossierId }),
      ...(q.type && { type: q.type }),
      ...(q.statut && { statut: q.statut }),
    }
    const bons = await prisma.bonKribi.findMany({
      where,
      include: {
        dossier: { select: { numero: true, client: true, compagnie: true } },
        responsable: { select: { nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return reply.send({ success: true, data: bons })
  })

  fastify.post('/bons', { preHandler: [authenticate, authorize(KRIBI_ROLES)] }, async (request, reply) => {
    const data = createBonSchema.parse(request.body)
    const dossier = await prisma.dossier.findUnique({ where: { id: data.dossierId } })
    if (!dossier) throw new NotFoundError('Dossier', data.dossierId)

    const bon = await prisma.bonKribi.create({
      data: {
        dossierId: data.dossierId,
        type: data.type,
        numero: data.numero || generateBonNumber(data.type),
        montant: data.montant,
        responsableId: request.currentUser.id,
      },
      include: {
        dossier: { select: { numero: true, client: true } },
        responsable: { select: { nom: true, prenom: true } },
      },
    })

    await prisma.auditLog.create({
      data: { dossierId: data.dossierId, userId: request.currentUser.id, action: 'BON_KRIBI_CREE', details: { type: data.type, numero: bon.numero } },
    })

    return reply.status(201).send({ success: true, data: bon })
  })

  fastify.patch('/bons/:id/statut', { preHandler: [authenticate, authorize(KRIBI_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { statut: string }

    const bon = await prisma.bonKribi.update({
      where: { id },
      data: { statut: body.statut as any },
    })

    return reply.send({ success: true, data: bon })
  })

  fastify.post('/bons/:id/facture', { preHandler: [authenticate, authorize(KRIBI_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ success: false, message: 'Aucun fichier' })

    const { DocumentService } = await import('../services/document.service')
    const docService = new DocumentService()
    const buffer = await data.toBuffer()
    docService.validateFile(data.mimetype, buffer.byteLength)
    const { url } = await docService.saveFile(buffer, data.filename, data.mimetype)

    const bon = await prisma.bonKribi.update({ where: { id }, data: { factureUrl: url } })
    return reply.send({ success: true, data: bon })
  })

  // ─── Gate Passes ──────────────────────────────────────────────────────────

  fastify.get('/gate-passes', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const gatePasses = await prisma.gatePass.findMany({
      where: {
        ...(q.dossierId && { dossierId: q.dossierId }),
        ...(q.statut && { statut: q.statut }),
      },
      include: {
        dossier: { select: { numero: true, client: true } },
        container: { select: { numero: true } },
        emetteur: { select: { nom: true, prenom: true } },
      },
      orderBy: { dateEmission: 'desc' },
      take: 100,
    })
    return reply.send({ success: true, data: gatePasses })
  })

  fastify.post('/gate-passes', { preHandler: [authenticate, authorize(KRIBI_ROLES)] }, async (request, reply) => {
    const data = createGatePassSchema.parse(request.body)
    const dossier = await prisma.dossier.findUnique({ where: { id: data.dossierId } })
    if (!dossier) throw new NotFoundError('Dossier', data.dossierId)

    const gatePass = await prisma.gatePass.create({
      data: {
        dossierId: data.dossierId,
        containerId: data.containerId,
        numero: generateGatePassNumber(),
        chauffeur: data.chauffeur,
        telephone: data.telephone,
        destination: data.destination,
        emetteurId: request.currentUser.id,
      },
      include: {
        dossier: { select: { numero: true, client: true } },
        container: { select: { numero: true } },
        emetteur: { select: { nom: true, prenom: true } },
      },
    })

    await prisma.auditLog.create({
      data: { dossierId: data.dossierId, userId: request.currentUser.id, action: 'GATE_PASS_CREE', details: { numero: gatePass.numero, chauffeur: data.chauffeur } },
    })

    return reply.status(201).send({ success: true, data: gatePass })
  })

  fastify.patch('/gate-passes/:id/transmettre', { preHandler: [authenticate, authorize(KRIBI_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const gp = await prisma.gatePass.update({
      where: { id },
      data: { statut: 'TRANSMIS', transmisAt: new Date() },
    })
    return reply.send({ success: true, data: gp })
  })

  fastify.patch('/gate-passes/:id/utilise', { preHandler: [authenticate, authorize(KRIBI_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const gp = await prisma.gatePass.update({
      where: { id },
      data: { statut: 'UTILISE', utiliseAt: new Date() },
    })

    // Mark container as SORTI if linked
    if (gp.containerId) {
      await prisma.container.update({ where: { id: gp.containerId }, data: { statut: 'SORTI' } })
    }

    return reply.send({ success: true, data: gp })
  })

  // ─── Dashboard Kribi ──────────────────────────────────────────────────────

  fastify.get('/dashboard', { preHandler: [authenticate] }, async (request, reply) => {
    const [dossiersKribi, bonsStats, gatePasses] = await Promise.all([
      prisma.dossier.findMany({
        where: { site: 'KRIBI', status: { not: 'CLOTURE' } },
        select: {
          id: true, numero: true, client: true, compagnie: true, status: true,
          _count: { select: { containers: true, bonsKribi: true, gatePasses: true } },
        },
        orderBy: { dateCreation: 'desc' },
      }),
      prisma.bonKribi.groupBy({
        by: ['type', 'statut'],
        _count: { id: true },
      }),
      prisma.gatePass.count({ where: { statut: { not: 'UTILISE' } } }),
    ])

    return reply.send({ success: true, data: { dossiersKribi, bonsStats, gatePasses } })
  })
}
