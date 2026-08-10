import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { convertToAppointmentSchema } from "@/lib/validations/pre-consultation";
import { convertToAppointment } from "@/services/pre-consultation.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.preconsultations.convertirRdv);

    const input = convertToAppointmentSchema.parse(await req.json());
    const appointment = await convertToAppointment(session.organizationId, params.id, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PRECONSULTATION_CONVERTED_APPOINTMENT",
      entityType: "PreConsultationSession",
      entityId: params.id,
      metadata: { appointmentId: appointment.id },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
