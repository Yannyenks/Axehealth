import type { OrgPlan } from "@prisma/client";

// Scaffold commercial: définitions déclaratives des offres, utilisées pour
// l'affichage (landing, sélecteur de signup, Paramètres, super-admin) —
// aucune limite n'est appliquée côté serveur pour l'instant (voir README),
// c'est un cadre informatif en attendant l'intégration d'un fournisseur de
// paiement réel.
export interface PlanDefinition {
  id: OrgPlan;
  name: string;
  tagline: string;
  maxUsers: number;
  highlights: string[];
  // Prix indicatif mensuel (USD) utilisé pour l'estimation de MRR côté
  // super-admin (services/superadmin.service.ts::getPlatformKpis) — null
  // pour Enterprise ("sur devis"), jamais un montant réellement facturé
  // puisqu'aucun paiement n'est branché (voir README).
  priceMonthlyUsd: number | null;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "STARTER",
    name: "Starter",
    tagline: "Pour démarrer avec une petite équipe",
    maxUsers: 5,
    highlights: ["Jusqu'à 5 comptes", "Tous les modules cliniques", "Support par email"],
    priceMonthlyUsd: 49,
  },
  {
    id: "PRO",
    name: "Pro",
    tagline: "Pour une clinique en croissance",
    maxUsers: 20,
    highlights: ["Jusqu'à 20 comptes", "Comparatif inter-cliniques", "Support prioritaire"],
    priceMonthlyUsd: 149,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    tagline: "Pour un réseau d'établissements",
    maxUsers: Number.POSITIVE_INFINITY,
    highlights: ["Comptes illimités", "Réseau de cliniques (groupe)", "Accompagnement dédié"],
    priceMonthlyUsd: null,
  },
];

export function getPlanDefinition(plan: OrgPlan): PlanDefinition {
  return PLAN_DEFINITIONS.find((p) => p.id === plan) ?? PLAN_DEFINITIONS[0];
}
