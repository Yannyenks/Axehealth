import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import type { CreateDepartmentInput, CreateRoomInput } from "@/lib/validations/locaux";

export async function listLocaux(organizationId: string) {
  return prisma.department.findMany({
    where: { organizationId },
    include: { rooms: { include: { beds: true }, orderBy: { numero: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(organizationId: string, input: CreateDepartmentInput) {
  const existing = await prisma.department.findUnique({ where: { organizationId_code: { organizationId, code: input.code } } });
  if (existing) throw new ConflictError("Un service avec ce code existe déjà");

  return prisma.department.create({ data: { organizationId, ...input } });
}

// Crée la chambre et ses lits en une seule opération — un lit n'a jamais de
// sens créé isolément (il appartient toujours à une chambre) et c'est ainsi
// que le seed de démonstration procède déjà.
export async function createRoomWithBeds(organizationId: string, input: CreateRoomInput) {
  if (input.departmentId) {
    const department = await prisma.department.findFirst({ where: { id: input.departmentId, organizationId } });
    if (!department) throw new NotFoundError("Service introuvable");
  }

  const existing = await prisma.room.findUnique({ where: { organizationId_numero: { organizationId, numero: input.numero } } });
  if (existing) throw new ConflictError("Une chambre avec ce numéro existe déjà");

  return prisma.room.create({
    data: {
      organizationId,
      departmentId: input.departmentId,
      numero: input.numero,
      type: input.type,
      beds: {
        create: Array.from({ length: input.bedCount }, (_, i) => ({ organizationId, numero: String(i + 1) })),
      },
    },
    include: { beds: true },
  });
}
