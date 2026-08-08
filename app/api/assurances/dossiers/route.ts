import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createClaimSchema } from "@/lib/validations/insurance";
import { createClaimForInvoice, listClaims } from "@/services/insurance.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.assurances.read);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;

    const claims = await listClaims(session.organizationId, status);

    return NextResponse.json({ claims });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.assurances.write);

    const { invoiceId } = createClaimSchema.parse(await req.json());
    const claim = await createClaimForInvoice(session.organizationId, invoiceId);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "INSURANCE_CLAIM_CREATED",
      entityType: "InsuranceClaim",
      entityId: claim.id,
      metadata: { montant: claim.montant.toString(), numeroBordereau: claim.numeroBordereau },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ claim }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
