import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "./auth";
import { ForbiddenError } from "./rbac";

export class NotFoundError extends Error {}
export class ConflictError extends Error {}
export class LockedError extends Error {}
// Une intégration externe requise n'est pas configurée / a refusé de
// répondre — distinct d'un 500 générique car ce n'est pas un bug applicatif,
// et le client (ex: chat de pré-consultation IA) doit pouvoir en tenir
// compte explicitement plutôt que de recevoir une erreur opaque.
export class ServiceUnavailableError extends Error {}

// Convertit les erreurs connues (auth, RBAC, validation, métier) en réponses
// HTTP homogènes pour toutes les routes API. Toute erreur non reconnue
// retombe en 500 générique — jamais de détail interne exposé au client.
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "FORBIDDEN", message: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: "NOT_FOUND", message: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: "CONFLICT", message: error.message }, { status: 409 });
  }
  if (error instanceof LockedError) {
    return NextResponse.json({ error: "ACCOUNT_LOCKED", message: error.message }, { status: 423 });
  }
  if (error instanceof ServiceUnavailableError) {
    return NextResponse.json({ error: "SERVICE_UNAVAILABLE", message: error.message }, { status: 503 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: error.issues }, { status: 422 });
  }

  console.error(error);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "Une erreur inattendue est survenue" }, { status: 500 });
}
