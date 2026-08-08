import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.factures.read);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;

    const invoices = await prisma.invoice.findMany({
      where: { organizationId: session.organizationId, status: status as never },
      include: {
        patient: { select: { firstName: true, lastName: true, patientNumber: true } },
        items: { select: { pole: true, libelle: true, montant: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    return handleApiError(error);
  }
}
