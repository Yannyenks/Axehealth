import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { markReviewed } from "@/services/pre-consultation.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.preconsultations.reviewer);

    const updated = await markReviewed(session.organizationId, params.id, session.sub);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PRECONSULTATION_REVIEWED",
      entityType: "PreConsultationSession",
      entityId: updated.id,
      metadata: { severity: updated.severity },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
