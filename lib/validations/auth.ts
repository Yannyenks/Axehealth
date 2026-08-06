import { z } from "zod";

export const signupSchema = z.object({
  organizationName: z.string().min(2).max(150),
  city: z.string().max(100).optional(),
  country: z.string().length(2).default("CM"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export type SignupInput = z.infer<typeof signupSchema>;
