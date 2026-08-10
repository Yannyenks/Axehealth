import { z } from "zod";

// organizationSlug est requis sur les deux schémas car Patient.email n'est
// unique que par organisation (@@unique([organizationId, email])) — le
// patient doit d'abord identifier son établissement.
export const patientSignupSchema = z.object({
  organizationSlug: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  sexe: z.enum(["M", "F"]),
  dateNaissance: z.coerce.date(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(150),
  password: z.string().min(8).max(100),
});

export const patientLoginSchema = z.object({
  organizationSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export type PatientSignupInput = z.infer<typeof patientSignupSchema>;
export type PatientLoginInput = z.infer<typeof patientLoginSchema>;
