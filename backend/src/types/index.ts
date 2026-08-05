import { Role, Site } from '@prisma/client'
import { FastifyRequest } from 'fastify'

export interface JWTPayload {
  id: string
  email: string
  role: Role
  site: Site
}

export interface AuthUser {
  id: string
  email: string
  nom: string
  prenom: string
  role: Role
  site: Site
  actif: boolean
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: AuthUser
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user: JWTPayload
  }
}

// ─── Role permission helpers ──────────────────────────────────────────────────

export const ADMIN_ROLES: Role[] = ['DIRECTEUR_GENERAL']

export const WORKFLOW_PERMISSIONS: Record<string, Role[]> = {
  RECEPTION:         ['SERVICE_ADMINISTRATIF', 'RESPONSABLE_EXPLOITATION', 'DIRECTEUR_GENERAL'],
  CODAGE:            ['RESPONSABLE_VALIDATION', 'RESPONSABLE_EXPLOITATION', 'DIRECTEUR_GENERAL'],
  VALIDATION:        ['RESPONSABLE_VALIDATION', 'RESPONSABLE_EXPLOITATION', 'DIRECTEUR_GENERAL'],
  PAIEMENT:          ['RESPONSABLE_LOGISTIQUE', 'RESPONSABLE_EXPLOITATION', 'DIRECTEUR_GENERAL'],
  BON_COMPAGNIE:     ['RESPONSABLE_SORTIES', 'RESPONSABLE_EXPLOITATION', 'DIRECTEUR_GENERAL'],
  OPERATIONS_KRIBI:  ['RESPONSABLE_DOUANIER', 'RESPONSABLE_EXPLOITATION', 'DIRECTEUR_GENERAL'],
  CLOTURE:           ['RESPONSABLE_EXPLOITATION', 'DIRECTEUR_GENERAL'],
}

export const FINANCE_ROLES: Role[] = [
  'DIRECTEUR_GENERAL',
  'COMPTABLE',
  'RESPONSABLE_EXPLOITATION',
  'SERVICE_ADMINISTRATIF',
  'RESPONSABLE_LOGISTIQUE',
  'RESPONSABLE_SORTIES',
  'RESPONSABLE_DOUANIER',
]

export const DI_MANAGE_ROLES: Role[] = [
  'DIRECTEUR_GENERAL',
  'SERVICE_ADMINISTRATIF',
]

export const DI_VALIDATE_ROLES: Role[] = [
  'DIRECTEUR_GENERAL',
  'RESPONSABLE_EXPLOITATION',
]

export const KRIBI_ROLES: Role[] = [
  'DIRECTEUR_GENERAL',
  'RESPONSABLE_EXPLOITATION',
  'RESPONSABLE_DOUANIER',
]

export const REPORTING_ROLES: Role[] = [
  'DIRECTEUR_GENERAL',
  'RESPONSABLE_EXPLOITATION',
  'COMPTABLE',
]

export const USER_MANAGE_ROLES: Role[] = ['DIRECTEUR_GENERAL']

export const SLA_CONFIG_ROLES: Role[] = ['DIRECTEUR_GENERAL', 'RESPONSABLE_EXPLOITATION']
