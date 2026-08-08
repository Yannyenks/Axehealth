import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGeminiModel } from "@/lib/ai/gemini";
import { businessAuditDiagnosticSchema, type SubmitBusinessAuditInput } from "@/lib/validations/business-audit";
import { NotFoundError } from "@/lib/api-error";

const AUDIT_PROMPT_TEMPLATE = (answers: SubmitBusinessAuditInput) => `Tu es un expert-comptable qui mène un entretien d'accueil avec une nouvelle entreprise cliente, dans le référentiel SYSCOHADA révisé (Afrique francophone). Voici les réponses qu'elle a données à ton questionnaire d'audit initial:

- Secteur d'activité: ${answers.secteurActivite}
- Taille de l'équipe: ${answers.tailleEquipe}
- Chiffre d'affaires annuel estimé: ${answers.chiffreAffairesEstime}
- Gestion comptable actuelle: ${answers.gestionComptableActuelle}
- Principal défi financier exprimé: ${answers.principalDefiFinancier}
- Obligations fiscales mentionnées: ${answers.obligationsFiscales || "non précisé"}

Produis un diagnostic court et actionnable, UNIQUEMENT au format JSON suivant, sans texte ni balise Markdown autour:

{
  "secteurActivite": string (reformulation normalisée du secteur),
  "maturiteComptable": "DEBUTANT" | "INTERMEDIAIRE" | "AVANCE" (basé sur la gestion actuelle décrite),
  "principauxRisques": string[] (1 à 4 risques concrets, ex: "Absence de suivi de trésorerie", "Retard probable de déclaration TVA"),
  "prioritesRecommandees": string[] (1 à 4 actions concrètes à court terme, ex: "Mettre en place un plan comptable OHADA de base", "Ouvrir un journal de banque"),
  "modulesRecommandes": (au moins un parmi) ["comptabilite","tresorerie","tiers","immobilisations","fiscalite"],
  "syntheseTexte": string (2-3 phrases, ton professionnel et rassurant, s'adressant directement au dirigeant)
}`;

export interface BusinessAuditResult {
  diagnostic: unknown;
  raw: string;
  valid: boolean;
}

async function runDiagnostic(answers: SubmitBusinessAuditInput): Promise<BusinessAuditResult> {
  const model = getGeminiModel({ jsonMode: true });
  const result = await model.generateContent(AUDIT_PROMPT_TEMPLATE(answers));
  const raw = result.response.text();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { diagnostic: null, raw, valid: false };
  }

  const parsed = businessAuditDiagnosticSchema.safeParse(parsedJson);
  return { diagnostic: parsed.success ? parsed.data : null, raw, valid: parsed.success };
}

// Faute d'IA disponible/configurée, ou d'une réponse exploitable, un
// diagnostic générique minimal est posé plutôt que de bloquer l'onboarding
// — l'audit est une aide à la personnalisation, jamais une étape obligatoire
// au sens strict.
function fallbackDiagnostic(answers: SubmitBusinessAuditInput) {
  return {
    secteurActivite: answers.secteurActivite,
    maturiteComptable: "DEBUTANT" as const,
    principauxRisques: ["Diagnostic automatique indisponible — à compléter manuellement avec votre comptable."],
    prioritesRecommandees: ["Configurer votre plan comptable et vos journaux dans le module Comptabilité."],
    modulesRecommandes: ["comptabilite", "tresorerie"] as const,
    syntheseTexte: "Votre espace est prêt. Le diagnostic automatique n'a pas pu être généré — vous pouvez démarrer directement votre saisie comptable.",
  };
}

export async function runBusinessAudit(organizationId: string, answers: SubmitBusinessAuditInput) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new NotFoundError("Organisation introuvable");

  let diagnostic: unknown = null;
  if (process.env.GEMINI_API_KEY) {
    const result = await runDiagnostic(answers);
    diagnostic = result.valid ? result.diagnostic : null;
  }
  if (!diagnostic) diagnostic = fallbackDiagnostic(answers);

  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      businessProfile: diagnostic as unknown as Prisma.InputJsonValue,
      auditCompletedAt: new Date(),
    },
  });
}
