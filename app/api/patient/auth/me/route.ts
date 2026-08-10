import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePatientAuth } from "@/lib/patient-auth";
import { handleApiError, NotFoundError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = requirePatientAuth(req);

    const patient = await prisma.patient.findUnique({
      where: { id: session.sub },
      select: { id: true, email: true, firstName: true, lastName: true, organizationId: true, organization: { select: { name: true, slug: true, logoUrl: true, primaryColor: true } } },
    });
    if (!patient) throw new NotFoundError("Patient introuvable");

    return NextResponse.json({ patient });
  } catch (error) {
    return handleApiError(error);
  }
}
