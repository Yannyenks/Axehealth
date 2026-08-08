import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { createAccountSchema } from "@/lib/validations/accounting-setup";
import { createAccount, listAccounts } from "@/services/accounting-setup.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.read);

    const accounts = await listAccounts(session.organizationId);
    return NextResponse.json({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.write);

    const input = createAccountSchema.parse(await req.json());
    const account = await createAccount(session.organizationId, input);

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
