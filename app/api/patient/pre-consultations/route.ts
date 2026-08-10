import { NextResponse, type NextRequest } from "next/server";
import { requirePatientAuth } from "@/lib/patient-auth";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createPreConsultationSessionSchema } from "@/lib/validations/pre-consultation";
import { createSession, listSessionsForPatient } from "@/services/pre-consultation.service";

export async function GET(req: NextRequest) {
  try {
    const session = requirePatientAuth(req);
    const sessions = await listSessionsForPatient(session.organizationId, session.sub);
    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requirePatientAuth(req);
    const input = createPreConsultationSessionSchema.parse(await req.json().catch(() => ({})));

    const preConsultation = await createSession(session.organizationId, session.sub, input.motifPatient);

    await writeAuditLog({
      organizationId: session.organizationId,
      action: "PRECONSULTATION_STARTED",
      entityType: "PreConsultationSession",
      entityId: preConsultation.id,
      metadata: { patientId: session.sub },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ session: preConsultation }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
