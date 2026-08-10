import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { signPatientAccessToken, signPatientRefreshToken } from "@/lib/patient-auth";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { patientSignupSchema } from "@/lib/validations/patient-auth";
import { signupPatient } from "@/services/patient-auth.service";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const input = patientSignupSchema.parse(await req.json());
    const patient = await signupPatient(input);

    const accessToken = signPatientAccessToken({ sub: patient.id, organizationId: patient.organizationId });
    const refreshToken = signPatientRefreshToken(patient.id);
    await prisma.patient.update({ where: { id: patient.id }, data: { refreshToken, lastLoginAt: new Date() } });

    await writeAuditLog({
      organizationId: patient.organizationId,
      action: "PATIENT_PORTAL_SIGNUP",
      entityType: "Patient",
      entityId: patient.id,
      metadata: { patientId: patient.id },
      ipAddress: ipFromRequest(req),
    });

    const response = NextResponse.json(
      {
        patient: { id: patient.id, email: patient.email, firstName: patient.firstName, lastName: patient.lastName, organizationId: patient.organizationId },
        accessToken,
      },
      { status: 201 },
    );

    response.cookies.set("axehealth_patient_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
