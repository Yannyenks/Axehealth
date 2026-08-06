import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { openCashSessionSchema } from "@/lib/validations/caisse";
import { openCashSession } from "@/services/caisse.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.caisse.encaisser);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as "OUVERTE" | "CLOTUREE" | null;

    const sessions = await prisma.cashSession.findMany({
      where: { organizationId: session.organizationId, status: status ?? undefined },
      include: {
        cashRegister: { select: { id: true, name: true } },
        cashier: { select: { id: true, firstName: true, lastName: true } },
        payments: { select: { id: true, montant: true, mode: true, validatedAt: true, cashierId: true } },
      },
      orderBy: { openedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.caisse.encaisser);

    const input = openCashSessionSchema.parse(await req.json());

    const cashSession = await openCashSession({
      organizationId: session.organizationId,
      cashierId: session.sub,
      ...input,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "CASH_SESSION_OPENED",
      entityType: "CashSession",
      entityId: cashSession.id,
      metadata: { montantOuverture: cashSession.montantOuverture.toString() },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ cashSession }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
