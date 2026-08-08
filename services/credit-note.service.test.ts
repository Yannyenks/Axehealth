import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError } from "@/lib/api-error";
import { createConsultationWithInvoice } from "@/services/consultation.service";
import { issueCreditNote } from "@/services/credit-note.service";

describe("Avoirs — réduction de la part patient", () => {
  let organizationId: string;
  let medecinId: string;
  let comptableId: string;
  let patientId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Avoirs", slug: `test-avoirs-${Date.now()}` } });
    organizationId = organization.id;

    const medecin = await prisma.user.create({
      data: { organizationId, email: `medecin-avoir-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Jean", lastName: "Test", role: "MEDECIN" },
    });
    medecinId = medecin.id;

    const comptable = await prisma.user.create({
      data: { organizationId, email: `comptable-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Compta", lastName: "Test", role: "COMPTABLE" },
    });
    comptableId = comptable.id;

    const patient = await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-AVOIR-${Date.now()}`, firstName: "Patient", lastName: "Avoir", sexe: "F", dateNaissance: new Date("1988-01-01") },
    });
    patientId = patient.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("réduit la part patient et repasse la facture à PAYEE si l'avoir couvre le solde restant", async () => {
    const consultation = await createConsultationWithInvoice(organizationId, medecinId, {
      patientId,
      medecinId,
      motif: "Test avoir",
      isPayant: true,
      montant: 10000,
    });
    void consultation;

    const invoice = await prisma.invoice.findFirstOrThrow({ where: { organizationId, patientId } });
    expect(invoice.status).toBe("EN_ATTENTE_PAIEMENT");

    const creditNote = await issueCreditNote(organizationId, comptableId, {
      invoiceId: invoice.id,
      montant: 10000,
      motif: "GESTE_COMMERCIAL",
      note: "Geste commercial suite réclamation",
    });
    expect(creditNote.montant.toString()).toBe("10000");

    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.montantPartPatient.toString()).toBe("0");
    expect(updated.status).toBe("PAYEE"); // 0 restant dû = soldée, sans qu'aucun paiement n'ait été encaissé
  });

  it("refuse un avoir supérieur à la part patient de la facture", async () => {
    const consultation = await createConsultationWithInvoice(organizationId, medecinId, {
      patientId,
      medecinId,
      motif: "Test avoir excessif",
      isPayant: true,
      montant: 5000,
    });
    void consultation;

    const invoice = await prisma.invoice.findFirstOrThrow({ where: { organizationId, patientId, montantTotal: 5000 } });

    await expect(issueCreditNote(organizationId, comptableId, { invoiceId: invoice.id, montant: 9000, motif: "AUTRE" })).rejects.toThrow(ConflictError);
  });
});
