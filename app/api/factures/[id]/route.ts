import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, assertSameOrganization, PERMISSIONS } from "@/lib/rbac";
import { handleApiError, NotFoundError } from "@/lib/api-error";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.factures.read);

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        patient: { select: { firstName: true, lastName: true, patientNumber: true } },
        organization: { select: { name: true, address: true, city: true, phone: true } },
        items: true,
        payments: { select: { mode: true, montant: true, createdAt: true, validatedAt: true } },
        creditNotes: { select: { montant: true, motif: true, createdAt: true } },
      },
    });
    if (!invoice) throw new NotFoundError("Facture introuvable");
    assertSameOrganization(session, invoice.organizationId);

    return NextResponse.json({ invoice });
  } catch (error) {
    return handleApiError(error);
  }
}
