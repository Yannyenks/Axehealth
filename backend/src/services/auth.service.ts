import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import { UnauthorizedError, NotFoundError, ConflictError } from '../utils/errors'

export class AuthService {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (!user) throw new UnauthorizedError('Email ou mot de passe incorrect')
    if (!user.actif) throw new UnauthorizedError('Compte désactivé. Contactez l\'administrateur')

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new UnauthorizedError('Email ou mot de passe incorrect')

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const { password: _, ...safeUser } = user
    return safeUser
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('Utilisateur', userId)

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) throw new UnauthorizedError('Mot de passe actuel incorrect')

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date) {
    await prisma.refreshToken.create({ data: { userId, token, expiresAt } })
  }

  async validateRefreshToken(token: string) {
    const rt = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true, role: true, site: true, actif: true } } },
    })
    if (!rt) throw new UnauthorizedError('Refresh token invalide')
    if (rt.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { token } })
      throw new UnauthorizedError('Refresh token expiré')
    }
    if (!rt.user.actif) throw new UnauthorizedError('Compte désactivé')
    return rt.user
  }

  async revokeRefreshToken(token: string) {
    await prisma.refreshToken.deleteMany({ where: { token } })
  }

  async revokeAllUserTokens(userId: string) {
    await prisma.refreshToken.deleteMany({ where: { userId } })
  }
}
