import { z } from "zod";

export const createIncidentSchema = z.object({
  hospitalizationId: z.string().cuid().optional(),
  type: z.enum(["CHUTE", "ESCARRE", "ERREUR_MEDICAMENTEUSE", "INFECTION_NOSOCOMIALE", "AUTRE"]),
  severite: z.enum(["MINEUR", "MODERE", "MAJEUR", "CRITIQUE"]),
  description: z.string().min(1).max(2000),
  actionsCorrectives: z.string().max(2000).optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
