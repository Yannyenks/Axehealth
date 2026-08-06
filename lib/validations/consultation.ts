import { z } from "zod";

export const createConsultationSchema = z.object({
  patientId: z.string().cuid(),
  medecinId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  motif: z.string().min(1).max(500).optional(),
  isPayant: z.boolean().default(true), // false = pas de verrou caisse (ex: contrôle gratuit)
});

export const updateConsultationSchema = z.object({
  status: z.enum(["PLANIFIEE", "EN_ATTENTE_CAISSE", "EN_COURS", "TERMINEE", "ANNULEE"]).optional(),
  diagnostic: z.string().max(1000).optional(),
  diagnosticCim: z.string().max(20).optional(),
  examenClinique: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  vitalSigns: z
    .object({
      temperature: z.number().min(25).max(45).optional(),
      tensionSys: z.number().int().min(40).max(300).optional(),
      tensionDia: z.number().int().min(20).max(200).optional(),
      pouls: z.number().int().min(20).max(250).optional(),
      frequenceResp: z.number().int().min(5).max(80).optional(),
      poids: z.number().min(0.5).max(400).optional(),
      taille: z.number().min(20).max(250).optional(),
      saturationO2: z.number().int().min(0).max(100).optional(),
      glycemie: z.number().min(0).max(10).optional(),
    })
    .optional(),
});

export const createPrescriptionSchema = z.object({
  items: z
    .array(
      z.object({
        stockItemId: z.string().cuid().optional(),
        denomination: z.string().min(1).max(200),
        posologie: z.string().min(1).max(300),
        duree: z.string().max(50).optional(),
        quantite: z.number().int().min(1).max(1000),
      }),
    )
    .min(1),
});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
