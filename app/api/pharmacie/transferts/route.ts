import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { transferStockSchema } from "@/lib/validations/pharmacie";
import { transferStock } from "@/services/pharmacie.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.pharmacie.write);

    const input = transferStockSchema.parse(await req.json());
    const result = await transferStock({ organizationId: session.organizationId, createdById: session.sub, ...input });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "STOCK_TRANSFERRED",
      entityType: "StockItem",
      entityId: input.stockItemId,
      metadata: { siteSource: input.siteSource, siteDestination: input.siteDestination, quantite: input.quantite },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
