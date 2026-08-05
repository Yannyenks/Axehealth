import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { SLAService } from '../services/sla.service'
import { authenticate } from '../middleware/authenticate'
import { authorize } from '../middleware/authorize'
import { SLA_CONFIG_ROLES } from '../types'
import { DossierStatus } from '@prisma/client'

const slaService = new SLAService()

const updateSLASchema = z.object({
  etape: z.enum(['RECEPTION','CODAGE','VALIDATION','PAIEMENT','BON_COMPAGNIE','OPERATIONS_KRIBI','CLOTURE']),
  slaHeures: z.number().positive(),
})

export const slaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const config = await slaService.getSLAConfig()
    const { prisma } = await import('../config/database')
    const dbConfigs = await prisma.sLAConfig.findMany()
    return reply.send({ success: true, data: dbConfigs, rawConfig: config })
  })

  fastify.put('/:etape', { preHandler: [authenticate, authorize(SLA_CONFIG_ROLES)] }, async (request, reply) => {
    const { etape } = request.params as { etape: string }
    const body = request.body as { slaHeures: number }

    const updated = await slaService.updateSLA(etape as DossierStatus, body.slaHeures, request.currentUser.id)
    return reply.send({ success: true, data: updated })
  })

  fastify.post('/reset-defaults', { preHandler: [authenticate, authorize(SLA_CONFIG_ROLES)] }, async (request, reply) => {
    await slaService.initializeDefaults()
    return reply.send({ success: true, message: 'SLA réinitialisés aux valeurs par défaut' })
  })

  // Get SLA status overview
  fastify.get('/status', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await slaService.checkAllRunningSteps()
    return reply.send({ success: true, message: 'Vérification SLA effectuée' })
  })
}
