import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createDepartmentSchema, createRoomSchema } from "@/lib/validations/locaux";
import { listLocaux, createDepartment, createRoomWithBeds } from "@/services/locaux.service";

const createLocauxSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("DEPARTMENT") }).merge(createDepartmentSchema),
  z.object({ kind: z.literal("ROOM") }).merge(createRoomSchema),
]);

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.hospitalisation.read);

    const departments = await listLocaux(session.organizationId);

    return NextResponse.json({ departments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.locaux.manage);

    const input = createLocauxSchema.parse(await req.json());

    if (input.kind === "DEPARTMENT") {
      const department = await createDepartment(session.organizationId, input);
      await writeAuditLog({
        organizationId: session.organizationId,
        userId: session.sub,
        action: "DEPARTMENT_CREATED",
        entityType: "Department",
        entityId: department.id,
        ipAddress: ipFromRequest(req),
      });
      return NextResponse.json({ department }, { status: 201 });
    }

    const room = await createRoomWithBeds(session.organizationId, input);
    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "ROOM_CREATED",
      entityType: "Room",
      entityId: room.id,
      metadata: { bedCount: room.beds.length },
      ipAddress: ipFromRequest(req),
    });
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
