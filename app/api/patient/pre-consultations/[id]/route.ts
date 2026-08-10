import { NextResponse, type NextRequest } from "next/server";
import { requirePatientAuth } from "@/lib/patient-auth";
import { handleApiError } from "@/lib/api-error";
import { getSessionForPatient } from "@/services/pre-consultation.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requirePatientAuth(req);
    const preConsultation = await getSessionForPatient(session.organizationId, session.sub, params.id);
    return NextResponse.json({ session: preConsultation });
  } catch (error) {
    return handleApiError(error);
  }
}
