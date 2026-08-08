import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { getDashboardOverview } from "@/services/dashboard.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.dashboards.read);

    const overview = await getDashboardOverview(session.organizationId);

    return NextResponse.json({ overview });
  } catch (error) {
    return handleApiError(error);
  }
}
