"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatTile } from "@/components/dashboard/stat-tile";
import { RevenueAreaChart } from "@/components/dashboard/revenue-area-chart";
import { PaymentBreakdownBar } from "@/components/dashboard/payment-breakdown-bar";
import { OccupancyByDepartment } from "@/components/dashboard/occupancy-by-department";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SatisfactionStats {
  totalReponses: number;
  nps: number | null;
  scoreMoyen: number | null;
}

interface Overview {
  statTiles: {
    caFactureToday: string;
    caFactureTodayDeltaPct: number | null;
    consultationsToday: number;
    consultationsTodayDeltaPct: number | null;
    occupationLits: { total: number; occupes: number; tauxPourcent: number };
    creancesAssurances: string;
  };
  paymentBreakdown: { mode: string; montant: string; pourcent: number }[];
  occupationParService: { service: string; occupes: number; total: number }[];
  alertes: { type: "PEREMPTION" | "REAPPRO"; label: string; detail: string }[];
}

interface RevenueSeriesResponse {
  revenueSeries: { date: string; [pole: string]: string }[];
  poles: string[];
}

const PERIOD_PRESETS = [7, 30, 90] as const;

export default function DashboardHome() {
  const { user } = useAuthStore();
  const [days, setDays] = useState<(typeof PERIOD_PRESETS)[number]>(7);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboards", "overview"],
    queryFn: () => api.get<{ overview: Overview }>("/api/dashboards/overview"),
  });

  const { data: revenueData, isFetching: isRevenueFetching } = useQuery({
    queryKey: ["dashboards", "revenue-series", days],
    queryFn: () => api.get<RevenueSeriesResponse>(`/api/dashboards/revenue-series?days=${days}`),
  });

  const { data: satisfactionData } = useQuery({
    queryKey: ["satisfaction"],
    queryFn: () => api.get<{ stats: SatisfactionStats }>("/api/satisfaction"),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Chargement des indicateurs…</p>;
  }

  const { statTiles, paymentBreakdown, occupationParService, alertes } = data.overview;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Tableau de bord direction</h1>
          <p className="text-sm text-muted-foreground">
            Indicateurs consolidés en temps réel · {user?.organization?.name}
          </p>
        </div>
        <Link href="/rapports">
          <Button variant="outline">
            <FileBarChart className="h-4 w-4" />
            Rapport RMA / SNIS
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Chiffre d'affaires du jour"
          value={Number(statTiles.caFactureToday)}
          delta={{ pct: statTiles.caFactureTodayDeltaPct, comparedTo: "vs hier", upIsGood: true }}
          href="/factures"
        />
        <StatTile
          label="Taux d'occupation des lits"
          value={statTiles.occupationLits.tauxPourcent}
          isCurrency={false}
          suffix="%"
          href="/hospitalisation"
        />
        <StatTile label="Créances assurances" value={Number(statTiles.creancesAssurances)} href="/factures" />
        <StatTile
          label="Consultations réalisées"
          value={statTiles.consultationsToday}
          isCurrency={false}
          delta={{ pct: statTiles.consultationsTodayDeltaPct, comparedTo: "vs hier", upIsGood: true }}
          href="/consultations"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          <div className="flex gap-1">
            {PERIOD_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setDays(preset)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  days === preset ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {preset} j
              </button>
            ))}
          </div>
          <div className={cn("transition-opacity", isRevenueFetching && "opacity-60")}>
            <RevenueAreaChart data={revenueData?.revenueSeries ?? []} poles={revenueData?.poles ?? []} days={days} />
          </div>
        </div>
        <PaymentBreakdownBar data={paymentBreakdown} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OccupancyByDepartment data={occupationParService} />
        <AlertsPanel data={alertes} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Satisfaction patient (NPS)</CardTitle>
            <p className="text-xs text-muted-foreground">Mois en cours</p>
          </CardHeader>
          <CardContent>
            {satisfactionData?.stats.nps === null || satisfactionData?.stats.nps === undefined ? (
              <p className="text-sm text-muted-foreground">Aucune réponse ce mois-ci.</p>
            ) : (
              <>
                <p className="font-display text-3xl font-semibold">{satisfactionData.stats.nps}</p>
                <p className="text-sm text-muted-foreground">
                  {satisfactionData.stats.totalReponses} réponse{satisfactionData.stats.totalReponses > 1 ? "s" : ""} · score moyen {satisfactionData.stats.scoreMoyen}/10
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
