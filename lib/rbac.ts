import type { Role } from "@prisma/client";
import type { AccessTokenPayload } from "./auth";

const ALL_ROLES: Role[] = ["ADMIN", "SECRETAIRE", "MEDECIN", "INFIRMIER", "PHARMACIEN", "BIOLOGISTE", "CAISSIER", "COMPTABLE", "RH"];

// Permissions par module. Un rôle absent d'une liste n'a pas accès au module.
export const PERMISSIONS = {
  patients: {
    read: ["ADMIN", "SECRETAIRE", "MEDECIN", "INFIRMIER", "CAISSIER", "PHARMACIEN"] as Role[],
    write: ["ADMIN", "SECRETAIRE"] as Role[],
  },
  consultations: {
    read: ["ADMIN", "MEDECIN", "INFIRMIER", "SECRETAIRE"] as Role[],
    write: ["ADMIN", "MEDECIN"] as Role[],
    unlock: ["ADMIN", "CAISSIER"] as Role[], // seule la caisse débloque l'acte payant
  },
  caisse: {
    encaisser: ["ADMIN", "CAISSIER"] as Role[],
    valider: ["ADMIN", "CAISSIER"] as Role[], // second regard (double validation aveugle)
    cloturer: ["ADMIN", "CAISSIER"] as Role[],
    // Émettre un avoir est un acte comptable, pas une opération de caisse
    // courante — jamais le caissier seul, pour la même raison que la double
    // validation des paiements: séparation des tâches anti-fraude.
    emettreAvoir: ["ADMIN", "COMPTABLE"] as Role[],
  },
  factures: {
    read: ["ADMIN", "CAISSIER", "COMPTABLE", "SECRETAIRE"] as Role[],
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
  alertes: {
    manage: ["ADMIN"] as Role[],
  },
  assurances: {
    read: ["ADMIN", "COMPTABLE", "CAISSIER", "SECRETAIRE"] as Role[],
    write: ["ADMIN", "COMPTABLE"] as Role[],
  },
  laboratoire: {
    read: ["ADMIN", "MEDECIN", "BIOLOGISTE", "INFIRMIER"] as Role[],
    demander: ["ADMIN", "MEDECIN"] as Role[],
    saisirResultat: ["ADMIN", "BIOLOGISTE"] as Role[],
  },
  conges: {
    demander: ALL_ROLES, // chacun demande son propre congé, quel que soit son rôle
    gerer: ["ADMIN", "RH"] as Role[], // approbation/rejet des congés d'autrui
  },
  satisfaction: {
    enregistrer: ["ADMIN", "SECRETAIRE", "CAISSIER"] as Role[], // recueilli à l'accueil/à la sortie
    read: ["ADMIN"] as Role[], // vue agrégée réservée à la direction
  },
  groupe: {
    read: ["ADMIN"] as Role[], // comparatif inter-cliniques réservé à la direction
  },
  equipe: {
    read: ["ADMIN"] as Role[],
    manage: ["ADMIN"] as Role[], // inviter, changer de rôle, désactiver un compte
  },
  organisation: {
    manage: ["ADMIN"] as Role[],
  },
  locaux: {
    manage: ["ADMIN"] as Role[], // configuration des services/chambres/lits
  },
  preconsultations: {
    read: ["ADMIN", "MEDECIN", "SECRETAIRE"] as Role[],
    reviewer: ["ADMIN", "MEDECIN", "SECRETAIRE"] as Role[], // marquer "revu" = tri, pas un acte médical
    convertirConsultation: ["ADMIN", "MEDECIN"] as Role[], // acte médical — même règle que consultations.write
    convertirRdv: ["ADMIN", "MEDECIN", "SECRETAIRE"] as Role[], // prise de RDV = tâche d'accueil habituelle
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
