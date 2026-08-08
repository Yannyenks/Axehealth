import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { createJournalEntrySchema } from "@/lib/validations/journal-entry";
import { createJournalEntry, listJournalEntries } from "@/services/journal-entry.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.read);

    const { searchParams } = new URL(req.url);
    const journalId = searchParams.get("journalId") ?? undefined;

    const entries = await listJournalEntries(session.organizationId, journalId);

    return NextResponse.json({ entries });
  } catch (error) {
    return handleApiError(error);
  }
}

// Point d'entrée unique de création d'écriture: le service impose l'équilibre
// débit=crédit avant tout prisma.journalEntry.create — voir
// services/journal-entry.service.ts::createJournalEntry.
export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.write);

    const input = createJournalEntrySchema.parse(await req.json());
    const entry = await createJournalEntry(session.organizationId, session.sub, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "JOURNAL_ENTRY_CREATED",
      entityType: "JournalEntry",
      entityId: entry.id,
      metadata: { numeroPiece: entry.numeroPiece, journalId: entry.journalId },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
