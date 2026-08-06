import { PrismaClient } from "@prisma/client";
import { hashPassword, hashPin } from "../lib/auth";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "AxeHealth2026!";
const DEFAULT_PIN = "1234";

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "clinique-demo" },
    update: {},
    create: {
      name: "Clinique Demo AxeHealth",
      slug: "clinique-demo",
      city: "Douala",
      country: "CM",
    },
  });

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const pinHash = await hashPin(DEFAULT_PIN);

  const users = [
    { email: "admin@axehealth.demo", firstName: "Admin", lastName: "Système", role: "ADMIN" as const },
    { email: "medecin@axehealth.demo", firstName: "Jean", lastName: "Medecin", role: "MEDECIN" as const },
    { email: "caissier1@axehealth.demo", firstName: "Alice", lastName: "Caisse", role: "CAISSIER" as const },
    { email: "caissier2@axehealth.demo", firstName: "Bernard", lastName: "Caisse", role: "CAISSIER" as const },
    { email: "pharmacien@axehealth.demo", firstName: "Claire", lastName: "Pharma", role: "PHARMACIEN" as const },
    { email: "infirmier@axehealth.demo", firstName: "David", lastName: "Soins", role: "INFIRMIER" as const },
    { email: "secretaire@axehealth.demo", firstName: "Estelle", lastName: "Accueil", role: "SECRETAIRE" as const },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        organizationId: organization.id,
        email: user.email,
        passwordHash,
        pinHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  }

  const existingRegister = await prisma.cashRegister.findFirst({ where: { organizationId: organization.id, name: "Caisse Accueil" } });
  if (!existingRegister) {
    await prisma.cashRegister.create({ data: { organizationId: organization.id, name: "Caisse Accueil" } });
  }

  console.log(`Seed terminé. Organisation: ${organization.slug}`);
  console.log(`Mot de passe par défaut: ${DEFAULT_PASSWORD} — PIN caisse: ${DEFAULT_PIN}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
