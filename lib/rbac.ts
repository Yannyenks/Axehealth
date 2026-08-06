import type { Role } from "@prisma/client";
import type { AccessTokenPayload } from "./auth";

// Permissions par module. Un rôle absent d'une liste n'a pas accès au module.
export const PERMISSIONS = {
  consultations: {
    read: ["ADMIN", "MEDECIN", "INFIRMIER", "SECRETAIRE"] as Role[],
    write: ["ADMIN", "MEDECIN"] as Role[],
    unlock: ["ADMIN", "CAISSIER"] as Role[], // seule la caisse débloque l'acte payant
  },
  caisse: {
    encaisser: ["ADMIN", "CAISSIER"] as Role[],
    valider: ["ADMIN", "CAISSIER"] as Role[], // second regard (double validation aveugle)
    cloturer: ["ADMIN", "CAISSIER"] as Role[],
  },
  pharmacie: {
    read: ["ADMIN", "PHARMACIEN", "MEDECIN"] as Role[],
    write: ["ADMIN", "PHARMACIEN"] as Role[],
  },
  hospitalisation: {
    read: ["ADMIN", "MEDECIN", "INFIRMIER"] as Role[],
    write: ["ADMIN", "MEDECIN", "INFIRMIER"] as Role[],
  },
  rh: {
    read: ["ADMIN", "RH"] as Role[],
    write: ["ADMIN", "RH"] as Role[],
  },
  comptabilite: {
    read: ["ADMIN", "COMPTABLE", "CAISSIER"] as Role[],
    write: ["ADMIN", "COMPTABLE"] as Role[],
  },
  dashboards: {
    read: ["ADMIN"] as Role[],
  },
  notifications: {
    send: ["ADMIN", "SECRETAIRE"] as Role[],
  },
} as const;

export class ForbiddenError extends Error {}

export function requireRole(session: AccessTokenPayload, allowed: readonly Role[]): void {
  if (!allowed.includes(session.role)) {
    throw new ForbiddenError(`Role ${session.role} is not permitted for this action`);
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
