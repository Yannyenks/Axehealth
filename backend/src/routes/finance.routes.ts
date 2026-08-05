import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { FINANCE_ROLES } from '../types'
import { NotFoundError } from '../utils/errors'
import { Role } from '@prisma/client'

const customsPaymentSchema = z.object({
  dossierId: z.string(),
  type: z.enum(['DROITS','TAXES','REDEVANCES','PENALITE']),
  montant: z.number().positive(),
  reference: z.string().optional(),
  date: z.string().optional(),
})

const companyPaymentSchema = z.object({
  dossierId: z.string(),
  compagnie: z.enum(['MSC','COSCO','MAERSK','CMA_CGM']),
  type: z.enum(['SURESTARIES','FRAIS_PORTUAIRES','MANUTENTION','TERMINAL']),
  montant: z.number().positive(),
  reference: z.string().optional(),
  date: z.string().optional(),
})

const transferSchema = z.object({
  montant: z.number().positive(),
  description: z.string().min(3),
  compteSource: z.string().min(2),
  compteDestination: z.string().min(2),
  reference: z.string().optional(),
})

const PAYMENT_ROLES: Role[] = ['DIRECTEUR_GENERAL','RESPONSABLE_LOGISTIQUE','RESPONSABLE_SORTIES','RESPONSABLE_DOUANIER','RESPONSABLE_EXPLOITATION']
const ACCOUNTING_ROLES: Role[] = ['DIRECTEUR_GENERAL','COMPTABLE','RESPONSABLE_EXPLOITATION']
const TRANSFER_ROLES: Role[] = ['DIRECTEUR_GENERAL','COMPTABLE','SERVICE_ADMINISTRATIF']

export const financeRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Summary ──────────────────────────────────────────────────────────────

  fastify.get('/summary', { preHandler: [authenticate] }, async (request, reply) => {
    const [douane, compagnie, pendingD, pendingC, transfers] = await Promise.all([
      prisma.customsPayment.aggregate({ _sum: { montant: true } }),
      prisma.companyPayment.aggregate({ _sum: { montant: true } }),
      prisma.customsPayment.aggregate({ where: { statut: 'EN_ATTENTE' }, _sum: { montant: true } }),
      prisma.companyPayment.aggregate({ where: { statut: 'EN_ATTENTE' }, _sum: { montant: true } }),
      prisma.transfer.aggregate({ _sum: { montant: true } }),
    ])
    return reply.send({
      success: true,
      data: {
        totalDouane: douane._sum.montant || 0,
        totalCompagnie: compagnie._sum.montant || 0,
        enAttenteDouane: pendingD._sum.montant || 0,
        enAttenteCompagnie: pendingC._sum.montant || 0,
        totalTransfers: transfers._sum.montant || 0,
      },
    })
  })

  // ─── Customs Payments ─────────────────────────────────────────────────────

  fastify.get('/douane', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const where: any = {
      ...(q.dossierId && { dossierId: q.dossierId }),
      ...(q.statut && { statut: q.statut }),
      ...(q.type && { type: q.type }),
    }
    const payments = await prisma.customsPayment.findMany({
      where,
      include: { dossier: { select: { numero: true, client: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    })
    return reply.send({ success: true, data: payments })
  })

  fastify.post('/douane', { preHandler: [authenticate, authorize(PAYMENT_ROLES)] }, async (request, reply) => {
    const data = customsPaymentSchema.parse(request.body)
    const payment = await prisma.customsPayment.create({
      data: { ...data, date: data.date ? new Date(data.date) : new Date() },
      include: { dossier: { select: { numero: true } } },
    })
    await prisma.auditLog.create({
      data: { dossierId: data.dossierId, userId: request.currentUser.id, action: 'PAIEMENT_DOUANE_CREE', details: data },
    })
    return reply.status(201).send({ success: true, data: payment })
  })

  fastify.patch('/douane/:id/pay', { preHandler: [authenticate, authorize(PAYMENT_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const payment = await prisma.customsPayment.update({
      where: { id },
      data: { statut: 'PAYE', paidAt: new Date() },
    })
    await prisma.auditLog.create({
      data: { dossierId: payment.dossierId, userId: request.currentUser.id, action: 'PAIEMENT_DOUANE_PAYE', details: { id } },
    })
    return reply.send({ success: true, data: payment })
  })

  // ─── Company Payments ─────────────────────────────────────────────────────

  fastify.get('/compagnie', { preHandler: [authenticate] }, async (request, reply) => {
    const q = request.query as any
    const where: any = {
      ...(q.dossierId && { dossierId: q.dossierId }),
      ...(q.compagnie && { compagnie: q.compagnie }),
      ...(q.statut && { statut: q.statut }),
    }
    const payments = await prisma.companyPayment.findMany({
      where,
      include: { dossier: { select: { numero: true, client: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    })
    return reply.send({ success: true, data: payments })
  })

  fastify.post('/compagnie', { preHandler: [authenticate, authorize(PAYMENT_ROLES)] }, async (request, reply) => {
    const data = companyPaymentSchema.parse(request.body)
    const payment = await prisma.companyPayment.create({
      data: { ...data, date: data.date ? new Date(data.date) : new Date() },
      include: { dossier: { select: { numero: true } } },
    })
    await prisma.auditLog.create({
      data: { dossierId: data.dossierId, userId: request.currentUser.id, action: 'PAIEMENT_COMPAGNIE_CREE', details: data },
    })
    return reply.status(201).send({ success: true, data: payment })
  })

  fastify.patch('/compagnie/:id/pay', { preHandler: [authenticate, authorize(PAYMENT_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const payment = await prisma.companyPayment.update({
      where: { id },
      data: { statut: 'PAYE', paidAt: new Date() },
    })
    return reply.send({ success: true, data: payment })
  })

  // ─── Transfers ────────────────────────────────────────────────────────────

  fastify.get('/transfers', { preHandler: [authenticate, authorize(ACCOUNTING_ROLES)] }, async (request, reply) => {
    const transfers = await prisma.transfer.findMany({ orderBy: { date: 'desc' }, take: 100 })
    return reply.send({ success: true, data: transfers })
  })

  fastify.post('/transfers', { preHandler: [authenticate, authorize(TRANSFER_ROLES)] }, async (request, reply) => {
    const data = transferSchema.parse(request.body)
    const transfer = await prisma.transfer.create({
      data: { ...data, date: new Date() },
    })
    await prisma.auditLog.create({
      data: { userId: request.currentUser.id, action: 'TRANSFER_CREE', details: data },
    })
    return reply.status(201).send({ success: true, data: transfer })
  })

  fastify.patch('/transfers/:id/validate', { preHandler: [authenticate, authorize(ACCOUNTING_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const transfer = await prisma.transfer.update({ where: { id }, data: { statut: 'PAYE' } })
    return reply.send({ success: true, data: transfer })
  })

  // ─── By company summary ───────────────────────────────────────────────────

  fastify.get('/par-compagnie', { preHandler: [authenticate] }, async (request, reply) => {
    const compagnies = ['MSC', 'COSCO', 'MAERSK', 'CMA_CGM']
    const data = await Promise.all(
      compagnies.map(async (comp) => {
        const [dossiers, payments] = await Promise.all([
          prisma.dossier.count({ where: { compagnie: comp as any } }),
          prisma.companyPayment.aggregate({
            where: { compagnie: comp as any },
            _sum: { montant: true },
          }),
        ])
        return { compagnie: comp, dossiers, totalPaiements: payments._sum.montant || 0 }
      }),
    )
    return reply.send({ success: true, data })
  })
}
