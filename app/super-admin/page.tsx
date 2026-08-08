"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PLAN_DEFINITIONS } from "@/lib/plans";

type Plan = "STARTER" | "PRO" | "ENTERPRISE";

interface OrganizationUsage {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan: Plan;
  createdAt: string;
  utilisateurs: number;
  ecritures: number;
}

interface PlatformKpis {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
  newOrganizationsThisMonth: number;
  planBreakdown: { plan: Plan; count: number }[];
  mrrEstimateUsd: number;
  signupsByMonth: { month: string; count: number }[];
}

const PLAN_LABEL: Record<Plan, string> = { STARTER: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" };

export default function SuperAdminPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [assistingId, setAssistingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "organisations"],
    queryFn: () => api.get<{ organizations: OrganizationUsage[] }>("/api/superadmin/organisations"),
  });

  const { data: kpiData } = useQuery({
    queryKey: ["superadmin", "kpis"],
    queryFn: () => api.get<{ kpis: PlatformKpis }>("/api/superadmin/kpis"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/superadmin/organisations/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin"] });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  const changePlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: Plan }) => api.patch(`/api/superadmin/organisations/${id}`, { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin"] });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  async function handleAssist(org: OrganizationUsage) {
    if (
      !window.confirm(
        `Démarrer une session d'assistance sur "${org.name}" ? Vous obtiendrez un accès complet à cette organisation, journalisé, jusqu'à ce que vous quittiez le mode assistance.`,
      )
    ) {
      return;
    }

    setAssistingId(org.id);
    try {
      await api.post(`/api/superadmin/organisations/${org.id}/assistance`);
      // Rechargement complet: le cookie de session a changé côté serveur,
      // on veut repartir d'un état client neuf plutôt que de risquer de
      // servir des données mises en cache sous l'ancienne session.
      window.location.href = "/dashboard";
    } catch (e) {
      setAssistingId(null);
      setError(e instanceof ApiError ? e.message : "Impossible de démarrer la session d'assistance");
    }
  }

  const kpis = kpiData?.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Console plateforme</h1>
        <p className="text-sm text-muted-foreground">Supervision, offres et assistance des organisations abonnées à AxeCompta</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {kpis && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Organisations" value={kpis.totalOrganizations} isCurrency={false} />
            <StatTile label="Actives" value={kpis.activeOrganizations} isCurrency={false} />
            <StatTile label="Suspendues" value={kpis.suspendedOrganizations} isCurrency={false} />
            <StatTile label="Nouvelles ce mois" value={kpis.newOrganizationsThisMonth} isCurrency={false} />
            <StatTile label="Comptes utilisateurs" value={kpis.totalUsers} isCurrency={false} />
            <StatTile label="MRR estimé" value={kpis.mrrEstimateUsd} isCurrency={false} suffix=" $" />
          </div>
          <p className="text-xs text-muted-foreground">
            MRR estimé = nombre d'organisations actives × prix indicatif par offre (aucun paiement réel n'est
            branché à ce jour — voir README).
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Répartition par offre</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              {kpis.planBreakdown.map((row) => (
                <div key={row.plan}>
                  <p className="text-sm text-muted-foreground">{PLAN_LABEL[row.plan]}</p>
                  <p className="font-display text-xl font-semibold">{row.count}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Offre</TableHead>
                <TableHead>Utilisateurs</TableHead>
                <TableHead>Écritures</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{org.slug}</TableCell>
                  <TableCell>
                    <Select
                      value={org.plan}
                      disabled={changePlan.isPending}
                      onChange={(e) => changePlan.mutate({ id: org.id, plan: e.target.value as Plan })}
                      className="h-8 w-32"
                    >
                      {PLAN_DEFINITIONS.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>{org.utilisateurs}</TableCell>
                  <TableCell>{org.ecritures}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(org.createdAt).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={org.isActive ? "success" : "destructive"}>{org.isActive ? "Active" : "Suspendue"}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleActive.isPending}
                        onClick={() => toggleActive.mutate({ id: org.id, isActive: !org.isActive })}
                      >
                        {org.isActive ? "Suspendre" : "Réactiver"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={assistingId === org.id}
                        onClick={() => handleAssist(org)}
                        title="Accéder à cet établissement en mode assistance"
                      >
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        {assistingId === org.id ? "…" : "Assister"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data?.organizations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Aucune organisation</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
