import { z } from "zod";

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  country: z.string().min(2).max(2).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(150).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur hex invalide (ex: #0EA5A4)")
    .nullable()
    .optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
