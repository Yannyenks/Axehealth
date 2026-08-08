import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog } from "@/lib/audit";
import { mobileMoneyWebhookSchema } from "@/lib/validations/caisse";
import { confirmMobileMoneyPayment } from "@/services/caisse.service";

// Callback fournisseur (MTN MoMo / Orange Money / Wave). Authentifié par
// secret partagé le temps de brancher la vérification de signature propre
// à chaque fournisseur — à faire avant toute mise en production réelle.
export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.MOBILE_MONEY_WEBHOOK_SECRET;
    const providedSecret = req.headers.get("x-webhook-secret");
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const input = mobileMoneyWebhookSchema.parse(await req.json());

    const payment = await confirmMobileMoneyPayment(input);

    await writeAuditLog({
      organizationId: payment.organizationId,
      action: input.success ? "MOBILE_MONEY_PAYMENT_CONFIRMED" : "MOBILE_MONEY_PAYMENT_FAILED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { providerReference: input.providerReference },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleApiError(error);
  }
}
