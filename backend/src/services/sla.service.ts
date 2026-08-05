import { DossierStatus } from '@prisma/client'
import { prisma } from '../config/database'
import { AlertService } from './alert.service'
import { env } from '../config/env'

const alertService = new AlertService()

const DEFAULT_SLA: Record<DossierStatus, number> = {
  RECEPTION:        env.SLA_RECEPTION,
  CODAGE:           env.SLA_CODAGE,
  VALIDATION:       env.SLA_VALIDATION,
  PAIEMENT:         env.SLA_PAIEMENT,
  BON_COMPAGNIE:    env.SLA_BON_COMPAGNIE,
  OPERATIONS_KRIBI: env.SLA_OPERATIONS_KRIBI,
  CLOTURE:          env.SLA_CLOTURE,
}

const SLA_LABELS: Record<DossierStatus, string> = {
  RECEPTION:        'Réception & Enregistrement',
  CODAGE:           'Codage & Déclaration',
  VALIDATION:       'Validation douanière',
  PAIEMENT:         'Paiement droits & taxes',
  BON_COMPAGNIE:    'Bon de compagnie',
  OPERATIONS_KRIBI: 'Opérations Kribi',
  CLOTURE:          'Clôture & Contrôle',
}

export class SLAService {
  async initializeDefaults() {
    const statuses = Object.keys(DEFAULT_SLA) as DossierStatus[]
    for (const etape of statuses) {
      await prisma.sLAConfig.upsert({
        where: { etape },
        update: {},
        create: {
          etape,
          slaHeures: DEFAULT_SLA[etape],
          labelFr: SLA_LABELS[etape],
        },
      })
    }
  }

  async getSLAConfig(): Promise<Record<DossierStatus, number>> {
    const configs = await prisma.sLAConfig.findMany()
    const result = { ...DEFAULT_SLA }
    for (const config of configs) {
      result[config.etape] = config.slaHeures
    }
    return result
  }

  async updateSLA(etape: DossierStatus, slaHeures: number, updatedById: string) {
    return prisma.sLAConfig.upsert({
      where: { etape },
      update: { slaHeures, updatedById },
      create: { etape, slaHeures, labelFr: SLA_LABELS[etape], updatedById },
    })
  }

  async startStep(dossierId: string, etape: DossierStatus) {
    const slaConfig = await this.getSLAConfig()
    const slaHeures = slaConfig[etape]

    await prisma.workflowStep.upsert({
      where: { dossierId_etape: { dossierId, etape } },
      update: { statut: 'EN_COURS', debutAt: new Date(), slaHeures },
      create: {
        dossierId,
        etape,
        statut: 'EN_COURS',
        debutAt: new Date(),
        slaHeures,
      },
    })
  }

  async completeStep(dossierId: string, etape: DossierStatus, userId: string, commentaire?: string) {
    const step = await prisma.workflowStep.findUnique({
      where: { dossierId_etape: { dossierId, etape } },
    })

    const finAt = new Date()
    let retardMinutes: number | undefined
    let delaiDepasse = false

    if (step?.debutAt && step.slaHeures) {
      const elapsedMs = finAt.getTime() - step.debutAt.getTime()
      const elapsedMinutes = Math.floor(elapsedMs / 60000)
      const slaMinutes = step.slaHeures * 60
      if (elapsedMinutes > slaMinutes) {
        delaiDepasse = true
        retardMinutes = elapsedMinutes - slaMinutes
      }
    }

    await prisma.workflowStep.update({
      where: { dossierId_etape: { dossierId, etape } },
      data: { statut: 'TERMINE', finAt, delaiDepasse, retardMinutes },
    })

    await prisma.workflowAction.create({
      data: {
        workflowStepId: step!.id,
        userId,
        action: 'COMPLETED',
        commentaire,
      },
    })

    return { delaiDepasse, retardMinutes }
  }

  async checkAllRunningSteps() {
    const now = new Date()
    const runningSteps = await prisma.workflowStep.findMany({
      where: { statut: 'EN_COURS', delaiDepasse: false },
      include: { dossier: { select: { numero: true, client: true } } },
    })

    for (const step of runningSteps) {
      if (!step.debutAt) continue
      const elapsedMs = now.getTime() - step.debutAt.getTime()
      const elapsedHours = elapsedMs / 3600000

      if (elapsedHours > step.slaHeures) {
        const retardMinutes = Math.floor((elapsedHours - step.slaHeures) * 60)
        await prisma.workflowStep.update({
          where: { id: step.id },
          data: { delaiDepasse: true, retardMinutes },
        })

        await alertService.create({
          type: 'SLA_DEPASSEMENT',
          message: `Dossier ${step.dossier.numero} (${step.dossier.client}) — étape "${step.etape}" en retard de ${Math.floor(retardMinutes / 60)}h${retardMinutes % 60}min`,
          severity: 'WARNING',
          dossierId: step.dossierId,
        })
      }
    }
  }

  async getStepStatus(dossierId: string) {
    return prisma.workflowStep.findMany({
      where: { dossierId },
      include: {
        actions: { include: { user: { select: { nom: true, prenom: true } } } },
        documents: { select: { id: true, nom: true, type: true, url: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }
}
