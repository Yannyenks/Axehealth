import { z } from "zod";

export const createLabRequestSchema = z.object({
  type: z.enum(["LABORATOIRE", "IMAGERIE"]),
  libelle: z.string().min(1).max(200),
});

export const updateLabResultSchema = z.object({
  resultat: z.string().min(1).max(4000),
  resultatFileUrl: z.string().url().optional(),
});

export type CreateLabRequestInput = z.infer<typeof createLabRequestSchema>;
