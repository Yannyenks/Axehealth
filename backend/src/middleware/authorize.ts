import { FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@prisma/client'
import { ForbiddenError } from '../utils/errors'

export function authorize(roles: Role[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = request.currentUser
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenError(
        `Rôle requis: ${roles.join(' ou ')}. Votre rôle: ${user?.role || 'inconnu'}`,
      )
    }
  }
}

export function authorizeSite(site: 'DOUALA' | 'KRIBI') {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = request.currentUser
    // DG and Exploitation can access all sites
    if (['DIRECTEUR_GENERAL', 'RESPONSABLE_EXPLOITATION'].includes(user.role)) return
    if (user.site !== site) {
      throw new ForbiddenError(`Accès limité au site ${site}`)
    }
  }
}
