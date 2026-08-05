import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../../.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_PREFIX: z.string().default('/api'),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(20),
  ALLOWED_MIME_TYPES: z
    .string()
    .default('application/pdf,image/jpeg,image/png,image/webp'),

  FRONTEND_URL: z.string().default('http://localhost:8080'),

  DI_ALERT_50: z.coerce.number().default(50),
  DI_ALERT_75: z.coerce.number().default(75),
  DI_ALERT_90: z.coerce.number().default(90),

  SLA_RECEPTION: z.coerce.number().default(48),
  SLA_CODAGE: z.coerce.number().default(24),
  SLA_VALIDATION: z.coerce.number().default(24),
  SLA_PAIEMENT: z.coerce.number().default(48),
  SLA_BON_COMPAGNIE: z.coerce.number().default(24),
  SLA_OPERATIONS_KRIBI: z.coerce.number().default(72),
  SLA_CLOTURE: z.coerce.number().default(24),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
