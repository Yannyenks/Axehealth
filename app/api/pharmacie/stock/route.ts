import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError, ConflictError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createStockItemSchema } from "@/lib/validations/pharmacie";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.pharmacie.read);

    const stockItems = await prisma.stockItem.findMany({
      where: { organizationId: session.organizationId },
      include: { lots: { where: { quantite: { gt: 0 } }, orderBy: { datePeremption: "asc" } } },
      orderBy: { nom: "asc" },
    });

    const withAvailability = stockItems.map((item) => ({
      ...item,
      quantiteDisponible: item.lots.reduce((sum, lot) => sum + lot.quantite, 0),
    }));

    return NextResponse.json({ stockItems: withAvailability });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.pharmacie.write);

    const input = createStockItemSchema.parse(await req.json());

    const existing = await prisma.stockItem.findFirst({ where: { organizationId: session.organizationId, code: input.code } });
    if (existing) throw new ConflictError("Un article avec ce code existe déjà");

    const stockItem = await prisma.stockItem.create({
      data: { organizationId: session.organizationId, ...input },
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "STOCK_ITEM_CREATED",
      entityType: "StockItem",
      entityId: stockItem.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ stockItem }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
