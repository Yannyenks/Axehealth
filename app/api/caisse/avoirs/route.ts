import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createCreditNoteSchema } from "@/lib/validations/credit-note";
import { issueCreditNote } from "@/services/credit-note.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.caisse.emettreAvoir);

    const input = createCreditNoteSchema.parse(await req.json());
    const creditNote = await issueCreditNote(session.organizationId, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "CREDIT_NOTE_ISSUED",
      entityType: "CreditNote",
      entityId: creditNote.id,
      metadata: { montant: creditNote.montant.toString(), motif: creditNote.motif, invoiceId: creditNote.invoiceId },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ creditNote }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
