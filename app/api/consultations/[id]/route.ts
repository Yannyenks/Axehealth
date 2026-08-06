import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, assertSameOrganization, PERMISSIONS } from "@/lib/rbac";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateConsultationSchema } from "@/lib/validations/consultation";
import { enrichVitalSign } from "@/lib/clinical";

async function loadConsultation(id: string) {
  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: { patient: true, medecin: { select: { id: true, firstName: true, lastName: true } }, vitalSigns: true, prescriptions: { include: { items: true } }, labRequests: true },
  });
  if (!consultation) throw new NotFoundError("Consultation introuvable");
  return consultation;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.consultations.read);

    const consultation = await loadConsultation(params.id);
    assertSameOrganization(session, consultation.organizationId);

    return NextResponse.json({ consultation: { ...consultation, vitalSigns: consultation.vitalSigns.map(enrichVitalSign) } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.consultations.write);

    const consultation = await loadConsultation(params.id);
    assertSameOrganization(session, consultation.organizationId);

    // Verrou anti-fraude: un acte payant en attente de caisse ne peut pas être
    // démarré ni clôturé tant qu'un paiement validé ne l'a pas débloqué.
    if (consultation.status === "EN_ATTENTE_CAISSE") {
      throw new ConflictError("Consultation verrouillée: en attente de validation caisse");
    }

    const input = updateConsultationSchema.parse(await req.json());

    const updated = await prisma.consultation.update({
      where: { id: params.id },
      data: {
        status: input.status,
        diagnostic: input.diagnostic,
        diagnosticCim: input.diagnosticCim,
        examenClinique: input.examenClinique,
        notes: input.notes,
        endedAt: input.status === "TERMINEE" ? new Date() : undefined,
        vitalSigns: input.vitalSigns
          ? {
              create: {
                patientId: consultation.patientId,
                ...input.vitalSigns,
              },
            }
          : undefined,
      },
      include: { vitalSigns: true },
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "CONSULTATION_UPDATED",
      entityType: "Consultation",
      entityId: updated.id,
      metadata: { status: input.status },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ consultation: { ...updated, vitalSigns: updated.vitalSigns.map(enrichVitalSign) } });
  } catch (error) {
    return handleApiError(error);
  }
}
