import { DossierStatus, Role } from '@prisma/client'
import { prisma } from '../config/database'

export class ReportingService {
  async getKPIs() {
    const [total, enCours, clotures, enRetard, alertesCritiques, diActives] = await Promise.all([
      prisma.dossier.count(),
      prisma.dossier.count({ where: { status: { not: 'CLOTURE' } } }),
      prisma.dossier.count({ where: { status: 'CLOTURE' } }),
      prisma.workflowStep.count({ where: { delaiDepasse: true, statut: { not: 'TERMINE' } } }),
      prisma.alert.count({ where: { severity: 'CRITICAL', resolue: false } }),
      prisma.dI.count({ where: { statut: 'ACTIVE' } }),
    ])

    return { total, enCours, clotures, enRetard, alertesCritiques, diActives }
  }

  async getSLAPerformance() {
    const steps = await prisma.workflowStep.findMany({
      where: { statut: 'TERMINE' },
      select: {
        etape: true,
        slaHeures: true,
        debutAt: true,
        finAt: true,
        delaiDepasse: true,
        retardMinutes: true,
      },
    })

    const grouped: Record<string, { count: number; enRetard: number; totalMinutes: number; totalSLAMinutes: number }> = {}

    for (const step of steps) {
      if (!step.debutAt || !step.finAt) continue
      const key = step.etape
      if (!grouped[key]) grouped[key] = { count: 0, enRetard: 0, totalMinutes: 0, totalSLAMinutes: 0 }

      const elapsed = (step.finAt.getTime() - step.debutAt.getTime()) / 60000
      grouped[key].count++
      grouped[key].totalMinutes += elapsed
      grouped[key].totalSLAMinutes += step.slaHeures * 60
      if (step.delaiDepasse) grouped[key].enRetard++
    }

    return Object.entries(grouped).map(([etape, stats]) => ({
      etape,
      count: stats.count,
      enRetard: stats.enRetard,
      tauxRetard: stats.count > 0 ? (stats.enRetard / stats.count) * 100 : 0,
      tempsMoyenMinutes: stats.count > 0 ? stats.totalMinutes / stats.count : 0,
      tempsSLAMoyenMinutes: stats.count > 0 ? stats.totalSLAMinutes / stats.count : 0,
    }))
  }

  async getEmployeePerformance() {
    const employees = await prisma.user.findMany({
      where: { actif: true },
      select: { id: true, nom: true, prenom: true, role: true, site: true },
    })

    const results = await Promise.all(
      employees.map(async (emp) => {
        const [totalDossiers, closedDossiers, lateSteps, totalActions] = await Promise.all([
          prisma.dossier.count({ where: { responsableId: emp.id } }),
          prisma.dossier.count({ where: { responsableId: emp.id, status: 'CLOTURE' } }),
          prisma.workflowStep.count({
            where: {
              dossier: { responsableId: emp.id },
              delaiDepasse: true,
            },
          }),
          prisma.workflowAction.count({ where: { userId: emp.id } }),
        ])

        const tauxReussite = totalDossiers > 0 ? (closedDossiers / totalDossiers) * 100 : 0

        return {
          ...emp,
          totalDossiers,
          closedDossiers,
          enCours: totalDossiers - closedDossiers,
          lateSteps,
          totalActions,
          tauxReussite: Math.round(tauxReussite),
        }
      }),
    )

    return results.sort((a, b) => b.tauxReussite - a.tauxReussite)
  }

  async getWeeklyActivity() {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 6)
    startOfWeek.setHours(0, 0, 0, 0)

    const logs = await prisma.auditLog.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: startOfWeek } },
      _count: { id: true },
    })

    const days: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      const key = d.toISOString().split('T')[0]
      days[key] = 0
    }

    for (const log of logs) {
      const key = log.createdAt.toISOString().split('T')[0]
      if (key in days) days[key] += log._count.id
    }

    return Object.entries(days).map(([date, count]) => ({ date, count }))
  }

  async getDIOverview() {
    const dis = await prisma.dI.findMany({
      where: { statut: 'ACTIVE' },
      include: {
        _count: { select: { dossiers: true, operations: true } },
      },
    })

    return dis.map((di) => {
      const solde = di.montantTotal - di.montantConsomme
      const pct = di.montantTotal > 0 ? (di.montantConsomme / di.montantTotal) * 100 : 0
      return {
        id: di.id,
        numero: di.numero,
        client: di.client,
        montantTotal: di.montantTotal,
        montantConsomme: di.montantConsomme,
        solde,
        pourcentageConsomme: Math.round(pct),
        dossiers: di._count.dossiers,
        operations: di._count.operations,
        statut: di.statut,
        alertNiveau: pct >= 100 ? 'epuisee' : pct >= 90 ? 'critical' : pct >= 75 ? 'warning' : pct >= 50 ? 'info' : 'ok',
      }
    })
  }

  async getFinancialSummary() {
    const [douane, compagnie, diTotal, diConsomme] = await Promise.all([
      prisma.customsPayment.aggregate({ _sum: { montant: true } }),
      prisma.companyPayment.aggregate({ _sum: { montant: true } }),
      prisma.dI.aggregate({ _sum: { montantTotal: true } }),
      prisma.dI.aggregate({ _sum: { montantConsomme: true } }),
    ])

    const [pendingDouane, pendingCompagnie] = await Promise.all([
      prisma.customsPayment.aggregate({ where: { statut: 'EN_ATTENTE' }, _sum: { montant: true } }),
      prisma.companyPayment.aggregate({ where: { statut: 'EN_ATTENTE' }, _sum: { montant: true } }),
    ])

    return {
      totalDouane: douane._sum.montant || 0,
      totalCompagnie: compagnie._sum.montant || 0,
      enAttente: (pendingDouane._sum.montant || 0) + (pendingCompagnie._sum.montant || 0),
      diTotal: diTotal._sum.montantTotal || 0,
      diConsomme: diConsomme._sum.montantConsomme || 0,
      diSolde: (diTotal._sum.montantTotal || 0) - (diConsomme._sum.montantConsomme || 0),
    }
  }

  async getDelayReports(params: { userId?: string; etape?: DossierStatus; limit?: number }) {
    const { userId, etape, limit = 50 } = params
    return prisma.delayReport.findMany({
      where: {
        ...(userId && { userId }),
        ...(etape && { etape }),
      },
      include: {
        user: { select: { nom: true, prenom: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
