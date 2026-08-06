import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { addNursingNoteSchema } from "@/lib/validations/hospitalisation";
import { addNursingNote } from "@/services/hospitalisation.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.hospitalisation.read);

    const notes = await prisma.nursingNote.findMany({
      where: { hospitalizationId: params.id, hospitalization: { organizationId: session.organizationId } },
      include: { author: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    return handleApiError(error);
  }
}

// Cahier de soins infirmiers: chaque entrée est horodatée et rattachée à son
// auteur, pour assurer la transmission fiable entre équipes jour/nuit.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.hospitalisation.write);

    const input = addNursingNoteSchema.parse(await req.json());

    const note = await addNursingNote({
      organizationId: session.organizationId,
      hospitalizationId: params.id,
      authorId: session.sub,
      input,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "NURSING_NOTE_ADDED",
      entityType: "NursingNote",
      entityId: note.id,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
