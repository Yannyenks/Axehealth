import { z } from "zod";

export const createStockItemSchema = z.object({
  code: z.string().min(1).max(50),
  nom: z.string().min(1).max(200),
  categorie: z.enum(["MEDICAMENT", "CONSOMMABLE", "DISPOSITIF_MEDICAL"]),
  unite: z.string().min(1).max(30),
  prixAchat: z.number().min(0),
  prixVente: z.number().min(0),
  seuilReappro: z.number().int().min(0).default(10),
});

export const receiveStockSchema = z.object({
  numeroLot: z.string().min(1).max(50),
  quantite: z.number().int().positive(),
  datePeremption: z.coerce.date(),
  site: z.string().min(1).max(100),
});

export const sellCounterSchema = z.object({
  patientId: z.string().cuid(),
  items: z
    .array(
      z.object({
        stockItemId: z.string().cuid(),
        quantite: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const dispensePrescriptionItemSchema = z.object({
  prescriptionItemId: z.string().cuid(),
});

export const transferStockSchema = z
  .object({
    stockItemId: z.string().cuid(),
    siteSource: z.string().min(1).max(100),
    siteDestination: z.string().min(1).max(100),
    quantite: z.number().int().positive(),
  })
  .refine((data) => data.siteSource !== data.siteDestination, { message: "Le site source et destination doivent être différents" });

export type CreateStockItemInput = z.infer<typeof createStockItemSchema>;
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;
export type SellCounterInput = z.infer<typeof sellCounterSchema>;
export type DispensePrescriptionItemInput = z.infer<typeof dispensePrescriptionItemSchema>;
export type TransferStockInput = z.infer<typeof transferStockSchema>;
