import { z } from "zod";

export const createPreConsultationSessionSchema = z.object({
  motifPatient: z.string().max(300).optional(),
});

export const postPreConsultationMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const convertToConsultationSchema = z
  .object({
    medecinId: z.string().cuid(),
    isPayant: z.boolean().default(true),
    montant: z.number().positive().optional(),
  })
  .refine((data) => !data.isPayant || data.montant !== undefined, {
    message: "Le montant de l'acte est requis pour une consultation payante",
    path: ["montant"],
  });

export const convertToAppointmentSchema = z.object({
  practitionerId: z.string().cuid(),
  scheduledAt: z.coerce.date(),
  duration: z.number().int().min(5).max(240).default(30),
  motif: z.string().max(500).optional(),
});

export type CreatePreConsultationSessionInput = z.infer<typeof createPreConsultationSessionSchema>;
export type PostPreConsultationMessageInput = z.infer<typeof postPreConsultationMessageSchema>;
export type ConvertToConsultationInput = z.infer<typeof convertToConsultationSchema>;
export type ConvertToAppointmentInput = z.infer<typeof convertToAppointmentSchema>;
