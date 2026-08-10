import jwt from "jsonwebtoken";
import { UnauthorizedError } from "./auth";

// Système d'authentification patient — miroir de lib/auth.ts mais
// volontairement séparé (secrets distincts, pas seulement un claim
// discriminant) pour qu'un token staff ne puisse jamais être accepté ici et
// vice versa, même en cas de bug: une signature invalide échoue avant même
// de regarder le contenu du payload.
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";
const TOKEN_TYPE = "patient";

function getSecret(name: "PATIENT_JWT_SECRET" | "PATIENT_JWT_REFRESH_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export interface PatientAccessTokenPayload {
  sub: string; // patientId
  organizationId: string;
  typ: typeof TOKEN_TYPE;
}

export function signPatientAccessToken(payload: Omit<PatientAccessTokenPayload, "typ">): string {
  return jwt.sign({ ...payload, typ: TOKEN_TYPE }, getSecret("PATIENT_JWT_SECRET"), { expiresIn: ACCESS_TOKEN_TTL });
}

export function signPatientRefreshToken(patientId: string): string {
  return jwt.sign({ sub: patientId }, getSecret("PATIENT_JWT_REFRESH_SECRET"), { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyPatientAccessToken(token: string): PatientAccessTokenPayload {
  const payload = jwt.verify(token, getSecret("PATIENT_JWT_SECRET")) as PatientAccessTokenPayload;
  if (payload.typ !== TOKEN_TYPE) throw new Error("Invalid token type");
  return payload;
}

export function getPatientBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);

  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)axehealth_patient_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Point d'entrée unique pour authentifier une requête API route côté portail
// patient. Réutilise UnauthorizedError (lib/auth.ts) car la sémantique HTTP
// est identique à l'auth staff, seul le token diffère.
export function requirePatientAuth(req: Request): PatientAccessTokenPayload {
  const token = getPatientBearerToken(req);
  if (!token) throw new UnauthorizedError("Missing bearer token");
  try {
    return verifyPatientAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
