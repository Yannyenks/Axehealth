import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updatePayrollStatusSchema } from "@/lib/validations/rh";
import { updatePayrollStatus } from "@/services/rh.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.rh.write);

    const input = updatePayrollStatusSchema.parse(await req.json());

    const payroll = await updatePayrollStatus(session.organizationId, params.id, input.status);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PAYROLL_STATUS_UPDATED",
      entityType: "Payroll",
      entityId: payroll.id,
      metadata: { status: input.status },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ payroll });
  } catch (error) {
    return handleApiError(error);
  }
}
