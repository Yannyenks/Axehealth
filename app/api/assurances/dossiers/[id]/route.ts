import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateClaimStatusSchema } from "@/lib/validations/insurance";
import { updateClaimStatus } from "@/services/insurance.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.assurances.write);

    const { status } = updateClaimStatusSchema.parse(await req.json());
    const claim = await updateClaimStatus(session.organizationId, params.id, status);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "INSURANCE_CLAIM_STATUS_UPDATED",
      entityType: "InsuranceClaim",
      entityId: claim.id,
      metadata: { status },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ claim });
  } catch (error) {
    return handleApiError(error);
  }
}
