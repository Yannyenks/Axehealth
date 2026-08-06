import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { receiveStockSchema } from "@/lib/validations/pharmacie";
import { receiveStock } from "@/services/pharmacie.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.pharmacie.write);

    const input = receiveStockSchema.parse(await req.json());

    const lot = await receiveStock({
      organizationId: session.organizationId,
      stockItemId: params.id,
      createdById: session.sub,
      ...input,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "STOCK_RECEIVED",
      entityType: "StockLot",
      entityId: lot.id,
      metadata: { quantite: lot.quantite, numeroLot: lot.numeroLot },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ lot }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
