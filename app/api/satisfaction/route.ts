import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createSatisfactionSchema } from "@/lib/validations/satisfaction";
import { createSatisfaction, getSatisfactionStats } from "@/services/satisfaction.service";

function defaultMonthRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from, to };
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.satisfaction.read);

    const { searchParams } = new URL(req.url);
    const defaults = defaultMonthRange();
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : defaults.from;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : defaults.to;

    const stats = await getSatisfactionStats(session.organizationId, from, to);

    return NextResponse.json({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.satisfaction.enregistrer);

    const input = createSatisfactionSchema.parse(await req.json());
    const satisfaction = await createSatisfaction(session.organizationId, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PATIENT_SATISFACTION_RECORDED",
      entityType: "PatientSatisfaction",
      entityId: satisfaction.id,
      metadata: { score: satisfaction.score },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ satisfaction }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
