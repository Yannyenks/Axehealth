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
    { email: "admin@axehealth.demo", firstName: "Admin", lastName: "Système", role: "ADMIN" as const, isSuperAdmin: true },
    { email: "medecin@axehealth.demo", firstName: "Jean", lastName: "Medecin", role: "MEDECIN" as const, isSuperAdmin: false },
    { email: "caissier1@axehealth.demo", firstName: "Alice", lastName: "Caisse", role: "CAISSIER" as const, isSuperAdmin: false },
    { email: "caissier2@axehealth.demo", firstName: "Bernard", lastName: "Caisse", role: "CAISSIER" as const, isSuperAdmin: false },
    { email: "pharmacien@axehealth.demo", firstName: "Claire", lastName: "Pharma", role: "PHARMACIEN" as const, isSuperAdmin: false },
    { email: "infirmier@axehealth.demo", firstName: "David", lastName: "Soins", role: "INFIRMIER" as const, isSuperAdmin: false },
    { email: "secretaire@axehealth.demo", firstName: "Estelle", lastName: "Accueil", role: "SECRETAIRE" as const, isSuperAdmin: false },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { isSuperAdmin: user.isSuperAdmin },
      create: {
        organizationId: organization.id,
        email: user.email,
        passwordHash,
        pinHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
    });
  }

  const existingRegister = await prisma.cashRegister.findFirst({ where: { organizationId: organization.id, name: "Caisse Accueil" } });
  if (!existingRegister) {
    await prisma.cashRegister.create({ data: { organizationId: organization.id, name: "Caisse Accueil" } });
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
