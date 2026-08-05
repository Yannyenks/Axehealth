import { DossierStatus, Compagnie, Site, Priorite } from '@prisma/client'
import { prisma } from '../config/database'
import { NotFoundError, BusinessError } from '../utils/errors'
import { generateDossierNumber, getNextStatus, buildPaginatedResult, paginate } from '../utils/helpers'
import { SLAService } from './sla.service'
import { AlertService } from './alert.service'

const slaService = new SLAService()
const alertService = new AlertService()

const DOSSIER_SELECT = {
  id: true, numero: true, client: true, compagnie: true, marchandise: true,
  site: true, status: true, priorite: true, dateCreation: true, dateArrivee: true,
  dateLimiteSortie: true, notes: true, closedAt: true, numeroDI: true,
  montantTaxes: true, montantHonoraires: true, montantRedevances: true,
  responsable: { select: { id: true, nom: true, prenom: true, role: true } },
  createur: { select: { id: true, nom: true, prenom: true } },
  di: { select: { id: true, numero: true, montantTotal: true, montantConsomme: true, statut: true } },
  _count: { select: { containers: true, documents: true, alertes: true } },
}

export class DossierService {
  async create(data: {
    client: string
    compagnie: Compagnie
    marchandise: string
    site: Site
    priorite: Priorite
    dateArrivee: string
    dateLimiteSortie?: string
    notes?: string
    responsableId: string
    createurId: string
    diId?: string
    numeroDI?: string
    conteneurs?: Array<{ numero: string; type?: string; taille?: string }>
  }) {
    const numero = generateDossierNumber()
    const slaConfig = await slaService.getSLAConfig()

    const dossier = await prisma.$transaction(async (tx) => {
      const d = await tx.dossier.create({
        data: {
          numero,
          client: data.client,
          compagnie: data.compagnie,
          marchandise: data.marchandise,
          site: data.site,
          priorite: data.priorite,
          dateArrivee: new Date(data.dateArrivee),
          dateLimiteSortie: data.dateLimiteSortie ? new Date(data.dateLimiteSortie) : undefined,
          notes: data.notes,
          responsableId: data.responsableId,
          createurId: data.createurId,
          diId: data.diId,
          numeroDI: data.numeroDI,
          containers: data.conteneurs
            ? {
                create: data.conteneurs.map((c) => ({
                  numero: c.numero,
                  type: c.type,
                  taille: c.taille as any,
                })),
              }
            : undefined,
        },
        select: DOSSIER_SELECT,
      })

      // Create all 7 workflow steps at once
      const statuses: DossierStatus[] = [
        'RECEPTION', 'CODAGE', 'VALIDATION', 'PAIEMENT',
        'BON_COMPAGNIE', 'OPERATIONS_KRIBI', 'CLOTURE',
      ]
      await tx.workflowStep.createMany({
        data: statuses.map((etape) => ({
          dossierId: d.id,
          etape,
          statut: etape === 'RECEPTION' ? 'EN_COURS' : 'EN_ATTENTE',
          debutAt: etape === 'RECEPTION' ? new Date() : undefined,
          slaHeures: slaConfig[etape],
        })),
      })

      await tx.auditLog.create({
        data: {
          dossierId: d.id,
          userId: data.createurId,
          action: 'DOSSIER_CREE',
          entite: 'Dossier',
          entiteId: d.id,
          details: { numero, client: data.client },
        },
      })

      return d
    })

    return dossier
  }

