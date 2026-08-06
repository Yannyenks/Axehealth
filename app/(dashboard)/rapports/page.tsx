"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Report {
  periode: { from: string; to: string };
  totalConsultations: number;
  consultationsParDiagnostic: { cim: string | null; count: number }[];
  totalHospitalisations: number;
  examensParType: { type: string; count: number }[];
}

export default function RapportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboards", "rapports"],
    queryFn: () => api.get<{ report: Report }>("/api/dashboards/rapports"),
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Chargement…</p>;

  const { report } = data;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Rapport d'activité RMA / SNIS</h1>
          <p className="text-sm text-muted-foreground">
            Compteurs bruts du mois en cours — à reporter sur le formulaire statistique réglementaire local.
          </p>
        </div>
        <a href="/api/dashboards/rapports?format=csv">
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Consultations terminées</p>
            <p className="mt-1 font-display text-2xl font-semibold">{report.totalConsultations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Hospitalisations admises</p>
            <p className="mt-1 font-display text-2xl font-semibold">{report.totalHospitalisations}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consultations par diagnostic (CIM-10)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code CIM-10</TableHead>
                <TableHead>Nombre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.consultationsParDiagnostic.map((d) => (
                <TableRow key={d.cim}>
                  <TableCell>{d.cim}</TableCell>
                  <TableCell>{d.count}</TableCell>
                </TableRow>
              ))}
              {report.consultationsParDiagnostic.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">Aucune donnée</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Examens par type</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Nombre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.examensParType.map((e) => (
                <TableRow key={e.type}>
                  <TableCell>{e.type}</TableCell>
                  <TableCell>{e.count}</TableCell>
                </TableRow>
              ))}
              {report.examensParType.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">Aucune donnée</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
