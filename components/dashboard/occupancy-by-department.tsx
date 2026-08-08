import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Entry {
  service: string;
  occupes: number;
  total: number;
}

export function OccupancyByDepartment({ data }: { data: Entry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Occupation des lits</CardTitle>
        <p className="text-xs text-muted-foreground">Par service</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 && <p className="text-sm text-muted-foreground">Aucun lit configuré.</p>}
        {data.map((entry) => {
          const pct = entry.total > 0 ? (entry.occupes / entry.total) * 100 : 0;
          const fillClass = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-primary";
          return (
            <div key={entry.service}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-foreground">{entry.service}</span>
                <span className="text-muted-foreground">
                  {entry.occupes}/{entry.total} · {entry.total - entry.occupes} libres
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-primary/15">
                <div className={cn("h-2 rounded-full transition-all", fillClass)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
