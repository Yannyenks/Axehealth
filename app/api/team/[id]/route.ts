import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateTeamMemberSchema } from "@/lib/validations/team";
import { updateTeamMember } from "@/services/team.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.equipe.manage);

    const input = updateTeamMemberSchema.parse(await req.json());
    const user = await updateTeamMember(session.organizationId, params.id, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "TEAM_MEMBER_UPDATED",
      entityType: "User",
      entityId: user.id,
      metadata: JSON.parse(JSON.stringify(input)),
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
