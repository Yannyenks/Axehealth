import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { completeOnboarding } from "@/services/organization.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.organisation.manage);

    const organization = await completeOnboarding(session.organizationId);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "ORGANIZATION_ONBOARDING_COMPLETED",
      entityType: "Organization",
      entityId: session.organizationId,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}
