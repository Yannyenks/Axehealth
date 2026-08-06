"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface GroupeEntry {
  organizationId: string;
  nom: string;
  patients: number;
  consultations: number;
  caEncaisse: string;
  tauxOccupationLits: number;
  nps: number | null;
}

interface GroupeComparatif {
  groupe: { id: string; nom: string } | null;
  organisations: GroupeEntry[];
}

export default function GroupePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["groupe", "comparatif"],
    queryFn: () => api.get<GroupeComparatif>("/api/groupe/comparatif"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Comparatif inter-cliniques</h1>
        <p className="text-sm text-muted-foreground">Activité du mois en cours, par établissement du groupe</p>
      </div>

      {!isLoading && !data?.groupe && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Cette organisation n'appartient à aucun groupe multi-établissement pour l'instant.
          </CardContent>
        </Card>
      )}

      {data?.groupe && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Patients</TableHead>
                  <TableHead>Consultations (mois)</TableHead>
                  <TableHead>CA encaissé (mois)</TableHead>
                  <TableHead>Occupation lits</TableHead>
                  <TableHead>NPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">Chargement…</TableCell>
                  </TableRow>
                )}
                {data.organisations.map((org) => (
                  <TableRow key={org.organizationId}>
                    <TableCell className="font-medium">{org.nom}</TableCell>
                    <TableCell>{org.patients}</TableCell>
                    <TableCell>{org.consultations}</TableCell>
                    <TableCell>{org.caEncaisse} FCFA</TableCell>
                    <TableCell>{org.tauxOccupationLits}%</TableCell>
                    <TableCell>{org.nps === null ? "—" : org.nps}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
