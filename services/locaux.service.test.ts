import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import { listLocaux, createDepartment, createRoomWithBeds } from "@/services/locaux.service";

describe("Configuration des services/chambres/lits", () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Locaux", slug: `test-locaux-${Date.now()}` } });
    organizationId = organization.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("crée un service puis une chambre avec ses lits en une opération", async () => {
    const department = await createDepartment(organizationId, { name: "Chirurgie", code: "CHIR" });

    const room = await createRoomWithBeds(organizationId, { departmentId: department.id, numero: "301", type: "BLOC_OPERATOIRE", bedCount: 3 });
    expect(room.beds).toHaveLength(3);

    const locaux = await listLocaux(organizationId);
    const chirurgie = locaux.find((d) => d.code === "CHIR");
    expect(chirurgie?.rooms).toHaveLength(1);
    expect(chirurgie?.rooms[0].beds).toHaveLength(3);
  });

  it("refuse un service ou une chambre en doublon", async () => {
    await createDepartment(organizationId, { name: "Pédiatrie", code: "PEDIA" });
    await expect(createDepartment(organizationId, { name: "Pédiatrie 2", code: "PEDIA" })).rejects.toThrow(ConflictError);

    await createRoomWithBeds(organizationId, { numero: "401", type: "CHAMBRE_SIMPLE", bedCount: 1 });
    await expect(createRoomWithBeds(organizationId, { numero: "401", type: "CHAMBRE_SIMPLE", bedCount: 1 })).rejects.toThrow(ConflictError);
  });

  it("lève une NotFoundError si le service référencé n'existe pas", async () => {
    await expect(createRoomWithBeds(organizationId, { departmentId: "inexistant-id", numero: "501", type: "URGENCES", bedCount: 1 })).rejects.toThrow(NotFoundError);
  });
});
