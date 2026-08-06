import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createProviderSchema } from "@/lib/validations/insurance";
import { createProvider, listProviders } from "@/services/insurance.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.assurances.read);

    const providers = await listProviders(session.organizationId);

    return NextResponse.json({ providers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.assurances.write);

    const input = createProviderSchema.parse(await req.json());
    const provider = await createProvider(session.organizationId, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "INSURANCE_PROVIDER_CREATED",
      entityType: "InsuranceProvider",
      entityId: provider.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ provider }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
