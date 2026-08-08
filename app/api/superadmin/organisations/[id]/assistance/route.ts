import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, signAccessToken, getBearerToken } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError, NotFoundError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { getOrCreateSupportUser } from "@/services/superadmin.service";

const ASSIST_RETURN_COOKIE = "axecompta_assist_return";

// Démarre une session d'assistance: le super-admin obtient un accès complet
// (comme un ADMIN de l'établissement ciblé) via un compte support réel de
// cette organisation — voir services/superadmin.service.ts::getOrCreateSupportUser
// pour le choix d'architecture. Le token super-admin d'origine est conservé
// dans un cookie séparé pour permettre le retour (POST /api/superadmin/assistance/exit).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireSuperAdmin(session);

    const organization = await prisma.organization.findUnique({ where: { id: params.id } });
    if (!organization) throw new NotFoundError("Organisation introuvable");

    const originalToken = getBearerToken(req);
    if (!originalToken) throw new NotFoundError("Session super-admin introuvable");

    const supportUser = await getOrCreateSupportUser(organization.id);

    const assistanceToken = signAccessToken({
      sub: supportUser.id,
      organizationId: organization.id,
      role: "ADMIN",
      impersonatedBy: session.sub,
    });

    await writeAuditLog({
      organizationId: organization.id,
      userId: session.sub,
      action: "ASSISTANCE_SESSION_STARTED",
      entityType: "Organization",
      entityId: organization.id,
      ipAddress: ipFromRequest(req),
    });

    const response = NextResponse.json({ organization: { id: organization.id, name: organization.name, slug: organization.slug } });

    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge: 15 * 60, path: "/" };
    response.cookies.set(ASSIST_RETURN_COOKIE, originalToken, cookieOptions);
    response.cookies.set("axecompta_token", assistanceToken, cookieOptions);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
