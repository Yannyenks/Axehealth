"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Petit badge de compteur pollant les pré-consultations ROUGE en attente de
// revue — affiché uniquement à côté de l'item de nav "Pré-consultations IA"
// (voir app-sidebar.tsx), donc uniquement pour les rôles déjà autorisés à
// voir ce module: pas de fetch/poll pour un utilisateur qui n'a pas accès.
export function PreConsultationRougeBadge() {
  const { data } = useQuery({
    queryKey: ["preconsultations", "rouge-count"],
    queryFn: () => api.get<{ sessions: unknown[] }>("/api/pre-consultations?severity=ROUGE&status=EN_ATTENTE_REVUE"),
    refetchInterval: 10000,
  });

  const count = data?.sessions.length ?? 0;
  if (!count) return null;

  return <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">{count}</span>;
}