  async findAll(params: {
    status?: DossierStatus
    site?: Site
    compagnie?: Compagnie
    priorite?: Priorite
    responsableId?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const { status, site, compagnie, priorite, responsableId, search, page = 1, limit = 20 } = params
    const { skip, take } = paginate(page, limit)

    const where: any = {
      ...(status && { status }),
      ...(site && { site }),
      ...(compagnie && { compagnie }),
      ...(priorite && { priorite }),
      ...(responsableId && { responsableId }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { client: { contains: search, mode: 'insensitive' } },
          { marchandise: { contains: search, mode: 'insensitive' } },
          { containers: { some: { numero: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    }

    const [dossiers, total] = await Promise.all([
      prisma.dossier.findMany({ where, select: DOSSIER_SELECT, orderBy: { dateCreation: 'desc' }, skip, take }),
      prisma.dossier.count({ where }),
    ])

    return buildPaginatedResult(dossiers, total, page, limit)
  }

  async findById(id: string) {
    const dossier = await prisma.dossier.findUnique({
      where: { id },
      include: {
        responsable: { select: { id: true, nom: true, prenom: true, role: true, email: true } },
        createur: { select: { id: true, nom: true, prenom: true } },
        di: true,
        containers: true,
        documents: {
          include: { uploader: { select: { nom: true, prenom: true } } },
          orderBy: { createdAt: 'desc' },
        },
        commentaires: {
          include: { auteur: { select: { nom: true, prenom: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        workflowSteps: {
          include: {
            actions: { include: { user: { select: { nom: true, prenom: true } } } },
            documents: { select: { id: true, nom: true, url: true, type: true } },
          },
        },
        alertes: { where: { resolue: false }, orderBy: { createdAt: 'desc' } },
        diOperations: {
          include: {
            di: { select: { numero: true } },
            validateur: { select: { nom: true, prenom: true } },
          },
          orderBy: { date: 'desc' },
        },
        paiementsDouane: { orderBy: { date: 'desc' } },
        paiementsCompagnie: { orderBy: { date: 'desc' } },
        bonsKribi: {
          include: { responsable: { select: { nom: true, prenom: true } } },
          orderBy: { createdAt: 'desc' },
        },
        gatePasses: {
          include: {
            container: { select: { numero: true } },
            emetteur: { select: { nom: true, prenom: true } },
          },
          orderBy: { dateEmission: 'desc' },
        },
        auditLogs: {
          include: { user: { select: { nom: true, prenom: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!dossier) throw new NotFoundError('Dossier', id)
    return dossier
  }

  async advanceStatus(id: string, userId: string, commentaire?: string) {
    const dossier = await prisma.dossier.findUnique({
      where: { id },
      include: {
        workflowSteps: { where: { etape: { equals: undefined } } },
      },
    })
    if (!dossier) throw new NotFoundError('Dossier', id)
    if (dossier.status === 'CLOTURE') throw new BusinessError('Dossier déjà clôturé')

    // Check if current step has required proof
    const currentStep = await prisma.workflowStep.findUnique({
      where: { dossierId_etape: { dossierId: id, etape: dossier.status } },
      include: { documents: { take: 1 } },
    })

    if (currentStep?.preuveRequise && currentStep.documents.length === 0) {
      throw new BusinessError(
        `Impossible de valider l'étape "${dossier.status}": une preuve documentaire est requise.`,
        'PREUVE_MANQUANTE',
      )
    }

    const nextStatus = getNextStatus(dossier.status)
    if (!nextStatus) throw new BusinessError('Aucune étape suivante disponible')

    const { delaiDepasse, retardMinutes } = await slaService.completeStep(id, dossier.status, userId, commentaire)

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.dossier.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(nextStatus === 'CLOTURE' && { closedAt: new Date() }),
        },
        select: DOSSIER_SELECT,
      })

      await tx.workflowStep.update({
        where: { dossierId_etape: { dossierId: id, etape: nextStatus } },
        data: { statut: 'EN_COURS', debutAt: new Date() },
      })

      await tx.auditLog.create({
        data: {
          dossierId: id,
          userId,
          action: 'STATUT_CHANGE',
          details: { de: dossier.status, vers: nextStatus, delaiDepasse, retardMinutes },
        },
      })

      return d
    })

    if (delaiDepasse && retardMinutes) {
      await alertService.create({
        type: 'SLA_DEPASSEMENT',
        severity: 'WARNING',
        message: `Étape ${dossier.status} du dossier ${dossier.numero} validée avec ${Math.floor(retardMinutes / 60)}h de retard`,
        dossierId: id,
      })
    }

    return updated
  }

  async updateDossier(id: string, data: Partial<{
    client: string; marchandise: string; priorite: Priorite;
    responsableId: string; notes: string; dateLimiteSortie: string;
    montantTaxes: number; montantHonoraires: number; montantRedevances: number;
  }>, userId: string) {
    await prisma.dossier.findUniqueOrThrow({ where: { id } })

    const updated = await prisma.dossier.update({
      where: { id },
      data: {
        ...(data.client && { client: data.client }),
        ...(data.marchandise && { marchandise: data.marchandise }),
        ...(data.priorite && { priorite: data.priorite }),
        ...(data.responsableId && { responsableId: data.responsableId }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.dateLimiteSortie && { dateLimiteSortie: new Date(data.dateLimiteSortie) }),
        ...(data.montantTaxes !== undefined && { montantTaxes: data.montantTaxes }),
        ...(data.montantHonoraires !== undefined && { montantHonoraires: data.montantHonoraires }),
        ...(data.montantRedevances !== undefined && { montantRedevances: data.montantRedevances }),
      },
      select: DOSSIER_SELECT,
    })

    await prisma.auditLog.create({
      data: { dossierId: id, userId, action: 'DOSSIER_MODIFIE', details: data },
    })

    return updated
  }

  async addComment(dossierId: string, auteurId: string, message: string) {
    const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } })
    if (!dossier) throw new NotFoundError('Dossier', dossierId)

    return prisma.comment.create({
      data: { dossierId, auteurId, message },
      include: { auteur: { select: { nom: true, prenom: true, role: true } } },
    })
  }

  async getKanbanData() {
    const statuses: DossierStatus[] = [
      'RECEPTION', 'CODAGE', 'VALIDATION', 'PAIEMENT',
      'BON_COMPAGNIE', 'OPERATIONS_KRIBI', 'CLOTURE',
    ]

    const dossiers = await prisma.dossier.findMany({
      select: { ...DOSSIER_SELECT, containers: { select: { id: true, numero: true, statut: true } } },
      orderBy: [{ priorite: 'asc' }, { dateCreation: 'desc' }],
    })

    return statuses.reduce((acc, status) => {
      acc[status] = dossiers.filter((d) => d.status === status)
      return acc
    }, {} as Record<DossierStatus, typeof dossiers>)
  }

  async linkDI(dossierId: string, diId: string, userId: string) {
    const [dossier, di] = await Promise.all([
      prisma.dossier.findUnique({ where: { id: dossierId } }),
      prisma.dI.findUnique({ where: { id: diId } }),
    ])
    if (!dossier) throw new NotFoundError('Dossier', dossierId)
    if (!di) throw new NotFoundError('DI', diId)

    const updated = await prisma.dossier.update({
      where: { id: dossierId },
      data: { diId, numeroDI: di.numero },
      select: DOSSIER_SELECT,
    })

    await prisma.auditLog.create({
      data: { dossierId, userId, action: 'DI_LIEE', details: { diId, numeroDI: di.numero } },
    })

    return updated
  }
}
