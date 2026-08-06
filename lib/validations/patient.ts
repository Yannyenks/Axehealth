import { z } from "zod";

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  sexe: z.enum(["M", "F"]),
  dateNaissance: z.coerce.date(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(150).optional(),
  adresse: z.string().max(300).optional(),
  ville: z.string().max(100).optional(),
  groupeSanguin: z.string().max(10).optional(),
  allergies: z.array(z.string().max(100)).default([]),
  insuranceProviderId: z.string().cuid().optional(),
  insuranceNumber: z.string().max(50).optional(),
  tiersPayantRate: z.number().int().min(0).max(100).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
