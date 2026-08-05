import { DossierStatus } from '@prisma/client'

export function generateDossierNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 9000) + 1000
  return `DOS-${year}-${random}`
}

export function generateDINumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 9000) + 1000
  return `DI-${year}-${random}`
}

export function generateGatePassNumber(): string {
  const date = new Date()
  const prefix = `GP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
  const random = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${random}`
}

export function generateBonNumber(type: string): string {
  const date = new Date()
  const prefix = type.substring(0, 3).toUpperCase()
  const random = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${date.getFullYear()}-${random}`
}

export function calculateDISolde(montantTotal: number, montantConsomme: number) {
  const solde = montantTotal - montantConsomme
  const pourcentageConsomme = montantTotal > 0 ? (montantConsomme / montantTotal) * 100 : 0
  const pourcentageRestant = 100 - pourcentageConsomme
  return { solde, pourcentageConsomme, pourcentageRestant }
}

export function getDIAlertLevel(pourcentageConsomme: number): 'none' | 'warning_50' | 'warning_75' | 'critical_90' | 'epuisee' {
  if (pourcentageConsomme >= 100) return 'epuisee'
  if (pourcentageConsomme >= 90) return 'critical_90'
  if (pourcentageConsomme >= 75) return 'warning_75'
  if (pourcentageConsomme >= 50) return 'warning_50'
  return 'none'
}

export function getNextStatus(current: DossierStatus): DossierStatus | null {
  const flow: DossierStatus[] = [
    'RECEPTION',
    'CODAGE',
    'VALIDATION',
    'PAIEMENT',
    'BON_COMPAGNIE',
    'OPERATIONS_KRIBI',
    'CLOTURE',
  ]
  const idx = flow.indexOf(current)
  return idx < flow.length - 1 ? flow[idx + 1] : null
}

export function formatCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(amount)
}

export function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m}min`
}

export function paginate(page: number, limit: number) {
  const take = Math.min(limit, 100)
  const skip = (page - 1) * take
  return { take, skip }
}

export type PaginatedResult<T> = {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit)
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}
