import { buildApp } from './app'
import { env } from './config/env'
import { logger } from './utils/logger'
import { prisma } from './config/database'
import { SLAService } from './services/sla.service'
import { startSLAMonitor } from './jobs/sla-monitor'
import { startDIMonitor } from './jobs/di-monitor'

async function main() {
  const app = await buildApp()

  // Test DB connection
  await prisma.$connect()
  logger.info('📦 Database connected')

  // Initialize SLA defaults
  const slaService = new SLAService()
  await slaService.initializeDefaults()
  logger.info('⏱  SLA defaults initialized')

  // Start background jobs
  startSLAMonitor()
  startDIMonitor()
  logger.info('⚙️  Background jobs started')

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  logger.info(`🚀 FINITRANS API running on http://0.0.0.0:${env.PORT}`)
  logger.info(`📖 Health: http://localhost:${env.PORT}/health`)
}

process.on('SIGINT', async () => {
  logger.info('Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})

main().catch((err) => {
  logger.error(err, 'Failed to start server')
  process.exit(1)
})
