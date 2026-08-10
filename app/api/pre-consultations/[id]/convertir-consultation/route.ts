import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { convertToConsultationSchema } from "@/lib/validations/pre-consultation";
import { convertToConsultation } from "@/services/pre-consultation.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.preconsultations.convertirConsultation);

    const input = convertToConsultationSchema.parse(await req.json());
    const consultation = await convertToConsultation(session.organizationId, params.id, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PRECONSULTATION_CONVERTED_CONSULTATION",
      entityType: "PreConsultationSession",
      entityId: params.id,
      metadata: { consultationId: consultation.id },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ consultation }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
