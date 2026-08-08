import { PrismaClient, type User } from "@prisma/client";
import { hashPassword, hashPin } from "../lib/auth";
import { createPatient } from "../services/patient.service";
import { createConsultationWithInvoice } from "../services/consultation.service";
import { createPrescriptionWithAlerts } from "../services/prescription.service";
import { splitInvoiceAmount } from "../services/insurance.service";
import { receiveStock, sellCounter, dispensePrescriptionItem } from "../services/pharmacie.service";
import { openCashSession, registerPayment, validatePaymentBlind } from "../services/caisse.service";
import { admitPatient, addNursingNote } from "../services/hospitalisation.service";
import { createLeaveRequest, updateLeaveStatus } from "../services/leave.service";
import { createSatisfaction } from "../services/satisfaction.service";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "AxeHealth2026!";
const DEFAULT_PIN = "1234";

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

// Jeu de données de démonstration réaliste, permettant de présenter chaque
// module rempli dès la première connexion (au lieu d'écrans vides). N'est
// exécuté qu'une seule fois — protégé par le nombre de patients existants,
// pour qu'un `npm run db:seed` répété ne duplique pas les factures/paiements.
async function seedDemoData(organizationId: string, users: Record<string, User>, cashRegisterId: string) {
  const existingPatientCount = await prisma.patient.count({ where: { organizationId } });
  if (existingPatientCount > 1) {
    console.log("Données de démonstration déjà présentes — étape ignorée.");
    return;
  }

  const insurer = await prisma.insuranceProvider.create({
    data: { organizationId, name: "CNPS Santé", tauxPriseEnCharge: 70, plafondAnnuel: 500000, contact: "+237 233 42 10 10" },
  });

  const patientDefs = [
    { firstName: "Amina", lastName: "Njoya", sexe: "F" as const, dateNaissance: new Date("1985-03-12"), phone: "+237690112233", ville: "Douala", allergies: ["Pénicilline"], antecedents: { medicaux: "Hypertension artérielle traitée" }, insured: true },
    { firstName: "Paul", lastName: "Ateba", sexe: "M" as const, dateNaissance: new Date("1978-07-02"), phone: "+237677223344", ville: "Yaoundé", allergies: [] as string[], insured: false },
    { firstName: "Grace", lastName: "Mvondo", sexe: "F" as const, dateNaissance: new Date("1992-11-20"), phone: "+237655334455", ville: "Douala", allergies: ["Arachide"], insured: true },
    { firstName: "Samuel", lastName: "Foka", sexe: "M" as const, dateNaissance: new Date("2001-01-05"), phone: "+237699445566", ville: "Bafoussam", allergies: [] as string[], insured: false },
    { firstName: "Clarisse", lastName: "Onana", sexe: "F" as const, dateNaissance: new Date("1996-05-30"), phone: "+237678556677", ville: "Douala", allergies: [] as string[], insured: false },
    { firstName: "Bernard", lastName: "Talla", sexe: "M" as const, dateNaissance: new Date("1965-09-18"), phone: "+237691667788", ville: "Douala", allergies: [] as string[], antecedents: { medicaux: "Diabète type 2", chirurgicaux: "Appendicectomie (2010)" }, insured: true },
    { firstName: "Josiane", lastName: "Kamdem", sexe: "F" as const, dateNaissance: new Date("1989-02-14"), phone: "+237654778899", ville: "Douala", allergies: [] as string[], insured: false },
    { firstName: "Eric", lastName: "Nkeng", sexe: "M" as const, dateNaissance: new Date("2015-06-08"), phone: "+237690889900", ville: "Douala", allergies: ["Lactose"], insured: false },
    { firstName: "Sylvie", lastName: "Essomba", sexe: "F" as const, dateNaissance: new Date("1973-12-25"), phone: "+237677990011", ville: "Douala", allergies: [] as string[], insured: false },
  ];

  const patients = [];
  for (const def of patientDefs) {
    const patient = await createPatient(organizationId, {
      firstName: def.firstName,
      lastName: def.lastName,
      sexe: def.sexe,
      dateNaissance: def.dateNaissance,
      phone: def.phone,
      ville: def.ville,
      allergies: def.allergies,
      antecedents: def.antecedents,
      insuranceProviderId: def.insured ? insurer.id : undefined,
      insuranceNumber: def.insured ? `CNPS-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      tiersPayantRate: def.insured ? 70 : undefined,
    });
    patients.push(patient);
  }

  const existingPatient = await prisma.patient.findFirst({ where: { organizationId, firstName: "Jean", lastName: "Mballa" } });
  if (existingPatient) patients.push(existingPatient);

  // ---- Pharmacie: articles + lots (dont un proche de la péremption et un sous le seuil de réappro, pour démontrer les alertes) ----
  const stockDefs = [
    { code: "PARA500", nom: "Paracétamol 500mg", categorie: "MEDICAMENT" as const, unite: "comprimé", prixAchat: 15, prixVente: 30, seuilReappro: 100 },
    { code: "AMOX500", nom: "Amoxicilline 500mg", categorie: "MEDICAMENT" as const, unite: "gélule", prixAchat: 40, prixVente: 75, seuilReappro: 50 },
    { code: "GANT-L", nom: "Gants latex (boîte de 100)", categorie: "CONSOMMABLE" as const, unite: "boîte", prixAchat: 2500, prixVente: 3500, seuilReappro: 20 },
    { code: "SER-5ML", nom: "Seringue 5ml", categorie: "DISPOSITIF_MEDICAL" as const, unite: "unité", prixAchat: 50, prixVente: 100, seuilReappro: 100 },
    { code: "COMP-STER", nom: "Compresses stériles", categorie: "CONSOMMABLE" as const, unite: "paquet", prixAchat: 800, prixVente: 1500, seuilReappro: 15 },
    { code: "SHA", nom: "Solution hydroalcoolique 500ml", categorie: "CONSOMMABLE" as const, unite: "flacon", prixAchat: 1200, prixVente: 2000, seuilReappro: 10 },
  ];

  const stockItems: Record<string, { id: string }> = {};
  for (const def of stockDefs) {
    stockItems[def.code] = await prisma.stockItem.create({ data: { organizationId, ...def } });
  }

  await receiveStock({ organizationId, stockItemId: stockItems.PARA500.id, numeroLot: "LOT-PARA-A", quantite: 25, datePeremption: daysFromNow(20), site: "Dépôt principal", createdById: users.pharmacien.id });
  await receiveStock({ organizationId, stockItemId: stockItems.PARA500.id, numeroLot: "LOT-PARA-B", quantite: 300, datePeremption: daysFromNow(365), site: "Dépôt principal", createdById: users.pharmacien.id });
  await receiveStock({ organizationId, stockItemId: stockItems.AMOX500.id, numeroLot: "LOT-AMOX-A", quantite: 8, datePeremption: daysFromNow(240), site: "Dépôt principal", createdById: users.pharmacien.id });
  await receiveStock({ organizationId, stockItemId: stockItems["GANT-L"].id, numeroLot: "LOT-GANT-A", quantite: 60, datePeremption: daysFromNow(720), site: "Dépôt principal", createdById: users.pharmacien.id });
  await receiveStock({ organizationId, stockItemId: stockItems["SER-5ML"].id, numeroLot: "LOT-SER-A", quantite: 400, datePeremption: daysFromNow(500), site: "Dépôt principal", createdById: users.pharmacien.id });
  await receiveStock({ organizationId, stockItemId: stockItems["COMP-STER"].id, numeroLot: "LOT-COMP-A", quantite: 6, datePeremption: daysFromNow(400), site: "Dépôt principal", createdById: users.pharmacien.id });
  await receiveStock({ organizationId, stockItemId: stockItems.SHA.id, numeroLot: "LOT-SHA-A", quantite: 40, datePeremption: daysFromNow(300), site: "Dépôt principal", createdById: users.pharmacien.id });

  // ---- Historique de facturation sur 18 jours, pour peupler le tableau de bord (graphique de recettes, occupation, créances) ----
  const poles = ["Consultation", "Pharmacie", "Laboratoire", "Hospitalisation"];
  const montants = [8000, 12000, 15000, 20000, 25000, 30000, 45000, 10000, 18000];
  const modes = ["ESPECES", "MTN_MOMO", "ORANGE_MONEY", "CARTE"] as const;
  let claimCreated = false;

  for (let daysAgo = 17; daysAgo >= 1; daysAgo--) {
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const patient = patients[daysAgo % patients.length];
    const pole = poles[daysAgo % poles.length];
    const montantTotal = montants[daysAgo % montants.length];

    const { montantPartPatient, montantPartAssurance, insuranceProviderId } = await splitInvoiceAmount(patient, montantTotal);

    const session = await prisma.cashSession.create({
      data: {
        organizationId,
        cashRegisterId,
        cashierId: users.caissier1.id,
        montantOuverture: 0,
        status: "CLOTUREE",
        montantClotureTheorique: montantPartPatient,
        montantClotureReel: montantPartPatient,
        ecart: 0,
        pinVerifiedAt: date,
        openedAt: date,
        closedAt: date,
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        patientId: patient.id,
        numero: `HIST-${1000 - daysAgo}`,
        status: "PAYEE",
        montantTotal,
        montantPartPatient,
        montantPartAssurance,
        insuranceProviderId,
        montantPaye: montantPartPatient,
        createdById: users.admin.id,
        createdAt: date,
        items: { create: [{ pole, libelle: `${pole} — ${date.toLocaleDateString("fr-FR")}`, quantite: 1, prixUnitaire: montantTotal, montant: montantTotal }] },
      },
    });

    await prisma.payment.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        cashSessionId: session.id,
        mode: modes[daysAgo % modes.length],
        montant: montantPartPatient,
        cashierId: users.caissier1.id,
        validatedById: users.caissier2.id,
        validatedAt: date,
        createdAt: date,
      },
    });

    // Une seule créance assurance en cours, pour illustrer le KPI sans le saturer.
    if (!claimCreated && insuranceProviderId) {
      await prisma.insuranceClaim.create({
        data: { organizationId, invoiceId: invoice.id, insuranceProviderId, montant: montantPartAssurance, status: "EN_PREPARATION" },
      });
      claimCreated = true;
    }
  }

  // ---- Une consultation déjà terminée, avec ordonnance dispensée et avis patient (pour démontrer impression + NPS) ----
  const consultationTerminee = await createConsultationWithInvoice(organizationId, users.admin.id, {
    patientId: patients[0].id,
    medecinId: users.medecin.id,
    motif: "Fièvre et céphalées persistantes",
    isPayant: false,
  });
  await prisma.consultation.update({
    where: { id: consultationTerminee.id },
    data: {
      status: "TERMINEE",
      diagnostic: "Paludisme simple",
      diagnosticCim: "B54",
      examenClinique: "Température 38.9°C, pas de signe de gravité.",
      endedAt: new Date(),
    },
  });
  const prescription = await createPrescriptionWithAlerts({
    consultationId: consultationTerminee.id,
    patientId: patients[0].id,
    prescripteurId: users.medecin.id,
    items: [{ stockItemId: stockItems.PARA500.id, denomination: "Paracétamol 500mg", posologie: "1 comprimé 3x/jour pendant 3 jours", duree: "3 jours", quantite: 9 }],
  });
  await dispensePrescriptionItem({ organizationId, prescriptionItemId: prescription.items[0].id, userId: users.pharmacien.id });
  await createSatisfaction(organizationId, { patientId: patients[0].id, consultationId: consultationTerminee.id, score: 9, commentaire: "Prise en charge rapide, personnel à l'écoute." });

  // ---- Avis patients supplémentaires ce mois-ci, pour un NPS représentatif sur le tableau de bord ----
  const satisfactionScores = [10, 9, 8, 10, 7, 3, 9];
  for (let i = 0; i < satisfactionScores.length; i++) {
    await createSatisfaction(organizationId, { patientId: patients[(i + 2) % patients.length].id, score: satisfactionScores[i] });
  }

  // ---- Deux consultations payantes "du jour" : une verrouillée en attente de caisse, une débloquée après double validation ----
  const consultationEnAttente = await createConsultationWithInvoice(organizationId, users.admin.id, {
    patientId: patients[1].id,
    medecinId: users.medecin.id,
    motif: "Douleurs abdominales",
    isPayant: true,
    montant: 15000,
  });
  void consultationEnAttente; // reste verrouillée (EN_ATTENTE_CAISSE) — illustre le dispositif anti-fraude à la connexion caissier/médecin

  const consultationAEncaisser = await createConsultationWithInvoice(organizationId, users.admin.id, {
    patientId: patients[2].id,
    medecinId: users.medecin.id,
    motif: "Consultation de suivi tension artérielle",
    isPayant: true,
    montant: 12000,
  });
  const invoiceAEncaisser = await prisma.invoice.findFirstOrThrow({ where: { organizationId, patientId: patients[2].id, items: { some: { consultationId: consultationAEncaisser.id } } } });

  const todaySession = await openCashSession({ organizationId, cashierId: users.caissier1.id, cashRegisterId, montantOuverture: 20000 });
  const todayPayment = await registerPayment({
    organizationId,
    cashierId: users.caissier1.id,
    input: { invoiceId: invoiceAEncaisser.id, cashSessionId: todaySession.id, mode: "ESPECES", montant: Number(invoiceAEncaisser.montantPartPatient) },
  });
  await validatePaymentBlind({ organizationId, paymentId: todayPayment.id, validatorId: users.admin.id, pin: DEFAULT_PIN });

  // ---- Une vente comptoir en pharmacie, pour illustrer une sortie de stock FEFO réelle ----
  await sellCounter({
    organizationId,
    createdById: users.pharmacien.id,
    input: { patientId: patients[3].id, items: [{ stockItemId: stockItems["SER-5ML"].id, quantite: 2 }] },
  });

  // ---- Hospitalisation en cours, avec une note de soins ----
  const liveBed = await prisma.bed.findFirst({ where: { organizationId, status: "LIBRE" } });
  if (liveBed) {
    const hospitalization = await admitPatient({ organizationId, patientId: patients[4].id, bedId: liveBed.id, motifEntree: "Surveillance post-opératoire" });
    await addNursingNote({ organizationId, hospitalizationId: hospitalization.id, authorId: users.infirmier.id, input: { periode: "JOUR", note: "Constantes stables, patient calme, alimentation reprise." } });
  }

  // ---- RH: une demande de congé en attente, une déjà approuvée ----
  await createLeaveRequest(organizationId, users.infirmier.id, { type: "CONGE_PAYE", dateDebut: daysFromNow(10), dateFin: daysFromNow(15) });
  const congeMedecin = await createLeaveRequest(organizationId, users.medecin.id, { type: "CONGE_PAYE", dateDebut: daysFromNow(-20), dateFin: daysFromNow(-15) });
  await updateLeaveStatus(organizationId, congeMedecin.id, users.admin.id, "APPROUVE");

  console.log(`Données de démonstration créées: ${patients.length} patients, ${stockDefs.length} articles pharmacie, 18 jours d'historique de facturation.`);
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "clinique-demo" },
    update: { onboardingCompletedAt: new Date() },
    create: {
      name: "Clinique Demo AxeHealth",
      slug: "clinique-demo",
      city: "Douala",
      country: "CM",
      plan: "PRO",
      // Les comptes de démo n'ont pas besoin de traverser /onboarding — ils
      // arrivent directement sur le tableau de bord.
      onboardingCompletedAt: new Date(),
    },
  });

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const pinHash = await hashPin(DEFAULT_PIN);

  const userDefs = [
    { key: "admin", email: "admin@axehealth.demo", firstName: "Admin", lastName: "Système", role: "ADMIN" as const, isSuperAdmin: true },
    { key: "medecin", email: "medecin@axehealth.demo", firstName: "Jean", lastName: "Medecin", role: "MEDECIN" as const, isSuperAdmin: false },
    { key: "caissier1", email: "caissier1@axehealth.demo", firstName: "Alice", lastName: "Caisse", role: "CAISSIER" as const, isSuperAdmin: false },
    { key: "caissier2", email: "caissier2@axehealth.demo", firstName: "Bernard", lastName: "Caisse", role: "CAISSIER" as const, isSuperAdmin: false },
    { key: "pharmacien", email: "pharmacien@axehealth.demo", firstName: "Claire", lastName: "Pharma", role: "PHARMACIEN" as const, isSuperAdmin: false },
    { key: "infirmier", email: "infirmier@axehealth.demo", firstName: "David", lastName: "Soins", role: "INFIRMIER" as const, isSuperAdmin: false },
    { key: "secretaire", email: "secretaire@axehealth.demo", firstName: "Estelle", lastName: "Accueil", role: "SECRETAIRE" as const, isSuperAdmin: false },
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
        pinHash,
        firstName: def.firstName,
        lastName: def.lastName,
        role: def.role,
        isSuperAdmin: def.isSuperAdmin,
      },
    });
  }

  let cashRegister = await prisma.cashRegister.findFirst({ where: { organizationId: organization.id, name: "Caisse Accueil" } });
  if (!cashRegister) {
    cashRegister = await prisma.cashRegister.create({ data: { organizationId: organization.id, name: "Caisse Accueil" } });
  }

  // Il n'existe pas (encore) d'écran de configuration des chambres/lits —
  // ce jeu de démonstration permet de tester le plan des lits et
  // l'occupation par service dès l'installation, sans accès direct à la DB.
  const wards: { departmentCode: string; departmentName: string; rooms: { numero: string; bedCount: number }[] }[] = [
    { departmentCode: "MED-GEN", departmentName: "Médecine générale", rooms: [{ numero: "101", bedCount: 2 }, { numero: "102", bedCount: 2 }] },
    { departmentCode: "MATERNITE", departmentName: "Maternité", rooms: [{ numero: "201", bedCount: 3 }] },
  ];

  for (const ward of wards) {
    const department = await prisma.department.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: ward.departmentCode } },
      update: {},
      create: { organizationId: organization.id, name: ward.departmentName, code: ward.departmentCode },
    });

    for (const roomDef of ward.rooms) {
      const room = await prisma.room.upsert({
        where: { organizationId_numero: { organizationId: organization.id, numero: roomDef.numero } },
        update: {},
        create: { organizationId: organization.id, departmentId: department.id, numero: roomDef.numero, type: "CHAMBRE_DOUBLE" },
      });

      for (let i = 1; i <= roomDef.bedCount; i++) {
        await prisma.bed.upsert({
          where: { roomId_numero: { roomId: room.id, numero: String(i) } },
          update: {},
          create: { organizationId: organization.id, roomId: room.id, numero: String(i) },
        });
      }
    }
  }

  await seedDemoData(organization.id, users, cashRegister.id);

  console.log(`Seed terminé. Organisation: ${organization.slug}`);
  console.log(`Compte de démonstration principal: admin@axehealth.demo / ${DEFAULT_PASSWORD} (super-admin plateforme)`);
  console.log(`Autres comptes: medecin, caissier1, caissier2, pharmacien, infirmier, secretaire @axehealth.demo — même mot de passe, PIN caisse: ${DEFAULT_PIN}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
