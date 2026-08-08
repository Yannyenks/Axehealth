import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { listPendingLabRequests } from "@/services/lab.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.laboratoire.read);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "LABORATOIRE" | "IMAGERIE" | null;

    const labRequests = await listPendingLabRequests(session.organizationId, type ?? undefined);

    return NextResponse.json({ labRequests });
  } catch (error) {
    return handleApiError(error);
  }
}
