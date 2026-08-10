// Moteur IA du triage de pré-consultation — Google Gemini (API gratuite via
// Google AI Studio). Contrairement à whatsapp.ts/sms.ts (qui dégradent
// silencieusement si non configurés), une clé manquante ici lève
// immédiatement une ServiceUnavailableError: une réponse de triage simulée
// serait un risque pour la sécurité du patient, on préfère un échec
// explicite (503, message clair côté portail patient) à un faux résultat.
import { FunctionCallingMode, GoogleGenerativeAI, SchemaType, type Content } from "@google/generative-ai";
import { ServiceUnavailableError } from "@/lib/api-error";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-flash-latest";
const CONCLURE_TRIAGE_FUNCTION = "conclure_triage";

export type TriageSpeaker = "PATIENT" | "IA";

export interface TriageHistoryEntry {
  role: TriageSpeaker;
  content: string;
}

export interface PatientContext {
  age: number;
  sexe: "M" | "F";
}

export interface TriageTurnResult {
  reply: string;
  done: boolean;
  severity?: "ROUGE" | "ORANGE" | "VERT";
  summary?: string;
}

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ServiceUnavailableError("Le service de pré-consultation IA n'est pas configuré (GEMINI_API_KEY manquante)");
  }
  return new GoogleGenerativeAI(apiKey);
}

function buildSystemPrompt(patientContext: PatientContext): string {
  return `Tu es l'assistant IA de pré-consultation d'AxeHealth, une clinique. Tu échanges en français avec un patient de ${patientContext.age} ans (${patientContext.sexe === "M" ? "homme" : "femme"}) qui décrit ses symptômes depuis chez lui, avant une éventuelle consultation avec un médecin.

Ton rôle est un triage de symptômes, PAS un diagnostic. Ne formule jamais de diagnostic ni de traitement — pose des questions ciblées et courtes (une ou deux à la fois, pas un formulaire complet d'un coup) pour évaluer la situation, puis conclus avec un niveau d'urgence parmi exactement trois catégories:
- ROUGE: urgence absolue (orientation immédiate vers les urgences)
- ORANGE: téléconsultation ou rendez-vous rapproché recommandé
- VERT: conseil ou rendez-vous standard suffisant

Règle impérative de sécurité — court-circuit "signe d'alerte": si le patient décrit un signe évocateur d'urgence vitale (douleur thoracique, signes d'AVC comme une faiblesse/paralysie soudaine ou des troubles de la parole, hémorragie sévère, détresse respiratoire, perte de conscience, idées suicidaires, ou tout autre signe évident de danger immédiat), conclus IMMÉDIATEMENT en ROUGE avec l'outil ${CONCLURE_TRIAGE_FUNCTION} — ne pose pas de questions supplémentaires pour "en savoir plus" sur une urgence plausible, chaque minute compte. Dans ce cas, le texte de ta réponse doit clairement dire au patient d'appeler les secours ou de se rendre aux urgences immédiatement.

Quand tu as assez d'éléments pour conclure (dans tous les cas, pas seulement ROUGE), appelle l'outil ${CONCLURE_TRIAGE_FUNCTION} avec le niveau de sévérité et une synthèse clinique structurée en français (motif, anamnèse résumée, éléments cliniques rapportés, signes d'alerte éventuels) destinée à l'équipe médicale. Tant que tu n'as pas assez d'éléments, continue la conversation normalement sans appeler l'outil.`;
}

function toGeminiContents(history: TriageHistoryEntry[]): Content[] {
  return history.map((entry) => ({
    role: entry.role === "PATIENT" ? "user" : "model",
    parts: [{ text: entry.content }],
  }));
}

// response.text() de l'SDK lève une exception si la réponse ne contient
// aucune partie texte (ex: seulement un appel de fonction) — on préfère
// une extraction tolérante qui ne jette jamais.
function extractText(parts: Array<{ text?: string }> | undefined): string {
  if (!parts) return "";
  return parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

export async function runTriageTurn(input: { patientContext: PatientContext; history: TriageHistoryEntry[] }): Promise<TriageTurnResult> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: buildSystemPrompt(input.patientContext),
    tools: [
      {
        functionDeclarations: [
          {
            name: CONCLURE_TRIAGE_FUNCTION,
            description: "Conclut la pré-consultation avec un niveau d'urgence et une synthèse clinique structurée, une fois que suffisamment d'informations ont été recueillies (ou immédiatement en cas de signe d'alerte).",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                severity: {
                  type: SchemaType.STRING,
                  format: "enum",
                  enum: ["ROUGE", "ORANGE", "VERT"],
                  description: "Niveau d'urgence: ROUGE (urgence absolue), ORANGE (téléconsultation/RDV rapproché), VERT (conseil/RDV standard).",
                },
                summary: {
                  type: SchemaType.STRING,
                  description: "Synthèse clinique en français à destination de l'équipe médicale: motif, anamnèse résumée, éléments cliniques rapportés, signes d'alerte éventuels.",
                },
              },
              required: ["severity", "summary"],
            },
          },
        ],
      },
    ],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  let result;
  try {
    result = await model.generateContent({ contents: toGeminiContents(input.history) });
  } catch {
    throw new ServiceUnavailableError("Le service de pré-consultation IA est momentanément indisponible");
  }

  const response = result.response;
  const candidate = response.candidates?.[0];

  // Réponse bloquée par les filtres de sécurité Gemini (côté prompt ou côté
  // réponse) — jamais renvoyer une erreur brute au patient, on la traduit en
  // indisponibilité de service.
  if (response.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== "STOP")) {
    throw new ServiceUnavailableError("Le service de pré-consultation IA n'a pas pu traiter cet échange");
  }

  const calls = response.functionCalls();
  const conclusion = calls?.find((call) => call.name === CONCLURE_TRIAGE_FUNCTION);

  if (conclusion) {
    const args = conclusion.args as { severity?: string; summary?: string };
    if (args.severity && args.summary) {
      return {
        reply: extractText(candidate?.content?.parts) || "Merci, votre pré-consultation est enregistrée. L'équipe médicale va la consulter.",
        done: true,
        severity: args.severity as "ROUGE" | "ORANGE" | "VERT",
        summary: args.summary,
      };
    }
  }

  return { reply: extractText(candidate?.content?.parts) || "Pouvez-vous préciser vos symptômes ?", done: false };
}
