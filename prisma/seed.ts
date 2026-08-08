import { PrismaClient, type User } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "AxeCompta2026!";

// Sous-ensemble représentatif du plan comptable SYSCOHADA révisé — assez
// pour démontrer les journaux Achats/Ventes/Banque/Caisse/OD dès la première
// connexion, sans prétendre couvrir tout le plan comptable.
const ACCOUNT_DEFS: { numero: string; libelle: string; classe: string; isAuxiliaire?: boolean }[] = [
  { numero: "101000", libelle: "Capital social", classe: "CLASSE1_RESSOURCES_DURABLES" },
  { numero: "211000", libelle: "Matériel et outillage industriel", classe: "CLASSE2_ACTIF_IMMOBILISE" },
  { numero: "401000", libelle: "Fournisseurs", classe: "CLASSE4_TIERS", isAuxiliaire: true },
  { numero: "411000", libelle: "Clients", classe: "CLASSE4_TIERS", isAuxiliaire: true },
  { numero: "445200", libelle: "TVA déductible", classe: "CLASSE4_TIERS" },
  { numero: "443200", libelle: "TVA collectée", classe: "CLASSE4_TIERS" },
  { numero: "521000", libelle: "Banque locale", classe: "CLASSE5_TRESORERIE" },
  { numero: "571000", libelle: "Caisse", classe: "CLASSE5_TRESORERIE" },
  { numero: "601100", libelle: "Achats de marchandises", classe: "CLASSE6_CHARGES" },
  { numero: "605000", libelle: "Autres achats (eau, électricité)", classe: "CLASSE6_CHARGES" },
  { numero: "622000", libelle: "Locations", classe: "CLASSE6_CHARGES" },
  { numero: "661000", libelle: "Rémunérations directes versées au personnel", classe: "CLASSE6_CHARGES" },
  { numero: "701000", libelle: "Ventes de marchandises", classe: "CLASSE7_PRODUITS" },
  { numero: "706000", libelle: "Services vendus", classe: "CLASSE7_PRODUITS" },
];

