import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.rh.read);

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") ?? undefined;

    const users = await prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true, role: role as never },
      select: { id: true, firstName: true, lastName: true, role: true, email: true },
      orderBy: { lastName: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
