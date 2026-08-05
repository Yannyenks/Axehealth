import { DIStatut, DIOperationStatut } from '@prisma/client'
import { prisma } from '../config/database'
import { NotFoundError, BusinessError, ConflictError } from '../utils/errors'
import { generateDINumber, calculateDISolde, buildPaginatedResult, paginate } from '../utils/helpers'
import { AlertService } from './alert.service'

const alertService = new AlertService()

export class DIService {
  async create(data: {
    client: string
    montantTotal: number
    dateExpiration: string
    notes?: string
  }) {
    const numero = generateDINumber()
    return prisma.dI.create({
      data: {
        numero,
        client: data.client,
        montantTotal: data.montantTotal,
        dateExpiration: new Date(data.dateExpiration),
        notes: data.notes,
      },
    })
  }

  async findAll(params: {
    client?: string
    statut?: DIStatut
    page?: number
    limit?: number
  }) {
    const { client, statut, page = 1, limit = 20 } = params
    const { skip, take } = paginate(page, limit)

    const where = {
      ...(client && { client: { contains: client, mode: 'insensitive' as const } }),
      ...(statut && { statut }),
    }

    const [dis, total] = await Promise.all([
      prisma.dI.findMany({
        where,
        include: {
          operations: {
            where: { statut: 'VALIDE' },
            select: { montant: true, dossierId: true, date: true },
          },
          dossiers: { select: { id: true, numero: true, client: true } },
          _count: { select: { operations: true, dossiers: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.dI.count({ where }),
    ])

    const enriched = dis.map((di) => ({
      ...di,
      ...calculateDISolde(di.montantTotal, di.montantConsomme),
    }))

    return buildPaginatedResult(enriched, total, page, limit)
  }

  async findById(id: string) {
    const di = await prisma.dI.findUnique({
      where: { id },
      include: {
        dossiers: { select: { id: true, numero: true, client: true, status: true } },
        operations: {
          include: {
            dossier: { select: { numero: true, client: true } },
            validateur: { select: { nom: true, prenom: true } },
          },
          orderBy: { date: 'desc' },
        },
        alertes: { where: { resolue: false }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!di) throw new NotFoundError('DI', id)

    return { ...di, ...calculateDISolde(di.montantTotal, di.montantConsomme) }
  }

  async update(id: string, data: Partial<{ client: string; montantTotal: number; dateExpiration: string; statut: DIStatut; notes: string }>) {
    const di = await prisma.dI.findUnique({ where: { id } })
    if (!di) throw new NotFoundError('DI', id)

    if (data.montantTotal !== undefined && data.montantTotal < di.montantConsomme) {
      throw new BusinessError('Le nouveau montant total ne peut pas être inférieur au montant déjà consommé')
    }

    return prisma.dI.update({
      where: { id },
      data: {
        ...(data.client && { client: data.client }),
        ...(data.montantTotal !== undefined && { montantTotal: data.montantTotal }),
        ...(data.dateExpiration && { dateExpiration: new Date(data.dateExpiration) }),
        ...(data.statut && { statut: data.statut }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
  }

  // ─── DI Operations ────────────────────────────────────────────────────────

  async createOperation(data: {
    diId: string
    dossierId: string
    nombreConteneurs: number
    montant: number
    factureNumero?: string
    factureUrl?: string
    commentaire?: string
  }) {
    const di = await prisma.dI.findUnique({ where: { id: data.diId } })
    if (!di) throw new NotFoundError('DI', data.diId)
    if (di.statut !== 'ACTIVE') throw new BusinessError(`DI ${di.numero} n'est pas active (statut: ${di.statut})`)

    const dossier = await prisma.dossier.findUnique({ where: { id: data.dossierId } })
    if (!dossier) throw new NotFoundError('Dossier', data.dossierId)

    const solde = di.montantTotal - di.montantConsomme
    if (data.montant > solde) {
      throw new BusinessError(
        `Montant (${data.montant}) supérieur au solde DI disponible (${solde}). Solde insuffisant.`,
        'DI_SOLDE_INSUFFISANT',
      )
    }

    return prisma.dIOperation.create({
      data: {
        diId: data.diId,
        dossierId: data.dossierId,
        nombreConteneurs: data.nombreConteneurs,
        montant: data.montant,
        factureNumero: data.factureNumero,
        factureUrl: data.factureUrl,
        commentaire: data.commentaire,
      },
      include: {
        di: { select: { numero: true, montantTotal: true, montantConsomme: true } },
        dossier: { select: { numero: true, client: true } },
      },
    })
  }

  async validateOperation(operationId: string, validateurId: string) {
    const op = await prisma.dIOperation.findUnique({
      where: { id: operationId },
      include: { di: true },
    })
    if (!op) throw new NotFoundError('Opération DI', operationId)
    if (op.statut !== 'EN_ATTENTE') {
      throw new BusinessError(`Opération déjà ${op.statut.toLowerCase()}`)
    }

    const di = op.di
    const newConsomme = di.montantConsomme + op.montant

    if (newConsomme > di.montantTotal) {
      throw new BusinessError('Validation impossible: dépasserait le montant total de la DI')
    }

    // Update operation + DI in a transaction
    const [updatedOp, updatedDI] = await prisma.$transaction([
      prisma.dIOperation.update({
        where: { id: operationId },
        data: { statut: 'VALIDE', validateurId, validatedAt: new Date() },
      }),
      prisma.dI.update({
        where: { id: di.id },
        data: { montantConsomme: newConsomme },
      }),
    ])

    // Check thresholds and create alerts
    await alertService.checkAndCreateDIAlerts(di.id)

    return { operation: updatedOp, di: updatedDI, ...calculateDISolde(updatedDI.montantTotal, updatedDI.montantConsomme) }
  }

  async rejectOperation(operationId: string, validateurId: string, motif?: string) {
    const op = await prisma.dIOperation.findUnique({ where: { id: operationId } })
    if (!op) throw new NotFoundError('Opération DI', operationId)
    if (op.statut !== 'EN_ATTENTE') throw new BusinessError(`Opération déjà ${op.statut.toLowerCase()}`)

    return prisma.dIOperation.update({
      where: { id: operationId },
      data: {
        statut: 'REJETE',
        validateurId,
        validatedAt: new Date(),
        commentaire: motif ? `Rejeté: ${motif}` : op.commentaire,
      },
    })
  }

  async getConsumptionHistory(diId: string) {
    const di = await prisma.dI.findUnique({ where: { id: diId } })
    if (!di) throw new NotFoundError('DI', diId)

    const operations = await prisma.dIOperation.findMany({
      where: { diId, statut: 'VALIDE' },
      include: {
        dossier: { select: { numero: true, client: true } },
        validateur: { select: { nom: true, prenom: true } },
      },
      orderBy: { validatedAt: 'asc' },
    })

    // Build running balance
    let runningBalance = di.montantTotal
    return operations.map((op) => {
      runningBalance -= op.montant
      return { ...op, soldeApres: runningBalance }
    })
  }
}
