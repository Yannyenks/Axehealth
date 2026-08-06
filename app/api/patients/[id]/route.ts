import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, assertSameOrganization, PERMISSIONS } from "@/lib/rbac";
import { handleApiError, NotFoundError } from "@/lib/api-error";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.patients.read);

    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      include: { insuranceProvider: { select: { name: true } } },
    });
    if (!patient) throw new NotFoundError("Patient introuvable");
    assertSameOrganization(session, patient.organizationId);

    return NextResponse.json({ patient });
  } catch (error) {
    return handleApiError(error);
  }
}
