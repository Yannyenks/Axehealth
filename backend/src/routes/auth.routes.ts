import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AuthService } from '../services/auth.service'
import { authenticate } from '../middleware/authenticate'
import { env } from '../config/env'

const authService = new AuthService()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
})

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body)
    const user = await authService.login(email, password)

    const accessToken = fastify.jwt.sign(
      { id: user.id, email: user.email, role: user.role, site: user.site },
      { expiresIn: env.JWT_EXPIRES_IN },
    )

    const refreshToken = fastify.jwt.sign(
      { id: user.id },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_EXPIRES_IN },
    )

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    await authService.saveRefreshToken(user.id, refreshToken, expiresAt)

    reply.setCookie?.('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
    })

    return reply.send({
      success: true,
      data: { user, accessToken, refreshToken },
    })
  })

  fastify.post('/refresh', async (request, reply) => {
    const body = request.body as { refreshToken?: string }
    const token = body?.refreshToken
    if (!token) return reply.status(400).send({ success: false, message: 'Refresh token requis' })

    let payload: { id: string }
    try {
      payload = fastify.jwt.verify(token, { secret: env.JWT_REFRESH_SECRET }) as { id: string }
    } catch {
      return reply.status(401).send({ success: false, message: 'Refresh token invalide' })
    }

    const user = await authService.validateRefreshToken(token)
    await authService.revokeRefreshToken(token)

    const newAccessToken = fastify.jwt.sign(
      { id: user.id, email: user.email, role: user.role, site: user.site },
      { expiresIn: env.JWT_EXPIRES_IN },
    )
    const newRefreshToken = fastify.jwt.sign(
      { id: user.id },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_EXPIRES_IN },
    )

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    await authService.saveRefreshToken(user.id, newRefreshToken, expiresAt)

    return reply.send({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } })
  })

  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as { refreshToken?: string }
    if (body?.refreshToken) {
      await authService.revokeRefreshToken(body.refreshToken)
    }
    return reply.send({ success: true, message: 'Déconnexion réussie' })
  })

  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    return reply.send({ success: true, data: request.currentUser })
  })

  fastify.put('/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body)
    await authService.changePassword(request.currentUser.id, currentPassword, newPassword)
    await authService.revokeAllUserTokens(request.currentUser.id)
    return reply.send({ success: true, message: 'Mot de passe modifié. Veuillez vous reconnecter.' })
  })
}
