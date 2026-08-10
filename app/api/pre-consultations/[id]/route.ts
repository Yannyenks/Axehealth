import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { getSessionDetail } from "@/services/pre-consultation.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.preconsultations.read);

    const preConsultation = await getSessionDetail(session.organizationId, params.id);

    // Lecture de PHI (synthèse clinique + transcript) — journalisée comme
    // toute consultation d'un dossier patient sensible.
    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PRECONSULTATION_VIEWED",
      entityType: "PreConsultationSession",
      entityId: preConsultation.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ session: preConsultation });
  } catch (error) {
    return handleApiError(error);
  }
}
