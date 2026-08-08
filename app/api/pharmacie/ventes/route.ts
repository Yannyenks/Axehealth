import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { sellCounterSchema } from "@/lib/validations/pharmacie";
import { sellCounter } from "@/services/pharmacie.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.pharmacie.write);

    const input = sellCounterSchema.parse(await req.json());

    const invoice = await sellCounter({ organizationId: session.organizationId, createdById: session.sub, input });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PHARMACY_COUNTER_SALE",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: { montantTotal: invoice.montantTotal.toString() },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
