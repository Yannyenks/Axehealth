import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { toCsv, csvResponse } from "@/lib/csv";

// Lecture uniquement — journal immuable, réservé aux administrateurs.
export async function GET(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, ["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? undefined;

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: session.organizationId, action: action ? { contains: action, mode: "insensitive" } : undefined },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (searchParams.get("format") === "csv") {
      const rows = logs.map((log) => ({
        date: log.createdAt.toISOString(),
        action: log.action,
        entite: `${log.entityType}:${log.entityId}`,
        utilisateur: log.user ? `${log.user.firstName} ${log.user.lastName} (${log.user.role})` : "",
        ip: log.ipAddress ?? "",
      }));
      const csv = toCsv(rows, [
        { key: "date", header: "Date" },
        { key: "action", header: "Action" },
        { key: "entite", header: "Entité" },
        { key: "utilisateur", header: "Utilisateur" },
        { key: "ip", header: "Adresse IP" },
      ]);
      return csvResponse(csv, `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    }

    return NextResponse.json({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
