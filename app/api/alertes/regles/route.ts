import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createAlertRuleSchema } from "@/lib/validations/alert-rule";
import { createAlertRule, listAlertRules } from "@/services/alert-rule.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.alertes.manage);

    const rules = await listAlertRules(session.organizationId);

    return NextResponse.json({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.alertes.manage);

    const input = createAlertRuleSchema.parse(await req.json());
    const rule = await createAlertRule(session.organizationId, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "ALERT_RULE_CREATED",
      entityType: "AlertRule",
      entityId: rule.id,
      metadata: { metric: rule.metric, operator: rule.operator, threshold: rule.threshold.toString() },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
