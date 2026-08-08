import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
});

export const createRoomSchema = z.object({
  departmentId: z.string().cuid().optional(),
  numero: z.string().min(1).max(20),
  type: z.enum(["CHAMBRE_SIMPLE", "CHAMBRE_DOUBLE", "BLOC_OPERATOIRE", "URGENCES", "SOINS_INTENSIFS"]),
  bedCount: z.number().int().min(1).max(20).default(1),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
