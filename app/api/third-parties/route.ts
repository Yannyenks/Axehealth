import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { createThirdPartySchema } from "@/lib/validations/accounting-setup";
import { createThirdParty, listThirdParties } from "@/services/accounting-setup.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.read);

    const thirdParties = await listThirdParties(session.organizationId);
    return NextResponse.json({ thirdParties });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.write);

    const input = createThirdPartySchema.parse(await req.json());
    const thirdParty = await createThirdParty(session.organizationId, input);

    return NextResponse.json({ thirdParty }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
