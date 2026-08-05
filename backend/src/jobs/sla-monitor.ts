import cron from 'node-cron'
import { SLAService } from '../services/sla.service'
import { logger } from '../utils/logger'

const slaService = new SLAService()

// Run every 30 minutes — check all running workflow steps for SLA violations
export function startSLAMonitor() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      await slaService.checkAllRunningSteps()
      logger.debug('SLA monitor: check completed')
    } catch (err) {
      logger.error({ err }, 'SLA monitor: error during check')
    }
  })

  logger.info('⏱  SLA monitor scheduled (every 30 minutes)')
}