const JOURNAL_DEFS: { code: string; libelle: string; type: string }[] = [
  { code: "AC", libelle: "Achats", type: "ACHATS" },
  { code: "VE", libelle: "Ventes", type: "VENTES" },
  { code: "BQ1", libelle: "Banque locale", type: "BANQUE" },
  { code: "CA1", libelle: "Caisse", type: "CAISSE" },
  { code: "OD", libelle: "Opérations diverses", type: "OPERATIONS_DIVERSES" },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "entreprise-demo" },
    update: { onboardingCompletedAt: new Date() },
    create: {
      name: "Entreprise Demo AxeCompta",
      slug: "entreprise-demo",
      city: "Douala",
      country: "CM",
      plan: "PRO",
      // Les comptes de démo n'ont pas besoin de traverser /onboarding — ils
      // arrivent directement sur le tableau de bord.
      onboardingCompletedAt: new Date(),
      businessProfile: {
        secteurActivite: "Commerce / Négoce",
        maturiteComptable: "INTERMEDIAIRE",
        principauxRisques: ["Suivi de trésorerie irrégulier", "Retards possibles sur les déclarations de TVA"],
        prioritesRecommandees: ["Clôturer le journal de banque chaque mois", "Ventiler les charges par centre de coût"],
        modulesRecommandes: ["comptabilite", "tresorerie", "fiscalite"],
        syntheseTexte: "Votre activité de négoce justifie un suivi rapproché de la TVA collectée/déductible et de votre trésorerie.",
      },
      auditCompletedAt: new Date(),
    },
  });

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  const userDefs = [
    { key: "admin", email: "admin@axecompta.demo", firstName: "Admin", lastName: "Système", role: "ADMIN" as const, isSuperAdmin: true },
    { key: "comptable", email: "comptable@axecompta.demo", firstName: "Chantal", lastName: "Mballa", role: "COMPTABLE" as const, isSuperAdmin: false },
    { key: "caissier", email: "caissier@axecompta.demo", firstName: "Roger", lastName: "Ateba", role: "CAISSIER" as const, isSuperAdmin: false },
  ];

  const users: Record<string, User> = {};
  for (const def of userDefs) {
    users[def.key] = await prisma.user.upsert({
      where: { email: def.email },
      update: { isSuperAdmin: def.isSuperAdmin },
      create: {
        organizationId: organization.id,
        email: def.email,
        passwordHash,
        firstName: def.firstName,
        lastName: def.lastName,
        role: def.role,
        isSuperAdmin: def.isSuperAdmin,
      },
    });
  }

  const accounts: Record<string, { id: string; isAuxiliaire: boolean }> = {};
  for (const def of ACCOUNT_DEFS) {
    const account = await prisma.account.upsert({
      where: { organizationId_numero: { organizationId: organization.id, numero: def.numero } },
      update: {},
      create: {
        organizationId: organization.id,
        numero: def.numero,
        libelle: def.libelle,
        classe: def.classe as never,
        isAuxiliaire: def.isAuxiliaire ?? false,
      },
    });
    accounts[def.numero] = { id: account.id, isAuxiliaire: account.isAuxiliaire };
  }

  const journals: Record<string, { id: string; code: string }> = {};
  for (const def of JOURNAL_DEFS) {
    const journal = await prisma.journal.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: def.code } },
      update: {},
      create: { organizationId: organization.id, code: def.code, libelle: def.libelle, type: def.type as never },
    });
    journals[def.code] = { id: journal.id, code: journal.code };
  }

  const fournisseur = await prisma.thirdParty.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "FO0001" } },
    update: {},
    create: {
      organizationId: organization.id,
      code: "FO0001",
      raisonSociale: "ENEO Cameroun (électricité)",
      type: "FOURNISSEUR",
      accountId: accounts["401000"].id,
    },
  });

  const client = await prisma.thirdParty.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "CL0001" } },
    update: {},
    create: {
      organizationId: organization.id,
      code: "CL0001",
      raisonSociale: "SOCIMEX SARL",
      type: "CLIENT",
      accountId: accounts["411000"].id,
    },
  });

  // Une pièce déjà présente ne doit pas être recréée à chaque exécution du
  // seed — protégé par l'existence de la première pièce du journal Achats.
  const existingEntry = await prisma.journalEntry.findFirst({ where: { organizationId: organization.id, journalId: journals.AC.id } });
  if (!existingEntry) {
    await prisma.journalEntry.create({
      data: {
        organizationId: organization.id,
        journalId: journals.AC.id,
        numeroPiece: `${journals.AC.code}-${new Date().getFullYear()}-000001`,
        dateEcriture: new Date(),
        libelle: "Facture électricité ENEO — Août 2026",
        reference: "FAC-ENEO-08-2026",
        thirdPartyId: fournisseur.id,
        status: "VALIDEE",
        createdById: users.comptable.id,
        validatedById: users.comptable.id,
        validatedAt: new Date(),
        items: {
          create: [
            { accountId: accounts["605000"].id, libelle: "Électricité — locaux principaux", debit: 42000, credit: 0 },
            { accountId: accounts["445200"].id, libelle: "TVA déductible sur facture ENEO", debit: 7980, credit: 0 },
            { accountId: accounts["401000"].id, thirdPartyId: fournisseur.id, libelle: "ENEO Cameroun", debit: 0, credit: 49980 },
          ],
        },
      },
    });

    await prisma.journalEntry.create({
      data: {
        organizationId: organization.id,
        journalId: journals.VE.id,
        numeroPiece: `${journals.VE.code}-${new Date().getFullYear()}-000001`,
        dateEcriture: new Date(),
        libelle: "Vente de marchandises — SOCIMEX",
        reference: "FAC-CL-000001",
        thirdPartyId: client.id,
        status: "VALIDEE",
        createdById: users.comptable.id,
        validatedById: users.comptable.id,
        validatedAt: new Date(),
        items: {
          create: [
            { accountId: accounts["411000"].id, thirdPartyId: client.id, libelle: "SOCIMEX SARL", debit: 238000, credit: 0 },
            { accountId: accounts["701000"].id, libelle: "Vente de marchandises", debit: 0, credit: 200000 },
            { accountId: accounts["443200"].id, libelle: "TVA collectée", debit: 0, credit: 38000 },
          ],
        },
      },
    });
  }

  console.log(`Seed terminé. Organisation: ${organization.slug}`);
  console.log(`Compte de démonstration principal: admin@axecompta.demo / ${DEFAULT_PASSWORD} (super-admin plateforme)`);
  console.log(`Autres comptes: comptable@axecompta.demo, caissier@axecompta.demo — même mot de passe.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
