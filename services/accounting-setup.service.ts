import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/api-error";
import type { CreateAccountInput, CreateJournalInput, CreateThirdPartyInput } from "@/lib/validations/accounting-setup";

export async function listJournals(organizationId: string) {
  return prisma.journal.findMany({ where: { organizationId, isActive: true }, orderBy: { code: "asc" } });
}

export async function createJournal(organizationId: string, input: CreateJournalInput) {
  const existing = await prisma.journal.findUnique({ where: { organizationId_code: { organizationId, code: input.code } } });
  if (existing) throw new ConflictError("Un journal avec ce code existe déjà");

  return prisma.journal.create({ data: { organizationId, ...input } });
}

export async function listAccounts(organizationId: string) {
  return prisma.account.findMany({ where: { organizationId, isActive: true }, orderBy: { numero: "asc" } });
}

export async function createAccount(organizationId: string, input: CreateAccountInput) {
  const existing = await prisma.account.findUnique({ where: { organizationId_numero: { organizationId, numero: input.numero } } });
  if (existing) throw new ConflictError("Un compte avec ce numéro existe déjà");

  return prisma.account.create({ data: { organizationId, ...input } });
}

export async function listThirdParties(organizationId: string) {
  return prisma.thirdParty.findMany({ where: { organizationId }, orderBy: { raisonSociale: "asc" } });
}

export async function createThirdParty(organizationId: string, input: CreateThirdPartyInput) {
  const existing = await prisma.thirdParty.findUnique({ where: { organizationId_code: { organizationId, code: input.code } } });
  if (existing) throw new ConflictError("Un tiers avec ce code existe déjà");

  return prisma.thirdParty.create({ data: { organizationId, ...input } });
}
