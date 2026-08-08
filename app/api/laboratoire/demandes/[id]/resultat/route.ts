import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateLabResultSchema } from "@/lib/validations/lab";
import { submitLabResult } from "@/services/lab.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.laboratoire.saisirResultat);

    const input = updateLabResultSchema.parse(await req.json());
    const labRequest = await submitLabResult(session.organizationId, params.id, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "LAB_RESULT_SUBMITTED",
      entityType: "LabRequest",
      entityId: labRequest.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ labRequest });
  } catch (error) {
    return handleApiError(error);
  }
}
