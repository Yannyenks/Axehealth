import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateHospitalizationSchema } from "@/lib/validations/hospitalisation";
import { dischargePatient, transferBed } from "@/services/hospitalisation.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.hospitalisation.write);

    const input = updateHospitalizationSchema.parse(await req.json());

    if (input.action === "SORTIE") {
      const hospitalization = await dischargePatient({
        organizationId: session.organizationId,
        hospitalizationId: params.id,
        motifSortie: input.motifSortie,
      });

      await writeAuditLog({
        organizationId: session.organizationId,
        userId: session.sub,
        action: "PATIENT_DISCHARGED",
        entityType: "Hospitalization",
        entityId: hospitalization.id,
        ipAddress: ipFromRequest(req),
      });

      return NextResponse.json({ hospitalization });
    }

    const hospitalization = await transferBed({
      organizationId: session.organizationId,
      hospitalizationId: params.id,
      newBedId: input.newBedId,
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PATIENT_TRANSFERRED",
      entityType: "Hospitalization",
      entityId: hospitalization.id,
      metadata: { newBedId: input.newBedId },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ hospitalization });
  } catch (error) {
    return handleApiError(error);
  }
}
