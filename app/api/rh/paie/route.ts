import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { computePayrollSchema } from "@/lib/validations/rh";
import { computePayroll } from "@/services/rh.service";

export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.rh.read);

    const { searchParams } = new URL(req.url);
    const periode = searchParams.get("periode") ?? undefined;

    const payrolls = await prisma.payroll.findMany({
      where: { organizationId: session.organizationId, periode },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ payrolls });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.rh.write);

    const input = computePayrollSchema.parse(await req.json());
    const payroll = await computePayroll(session.organizationId, input);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "PAYROLL_COMPUTED",
      entityType: "Payroll",
      entityId: payroll.id,
      metadata: { type: payroll.type, periode: payroll.periode, netAPayer: payroll.netAPayer.toString() },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ payroll }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
