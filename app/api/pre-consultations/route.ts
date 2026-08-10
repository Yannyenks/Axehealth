import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { listSessionsForStaff } from "@/services/pre-consultation.service";
import type { PreConsultationStatus, TriageSeverity } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.preconsultations.read);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as PreConsultationStatus | null;
    const severity = searchParams.get("severity") as TriageSeverity | null;

    const sessions = await listSessionsForStaff(session.organizationId, {
      status: status ?? undefined,
      severity: severity ?? undefined,
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}
