import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/api-error";

// Vue plateforme: un super-admin ne charge jamais les données métier d'un
// tenant (patients, factures...), seulement des compteurs d'usage — il
// n'obtient pas d'accès implicite au contenu d'une organisation qui n'est
// pas la sienne, uniquement à des métadonnées de gestion.
export async function listOrganizationsWithUsage() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      createdAt: true,
      _count: { select: { users: true, patients: true } },
    },
  });

  return organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    isActive: org.isActive,
    createdAt: org.createdAt,
    utilisateurs: org._count.users,
    patients: org._count.patients,
  }));
}

export async function setOrganizationActive(organizationId: string, isActive: boolean) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new NotFoundError("Organisation introuvable");

  return prisma.organization.update({ where: { id: organizationId }, data: { isActive } });
}
