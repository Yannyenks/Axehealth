import { z } from "zod";

const journalItemSchema = z
  .object({
    accountId: z.string().cuid(),
    thirdPartyId: z.string().cuid().optional(),
    libelle: z.string().min(1).max(255),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
  })
  .refine((item) => (item.debit > 0) !== (item.credit > 0), {
    message: "Chaque ligne doit être renseignée soit au débit soit au crédit, jamais les deux ni aucun",
  });

export const createJournalEntrySchema = z.object({
  journalId: z.string().cuid(),
  dateEcriture: z.coerce.date(),
  libelle: z.string().min(1).max(255),
  reference: z.string().max(100).optional(),
  thirdPartyId: z.string().cuid().optional(),
  scannedDocumentId: z.string().cuid().optional(),
  items: z.array(journalItemSchema).min(2, "Une écriture nécessite au moins deux lignes"),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
