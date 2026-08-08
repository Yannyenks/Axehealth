import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createPaymentSchema } from "@/lib/validations/caisse";
import { registerPayment } from "@/services/caisse.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.caisse.encaisser);

    const input = createPaymentSchema.parse(await req.json());

    const payment = await registerPayment({
      organizationId: session.organizationId,
      cashierId: session.sub,
      input,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PAYMENT_REGISTERED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { montant: payment.montant.toString(), mode: payment.mode },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json(
      { payment, message: "Paiement enregistré — en attente de validation par un second utilisateur habilité" },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
