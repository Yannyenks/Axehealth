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
    // Pagination bornée : 50 par défaut, 100 au maximum. Les valeurs hors bornes sont ramenées à la limite.
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);

    const where = {
      organizationId: session.organizationId,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { patientNumber: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };

    const [patients, total] = await prisma.$transaction([
      prisma.patient.findMany({
        where,
        include: { insuranceProvider: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);

    return NextResponse.json({ patients, total, page, limit });
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
