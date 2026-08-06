import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { listOrganizationsWithUsage } from "@/services/superadmin.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireSuperAdmin(session);

    const organizations = await listOrganizationsWithUsage();

    return NextResponse.json({ organizations });
  } catch (error) {
    return handleApiError(error);
  }
}
