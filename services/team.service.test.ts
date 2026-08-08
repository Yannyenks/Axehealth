import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import { ForbiddenError } from "@/lib/rbac";
import { listTeamMembers, createTeamMember, updateTeamMember } from "@/services/team.service";

describe("Gestion de l'équipe (utilisateurs)", () => {
  let organizationId: string;
  let adminId: string;
  let secondAdminId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Équipe", slug: `test-equipe-${Date.now()}` } });
    organizationId = organization.id;

    const admin = await prisma.user.create({
      data: { organizationId, email: `admin-${Date.now()}@test.demo`, passwordHash: "x", firstName: "Admin", lastName: "Un", role: "ADMIN" },
    });
    adminId = admin.id;

    const secondAdmin = await prisma.user.create({
      data: { organizationId, email: `admin2-${Date.now()}@test.demo`, passwordHash: "x", firstName: "Admin", lastName: "Deux", role: "ADMIN" },
    });
    secondAdminId = secondAdmin.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("crée un nouveau membre avec un mot de passe provisoire à usage unique", async () => {
    const { user, tempPassword } = await createTeamMember(organizationId, {
      email: `nouveau-${Date.now()}@test.demo`,
      firstName: "Jean",
      lastName: "Nouveau",
      role: "MEDECIN",
    });

    expect(user.role).toBe("MEDECIN");
    expect(user.isActive).toBe(true);
    expect(tempPassword).toHaveLength(12);
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("refuse de créer un compte avec un email déjà utilisé", async () => {
    const email = `duplique-${Date.now()}@test.demo`;
    await createTeamMember(organizationId, { email, firstName: "A", lastName: "B", role: "SECRETAIRE" });

    await expect(createTeamMember(organizationId, { email, firstName: "C", lastName: "D", role: "SECRETAIRE" })).rejects.toThrow(ConflictError);
  });

  it("liste les membres, actifs et inactifs", async () => {
    const members = await listTeamMembers(organizationId);
    expect(members.length).toBeGreaterThanOrEqual(2);
  });

  it("ne renvoie jamais le hash du mot de passe lors d'une mise à jour", async () => {
    const { user } = await createTeamMember(organizationId, { email: `safe-update-${Date.now()}@test.demo`, firstName: "A", lastName: "B", role: "SECRETAIRE" });
    const updated = await updateTeamMember(organizationId, user.id, adminId, { role: "INFIRMIER" });
    expect(updated).not.toHaveProperty("passwordHash");
    expect(updated.role).toBe("INFIRMIER");
  });

  it("empêche un administrateur de se désactiver lui-même", async () => {
    await expect(updateTeamMember(organizationId, adminId, adminId, { isActive: false })).rejects.toThrow(ForbiddenError);
  });

  it("empêche de désactiver le dernier administrateur actif restant", async () => {
    // On désactive d'abord le second admin, ne laissant plus que `adminId` actif.
    await updateTeamMember(organizationId, secondAdminId, adminId, { isActive: false });

    await expect(updateTeamMember(organizationId, adminId, secondAdminId, { isActive: false })).rejects.toThrow(ConflictError);
  });

  it("lève une NotFoundError pour un utilisateur inexistant", async () => {
    await expect(updateTeamMember(organizationId, "inexistant-id", adminId, { isActive: false })).rejects.toThrow(NotFoundError);
  });
});
