import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { startMfaSetup } from "@/services/mfa.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.sub } });

    const { secret, otpAuthUri } = await startMfaSetup(session.sub, user.email);

    return NextResponse.json({ secret, otpAuthUri });
  } catch (error) {
    return handleApiError(error);
  }
}
