import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { generateTotp } from "@/lib/totp";
import { ForbiddenError } from "@/lib/rbac";
import { startMfaSetup, confirmMfaSetup, verifyMfaLogin, disableMfa } from "@/services/mfa.service";

describe("MFA — activation, connexion, codes de secours", () => {
  let organizationId: string;
  let userId: string;
  const password = "Test1234!";

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test MFA", slug: `test-mfa-${Date.now()}` } });
    organizationId = organization.id;

    const user = await prisma.user.create({
      data: { organizationId, email: `mfa-${Date.now()}@test.local`, passwordHash: await hashPassword(password), firstName: "Sam", lastName: "Test", role: "ADMIN" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("n'active le MFA qu'après un premier code valide", async () => {
    const { secret } = await startMfaSetup(userId, "mfa-test@test.local");

    let user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.totpEnabled).toBe(false); // pas encore actif tant que non confirmé

    await expect(confirmMfaSetup(userId, "000000")).rejects.toThrow(ForbiddenError);

    const validCode = generateTotp(secret);
    const { backupCodes } = await confirmMfaSetup(userId, validCode);
    expect(backupCodes).toHaveLength(8);

    user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.totpEnabled).toBe(true);
  });

  it("valide la connexion avec un code TOTP courant, rejette un code invalide", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const code = generateTotp(user.totpSecret!);

    await expect(verifyMfaLogin(userId, "999999")).rejects.toThrow(ForbiddenError);
    const result = await verifyMfaLogin(userId, code);
    expect(result.id).toBe(userId);
  });

  it("un code de secours fonctionne une seule fois puis est refusé", async () => {
    const { backupCodes } = await confirmMfaSetup(userId, generateTotp((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).totpSecret!));
    const code = backupCodes[0];

    await verifyMfaLogin(userId, code);
    await expect(verifyMfaLogin(userId, code)).rejects.toThrow(ForbiddenError);
  });

  it("la désactivation exige un code TOTP ou le mot de passe valide", async () => {
    await expect(disableMfa(userId, { totpCode: "000000", password: "mauvais-mdp" })).rejects.toThrow(ForbiddenError);

    await disableMfa(userId, { password });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.totpEnabled).toBe(false);
    expect(user.totpSecret).toBeNull();
    expect(user.totpBackupCodes).toHaveLength(0);
  });
});
