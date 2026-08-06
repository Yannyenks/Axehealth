import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateAlertRuleSchema } from "@/lib/validations/alert-rule";
import { setAlertRuleActive } from "@/services/alert-rule.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.alertes.manage);

    const { isActive } = updateAlertRuleSchema.parse(await req.json());
    const rule = await setAlertRuleActive(session.organizationId, params.id, isActive);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: isActive ? "ALERT_RULE_ACTIVATED" : "ALERT_RULE_DEACTIVATED",
      entityType: "AlertRule",
      entityId: rule.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}
