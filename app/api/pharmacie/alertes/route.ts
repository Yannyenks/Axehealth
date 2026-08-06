import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { getExpiryAlerts, getReorderAlerts } from "@/services/pharmacie.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.pharmacie.read);

    const { searchParams } = new URL(req.url);
    const daysThreshold = Number(searchParams.get("jours") ?? 30);

    const [peremption, reappro] = await Promise.all([
      getExpiryAlerts(session.organizationId, daysThreshold),
      getReorderAlerts(session.organizationId),
    ]);

    return NextResponse.json({ peremption, reappro });
  } catch (error) {
    return handleApiError(error);
  }
}
