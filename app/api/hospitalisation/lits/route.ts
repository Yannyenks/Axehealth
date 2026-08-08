import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { getBedMap } from "@/services/hospitalisation.service";

// Vue temps réel du plan des lits — polling léger côté client (pas de
// websocket dans cette itération), suffisant pour un rafraîchissement
// toutes les quelques secondes sur l'écran de supervision.
export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.hospitalisation.read);

    const rooms = await getBedMap(session.organizationId);

    return NextResponse.json({ rooms });
  } catch (error) {
    return handleApiError(error);
  }
}
