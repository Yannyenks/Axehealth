import { z } from "zod";

export const admitPatientSchema = z.object({
  patientId: z.string().cuid(),
  bedId: z.string().cuid(),
  motifEntree: z.string().max(500).optional(),
});

export const dischargePatientSchema = z.object({
  action: z.literal("SORTIE"),
  motifSortie: z.string().max(500).optional(),
});

export const transferBedSchema = z.object({
  action: z.literal("TRANSFERT"),
  newBedId: z.string().cuid(),
});

export const updateHospitalizationSchema = z.discriminatedUnion("action", [dischargePatientSchema, transferBedSchema]);

export const addNursingNoteSchema = z.object({
  periode: z.enum(["JOUR", "NUIT"]),
  note: z.string().min(1).max(2000),
});

export type AdmitPatientInput = z.infer<typeof admitPatientSchema>;
export type UpdateHospitalizationInput = z.infer<typeof updateHospitalizationSchema>;
export type AddNursingNoteInput = z.infer<typeof addNursingNoteSchema>;
