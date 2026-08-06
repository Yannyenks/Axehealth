import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError } from "@/lib/api-error";
import { receiveStock, sellCounter } from "@/services/pharmacie.service";

describe("Pharmacie — FEFO (First Expired, First Out)", () => {
  let organizationId: string;
  let userId: string;
  let patientId: string;
  let stockItemId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test FEFO", slug: `test-fefo-${Date.now()}` } });
    organizationId = organization.id;

    const user = await prisma.user.create({
      data: { organizationId, email: `pharma-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Claire", lastName: "Test", role: "PHARMACIEN" },
    });
    userId = user.id;

    const patient = await prisma.patient.create({
      data: { organizationId, patientNumber: `PAT-FEFO-${Date.now()}`, firstName: "Patient", lastName: "Fefo", sexe: "F", dateNaissance: new Date("1985-05-05") },
    });
    patientId = patient.id;

    const stockItem = await prisma.stockItem.create({
      data: { organizationId, code: `MED-${Date.now()}`, nom: "Paracétamol 500mg", categorie: "MEDICAMENT", unite: "boîte", prixAchat: 500, prixVente: 1000, seuilReappro: 5 },
    });
    stockItemId = stockItem.id;

    // Lot A: expire dans 10 jours, quantité 5 — doit être consommé en premier.
    await receiveStock({
      organizationId,
      stockItemId,
      createdById: userId,
      numeroLot: "LOT-A-URGENT",
      quantite: 5,
      datePeremption: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      site: "Dépôt principal",
    });
    // Lot B: expire dans 100 jours, quantité 20 — ne doit être touché qu'après épuisement du lot A.
    await receiveStock({
      organizationId,
      stockItemId,
      createdById: userId,
      numeroLot: "LOT-B-LOINTAIN",
      quantite: 20,
      datePeremption: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      site: "Dépôt principal",
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("consomme le lot le plus proche de la péremption avant les lots plus récents", async () => {
    // Vend 8 unités: doit épuiser les 5 du lot A puis prendre 3 sur le lot B.
    await sellCounter({ organizationId, createdById: userId, input: { patientId, items: [{ stockItemId, quantite: 8 }] } });

    const lots = await prisma.stockLot.findMany({ where: { stockItemId }, orderBy: { datePeremption: "asc" } });
    expect(lots[0].numeroLot).toBe("LOT-A-URGENT");
    expect(lots[0].quantite).toBe(0);
    expect(lots[1].numeroLot).toBe("LOT-B-LOINTAIN");
    expect(lots[1].quantite).toBe(17);

    const movements = await prisma.stockMovement.findMany({ where: { stockItemId, type: "SORTIE_VENTE" }, orderBy: { createdAt: "asc" } });
    expect(movements).toHaveLength(2);
    expect(movements[0].quantite).toBe(-5);
    expect(movements[1].quantite).toBe(-3);
  });

  it("refuse la vente si le stock cumulé est insuffisant, sans décrémenter partiellement", async () => {
    const before = await prisma.stockLot.findMany({ where: { stockItemId } });
    const totalBefore = before.reduce((sum, l) => sum + l.quantite, 0);

    await expect(
      sellCounter({ organizationId, createdById: userId, input: { patientId, items: [{ stockItemId, quantite: 9999 }] } }),
    ).rejects.toThrow(ConflictError);

    const after = await prisma.stockLot.findMany({ where: { stockItemId } });
    const totalAfter = after.reduce((sum, l) => sum + l.quantite, 0);
    expect(totalAfter).toBe(totalBefore); // la transaction a bien tout annulé (tout ou rien)
  });
});
