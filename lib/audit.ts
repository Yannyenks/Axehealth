import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

interface AuditEntry {
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

// Écriture seule, jamais de update/delete sur AuditLog — journal immuable
// requis pour la traçabilité anti-fraude et les contrôles réglementaires.
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? undefined,
    },
  });
}

export function ipFromRequest(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
