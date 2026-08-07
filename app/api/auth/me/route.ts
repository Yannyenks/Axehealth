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
        organization: {
          select: { name: true, slug: true, logoUrl: true, primaryColor: true, plan: true, trialEndsAt: true, onboardingCompletedAt: true },
        },
        totpEnabled: true,
        isSuperAdmin: true,
      },
    });
    if (!user) throw new NotFoundError("Utilisateur introuvable");

    // Dérivé du claim JWT décodé (session), jamais de la base — l'état
    // d'assistance est une propriété du token en cours, pas de l'utilisateur.
    const impersonation = session.impersonatedBy ? { active: true as const } : { active: false as const };

    return NextResponse.json({ user, impersonation });
  } catch (error) {
    return handleApiError(error);
  }
}
