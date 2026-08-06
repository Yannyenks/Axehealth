import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError } from "@/lib/api-error";
import { receiveStock, sellCounter, transferStock } from "@/services/pharmacie.service";

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

describe("Pharmacie — transferts inter-sites", () => {
  let organizationId: string;
  let userId: string;
  let stockItemId: string;
  const datePeremption = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Transfert", slug: `test-transfert-${Date.now()}` } });
    organizationId = organization.id;

    const user = await prisma.user.create({
      data: { organizationId, email: `pharma-transfert-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Claire", lastName: "Test", role: "PHARMACIEN" },
    });
    userId = user.id;

    const stockItem = await prisma.stockItem.create({
      data: { organizationId, code: `MED-TR-${Date.now()}`, nom: "Amoxicilline 500mg", categorie: "MEDICAMENT", unite: "boîte", prixAchat: 800, prixVente: 1500, seuilReappro: 5 },
    });
    stockItemId = stockItem.id;

    await receiveStock({ organizationId, stockItemId, createdById: userId, numeroLot: "LOT-X", quantite: 30, datePeremption, site: "Douala" });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("déplace la quantité du site source vers le site destination avec le même numéro de lot", async () => {
    await transferStock({ organizationId, stockItemId, createdById: userId, siteSource: "Douala", siteDestination: "Kribi", quantite: 12 });

    const doualaLot = await prisma.stockLot.findFirstOrThrow({ where: { stockItemId, site: "Douala" } });
    expect(doualaLot.quantite).toBe(18);

    const kribiLot = await prisma.stockLot.findFirstOrThrow({ where: { stockItemId, site: "Kribi" } });
    expect(kribiLot.quantite).toBe(12);
    expect(kribiLot.numeroLot).toBe("LOT-X");
    expect(kribiLot.datePeremption.getTime()).toBe(datePeremption.getTime());

    const movements = await prisma.stockMovement.findMany({ where: { stockItemId, type: "TRANSFERT" } });
    expect(movements).toHaveLength(2);
    expect(movements.map((m) => m.quantite).sort()).toEqual([-12, 12]);
  });

  it("fusionne dans le lot existant du site destination si un transfert ultérieur porte le même numéro de lot", async () => {
    await transferStock({ organizationId, stockItemId, createdById: userId, siteSource: "Douala", siteDestination: "Kribi", quantite: 5 });

    const kribiLots = await prisma.stockLot.findMany({ where: { stockItemId, site: "Kribi" } });
    expect(kribiLots).toHaveLength(1); // pas de doublon de lot: fusionné
    expect(kribiLots[0].quantite).toBe(17);
  });

  it("refuse un transfert si le site source n'a pas assez de stock", async () => {
    await expect(
      transferStock({ organizationId, stockItemId, createdById: userId, siteSource: "Douala", siteDestination: "Kribi", quantite: 9999 }),
    ).rejects.toThrow(ConflictError);
  });

  it("refuse un transfert vers le même site", async () => {
    await expect(
      transferStock({ organizationId, stockItemId, createdById: userId, siteSource: "Douala", siteDestination: "Douala", quantite: 1 }),
    ).rejects.toThrow(ConflictError);
  });
});
