import { z } from "zod";

export const confirmMfaSchema = z.object({ code: z.string().length(6) });

export const disableMfaSchema = z
  .object({ totpCode: z.string().length(6).optional(), password: z.string().min(1).optional() })
  .refine((data) => data.totpCode || data.password, { message: "Fournir un code TOTP ou le mot de passe" });

export const verifyMfaLoginSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(6).max(10), // 6 chiffres TOTP ou code de secours plus long
});
