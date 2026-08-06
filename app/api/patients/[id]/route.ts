import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, assertSameOrganization, PERMISSIONS } from "@/lib/rbac";
import { handleApiError, NotFoundError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updatePatientSchema } from "@/lib/validations/patient";
import { updatePatient } from "@/services/patient.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.patients.read);

    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      include: { insuranceProvider: { select: { name: true } } },
    });
    if (!patient) throw new NotFoundError("Patient introuvable");
    assertSameOrganization(session, patient.organizationId);

    return NextResponse.json({ patient });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.patients.write);

    const input = updatePatientSchema.parse(await req.json());
    const { updated, changed } = await updatePatient(session.organizationId, params.id, input);

    if (Object.keys(changed).length > 0) {
      await writeAuditLog({
        organizationId: session.organizationId,
        userId: session.sub,
        action: "PATIENT_UPDATED",
        entityType: "Patient",
        entityId: updated.id,
        metadata: JSON.parse(JSON.stringify(changed)),
        ipAddress: ipFromRequest(req),
      });
    }

    return NextResponse.json({ patient: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
