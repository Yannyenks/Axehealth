import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import staticFiles from '@fastify/static'
import path from 'path'
import { env } from './config/env'
import { logger } from './utils/logger'
import { ApiError } from './utils/errors'
import { authRoutes } from './routes/auth.routes'
import { userRoutes } from './routes/users.routes'
import { dossierRoutes } from './routes/dossiers.routes'
import { containerRoutes } from './routes/containers.routes'
import { diRoutes } from './routes/di.routes'
import { documentRoutes } from './routes/documents.routes'
import { workflowRoutes } from './routes/workflow.routes'
import { alertRoutes } from './routes/alerts.routes'
import { messageRoutes } from './routes/messages.routes'
import { financeRoutes } from './routes/finance.routes'
import { kribiRoutes } from './routes/kribi.routes'
import { reportingRoutes } from './routes/reporting.routes'
import { slaRoutes } from './routes/sla.routes'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    ajv: {
      customOptions: { removeAdditional: 'all', coerceTypes: true, useDefaults: true },
    },
  })

  // ─── Plugins ─────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: [env.FRONTEND_URL, 'http://localhost:8080', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  })

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 5,
    },
  })

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      message: 'Trop de requêtes. Veuillez patienter une minute.',
      code: 'RATE_LIMIT',
    }),
  })

  await app.register(staticFiles, {
    root: path.resolve(env.UPLOAD_DIR),
    prefix: '/uploads/',
    decorateReply: false,
  })

  // ─── Global error handler ─────────────────────────────────────────────────

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      })
    }

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        message: 'Données invalides',
        code: 'VALIDATION_ERROR',
        details: error.validation,
      })
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        message: 'Trop de requêtes',
        code: 'RATE_LIMIT',
      })
    }

    logger.error({ err: error, url: request.url }, 'Unhandled error')
    return reply.status(500).send({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
    })
  })

  // ─── Health check ─────────────────────────────────────────────────────────

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'finitrans-api',
    version: '1.0.0',
  }))

  // ─── Routes ───────────────────────────────────────────────────────────────

  app.register(authRoutes, { prefix: `${env.API_PREFIX}/auth` })
  app.register(userRoutes, { prefix: `${env.API_PREFIX}/users` })
  app.register(dossierRoutes, { prefix: `${env.API_PREFIX}/dossiers` })
  app.register(containerRoutes, { prefix: `${env.API_PREFIX}/containers` })
  app.register(diRoutes, { prefix: `${env.API_PREFIX}/di` })
  app.register(documentRoutes, { prefix: `${env.API_PREFIX}/documents` })
  app.register(workflowRoutes, { prefix: `${env.API_PREFIX}/workflow` })
  app.register(alertRoutes, { prefix: `${env.API_PREFIX}/alertes` })
  app.register(messageRoutes, { prefix: `${env.API_PREFIX}/messages` })
  app.register(financeRoutes, { prefix: `${env.API_PREFIX}/finance` })
  app.register(kribiRoutes, { prefix: `${env.API_PREFIX}/kribi` })
  app.register(reportingRoutes, { prefix: `${env.API_PREFIX}/reporting` })
  app.register(slaRoutes, { prefix: `${env.API_PREFIX}/sla` })

  return app
}
