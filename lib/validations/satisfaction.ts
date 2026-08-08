import { z } from "zod";

export const createSatisfactionSchema = z.object({
  patientId: z.string().cuid(),
  consultationId: z.string().cuid().optional(),
  score: z.number().int().min(0).max(10),
  commentaire: z.string().max(1000).optional(),
});

export type CreateSatisfactionInput = z.infer<typeof createSatisfactionSchema>;
