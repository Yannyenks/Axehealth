import { NextResponse, type NextRequest } from "next/server";
import { requirePatientAuth } from "@/lib/patient-auth";
import { handleApiError } from "@/lib/api-error";
import { postPreConsultationMessageSchema } from "@/lib/validations/pre-consultation";
import { postPatientMessage } from "@/services/pre-consultation.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requirePatientAuth(req);
    const { content } = postPreConsultationMessageSchema.parse(await req.json());

    const result = await postPatientMessage(session.organizationId, session.sub, params.id, content);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
