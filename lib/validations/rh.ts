import { z } from "zod";

export const createShiftSchema = z.object({
  userId: z.string().cuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  periode: z.enum(["JOUR", "NUIT"]),
  isAstreinte: z.boolean().default(false),
});

const periodeRegex = /^\d{4}-(0[1-9]|1[0-2])$/; // "2026-08"

export const computePayrollSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SALAIRE_FIXE"),
    userId: z.string().cuid(),
    periode: z.string().regex(periodeRegex),
    salaireBrut: z.number().min(0),
    // Taux de cotisation salariale appliqué au brut — configurable car les
    // taux CNPS réels dépendent du régime et évoluent réglementairement.
    tauxCotisationCnps: z.number().min(0).max(100).default(4.2),
  }),
  z.object({
    type: z.literal("RETROCESSION"),
    userId: z.string().cuid(),
    periode: z.string().regex(periodeRegex),
    retrocessionTaux: z.number().min(0).max(100),
  }),
]);

export const updatePayrollStatusSchema = z.object({
  status: z.enum(["VALIDE", "PAYE"]),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type ComputePayrollInput = z.infer<typeof computePayrollSchema>;
export type UpdatePayrollStatusInput = z.infer<typeof updatePayrollStatusSchema>;
