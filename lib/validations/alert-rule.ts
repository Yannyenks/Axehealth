import { z } from "zod";

export const createAlertRuleSchema = z.object({
  label: z.string().min(1).max(150),
  metric: z.enum([
    "CA_JOUR",
    "CREANCES_ASSURANCES",
    "TAUX_OCCUPATION_LITS",
    "STOCK_JOURS_AVANT_PEREMPTION",
    "STOCK_SOUS_SEUIL_REAPPRO",
    "ECART_CAISSE_CLOTURE",
  ]),
  operator: z.enum(["SUPERIEUR_A", "INFERIEUR_A"]),
  threshold: z.number(),
  notifyRoles: z
    .array(z.enum(["ADMIN", "SECRETAIRE", "MEDECIN", "INFIRMIER", "PHARMACIEN", "BIOLOGISTE", "CAISSIER", "COMPTABLE", "RH"]))
    .min(1),
});

export const updateAlertRuleSchema = z.object({
  isActive: z.boolean(),
});

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
