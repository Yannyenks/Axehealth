import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatCompactXaf(value: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return `${formatted} FCFA`;
}

interface StatTileProps {
  label: string;
  value: number;
  isCurrency?: boolean;
  suffix?: string;
  delta?: { pct: number | null; comparedTo: string; upIsGood?: boolean };
}

export function StatTile({ label, value, isCurrency = true, suffix, delta }: StatTileProps) {
  const displayValue = isCurrency
    ? formatCompactXaf(value)
    : `${new Intl.NumberFormat("fr-FR").format(value)}${suffix ?? ""}`;

  const showDelta = delta && delta.pct !== null;
  const isUp = showDelta && delta!.pct! >= 0;
  const upIsGood = delta?.upIsGood ?? true;
  const isPositive = isUp === upIsGood;

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-foreground">{displayValue}</p>
        {showDelta && (
          <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", isPositive ? "text-success" : "text-destructive")}>
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isUp ? "+" : ""}{delta!.pct}% {delta!.comparedTo}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
