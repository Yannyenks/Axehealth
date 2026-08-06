import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

function getSecret(name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export interface AccessTokenPayload {
  sub: string; // userId
  organizationId: string;
  role: Role;
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

// Utilisé pour le PIN de caisse (double validation anti-fraude à la clôture
// et au déblocage d'un acte payant).
export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, { type: argon2.argon2id });
}

export async function verifyPin(hash: string, pin: string): Promise<boolean> {
  return argon2.verify(hash, pin);
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getSecret("JWT_SECRET"), { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret("JWT_REFRESH_SECRET"), { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getSecret("JWT_SECRET")) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, getSecret("JWT_REFRESH_SECRET")) as { sub: string };
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export class UnauthorizedError extends Error {}

// Point d'entrée unique pour authentifier une requête API route.
// Lève UnauthorizedError si le token est absent/invalide/expiré.
export function requireAuth(req: Request): AccessTokenPayload {
  const token = getBearerToken(req);
  if (!token) throw new UnauthorizedError("Missing bearer token");
  try {
    return verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
