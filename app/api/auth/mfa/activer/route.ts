import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { confirmMfaSchema } from "@/lib/validations/mfa";
import { confirmMfaSetup } from "@/services/mfa.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    const { code } = confirmMfaSchema.parse(await req.json());

    const { backupCodes } = await confirmMfaSetup(session.sub, code);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "MFA_ENABLED",
      entityType: "User",
      entityId: session.sub,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ backupCodes });
  } catch (error) {
    return handleApiError(error);
  }
}
