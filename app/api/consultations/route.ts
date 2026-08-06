import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createConsultationSchema } from "@/lib/validations/consultation";

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

    const patient = await prisma.patient.findFirst({
      where: { id: input.patientId, organizationId: session.organizationId },
    });
    if (!patient) {
      return NextResponse.json({ error: "PATIENT_NOT_FOUND" }, { status: 404 });
    }

    // Un acte payant démarre verrouillé: seule la caisse (paiement validé)
    // peut le faire passer en EN_COURS via /api/caisse/paiements/[id]/valider.
    const consultation = await prisma.consultation.create({
      data: {
        organizationId: session.organizationId,
        patientId: input.patientId,
        medecinId: input.medecinId,
        appointmentId: input.appointmentId,
        motif: input.motif,
        status: input.isPayant ? "EN_ATTENTE_CAISSE" : "EN_COURS",
        startedAt: input.isPayant ? undefined : new Date(),
      },
    });

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
