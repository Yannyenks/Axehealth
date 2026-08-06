import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { verifyPassword, signMfaChallengeToken } from "@/lib/auth";
import { issueSession } from "@/lib/session";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { email, password } = loginSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email } });

    // Réponse identique que l'utilisateur existe ou non — évite l'énumération de comptes.
    if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, password))) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

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
