import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { toCsv, csvResponse } from "@/lib/csv";
import { getActivityReport } from "@/services/dashboard.service";

function defaultMonthRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from, to };
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.dashboards.read);

    const { searchParams } = new URL(req.url);
    const defaults = defaultMonthRange();
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : defaults.from;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : defaults.to;

    const report = await getActivityReport(session.organizationId, from, to);

    if (searchParams.get("format") === "csv") {
      const rows = [
        { metrique: "Consultations terminées", valeur: report.totalConsultations },
        { metrique: "Hospitalisations admises", valeur: report.totalHospitalisations },
        ...report.consultationsParDiagnostic.map((d) => ({ metrique: `Diagnostic ${d.cim}`, valeur: d.count })),
        ...report.examensParType.map((e) => ({ metrique: `Examens ${e.type}`, valeur: e.count })),
      ];
      const csv = toCsv(rows, [{ key: "metrique", header: "Indicateur" }, { key: "valeur", header: "Valeur" }]);
      return csvResponse(csv, `rapport-activite-${from.toISOString().slice(0, 10)}.csv`);
    }

    return NextResponse.json({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
