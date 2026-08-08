import { z } from "zod";

const ROLES = ["ADMIN", "COMPTABLE", "CAISSIER"] as const;

export const createTeamMemberSchema = z.object({
  email: z.string().email().max(150),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(ROLES),
  phone: z.string().max(30).optional(),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
