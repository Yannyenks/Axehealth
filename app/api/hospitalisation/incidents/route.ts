import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createIncidentSchema } from "@/lib/validations/incident";
import { createIncident, listIncidents } from "@/services/incident.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.hospitalisation.read);

    const { searchParams } = new URL(req.url);
    const incidents = await listIncidents(session.organizationId, {
      type: searchParams.get("type") ?? undefined,
      severite: searchParams.get("severite") ?? undefined,
    });

    return NextResponse.json({ incidents });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.hospitalisation.write);

    const input = createIncidentSchema.parse(await req.json());
    const incident = await createIncident(session.organizationId, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "INCIDENT_DECLARED",
      entityType: "Incident",
      entityId: incident.id,
      metadata: { type: incident.type, severite: incident.severite },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
