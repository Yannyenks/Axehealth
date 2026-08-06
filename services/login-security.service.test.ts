import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { LockedError } from "@/lib/api-error";
import { assertNotLocked, recordFailedLogin, recordSuccessfulLogin } from "@/services/login-security.service";

describe("Verrouillage de compte anti brute-force", () => {
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Clinique Test Lockout", slug: `test-lockout-${Date.now()}` } });
    organizationId = organization.id;

    const user = await prisma.user.create({
      data: { organizationId, email: `lockout-${Date.now()}@test.local`, passwordHash: await hashPassword("Test1234!"), firstName: "Test", lastName: "Lockout", role: "ADMIN" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("ne verrouille pas avant le seuil, verrouille au 5e échec", async () => {
    for (let i = 0; i < 4; i++) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await recordFailedLogin(userId, user.failedLoginAttempts);
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(updated.lockedUntil).toBeNull();
      expect(() => assertNotLocked(updated)).not.toThrow();
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await recordFailedLogin(userId, user.failedLoginAttempts); // 5e échec

    const locked = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(locked.lockedUntil).not.toBeNull();
    expect(() => assertNotLocked(locked)).toThrow(LockedError);
  });

  it("une connexion réussie remet le compteur et le verrou à zéro", async () => {
    await recordSuccessfulLogin(userId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(() => assertNotLocked(user)).not.toThrow();
  });
});
