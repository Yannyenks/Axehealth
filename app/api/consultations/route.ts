import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createConsultationSchema } from "@/lib/validations/consultation";
import { createConsultationWithInvoice } from "@/services/consultation.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.consultations.read);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const patientId = searchParams.get("patientId") ?? undefined;
    const medecinId = searchParams.get("medecinId") ?? undefined;

    const consultations = await prisma.consultation.findMany({
      where: {
        organizationId: session.organizationId,
        status: status as never,
        patientId,
        // Un médecin ne voit par défaut que ses propres consultations, sauf ADMIN.
        medecinId: session.role === "MEDECIN" ? session.sub : medecinId,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        medecin: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ consultations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.consultations.write);

    const input = createConsultationSchema.parse(await req.json());

    const consultation = await createConsultationWithInvoice(session.organizationId, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "CONSULTATION_CREATED",
      entityType: "Consultation",
      entityId: consultation.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ consultation }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
