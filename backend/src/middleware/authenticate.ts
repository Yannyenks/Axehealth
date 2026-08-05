import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../config/database'
import { UnauthorizedError } from '../utils/errors'

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    throw new UnauthorizedError('Token invalide ou expiré')
  }

  const payload = request.user as { id: string }
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, nom: true, prenom: true, role: true, site: true, actif: true },
  })

  if (!user) throw new UnauthorizedError('Utilisateur introuvable')
  if (!user.actif) throw new UnauthorizedError('Compte désactivé')

  request.currentUser = user
}
