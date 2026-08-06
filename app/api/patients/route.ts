import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createPatientSchema } from "@/lib/validations/patient";
import { findPotentialDuplicates, createPatient } from "@/services/patient.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.patients.read);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    const patients = await prisma.patient.findMany({
      where: {
        organizationId: session.organizationId,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { patientNumber: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      include: { insuranceProvider: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ patients });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.patients.write);

    const input = createPatientSchema.parse(await req.json());

    if (!input.force) {
      const duplicates = await findPotentialDuplicates(session.organizationId, input);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: "POTENTIAL_DUPLICATE", duplicates }, { status: 409 });
      }
    }

    const patient = await createPatient(session.organizationId, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PATIENT_CREATED",
      entityType: "Patient",
      entityId: patient.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
