import { z } from "zod";

export const createProviderSchema = z.object({
  name: z.string().min(1).max(150),
  tauxPriseEnCharge: z.number().int().min(0).max(100),
  plafondAnnuel: z.number().min(0).optional(),
  contact: z.string().max(200).optional(),
});

export const createClaimSchema = z.object({
  invoiceId: z.string().cuid(),
});

export const updateClaimStatusSchema = z.object({
  status: z.enum(["TRANSMIS", "ACCEPTE", "REJETE", "PAYE"]),
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
