import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.caisse.encaisser);

    const registres = await prisma.cashRegister.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      include: { sessions: { where: { status: "OUVERTE" }, take: 1 } },
    });

    return NextResponse.json({
      registres: registres.map((r) => ({ ...r, sessionOuverte: r.sessions[0] ?? null, sessions: undefined })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
