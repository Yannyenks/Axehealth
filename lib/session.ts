import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { signAccessToken, signRefreshToken } from "./auth";
import { prisma } from "./prisma";

// Émission de session partagée entre /api/auth/login (sans MFA) et
// /api/auth/mfa/verifier-login (après second facteur) — un seul endroit
// pose le cookie et fait tourner le refresh token, pour que les deux
// chemins restent strictement équivalents en sécurité.
export async function issueSession(user: User): Promise<NextResponse> {
  const accessToken = signAccessToken({ sub: user.id, organizationId: user.organizationId, role: user.role });
  const refreshToken = signRefreshToken(user.id);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), refreshToken } });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
    },
    accessToken,
  });

  response.cookies.set("axehealth_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });

  return response;
}
