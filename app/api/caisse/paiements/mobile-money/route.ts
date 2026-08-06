import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { initiateMobileMoneySchema } from "@/lib/validations/caisse";
import { initiateMobileMoneyPayment } from "@/services/caisse.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.caisse.encaisser);

    const input = initiateMobileMoneySchema.parse(await req.json());

    const payment = await initiateMobileMoneyPayment({
      organizationId: session.organizationId,
      cashierId: session.sub,
      input,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "MOBILE_MONEY_PAYMENT_INITIATED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { mode: input.mode, montant: input.montant },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ payment, message: "Paiement Mobile Money initié — en attente de confirmation opérateur" }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
