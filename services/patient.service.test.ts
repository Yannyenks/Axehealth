import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { findPotentialDuplicates, createPatient, updatePatient, decryptAntecedents } from "@/services/patient.service";

describe("Patients — dédoublonnage et historique de modification", () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Patients", slug: `test-patients-${Date.now()}` } });
    organizationId = organization.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("détecte un doublon sur nom+prénom+date de naissance", async () => {
    const dateNaissance = new Date("1992-03-15");
    await createPatient(organizationId, { firstName: "Marie", lastName: "Ngo", sexe: "F", dateNaissance, allergies: [] });

    const duplicates = await findPotentialDuplicates(organizationId, { firstName: "marie", lastName: "NGO", dateNaissance }); // insensible à la casse
    expect(duplicates).toHaveLength(1);
  });

  it("détecte un doublon sur le même numéro de téléphone même avec un nom différent", async () => {
    await createPatient(organizationId, { firstName: "Paul", lastName: "Biya", sexe: "M", dateNaissance: new Date("1975-01-01"), phone: "690112233", allergies: [] });

    const duplicates = await findPotentialDuplicates(organizationId, { firstName: "Paulette", lastName: "Autre", dateNaissance: new Date("2000-01-01"), phone: "690112233" });
    expect(duplicates.some((d) => d.firstName === "Paul")).toBe(true);
  });

  it("ne signale aucun doublon pour un patient réellement distinct", async () => {
    const duplicates = await findPotentialDuplicates(organizationId, { firstName: "Inconnu", lastName: "Personne", dateNaissance: new Date("1960-06-06") });
    expect(duplicates).toHaveLength(0);
  });

  it("journalise uniquement les champs réellement modifiés", async () => {
    const patient = await createPatient(organizationId, { firstName: "Sophie", lastName: "Test", sexe: "F", dateNaissance: new Date("1995-05-05"), phone: "699000000", allergies: [] });

    const { updated, changed } = await updatePatient(organizationId, patient.id, { phone: "699999999", firstName: "Sophie" });

    expect(updated.phone).toBe("699999999");
    expect(changed).toHaveProperty("phone");
    expect(changed).not.toHaveProperty("firstName"); // valeur identique, pas un vrai changement
    expect(changed.phone.avant).toBe("699000000");
    expect(changed.phone.apres).toBe("699999999");
  });

  it("chiffre les antécédents en base et les déchiffre correctement à la lecture", async () => {
    const patient = await createPatient(organizationId, {
      firstName: "Chiffre",
      lastName: "Test",
      sexe: "M",
      dateNaissance: new Date("1980-01-01"),
      allergies: [],
      antecedents: { familiaux: "Hypertension (mère)", chirurgicaux: "Aucun" },
    });

    const raw = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(raw.antecedents).not.toBeNull();
    expect(raw.antecedents).not.toContain("Hypertension"); // jamais en clair en base

    const decrypted = decryptAntecedents(raw.antecedents);
    expect(decrypted?.familiaux).toBe("Hypertension (mère)");
    expect(decrypted?.chirurgicaux).toBe("Aucun");
  });

  it("ne journalise jamais les antécédents en clair, seulement le fait qu'ils ont changé", async () => {
    const patient = await createPatient(organizationId, {
      firstName: "Confidentiel",
      lastName: "Test",
      sexe: "F",
      dateNaissance: new Date("1982-02-02"),
      allergies: [],
    });

    const { changed } = await updatePatient(organizationId, patient.id, { antecedents: { medicaux: "Diabète type 2" } });

    expect(JSON.stringify(changed)).not.toContain("Diabète");
    expect(changed.antecedents.apres).toBe("[modifié]");
  });
});
