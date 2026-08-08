import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { dispensePrescriptionItemSchema } from "@/lib/validations/pharmacie";
import { dispensePrescriptionItem } from "@/services/pharmacie.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.pharmacie.write);

    const input = dispensePrescriptionItemSchema.parse(await req.json());

    const item = await dispensePrescriptionItem({
      organizationId: session.organizationId,
      prescriptionItemId: input.prescriptionItemId,
      userId: session.sub,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PRESCRIPTION_ITEM_DISPENSED",
      entityType: "PrescriptionItem",
      entityId: item.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error);
  }
}
