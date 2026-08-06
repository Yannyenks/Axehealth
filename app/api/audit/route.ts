import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";

// Lecture uniquement — journal immuable, réservé aux administrateurs.
export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, ["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? undefined;

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: session.organizationId, action: action ? { contains: action, mode: "insensitive" } : undefined },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
