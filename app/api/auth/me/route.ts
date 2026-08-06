import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { handleApiError, NotFoundError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        organization: { select: { name: true, slug: true } },
        totpEnabled: true,
      },
    });
    if (!user) throw new NotFoundError("Utilisateur introuvable");

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
