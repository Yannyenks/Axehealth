import { z } from "zod";

// Schéma de la réponse attendue de Gemini pour l'extraction OCR — jamais
// fait confiance à la sortie brute d'un modèle IA sans la revalider, même en
// mode JSON forcé (voir services/ai-ocr.service.ts).
export const ocrExtractionSchema = z.object({
  dateDocument: z.string(),
  montantTTC: z.number(),
  montantHT: z.number().optional(),
  montantTVA: z.number().optional(),
  tauxTVA: z.number().optional(),
  tiers: z.string().optional(),
  nature: z.enum(["ACHAT", "VENTE", "NOTE_DE_FRAIS", "AUTRE"]),
  devise: z.string().default("XAF"),
  ecritureProposee: z
    .array(
      z.object({
        compteNumero: z.string(),
        compteLibelle: z.string(),
        sens: z.enum(["DEBIT", "CREDIT"]),
        montant: z.number(),
      }),
    )
    .min(2),
  confiance: z.number().min(0).max(1).optional(),
});

export type OcrExtraction = z.infer<typeof ocrExtractionSchema>;

export const sendChatMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  message: z.string().min(1).max(4000),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
