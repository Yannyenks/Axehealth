import { z } from "zod";

export const createLeaveRequestSchema = z
  .object({
    type: z.enum(["CONGE_PAYE", "CONGE_MALADIE", "CONGE_MATERNITE", "CONGE_SANS_SOLDE", "AUTRE"]),
    dateDebut: z.coerce.date(),
    dateFin: z.coerce.date(),
    motif: z.string().max(500).optional(),
  })
  .refine((data) => data.dateFin >= data.dateDebut, { message: "La date de fin doit être postérieure ou égale à la date de début", path: ["dateFin"] });

export const updateLeaveStatusSchema = z.object({
  status: z.enum(["APPROUVE", "REJETE"]),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
