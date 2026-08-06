import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, assertSameOrganization, PERMISSIONS } from "@/lib/rbac";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createPrescriptionSchema } from "@/lib/validations/consultation";
import { createPrescriptionWithAlerts } from "@/services/prescription.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.consultations.write);

    const consultation = await prisma.consultation.findUnique({ where: { id: params.id } });
    if (!consultation) throw new NotFoundError("Consultation introuvable");
    assertSameOrganization(session, consultation.organizationId);

    if (consultation.status === "EN_ATTENTE_CAISSE") {
      throw new ConflictError("Consultation verrouillée: en attente de validation caisse");
    }

    const input = createPrescriptionSchema.parse(await req.json());

    const prescription = await createPrescriptionWithAlerts({
      consultationId: consultation.id,
      patientId: consultation.patientId,
      prescripteurId: session.sub,
      items: input.items,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PRESCRIPTION_CREATED",
      entityType: "Prescription",
      entityId: prescription.id,
      metadata: { itemsCount: prescription.items.length },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ prescription }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
