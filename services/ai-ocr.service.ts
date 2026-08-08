import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGeminiModel } from "@/lib/ai/gemini";
import { ocrExtractionSchema, type OcrExtraction } from "@/lib/validations/ai";

const OCR_PROMPT = `Tu es un expert-comptable agréé, spécialiste du SYSCOHADA révisé (référentiel comptable OHADA) et de la fiscalité de la zone CEMAC/UEMOA.
Analyse le document (facture, reçu ou note de frais) fourni en pièce jointe et réponds UNIQUEMENT avec un objet JSON conforme au schéma suivant, sans texte ni balise Markdown autour:

{
  "dateDocument": string (format ISO 8601, ex: "2026-08-08"),
  "montantTTC": number,
  "montantHT": number (optionnel, si le document le détaille),
  "montantTVA": number (optionnel),
  "tauxTVA": number (optionnel, en pourcentage, ex: 19.25),
  "tiers": string (optionnel, raison sociale du fournisseur ou client identifié sur le document),
  "nature": "ACHAT" | "VENTE" | "NOTE_DE_FRAIS" | "AUTRE",
  "devise": string (code devise, ex: "XAF"),
  "ecritureProposee": [
    { "compteNumero": string, "compteLibelle": string, "sens": "DEBIT" | "CREDIT", "montant": number }
  ],
  "confiance": number (optionnel, entre 0 et 1)
}

Règles pour "ecritureProposee":
- Utilise la numérotation de comptes du plan comptable SYSCOHADA (classe 6 Charges, 7 Produits, 4 Tiers/État, 5 Trésorerie).
- Pour un achat: débite le compte de charge (60x/61x/62x) et la TVA déductible (445200) si applicable, crédite le compte fournisseur (401xxx) ou trésorerie (5xxxxx) si payé comptant.
- Pour une vente: débite le compte client (411xxx) ou trésorerie, crédite le compte de produit (70x/71x) et la TVA collectée (443200) si applicable.
- La somme des lignes "DEBIT" doit strictement égaler la somme des lignes "CREDIT".
- N'invente aucun montant: si une information est illisible, omets le champ optionnel correspondant plutôt que de deviner.`;

export interface OcrRunResult {
  extraction: OcrExtraction | null;
  raw: string;
}

// Appel Gemini Vision brut, sans jamais faire confiance à la sortie: même en
// mode JSON forcé, un modèle peut halluciner un champ ou dévier du schéma —
// l'extraction n'est retenue que si elle passe ocrExtractionSchema.
export async function runOcrExtraction(fileBase64: string, mimeType: string): Promise<OcrRunResult> {
  const model = getGeminiModel({ jsonMode: true });
  const result = await model.generateContent([{ inlineData: { mimeType, data: fileBase64 } }, { text: OCR_PROMPT }]);
  const raw = result.response.text();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { extraction: null, raw };
  }

  const parsed = ocrExtractionSchema.safeParse(parsedJson);
  return { extraction: parsed.success ? parsed.data : null, raw };
}

export async function createScannedDocument(
  organizationId: string,
  uploadedById: string,
  file: { fileUrl: string; fileName: string; mimeType: string },
) {
  return prisma.scannedDocument.create({
    data: { organizationId, uploadedById, fileUrl: file.fileUrl, fileName: file.fileName, mimeType: file.mimeType },
  });
}

// Le document reste EN_ATTENTE si l'extraction échoue (JSON invalide côté
// modèle) — le comptable peut toujours saisir l'écriture manuellement à
// partir du fichier scanné, jamais bloqué par une réponse IA défaillante.
export async function applyOcrResult(scannedDocumentId: string, result: OcrRunResult) {
  return prisma.scannedDocument.update({
    where: { id: scannedDocumentId },
    data: {
      status: result.extraction ? "TRAITE" : "ECHEC",
      extractedData: (result.extraction ?? { raw: result.raw }) as unknown as Prisma.InputJsonValue,
      suggestedJournalType: result.extraction ? mapNatureToJournalType(result.extraction.nature) : undefined,
    },
  });
}

function mapNatureToJournalType(nature: OcrExtraction["nature"]): "ACHATS" | "VENTES" | "OPERATIONS_DIVERSES" {
  if (nature === "ACHAT" || nature === "NOTE_DE_FRAIS") return "ACHATS";
  if (nature === "VENTE") return "VENTES";
  return "OPERATIONS_DIVERSES";
}
