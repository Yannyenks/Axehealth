import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { submitBusinessAuditSchema } from "@/lib/validations/business-audit";
import { runBusinessAudit } from "@/services/business-audit.service";

// Audit d'accueil mené par le copilote IA (voir services/business-audit.service.ts):
// l'ADMIN qui vient de créer son organisation répond à un court questionnaire,
// l'IA en tire un diagnostic (secteur, maturité, risques, modules recommandés)
// utilisé pour personnaliser le tableau de bord — jamais une donnée comptable
// engageante, uniquement indicative.
export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.organisation.manage);

    const input = submitBusinessAuditSchema.parse(await req.json());
    const organization = await runBusinessAudit(session.organizationId, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "BUSINESS_AUDIT_COMPLETED",
      entityType: "Organization",
      entityId: session.organizationId,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}
