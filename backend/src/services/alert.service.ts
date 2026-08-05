import { AlertSeverity, AlertType, NotificationType, Role } from '@prisma/client'
import { prisma } from '../config/database'

export class AlertService {
  async create(data: {
    type: AlertType
    message: string
    severity: AlertSeverity
    dossierId?: string
    diId?: string
    creeParId?: string
  }) {
    const alert = await prisma.alert.create({ data })

    // Push notification to all active staff
    const users = await prisma.user.findMany({
      where: { actif: true },
      select: { id: true, role: true },
    })

    const notifType: NotificationType =
      data.type === 'DI_SEUIL' ? 'DI_SEUIL' : 'ALERTE'

    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: notifType,
        titre: `Alerte ${data.severity === 'CRITICAL' ? 'CRITIQUE' : data.severity === 'WARNING' ? 'Avertissement' : 'Info'}`,
        message: data.message,
        data: {
          alertId: alert.id,
          dossierId: data.dossierId,
          diId: data.diId,
          severity: data.severity,
        },
      })),
    })

    return alert
  }

  async findAll(params: {
    lu?: boolean
    severity?: AlertSeverity
    type?: AlertType
    page?: number
    limit?: number
  }) {
    const { lu, severity, type, page = 1, limit = 50 } = params
    const skip = (page - 1) * limit

    const where = {
      ...(lu !== undefined && { lu }),
      ...(severity && { severity }),
      ...(type && { type }),
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          dossier: { select: { numero: true, client: true } },
          di: { select: { numero: true, client: true } },
        },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.alert.count({ where }),
    ])

    return { alerts, total }
  }

  async markAsRead(id: string) {
    return prisma.alert.update({
      where: { id },
      data: { lu: true, luAt: new Date() },
    })
  }

  async markAllAsRead() {
    return prisma.alert.updateMany({
      where: { lu: false },
      data: { lu: true, luAt: new Date() },
    })
  }

  async resolve(id: string) {
    return prisma.alert.update({
      where: { id },
      data: { resolue: true, resolueAt: new Date() },
    })
  }

  async checkAndCreateDIAlerts(diId: string) {
    const di = await prisma.dI.findUnique({ where: { id: diId } })
    if (!di) return

    const pct = di.montantTotal > 0 ? (di.montantConsomme / di.montantTotal) * 100 : 0

    const existingAlert = await prisma.alert.findFirst({
      where: { diId, resolue: false, type: 'DI_SEUIL' },
      orderBy: { createdAt: 'desc' },
    })

    let message = ''
    let severity: AlertSeverity = 'INFO'

    if (pct >= 100 && (!existingAlert || existingAlert.message.indexOf('épuisée') === -1)) {
      message = `DI ${di.numero} (${di.client}) est entièrement épuisée (100%)`
      severity = 'CRITICAL'
    } else if (pct >= 90 && (!existingAlert || existingAlert.message.indexOf('90%') === -1)) {
      message = `Attention: la DI ${di.numero} n'a plus que ${(100 - pct).toFixed(0)}% de solde (seuil 90%)`
      severity = 'CRITICAL'
    } else if (pct >= 75 && (!existingAlert || existingAlert.message.indexOf('75%') === -1)) {
      message = `Avertissement: la DI ${di.numero} a consommé 75% de son montant`
      severity = 'WARNING'
    } else if (pct >= 50 && (!existingAlert || existingAlert.message.indexOf('50%') === -1)) {
      message = `Info: la DI ${di.numero} a consommé 50% de son montant`
      severity = 'INFO'
    }

    if (message) {
      await this.create({ type: 'DI_SEUIL', message, severity, diId })
    }

    // Auto-mark DI as EPUISEE
    if (pct >= 100 && di.statut === 'ACTIVE') {
      await prisma.dI.update({ where: { id: diId }, data: { statut: 'EPUISEE' } })
    }
  }
}
