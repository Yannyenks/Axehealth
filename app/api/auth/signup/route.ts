import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { signupSchema } from "@/lib/validations/auth";
import { signupOrganization } from "@/services/organization.service";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const input = signupSchema.parse(await req.json());

    const { organization, user } = await signupOrganization(input);

    const accessToken = signAccessToken({ sub: user.id, organizationId: organization.id, role: user.role });
    const refreshToken = signRefreshToken(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    await writeAuditLog({
      organizationId: organization.id,
      userId: user.id,
      action: "ORGANIZATION_SIGNED_UP",
      entityType: "Organization",
      entityId: organization.id,
      ipAddress: ipFromRequest(req),
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: organization.id,
        },
        accessToken,
      },
      { status: 201 },
    );

    response.cookies.set("axecompta_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
