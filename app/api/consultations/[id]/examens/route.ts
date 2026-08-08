import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createLabRequestSchema } from "@/lib/validations/lab";
import { createLabRequest, listLabRequestsForConsultation } from "@/services/lab.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.laboratoire.read);

    const labRequests = await listLabRequestsForConsultation(session.organizationId, params.id);

    return NextResponse.json({ labRequests });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.laboratoire.demander);

    const input = createLabRequestSchema.parse(await req.json());
    const labRequest = await createLabRequest(session.organizationId, params.id, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "LAB_REQUEST_CREATED",
      entityType: "LabRequest",
      entityId: labRequest.id,
      metadata: { type: labRequest.type, libelle: labRequest.libelle },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ labRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
