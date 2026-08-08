import { z } from "zod";

export const submitBusinessAuditSchema = z.object({
  secteurActivite: z.string().min(1).max(100),
  tailleEquipe: z.string().min(1).max(50),
  chiffreAffairesEstime: z.string().min(1).max(50),
  gestionComptableActuelle: z.string().min(1).max(100),
  principalDefiFinancier: z.string().min(1).max(500),
  obligationsFiscales: z.string().max(500).optional(),
});

export type SubmitBusinessAuditInput = z.infer<typeof submitBusinessAuditSchema>;

const MODULES = ["comptabilite", "tresorerie", "tiers", "immobilisations", "fiscalite"] as const;

// Schéma du diagnostic attendu de Gemini — jamais fait confiance à la sortie
// brute d'un modèle IA sans la revalider (même principe que l'extraction OCR,
// voir lib/validations/ai.ts).
export const businessAuditDiagnosticSchema = z.object({
  secteurActivite: z.string(),
  maturiteComptable: z.enum(["DEBUTANT", "INTERMEDIAIRE", "AVANCE"]),
  principauxRisques: z.array(z.string()).min(1).max(6),
  prioritesRecommandees: z.array(z.string()).min(1).max(6),
  modulesRecommandes: z.array(z.enum(MODULES)).min(1),
  syntheseTexte: z.string(),
});

export type BusinessAuditDiagnostic = z.infer<typeof businessAuditDiagnosticSchema>;
