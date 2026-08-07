import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createTeamMemberSchema } from "@/lib/validations/team";
import { listTeamMembers, createTeamMember } from "@/services/team.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.equipe.read);

    const members = await listTeamMembers(session.organizationId);

    return NextResponse.json({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.equipe.manage);

    const input = createTeamMemberSchema.parse(await req.json());
    const { user, tempPassword } = await createTeamMember(session.organizationId, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "TEAM_MEMBER_CREATED",
      entityType: "User",
      entityId: user.id,
      metadata: { role: user.role },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ user, tempPassword }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
