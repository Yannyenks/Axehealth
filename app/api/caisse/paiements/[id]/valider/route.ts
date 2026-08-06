import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { validatePaymentSchema } from "@/lib/validations/caisse";
import { validatePaymentBlind } from "@/services/caisse.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.caisse.valider);

    const input = validatePaymentSchema.parse(await req.json());

    const payment = await validatePaymentBlind({
      organizationId: session.organizationId,
      paymentId: params.id,
      validatorId: session.sub,
      pin: input.pin,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PAYMENT_VALIDATED",
      entityType: "Payment",
      entityId: payment.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ payment, message: "Paiement validé — acte débloqué si facture soldée" });
  } catch (error) {
    return handleApiError(error);
  }
}
