import { PrismaClient, Role, Site, Compagnie, DossierStatus, Priorite, DIStatut } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding FINITRANS database...')

  // ─── Users from org chart ──────────────────────────────────────────────────

  const defaultPassword = await bcrypt.hash('Finitrans2024!', 12)

  const users = [
    { email: 'delba@finitrans.cm',   nom: 'Delba',   prenom: 'Mr',      role: 'DIRECTEUR_GENERAL' as Role,        site: 'DOUALA' as Site, telephone: '+237 699 000 001' },
    { email: 'soudi@finitrans.cm',   nom: 'Soudi',   prenom: 'Mr',      role: 'RESPONSABLE_EXPLOITATION' as Role,  site: 'DOUALA' as Site, telephone: '+237 699 000 002' },
    { email: 'yaya@finitrans.cm',    nom: 'Yaya',    prenom: 'Mr',      role: 'RESPONSABLE_LOGISTIQUE' as Role,    site: 'DOUALA' as Site, telephone: '+237 699 000 003' },
    { email: 'odette@finitrans.cm',  nom: 'Odette',  prenom: 'Mme',     role: 'RESPONSABLE_VALIDATION' as Role,   site: 'DOUALA' as Site, telephone: '+237 699 000 004' },
    { email: 'wandala@finitrans.cm', nom: 'Wandala', prenom: 'Mr',      role: 'RESPONSABLE_SORTIES' as Role,      site: 'DOUALA' as Site, telephone: '+237 699 000 005' },
    { email: 'yasmine@finitrans.cm', nom: 'Yasmine', prenom: 'Mme',     role: 'SERVICE_ADMINISTRATIF' as Role,    site: 'DOUALA' as Site, telephone: '+237 699 000 006' },
    { email: 'honore@finitrans.cm',  nom: 'Honoré',  prenom: 'Mr',      role: 'COMPTABLE' as Role,                site: 'DOUALA' as Site, telephone: '+237 699 000 007' },
    { email: 'aliou@finitrans.cm',   nom: 'Aliou',   prenom: 'Mr',      role: 'RESPONSABLE_DOUANIER' as Role,     site: 'KRIBI' as Site,  telephone: '+237 699 000 008' },
    { email: 'raphael@finitrans.cm', nom: 'Raphaël', prenom: 'Mr',      role: 'RESPONSABLE_DOUANIER' as Role,     site: 'KRIBI' as Site,  telephone: '+237 699 000 009' },
  ]

  const createdUsers: Record<string, string> = {}

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, password: defaultPassword },
    })
    createdUsers[user.nom.toLowerCase()] = created.id
    console.log(`  ✓ User: ${user.prenom} ${user.nom} (${user.role})`)
  }

  // ─── SLA Defaults ─────────────────────────────────────────────────────────

  const slaDefaults = [
    { etape: 'RECEPTION' as DossierStatus,        slaHeures: 48,  labelFr: 'Réception & Enregistrement' },
    { etape: 'CODAGE' as DossierStatus,           slaHeures: 24,  labelFr: 'Codage & Déclaration' },
    { etape: 'VALIDATION' as DossierStatus,       slaHeures: 24,  labelFr: 'Validation douanière' },
    { etape: 'PAIEMENT' as DossierStatus,         slaHeures: 48,  labelFr: 'Paiement droits & taxes' },
    { etape: 'BON_COMPAGNIE' as DossierStatus,    slaHeures: 24,  labelFr: 'Bon de compagnie' },
    { etape: 'OPERATIONS_KRIBI' as DossierStatus, slaHeures: 72,  labelFr: 'Opérations Kribi' },
    { etape: 'CLOTURE' as DossierStatus,          slaHeures: 24,  labelFr: 'Clôture & Contrôle' },
  ]

  for (const sla of slaDefaults) {
    await prisma.sLAConfig.upsert({
      where: { etape: sla.etape },
      update: {},
      create: sla,
    })
  }
  console.log('  ✓ SLA defaults configured')

  // ─── Sample DIs ───────────────────────────────────────────────────────────

  const di1 = await prisma.dI.upsert({
    where: { numero: 'DI-2026-001' },
    update: {},
    create: {
      numero: 'DI-2026-001',
      client: 'GLOBAL IMPORT SARL',
      montantTotal: 50_000_000,
      montantConsomme: 12_500_000,
      dateExpiration: new Date('2026-12-31'),
      statut: 'ACTIVE' as DIStatut,
    },
  })

  const di2 = await prisma.dI.upsert({
    where: { numero: 'DI-2026-002' },
    update: {},
    create: {
      numero: 'DI-2026-002',
      client: 'TRANSLOG CAMEROUN',
      montantTotal: 30_000_000,
      montantConsomme: 27_000_000,
      dateExpiration: new Date('2026-09-30'),
      statut: 'ACTIVE' as DIStatut,
    },
  })

  const di3 = await prisma.dI.upsert({
    where: { numero: 'DI-2026-003' },
    update: {},
    create: {
      numero: 'DI-2026-003',
      client: 'AFRICOM TRADING',
      montantTotal: 80_000_000,
      montantConsomme: 5_000_000,
      dateExpiration: new Date('2027-03-31'),
      statut: 'ACTIVE' as DIStatut,
    },
  })

  console.log('  ✓ Sample DIs created')

  // ─── Sample Dossiers ──────────────────────────────────────────────────────

  const dossierData = [
    {
      numero: 'DOS-2026-1001', client: 'GLOBAL IMPORT SARL', compagnie: 'MSC' as Compagnie,
      marchandise: 'Matériaux de construction', site: 'DOUALA' as Site, status: 'PAIEMENT' as DossierStatus,
      priorite: 'HAUTE' as Priorite, responsableId: createdUsers['yaya'], diId: di1.id, numeroDI: 'DI-2026-001',
      montantTaxes: 8_500_000, montantRedevances: 1_200_000,
      dateArrivee: new Date('2026-06-01'), dateLimiteSortie: new Date('2026-07-01'),
    },
    {
      numero: 'DOS-2026-1002', client: 'TRANSLOG CAMEROUN', compagnie: 'COSCO' as Compagnie,
      marchandise: 'Produits alimentaires', site: 'DOUALA' as Site, status: 'VALIDATION' as DossierStatus,
      priorite: 'MOYENNE' as Priorite, responsableId: createdUsers['odette'], diId: di2.id, numeroDI: 'DI-2026-002',
      montantTaxes: 3_200_000,
      dateArrivee: new Date('2026-06-05'),
    },
    {
      numero: 'DOS-2026-1003', client: 'AFRICOM TRADING', compagnie: 'MAERSK' as Compagnie,
      marchandise: 'Équipements industriels', site: 'KRIBI' as Site, status: 'OPERATIONS_KRIBI' as DossierStatus,
      priorite: 'HAUTE' as Priorite, responsableId: createdUsers['raphaël'], diId: di3.id, numeroDI: 'DI-2026-003',
      dateArrivee: new Date('2026-06-03'),
    },
    {
      numero: 'DOS-2026-1004', client: 'STE CAMEROUN RETAIL', compagnie: 'CMA_CGM' as Compagnie,
      marchandise: 'Électroménager', site: 'DOUALA' as Site, status: 'CODAGE' as DossierStatus,
      priorite: 'BASSE' as Priorite, responsableId: createdUsers['odette'],
      dateArrivee: new Date('2026-06-10'),
    },
    {
      numero: 'DOS-2026-1005', client: 'IMPORTEX SA', compagnie: 'MSC' as Compagnie,
      marchandise: 'Textiles & vêtements', site: 'DOUALA' as Site, status: 'BON_COMPAGNIE' as DossierStatus,
      priorite: 'MOYENNE' as Priorite, responsableId: createdUsers['wandala'], diId: di1.id, numeroDI: 'DI-2026-001',
      montantTaxes: 5_800_000, montantHonoraires: 450_000,
      dateArrivee: new Date('2026-05-28'),
    },
    {
      numero: 'DOS-2026-1006', client: 'GLOBAL IMPORT SARL', compagnie: 'COSCO' as Compagnie,
      marchandise: 'Pièces automobiles', site: 'DOUALA' as Site, status: 'RECEPTION' as DossierStatus,
      priorite: 'MOYENNE' as Priorite, responsableId: createdUsers['yasmine'],
      dateArrivee: new Date('2026-06-15'),
    },
    {
      numero: 'DOS-2026-1007', client: 'KRIBI LOGISTIC', compagnie: 'MSC' as Compagnie,
      marchandise: 'Matières premières', site: 'KRIBI' as Site, status: 'CLOTURE' as DossierStatus,
      priorite: 'BASSE' as Priorite, responsableId: createdUsers['aliou'],
      dateArrivee: new Date('2026-05-15'), closedAt: new Date('2026-06-01'),
    },
  ]

  const createdDossiers: Record<string, string> = {}

  for (const d of dossierData) {
    const dossier = await prisma.dossier.upsert({
      where: { numero: d.numero },
      update: {},
      create: {
        ...d,
        createurId: createdUsers['yasmine'],
      },
    })
    createdDossiers[d.numero] = dossier.id

    // Create workflow steps for each dossier
    const allStatuses: DossierStatus[] = ['RECEPTION','CODAGE','VALIDATION','PAIEMENT','BON_COMPAGNIE','OPERATIONS_KRIBI','CLOTURE']
    const currentIdx = allStatuses.indexOf(d.status)

    for (let i = 0; i < allStatuses.length; i++) {
      const etape = allStatuses[i]
      const sla = slaDefaults.find((s) => s.etape === etape)!
      let statut: 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE' = 'EN_ATTENTE'
      if (i < currentIdx) statut = 'TERMINE'
      else if (i === currentIdx) statut = 'EN_COURS'

      await prisma.workflowStep.upsert({
        where: { dossierId_etape: { dossierId: dossier.id, etape } },
        update: {},
        create: {
          dossierId: dossier.id,
          etape,
          statut,
          slaHeures: sla.slaHeures,
          debutAt: statut !== 'EN_ATTENTE' ? new Date(Date.now() - (currentIdx - i) * 24 * 3600 * 1000) : undefined,
          finAt: statut === 'TERMINE' ? new Date(Date.now() - (currentIdx - i - 1) * 24 * 3600 * 1000) : undefined,
        },
      })
    }

    // Add containers
    const conteneurNums = [`CTR-${d.numero}-001`, `CTR-${d.numero}-002`]
    for (const num of conteneurNums) {
      await prisma.container.upsert({
        where: { id: `cnt-${num}` },
        update: {},
        create: { id: `cnt-${num}`, numero: num, dossierId: dossier.id, taille: 'X40' },
      })
    }
  }

  console.log(`  ✓ ${dossierData.length} sample dossiers created`)

  // ─── Sample DI Operations ──────────────────────────────────────────────────

  await prisma.dIOperation.create({
    data: {
      diId: di1.id,
      dossierId: createdDossiers['DOS-2026-1001'],
      nombreConteneurs: 2,
      montant: 8_500_000,
      factureNumero: 'FACT-MSC-001',
      statut: 'VALIDE',
      validateurId: createdUsers['soudi'],
      validatedAt: new Date('2026-06-10'),
      commentaire: 'Facture MSC - droits de douane',
    },
  })

  await prisma.dIOperation.create({
    data: {
      diId: di1.id,
      dossierId: createdDossiers['DOS-2026-1005'],
      nombreConteneurs: 1,
      montant: 4_000_000,
      factureNumero: 'FACT-MSC-002',
      statut: 'VALIDE',
      validateurId: createdUsers['soudi'],
      validatedAt: new Date('2026-06-12'),
    },
  })

  await prisma.dIOperation.create({
    data: {
      diId: di2.id,
      dossierId: createdDossiers['DOS-2026-1002'],
      nombreConteneurs: 2,
      montant: 3_200_000,
      statut: 'EN_ATTENTE',
    },
  })

  console.log('  ✓ Sample DI operations created')

  // ─── Sample Alerts ────────────────────────────────────────────────────────

  await prisma.alert.createMany({
    data: [
      {
        type: 'DI_SEUIL',
        message: `DI DI-2026-002 (TRANSLOG CAMEROUN) a consommé 90% de son montant — solde critique`,
        severity: 'CRITICAL',
        diId: di2.id,
        lu: false,
      },
      {
        type: 'DETENTION',
        message: 'Conteneur CTR-DOS-2026-1001-001 en détention depuis 5 jours — pénalités en cours',
        severity: 'WARNING',
        dossierId: createdDossiers['DOS-2026-1001'],
        lu: false,
      },
      {
        type: 'SLA_DEPASSEMENT',
        message: 'Dossier DOS-2026-1002 — étape CODAGE dépasse le délai SLA de 8h',
        severity: 'WARNING',
        dossierId: createdDossiers['DOS-2026-1002'],
        lu: false,
      },
    ],
  })

  console.log('  ✓ Sample alerts created')

  // ─── Sample Conversations ─────────────────────────────────────────────────

  const conv = await prisma.conversation.create({
    data: {
      titre: 'Dossier DOS-2026-1001 — Suivi',
      type: 'DOSSIER',
      dossierId: createdDossiers['DOS-2026-1001'],
      participants: {
        create: [
          { userId: createdUsers['soudi'] },
          { userId: createdUsers['yaya'] },
          { userId: createdUsers['wandala'] },
        ],
      },
    },
  })

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv.id,
        auteurId: createdUsers['soudi'],
        contenu: 'Bonjour équipe, le dossier DOS-2026-1001 est en attente de paiement. Merci de traiter en priorité.',
        createdAt: new Date(Date.now() - 3 * 3600 * 1000),
      },
      {
        conversationId: conv.id,
        auteurId: createdUsers['yaya'],
        contenu: 'Compris. Je m\'en occupe immédiatement. Les droits de douane sont déjà préparés.',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000),
      },
    ],
  })

  console.log('  ✓ Sample conversations created')

  console.log('\n✅ FINITRANS database seeded successfully!')
  console.log('\n📋 Default credentials:')
  console.log('  Email format: prenom@finitrans.cm (ex: delba@finitrans.cm)')
  console.log('  Password: Finitrans2024!')
  console.log('\n👥 Users created:')
  users.forEach((u) => console.log(`  • ${u.prenom} ${u.nom} — ${u.email} — ${u.role} (${u.site})`))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
