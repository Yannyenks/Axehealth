import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { verifyPassword, signMfaChallengeToken } from "@/lib/auth";
import { issueSession } from "@/lib/session";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { assertNotLocked, recordFailedLogin, recordSuccessfulLogin } from "@/services/login-security.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { email, password } = loginSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email }, include: { organization: { select: { isActive: true } } } });

    // Réponse identique que l'utilisateur existe ou non, ou que ce soit le
    // compte ou son organisation qui soit désactivé — évite l'énumération
    // de comptes ET ne révèle pas qu'une organisation a été suspendue.
    if (!user || !user.isActive || !user.organization.isActive) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    assertNotLocked(user); // lève avant même de vérifier le mot de passe

    if (!(await verifyPassword(user.passwordHash, password))) {
      await recordFailedLogin(user.id, user.failedLoginAttempts);
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    await recordSuccessfulLogin(user.id);

    if (user.totpEnabled) {
      // Pas de session tant que le second facteur n'est pas confirmé — voir
      // POST /api/auth/mfa/verifier-login.
      return NextResponse.json({ mfaRequired: true, challengeToken: signMfaChallengeToken(user.id) });
    }

    await writeAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress: ipFromRequest(req),
    });

    return issueSession(user);
  } catch (error) {
    return handleApiError(error);
  }
}
