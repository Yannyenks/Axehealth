import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { disableMfaSchema } from "@/lib/validations/mfa";
import { disableMfa } from "@/services/mfa.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    const input = disableMfaSchema.parse(await req.json());

    await disableMfa(session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "MFA_DISABLED",
      entityType: "User",
      entityId: session.sub,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ disabled: true });
  } catch (error) {
    return handleApiError(error);
  }
}
