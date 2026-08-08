import { ShieldAlert, PackageX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Alert {
  type: "PEREMPTION" | "REAPPRO";
  label: string;
  detail: string;
}

export function AlertsPanel({ data }: { data: Alert[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Alertes opérationnelles</CardTitle>
          <p className="text-xs text-muted-foreground">Nécessitent une action</p>
        </div>
        {data.length > 0 && <Badge variant="warning">{data.length}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">Aucune alerte en cours.</p>}
        {data.map((alert, i) => (
          <div key={i} className="flex items-start gap-3 rounded-md border p-3">
            <span className="mt-0.5 rounded-full bg-warning/15 p-1.5 text-warning">
              {alert.type === "PEREMPTION" ? <ShieldAlert className="h-4 w-4" /> : <PackageX className="h-4 w-4" />}
            </span>
            <div className="text-sm">
              <p className="font-medium text-foreground">{alert.label}</p>
              <p className="text-muted-foreground">{alert.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
