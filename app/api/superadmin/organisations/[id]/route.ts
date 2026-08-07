import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { setOrganizationActive, setOrganizationPlan } from "@/services/superadmin.service";

const schema = z
  .object({ isActive: z.boolean().optional(), plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]).optional() })
  .refine((d) => d.isActive !== undefined || d.plan !== undefined, { message: "Rien à mettre à jour" });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireSuperAdmin(session);

    const { isActive, plan } = schema.parse(await req.json());

    let organization;
    // Journalisé au nom de la plateforme, pas dans le tenant lui-même — un
    // super-admin agit depuis l'extérieur de l'organisation qu'il modifie.
    if (isActive !== undefined) {
      organization = await setOrganizationActive(params.id, isActive);
      await writeAuditLog({
        organizationId: params.id,
        userId: session.sub,
        action: isActive ? "ORGANIZATION_REACTIVATED_BY_SUPERADMIN" : "ORGANIZATION_SUSPENDED_BY_SUPERADMIN",
        entityType: "Organization",
        entityId: params.id,
        ipAddress: ipFromRequest(req),
      });
    }
    if (plan !== undefined) {
      organization = await setOrganizationPlan(params.id, plan);
      await writeAuditLog({
        organizationId: params.id,
        userId: session.sub,
        action: "ORGANIZATION_PLAN_CHANGED",
        entityType: "Organization",
        entityId: params.id,
        metadata: { to: plan },
        ipAddress: ipFromRequest(req),
      });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}
