import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { verifyPassword } from "@/lib/auth";
import { issuePatientSession } from "@/lib/patient-session";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { assertNotLocked, recordFailedLogin, recordSuccessfulLogin } from "@/services/patient-login-security.service";
import { patientLoginSchema } from "@/lib/validations/patient-auth";

export async function POST(req: NextRequest) {
  try {
    const { organizationSlug, email, password } = patientLoginSchema.parse(await req.json());

    const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

    const patient = organization
      ? await prisma.patient.findFirst({ where: { organizationId: organization.id, email: { equals: email, mode: "insensitive" } } })
      : null;

    // Réponse identique que l'établissement/le patient existe ou non, ou que
    // le compte n'ait jamais été activé (passwordHash null) — évite
    // l'énumération de comptes, comme app/api/auth/login/route.ts.
    if (!organization || !organization.isActive || !patient || !patient.passwordHash) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    assertNotLocked(patient);

    if (!(await verifyPassword(patient.passwordHash, password))) {
      await recordFailedLogin(patient.id, patient.failedLoginAttempts);
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    await recordSuccessfulLogin(patient.id);

    await writeAuditLog({
      organizationId: patient.organizationId,
      action: "PATIENT_PORTAL_LOGIN",
      entityType: "Patient",
      entityId: patient.id,
      metadata: { patientId: patient.id },
      ipAddress: ipFromRequest(req),
    });

    return issuePatientSession(patient);
  } catch (error) {
    return handleApiError(error);
  }
}
