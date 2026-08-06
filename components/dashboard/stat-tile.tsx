import { Card, CardContent } from "@/components/ui/card";

function formatCompactXaf(value: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return `${formatted} FCFA`;
}

export function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-foreground">{formatCompactXaf(value)}</p>
      </CardContent>
    </Card>
  );
}
