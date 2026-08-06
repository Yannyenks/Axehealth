import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { getRevenueSeries } from "@/services/dashboard.service";

const ALLOWED_DAYS = [7, 30, 90] as const;

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.dashboards.read);

    const { searchParams } = new URL(req.url);
    const daysParam = Number(searchParams.get("days") ?? 7);
    const days = ALLOWED_DAYS.includes(daysParam as (typeof ALLOWED_DAYS)[number]) ? (daysParam as (typeof ALLOWED_DAYS)[number]) : 7;

    const series = await getRevenueSeries(session.organizationId, days);

    return NextResponse.json(series);
  } catch (error) {
    return handleApiError(error);
  }
}
