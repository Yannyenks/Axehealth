import { z } from "zod";

export const openCashSessionSchema = z.object({
  cashRegisterId: z.string().cuid(),
  montantOuverture: z.number().min(0),
});

export const createPaymentSchema = z.object({
  invoiceId: z.string().cuid(),
  cashSessionId: z.string().cuid(),
  mode: z.enum(["ESPECES", "MTN_MOMO", "ORANGE_MONEY", "WAVE", "CARTE", "VIREMENT"]),
  montant: z.number().positive(),
  reference: z.string().max(100).optional(),
});

// Second facteur requis pour valider un paiement (déblocage de l'acte côté
// médecin) — PIN du valideur, distinct du caissier qui a encaissé.
export const validatePaymentSchema = z.object({
  pin: z.string().min(4).max(12),
});

export const closeCashSessionSchema = z.object({
  cashSessionId: z.string().cuid(),
  montantClotureReel: z.number().min(0),
  pin: z.string().min(4).max(12),
});

export const initiateMobileMoneySchema = z.object({
  invoiceId: z.string().cuid(),
  cashSessionId: z.string().cuid(),
  mode: z.enum(["MTN_MOMO", "ORANGE_MONEY", "WAVE"]),
  montant: z.number().positive(),
  phoneNumber: z.string().min(8).max(20),
});

export const mobileMoneyWebhookSchema = z.object({
  providerReference: z.string().min(1),
  success: z.boolean(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ValidatePaymentInput = z.infer<typeof validatePaymentSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
export type InitiateMobileMoneyInput = z.infer<typeof initiateMobileMoneySchema>;
export type MobileMoneyWebhookInput = z.infer<typeof mobileMoneyWebhookSchema>;
