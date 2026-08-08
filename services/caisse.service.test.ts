import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword, hashPin } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { createConsultationWithInvoice } from "@/services/consultation.service";
import { openCashSession, registerPayment, validatePaymentBlind, closeCashSessionWithPin } from "@/services/caisse.service";

// Encode en test automatisé le parcours anti-fraude vérifié manuellement en
// conditions réelles pendant le développement (voir historique) — pour ne
// plus jamais le re-casser silencieusement à une prochaine modification.
// Tourne contre TEST_DATABASE_URL (voir vitest.config.ts), jamais la base
// de développement/démo.
describe("Caisse anti-fraude — parcours complet", () => {
  let organizationId: string;
  let medecinId: string;
  let caissier1Id: string;
  let caissier2Id: string;
  let patientId: string;
  let cashRegisterId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Test1234!");
    const pinHash = await hashPin("1234");

    const organization = await prisma.organization.create({
      data: { name: "Clinique Test Vitest", slug: `test-vitest-${Date.now()}` },
    });
    organizationId = organization.id;

    const medecin = await prisma.user.create({
      data: { organizationId, email: `medecin-${Date.now()}@test.local`, passwordHash, firstName: "Jean", lastName: "Test", role: "MEDECIN" },
    });
    medecinId = medecin.id;

    const caissier1 = await prisma.user.create({
      data: { organizationId, email: `caissier1-${Date.now()}@test.local`, passwordHash, pinHash, firstName: "Alice", lastName: "Test", role: "CAISSIER" },
    });
    caissier1Id = caissier1.id;

    const caissier2 = await prisma.user.create({
      data: { organizationId, email: `caissier2-${Date.now()}@test.local`, passwordHash, pinHash, firstName: "Bernard", lastName: "Test", role: "CAISSIER" },
    });
    caissier2Id = caissier2.id;

    const patient = await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-TEST-${Date.now()}`, firstName: "Patient", lastName: "Test", sexe: "M", dateNaissance: new Date("1990-01-01") },
    });
    patientId = patient.id;

    const cashRegister = await prisma.cashRegister.create({ data: { organizationId, name: "Caisse Test" } });
    cashRegisterId = cashRegister.id;
  });

  afterAll(async () => {
    // onDelete: Cascade sur toutes les relations organizationId nettoie
    // consultations/factures/paiements/sessions en une seule suppression.
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("verrouille la consultation payante jusqu'à validation caisse, puis la débloque", async () => {
    const consultation = await createConsultationWithInvoice(organizationId, medecinId, {
      patientId,
      medecinId,
      motif: "Test anti-fraude",
      isPayant: true,
      montant: 5000,
    });
    expect(consultation.status).toBe("EN_ATTENTE_CAISSE");

    const invoice = await prisma.invoice.findFirstOrThrow({ where: { organizationId, patientId } });
    expect(invoice.montantTotal.toString()).toBe("5000");

    const session = await openCashSession({ organizationId, cashierId: caissier1Id, cashRegisterId, montantOuverture: 10000 });

    const payment = await registerPayment({
      organizationId,
      cashierId: caissier1Id,
      input: { invoiceId: invoice.id, cashSessionId: session.id, mode: "ESPECES", montant: 5000 },
    });
    expect(payment.validatedAt).toBeNull();

    // Le caissier qui encaisse ne peut pas se valider lui-même.
    await expect(
      validatePaymentBlind({ organizationId, paymentId: payment.id, validatorId: caissier1Id, pin: "1234" }),
    ).rejects.toThrow(ForbiddenError);

    // Un PIN erroné échoue aussi, même pour un second utilisateur légitime.
    await expect(
      validatePaymentBlind({ organizationId, paymentId: payment.id, validatorId: caissier2Id, pin: "0000" }),
    ).rejects.toThrow(ForbiddenError);

    const validated = await validatePaymentBlind({ organizationId, paymentId: payment.id, validatorId: caissier2Id, pin: "1234" });
    expect(validated.validatedById).toBe(caissier2Id);

    const unlockedConsultation = await prisma.consultation.findUniqueOrThrow({ where: { id: consultation.id } });
    expect(unlockedConsultation.status).toBe("EN_COURS");
    expect(unlockedConsultation.unlockedByPaymentId).toBe(payment.id);

    const closed = await closeCashSessionWithPin({
      organizationId,
      cashSessionId: session.id,
      cashierId: caissier1Id,
      input: { cashSessionId: session.id, montantClotureReel: 15000, pin: "1234" },
    });
    expect(closed.status).toBe("CLOTUREE");
    expect(closed.ecart?.toString()).toBe("0"); // 10000 ouverture + 5000 espèces encaissées = 15000 théorique
  });
});
