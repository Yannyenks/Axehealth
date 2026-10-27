"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Part-to-whole: barre empilée horizontale plutôt qu'un donut (le donut
// reste déconseillé par la méthode dataviz — la barre porte la même
// information avec une comparaison de longueurs plus fiable).
const MODE_LABEL: Record<string, string> = {
  ESPECES: "Espèces",
  MTN_MOMO: "MTN MoMo",
  ORANGE_MONEY: "Orange Money",
  WAVE: "Wave",
  CARTE: "Carte bancaire",
  VIREMENT: "Virement",
};

const MODE_COLOR: Record<string, string> = {
  ESPECES: "#12384A",
  MTN_MOMO: "#1B7F86",
  ORANGE_MONEY: "#22B5B0",
  WAVE: "#E0A526",
  CARTE: "#1E5866",
  VIREMENT: "#7A6FD0",
};

interface Entry {
  mode: string;
  montant: string;
  pourcent: number;
}

export function PaymentBreakdownBar({ data }: { data: Entry[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const sorted = [...data].sort((a, b) => b.pourcent - a.pourcent);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Répartition des encaissements</CardTitle>
        <p className="text-xs text-muted-foreground">Part de chaque mode de paiement (30 derniers jours)</p>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun encaissement validé sur la période.</p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {sorted.map((entry) => (
                <div
                  key={entry.mode}
                  role="img"
                  aria-label={`${MODE_LABEL[entry.mode] ?? entry.mode}: ${entry.pourcent}%`}
                  className="h-full transition-opacity"
                  style={{
                    width: `${entry.pourcent}%`,
                    backgroundColor: MODE_COLOR[entry.mode] ?? "#5F7A84",
                    opacity: hovered && hovered !== entry.mode ? 0.45 : 1,
                  }}
                  onMouseEnter={() => setHovered(entry.mode)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {sorted.map((entry) => (
                <div
                  key={entry.mode}
                  className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm transition-colors"
                  style={{ backgroundColor: hovered === entry.mode ? "var(--muted)" : undefined }}
                  onMouseEnter={() => setHovered(entry.mode)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MODE_COLOR[entry.mode] ?? "#5F7A84" }} />
                    {MODE_LABEL[entry.mode] ?? entry.mode}
                  </span>
                  <span className="font-medium text-foreground">{entry.pourcent}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
