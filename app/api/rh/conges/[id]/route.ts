import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateLeaveStatusSchema } from "@/lib/validations/leave";
import { updateLeaveStatus, cancelLeaveRequest } from "@/services/leave.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);

    const body = await req.json();

    // Annulation de sa propre demande: ouvert à tous. Approbation/rejet
    // d'une demande: réservé à RH/Admin — deux chemins, deux permissions.
    if (body.status === "ANNULE") {
      const leaveRequest = await cancelLeaveRequest(session.organizationId, params.id, session.sub);
      await writeAuditLog({
        organizationId: session.organizationId,
        userId: session.sub,
        action: "LEAVE_REQUEST_CANCELLED",
        entityType: "LeaveRequest",
        entityId: leaveRequest.id,
        ipAddress: ipFromRequest(req),
      });
      return NextResponse.json({ leaveRequest });
    }

    requireRole(session, PERMISSIONS.conges.gerer);
    const { status } = updateLeaveStatusSchema.parse(body);
    const leaveRequest = await updateLeaveStatus(session.organizationId, params.id, session.sub, status);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "LEAVE_REQUEST_REVIEWED",
      entityType: "LeaveRequest",
      entityId: leaveRequest.id,
      metadata: { status },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ leaveRequest });
  } catch (error) {
    return handleApiError(error);
  }
}
