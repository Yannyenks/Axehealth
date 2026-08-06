import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMfaChallengeToken } from "@/lib/auth";
import { issueSession } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { verifyMfaLoginSchema } from "@/lib/validations/mfa";
import { verifyMfaLogin } from "@/services/mfa.service";

export async function POST(req: NextRequest) {
  try {
    const { challengeToken, code } = verifyMfaLoginSchema.parse(await req.json());

    let userId: string;
    try {
      userId = verifyMfaChallengeToken(challengeToken).sub;
    } catch {
      return NextResponse.json({ error: "CHALLENGE_EXPIRED" }, { status: 401 });
    }

    const user = await verifyMfaLogin(userId, code);
    const fullUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await writeAuditLog({
      organizationId: fullUser.organizationId,
      userId: fullUser.id,
      action: "USER_LOGIN_MFA",
      entityType: "User",
      entityId: fullUser.id,
      ipAddress: ipFromRequest(req),
    });

    return issueSession(fullUser);
  } catch (error) {
    return handleApiError(error);
  }
}
