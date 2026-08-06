"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/dashboard/stat-tile";
import { RevenueAreaChart } from "@/components/dashboard/revenue-area-chart";
import { PaymentBreakdownBar } from "@/components/dashboard/payment-breakdown-bar";
import { OccupancyByDepartment } from "@/components/dashboard/occupancy-by-department";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";

interface Overview {
  statTiles: {
    caFactureToday: string;
    caFactureTodayDeltaPct: number | null;
    consultationsToday: number;
    consultationsTodayDeltaPct: number | null;
    occupationLits: { total: number; occupes: number; tauxPourcent: number };
    creancesAssurances: string;
  };
  revenueSeries: { date: string; [pole: string]: string }[];
  poles: string[];
  paymentBreakdown: { mode: string; montant: string; pourcent: number }[];
  occupationParService: { service: string; occupes: number; total: number }[];
  alertes: { type: "PEREMPTION" | "REAPPRO"; label: string; detail: string }[];
}

export default function DashboardHome() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboards", "overview"],
    queryFn: () => api.get<{ overview: Overview }>("/api/dashboards/overview"),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Chargement des indicateurs…</p>;
  }

  const { statTiles, revenueSeries, poles, paymentBreakdown, occupationParService, alertes } = data.overview;

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
        <StatTile label="Chiffre d'affaires du jour" value={Number(statTiles.caFactureToday)} delta={{ pct: statTiles.caFactureTodayDeltaPct, comparedTo: "vs hier", upIsGood: true }} />
        <StatTile
          label="Taux d'occupation des lits"
          value={statTiles.occupationLits.tauxPourcent}
          isCurrency={false}
          suffix="%"
        />
        <StatTile label="Créances assurances" value={Number(statTiles.creancesAssurances)} />
        <StatTile
          label="Consultations réalisées"
          value={statTiles.consultationsToday}
          isCurrency={false}
          delta={{ pct: statTiles.consultationsTodayDeltaPct, comparedTo: "vs hier", upIsGood: true }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueAreaChart data={revenueSeries} poles={poles} />
        </div>
        <PaymentBreakdownBar data={paymentBreakdown} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OccupancyByDepartment data={occupationParService} />
        <AlertsPanel data={alertes} />
      </div>
    </div>
  );
}
