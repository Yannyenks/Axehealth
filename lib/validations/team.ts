import { z } from "zod";

const ROLES = ["ADMIN", "SECRETAIRE", "MEDECIN", "INFIRMIER", "PHARMACIEN", "BIOLOGISTE", "CAISSIER", "COMPTABLE", "RH"] as const;

export const createTeamMemberSchema = z.object({
  email: z.string().email().max(150),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(ROLES),
  phone: z.string().max(30).optional(),
  departmentId: z.string().cuid().optional(),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().cuid().nullable().optional(),
});

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
