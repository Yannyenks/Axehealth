import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import type { CreateJournalEntryInput } from "@/lib/validations/journal-entry";

// Écriture en partie double: la somme des débits doit égaler la somme des
// crédits au centime près avant toute écriture en base — c'est la règle
// fondamentale du SYSCOHADA, jamais laissée à la discrétion du client. Une
// fois créée, l'écriture est immuable (pas de route PATCH/DELETE exposée) —
// même logique de journal non modifiable que AuditLog.
export async function createJournalEntry(organizationId: string, createdById: string, input: CreateJournalEntryInput) {
  const journal = await prisma.journal.findFirst({ where: { id: input.journalId, organizationId, isActive: true } });
  if (!journal) throw new NotFoundError("Journal introuvable");

  const accountIds = [...new Set(input.items.map((item) => item.accountId))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds }, organizationId, isActive: true } });
  if (accounts.length !== accountIds.length) {
    throw new NotFoundError("Un ou plusieurs comptes du plan comptable sont introuvables ou inactifs");
  }

  const auxiliaryAccountIds = new Set(accounts.filter((account) => account.isAuxiliaire).map((account) => account.id));
  const missingThirdParty = input.items.find((item) => auxiliaryAccountIds.has(item.accountId) && !item.thirdPartyId);
  if (missingThirdParty) {
    throw new ConflictError("Un compte auxiliaire (client/fournisseur) nécessite un tiers sur la ligne correspondante");
  }

  const thirdPartyIds = new Set(input.items.map((item) => item.thirdPartyId).filter((id): id is string => Boolean(id)));
  if (input.thirdPartyId) thirdPartyIds.add(input.thirdPartyId);
  if (thirdPartyIds.size > 0) {
    const thirdParties = await prisma.thirdParty.findMany({ where: { id: { in: [...thirdPartyIds] }, organizationId } });
    if (thirdParties.length !== thirdPartyIds.size) throw new NotFoundError("Un ou plusieurs tiers sont introuvables");
  }

  const totalDebit = input.items.reduce((sum, item) => sum.plus(item.debit), new Decimal(0));
  const totalCredit = input.items.reduce((sum, item) => sum.plus(item.credit), new Decimal(0));
  if (!totalDebit.equals(totalCredit)) {
    throw new ConflictError(`Écriture déséquilibrée: débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)}`);
  }
  if (totalDebit.equals(0)) {
    throw new ConflictError("Une écriture ne peut pas être nulle");
  }

  return prisma.$transaction(async (tx) => {
    const year = input.dateEcriture.getUTCFullYear();
    const count = await tx.journalEntry.count({
      where: {
        organizationId,
        journalId: journal.id,
        dateEcriture: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
    });
    const numeroPiece = `${journal.code}-${year}-${String(count + 1).padStart(6, "0")}`;

    return tx.journalEntry.create({
      data: {
        organizationId,
        journalId: journal.id,
        numeroPiece,
        dateEcriture: input.dateEcriture,
        libelle: input.libelle,
        reference: input.reference,
        thirdPartyId: input.thirdPartyId,
        scannedDocumentId: input.scannedDocumentId,
        status: "VALIDEE",
        createdById,
        validatedById: createdById,
        validatedAt: new Date(),
        items: {
          create: input.items.map((item) => ({
            accountId: item.accountId,
            thirdPartyId: item.thirdPartyId,
            libelle: item.libelle,
            debit: item.debit,
            credit: item.credit,
          })),
        },
      },
      include: {
        journal: { select: { code: true, libelle: true } },
        thirdParty: { select: { raisonSociale: true } },
        items: { include: { account: { select: { numero: true, libelle: true } } } },
      },
    });
  });
}

export async function listJournalEntries(organizationId: string, journalId?: string) {
  return prisma.journalEntry.findMany({
    where: { organizationId, journalId },
    include: {
      journal: { select: { code: true, libelle: true } },
      thirdParty: { select: { raisonSociale: true } },
      items: { include: { account: { select: { numero: true, libelle: true } } } },
    },
    orderBy: { dateEcriture: "desc" },
    take: 50,
  });
}
