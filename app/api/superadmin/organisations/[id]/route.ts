import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { setOrganizationActive } from "@/services/superadmin.service";

const schema = z.object({ isActive: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireSuperAdmin(session);

    const { isActive } = schema.parse(await req.json());
    const organization = await setOrganizationActive(params.id, isActive);

    // Journalisé au nom de la plateforme, pas dans le tenant lui-même — un
    // super-admin agit depuis l'extérieur de l'organisation qu'il suspend.
    await writeAuditLog({
      organizationId: params.id,
      userId: session.sub,
      action: isActive ? "ORGANIZATION_REACTIVATED_BY_SUPERADMIN" : "ORGANIZATION_SUSPENDED_BY_SUPERADMIN",
      entityType: "Organization",
      entityId: params.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}
