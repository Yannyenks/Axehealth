import cron from 'node-cron'
import { prisma } from '../config/database'
import { AlertService } from '../services/alert.service'
import { logger } from '../utils/logger'

const alertService = new AlertService()

// Run daily at 08:00 — check DI expirations and low balance
export function startDIMonitor() {
  cron.schedule('0 8 * * *', async () => {
    try {
      const now = new Date()
      const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000)

      // DIs expiring in <= 7 days
      const expiring = await prisma.dI.findMany({
        where: {
          statut: 'ACTIVE',
          dateExpiration: { lte: in7Days, gte: now },
        },
      })

      for (const di of expiring) {
        const daysLeft = Math.ceil((di.dateExpiration.getTime() - now.getTime()) / (24 * 3600 * 1000))
        const existing = await prisma.alert.findFirst({
          where: { diId: di.id, type: 'EXPIRATION_DI', resolue: false },
        })
        if (!existing) {
          await alertService.create({
            type: 'EXPIRATION_DI',
            severity: daysLeft <= 2 ? 'CRITICAL' : 'WARNING',
            message: `DI ${di.numero} (${di.client}) expire dans ${daysLeft} jour(s) le ${di.dateExpiration.toLocaleDateString('fr-FR')}`,
            diId: di.id,
          })
        }
      }

      // Mark expired DIs
      await prisma.dI.updateMany({
        where: { statut: 'ACTIVE', dateExpiration: { lt: now } },
        data: { statut: 'EXPIREE' },
      })

      // Recheck DI balance thresholds for all active DIs
      const activeDIs = await prisma.dI.findMany({ where: { statut: 'ACTIVE' } })
      for (const di of activeDIs) {
        await alertService.checkAndCreateDIAlerts(di.id)
      }

      logger.debug(`DI monitor: checked ${activeDIs.length} DIs, ${expiring.length} expiring soon`)
    } catch (err) {
      logger.error({ err }, 'DI monitor: error during check')
    }
  })

  logger.info('📋 DI monitor scheduled (daily at 08:00)')
}
