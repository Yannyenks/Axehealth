import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateOrganizationSchema } from "@/lib/validations/organization";
import { updateOrganizationProfile } from "@/services/organization.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);

    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: session.organizationId } });

    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.organisation.manage);

    const input = updateOrganizationSchema.parse(await req.json());
    const organization = await updateOrganizationProfile(session.organizationId, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "ORGANIZATION_PROFILE_UPDATED",
      entityType: "Organization",
      entityId: session.organizationId,
      metadata: JSON.parse(JSON.stringify(input)),
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}
