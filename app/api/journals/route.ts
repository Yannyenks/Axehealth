import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { createJournalSchema } from "@/lib/validations/accounting-setup";
import { createJournal, listJournals } from "@/services/accounting-setup.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.read);

    const journals = await listJournals(session.organizationId);
    return NextResponse.json({ journals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.write);

    const input = createJournalSchema.parse(await req.json());
    const journal = await createJournal(session.organizationId, input);

    return NextResponse.json({ journal }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
