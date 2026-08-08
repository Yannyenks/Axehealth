import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError } from "@/lib/api-error";
import { splitInvoiceAmount, createClaimForInvoice, updateClaimStatus } from "@/services/insurance.service";
import { createConsultationWithInvoice } from "@/services/consultation.service";

describe("Tiers-payant — répartition patient/assurance et bordereaux", () => {
  let organizationId: string;
  let medecinId: string;
  let providerId: string;
  let insuredPatientId: string;
  let uninsuredPatientId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Assurance", slug: `test-assurance-${Date.now()}` } });
    organizationId = organization.id;

    const medecin = await prisma.user.create({
      data: { organizationId, email: `medecin-assur-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Jean", lastName: "Test", role: "MEDECIN" },
    });
    medecinId = medecin.id;

    const provider = await prisma.insuranceProvider.create({ data: { organizationId, name: "CNPS Test", tauxPriseEnCharge: 80 } });
    providerId = provider.id;

    const insuredPatient = await prisma.patient.create({
      data: {
        organizationId,
        patientNumber: `PAT-ASSUR-${Date.now()}`,
        firstName: "Assuré",
        lastName: "Test",
        sexe: "M",
        dateNaissance: new Date("1980-01-01"),
        insuranceProviderId: providerId,
        insuranceNumber: "ADH-001",
      },
    });
    insuredPatientId = insuredPatient.id;

    const uninsuredPatient = await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-NOASSUR-${Date.now()}`, firstName: "Sans", lastName: "Assurance", sexe: "F", dateNaissance: new Date("1990-01-01") },
    });
    uninsuredPatientId = uninsuredPatient.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("un patient sans assurance reste à 100% à sa charge", async () => {
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: uninsuredPatientId } });
    const split = await splitInvoiceAmount(patient, 10000);
    expect(split.montantPartPatient.toString()).toBe("10000");
    expect(split.montantPartAssurance.toString()).toBe("0");
    expect(split.insuranceProviderId).toBeNull();
  });

  it("un patient assuré utilise le taux par défaut du prestataire (80%)", async () => {
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: insuredPatientId } });
    const split = await splitInvoiceAmount(patient, 10000);
    expect(split.montantPartAssurance.toString()).toBe("8000");
    expect(split.montantPartPatient.toString()).toBe("2000");
    expect(split.insuranceProviderId).toBe(providerId);
  });

  it("un taux négocié individuellement (tiersPayantRate) prime sur celui du prestataire", async () => {
    await prisma.patient.update({ where: { id: insuredPatientId }, data: { tiersPayantRate: 50 } });
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: insuredPatientId } });
    const split = await splitInvoiceAmount(patient, 10000);
    expect(split.montantPartAssurance.toString()).toBe("5000");
    expect(split.montantPartPatient.toString()).toBe("5000");
    await prisma.patient.update({ where: { id: insuredPatientId }, data: { tiersPayantRate: null } }); // reset pour les tests suivants
  });

  it("la création de consultation répartit automatiquement la facture, et le dossier assurance suit le cycle de vie complet", async () => {
    const consultation = await createConsultationWithInvoice(organizationId, medecinId, {
      patientId: insuredPatientId,
      medecinId,
      motif: "Contrôle",
      isPayant: true,
      montant: 10000,
    });

    const invoice = await prisma.invoice.findFirstOrThrow({ where: { organizationId, patientId: insuredPatientId, montantTotal: 10000 } });
    expect(invoice.montantPartAssurance.toString()).toBe("8000");
    expect(invoice.montantPartPatient.toString()).toBe("2000");
    expect(invoice.insuranceProviderId).toBe(providerId);
    // Le montant à encaisser en caisse ne porte que sur la part patient.
    expect(invoice.montantPartPatient.toString()).not.toBe(invoice.montantTotal.toString());

    await expect(createClaimForInvoice(organizationId, invoice.id)).resolves.toMatchObject({ montant: expect.anything() });
    const claim = await prisma.insuranceClaim.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    expect(claim.montant.toString()).toBe("8000");
    expect(claim.status).toBe("EN_PREPARATION");

    // Un second dossier pour la même facture est refusé.
    await expect(createClaimForInvoice(organizationId, invoice.id)).rejects.toThrow(ConflictError);

    const transmis = await updateClaimStatus(organizationId, claim.id, "TRANSMIS");
    expect(transmis.transmisAt).not.toBeNull();
    expect(transmis.reponduAt).toBeNull();

    const paye = await updateClaimStatus(organizationId, claim.id, "PAYE");
    expect(paye.reponduAt).not.toBeNull();

    void consultation;
  });

  it("refuse un dossier assurance sur une facture sans part assurance", async () => {
    const consultation = await createConsultationWithInvoice(organizationId, medecinId, {
      patientId: uninsuredPatientId,
      medecinId,
      motif: "Contrôle sans assurance",
      isPayant: true,
      montant: 5000,
    });
    void consultation;

    const invoice = await prisma.invoice.findFirstOrThrow({ where: { organizationId, patientId: uninsuredPatientId } });
    await expect(createClaimForInvoice(organizationId, invoice.id)).rejects.toThrow(ConflictError);
  });
});
