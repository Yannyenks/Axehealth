import { z } from "zod";

export const createCreditNoteSchema = z.object({
  invoiceId: z.string().cuid(),
  montant: z.number().positive(),
  motif: z.enum(["ERREUR_FACTURATION", "RETOUR_PRODUIT", "GESTE_COMMERCIAL", "AUTRE"]),
  note: z.string().max(500).optional(),
});

export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
