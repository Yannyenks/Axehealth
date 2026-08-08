import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!client) client = new GoogleGenerativeAI(apiKey);
  return client;
}

// Modèle unique partagé par l'OCR (Vision) et le chat copilote — un seul
// point de configuration (température, format JSON) pour tout appel à
// Gemini dans l'application.
export function getGeminiModel(config?: { jsonMode?: boolean }): GenerativeModel {
  return getClient().getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: {
      temperature: 0.2,
      ...(config?.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });
}
