import { NextResponse } from "next/server";
import type { Patient } from "@prisma/client";
import { signPatientAccessToken, signPatientRefreshToken } from "./patient-auth";
import { prisma } from "./prisma";

// Émission de session patient — miroir de lib/session.ts::issueSession, mais
// sur un cookie distinct (axehealth_patient_token) pour coexister sans
// collision avec une session staff dans le même navigateur.
export async function issuePatientSession(patient: Patient): Promise<NextResponse> {
  const accessToken = signPatientAccessToken({ sub: patient.id, organizationId: patient.organizationId });
  const refreshToken = signPatientRefreshToken(patient.id);

  await prisma.patient.update({ where: { id: patient.id }, data: { lastLoginAt: new Date(), refreshToken } });

  const response = NextResponse.json({
    patient: {
      id: patient.id,
      email: patient.email,
      firstName: patient.firstName,
      lastName: patient.lastName,
      organizationId: patient.organizationId,
    },
    accessToken,
  });

  response.cookies.set("axehealth_patient_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });

  return response;
}
