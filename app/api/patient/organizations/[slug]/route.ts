import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, NotFoundError } from "@/lib/api-error";

// Route publique (aucune authentification) — c'est le point d'entrée du lien
// patient propre à chaque établissement (/patient/[slug]), appelé avant même
// que le patient soit connecté pour afficher le logo/la couleur de la
// clinique. Ne renvoie que des champs déjà publics par nature (identiques à
// ceux affichés sur la page de connexion staff ou dans l'URL elle-même) —
// jamais de données patient ni de détails internes de l'organisation.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: params.slug },
      select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, isActive: true },
    });
    if (!organization || !organization.isActive) throw new NotFoundError("Établissement introuvable");

    const { isActive: _isActive, ...organizationInfo } = organization;
    void _isActive;

    return NextResponse.json({ organization: organizationInfo });
  } catch (error) {
    return handleApiError(error);
  }
}
