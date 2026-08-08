import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { admitPatientSchema } from "@/lib/validations/hospitalisation";
import { admitPatient } from "@/services/hospitalisation.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.hospitalisation.write);

    const input = admitPatientSchema.parse(await req.json());

    const hospitalization = await admitPatient({ organizationId: session.organizationId, ...input });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PATIENT_ADMITTED",
      entityType: "Hospitalization",
      entityId: hospitalization.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ hospitalization }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
