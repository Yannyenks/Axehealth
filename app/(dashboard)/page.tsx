"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { StatTile } from "@/components/dashboard/stat-tile";
import { OccupancyMeter } from "@/components/dashboard/occupancy-meter";
import { PoleBreakdown } from "@/components/dashboard/pole-breakdown";

interface Kpis {
  caFacture: string;
  caEncaisse: string;
  caParPole: Record<string, string>;
  occupationLits: { total: number; occupes: number; tauxPourcent: number };
  creancesAssurances: string;
}

export default function DashboardHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboards", "kpis"],
    queryFn: () => api.get<{ kpis: Kpis }>("/api/dashboards/kpis"),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Chargement des indicateurs…</p>;
  }

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Indicateurs du mois en cours</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="CA facturé" value={Number(kpis.caFacture)} />
        <StatTile label="CA encaissé" value={Number(kpis.caEncaisse)} />
        <StatTile label="Créances assurances en attente" value={Number(kpis.creancesAssurances)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OccupancyMeter {...kpis.occupationLits} />
        <PoleBreakdown caParPole={kpis.caParPole} />
      </div>
    </div>
  );
}
