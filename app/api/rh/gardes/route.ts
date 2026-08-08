import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createShiftSchema } from "@/lib/validations/rh";
import { createShift, getPlanning } from "@/services/rh.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.rh.read);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date();
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);

    const shifts = await getPlanning(session.organizationId, from, to);

    return NextResponse.json({ shifts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.rh.write);

    const input = createShiftSchema.parse(await req.json());
    const shift = await createShift(session.organizationId, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "SHIFT_CREATED",
      entityType: "Shift",
      entityId: shift.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
