import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { startLabRequest } from "@/services/lab.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.laboratoire.saisirResultat);

    const labRequest = await startLabRequest(session.organizationId, params.id);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "LAB_REQUEST_STARTED",
      entityType: "LabRequest",
      entityId: labRequest.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ labRequest });
  } catch (error) {
    return handleApiError(error);
  }
}
