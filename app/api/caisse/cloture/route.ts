import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { closeCashSessionSchema } from "@/lib/validations/caisse";
import { closeCashSessionWithPin } from "@/services/caisse.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.caisse.cloturer);

    const input = closeCashSessionSchema.parse(await req.json());

    const cashSession = await closeCashSessionWithPin({
      organizationId: session.organizationId,
      cashSessionId: input.cashSessionId,
      cashierId: session.sub,
      input,
    });

    const hasEcart = cashSession.ecart && Number(cashSession.ecart) !== 0;

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: hasEcart ? "CASH_SESSION_CLOSED_WITH_DISCREPANCY" : "CASH_SESSION_CLOSED",
      entityType: "CashSession",
      entityId: cashSession.id,
      metadata: {
        montantClotureTheorique: cashSession.montantClotureTheorique?.toString(),
        montantClotureReel: cashSession.montantClotureReel?.toString(),
        ecart: cashSession.ecart?.toString(),
      },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ cashSession });
  } catch (error) {
    return handleApiError(error);
  }
}
