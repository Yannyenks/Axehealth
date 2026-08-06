import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Meter: la couleur du remplissage porte la sévérité (occupation des lits
// approchant la saturation = risque de capacité), la piste non remplie
// reste un ton plus clair de la même famille pour lire l'état d'un coup d'œil.
export function OccupancyMeter({ occupes, total, tauxPourcent }: { occupes: number; total: number; tauxPourcent: number }) {
  const fillClass = tauxPourcent >= 90 ? "bg-destructive" : tauxPourcent >= 70 ? "bg-warning" : "bg-primary";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Taux d'occupation des lits</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-semibold">{tauxPourcent}%</span>
          <span className="text-sm text-muted-foreground">{occupes} / {total} lits</span>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-primary/15">
          <div
            className={cn("h-2 rounded-full transition-all", fillClass)}
            style={{ width: `${Math.min(tauxPourcent, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
