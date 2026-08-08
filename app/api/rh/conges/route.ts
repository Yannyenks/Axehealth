import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createLeaveRequestSchema } from "@/lib/validations/leave";
import { createLeaveRequest, listLeaveRequests } from "@/services/leave.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.conges.demander);

    const { searchParams } = new URL(req.url);
    const canManage = PERMISSIONS.conges.gerer.includes(session.role);
    // Un employé ne voit que ses propres demandes ; RH/Admin voient tout le
    // monde (ou filtrent par employé via ?userId=).
    const userId = canManage ? (searchParams.get("userId") ?? undefined) : session.sub;

    const leaveRequests = await listLeaveRequests(session.organizationId, { userId, status: searchParams.get("status") ?? undefined });

    return NextResponse.json({ leaveRequests });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.conges.demander);

    const input = createLeaveRequestSchema.parse(await req.json());
    const leaveRequest = await createLeaveRequest(session.organizationId, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "LEAVE_REQUEST_CREATED",
      entityType: "LeaveRequest",
      entityId: leaveRequest.id,
      metadata: { type: leaveRequest.type },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ leaveRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
