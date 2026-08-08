import type { Role } from "@prisma/client";
import type { AccessTokenPayload } from "./auth";

// Permissions par module. Un rôle absent d'une liste n'a pas accès au module.
export const PERMISSIONS = {
  comptabilite: {
    read: ["ADMIN", "COMPTABLE", "CAISSIER"] as Role[],
    write: ["ADMIN", "COMPTABLE"] as Role[],
  },
  equipe: {
    read: ["ADMIN"] as Role[],
    manage: ["ADMIN"] as Role[], // inviter, changer de rôle, désactiver un compte
  },
  organisation: {
    manage: ["ADMIN"] as Role[],
  },
} as const;

export class ForbiddenError extends Error {}

export function requireRole(session: AccessTokenPayload, allowed: readonly Role[]): void {
  if (!allowed.includes(session.role)) {
    throw new ForbiddenError(`Role ${session.role} is not permitted for this action`);
  }
}

// Le super-admin opère au niveau plateforme (voir /api/superadmin), en plus
// de son rôle métier normal — c'est un drapeau distinct de la matrice RBAC
// par organisation, jamais un rôle qui donnerait implicitement des droits
// dans une organisation qui n'est pas la sienne.
export function requireSuperAdmin(session: AccessTokenPayload): void {
  if (!session.isSuperAdmin) {
    throw new ForbiddenError("Accès réservé aux super-administrateurs de la plateforme");
  }
}

// Vérifie qu'une ressource de tenant (déjà chargée) appartient bien à
// l'organisation de la session — dernier verrou d'isolation multi-tenant
// avant toute lecture/écriture, en plus du filtrage organizationId en requête.
export function assertSameOrganization(session: AccessTokenPayload, resourceOrgId: string): void {
  if (session.organizationId !== resourceOrgId) {
    throw new ForbiddenError("Resource does not belong to this organization");
  }
}
