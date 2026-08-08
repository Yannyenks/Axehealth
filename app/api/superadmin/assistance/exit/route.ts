import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, verifyAccessToken } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";

const ASSIST_RETURN_COOKIE = "axecompta_assist_return";

// Quitte une session d'assistance et restaure la session super-admin
// d'origine, stashée dans ASSIST_RETURN_COOKIE au moment de POST
// .../assistance (voir app/api/superadmin/organisations/[id]/assistance/route.ts).
export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    if (!session.impersonatedBy) {
      throw new ForbiddenError("Aucune session d'assistance active");
    }

    const returnToken = req.cookies.get(ASSIST_RETURN_COOKIE)?.value;
    if (!returnToken) {
      // Le cookie de retour a expiré ou a été supprimé — on ne peut pas
      // restaurer la session super-admin, il faudra se reconnecter.
      const response = NextResponse.json({ error: "ASSISTANCE_RETURN_EXPIRED" }, { status: 401 });
      response.cookies.delete("axecompta_token");
      response.cookies.delete(ASSIST_RETURN_COOKIE);
      return response;
    }

    try {
      verifyAccessToken(returnToken);
    } catch {
      const response = NextResponse.json({ error: "ASSISTANCE_RETURN_EXPIRED" }, { status: 401 });
      response.cookies.delete("axecompta_token");
      response.cookies.delete(ASSIST_RETURN_COOKIE);
      return response;
    }

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.impersonatedBy,
      action: "ASSISTANCE_SESSION_ENDED",
      entityType: "Organization",
      entityId: session.organizationId,
      ipAddress: ipFromRequest(req),
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set("axecompta_token", returnToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });
    response.cookies.delete(ASSIST_RETURN_COOKIE);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
