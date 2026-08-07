import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { getPlatformKpis } from "@/services/superadmin.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireSuperAdmin(session);

    const kpis = await getPlatformKpis();

    return NextResponse.json({ kpis });
  } catch (error) {
    return handleApiError(error);
  }
}
