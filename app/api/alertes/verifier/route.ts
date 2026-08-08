import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { evaluateOrganizationAlertRules } from "@/services/alert-rule.service";

// Vérification à la demande (bouton "Vérifier maintenant" côté UI), en
// complément du cron planifié (voir app/api/cron/evaluer-alertes).
export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.alertes.manage);

    const triggered = await evaluateOrganizationAlertRules(session.organizationId);

    return NextResponse.json({
      triggered: triggered.map((t) => ({ ruleId: t.rule.id, label: t.rule.label, value: t.value })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
