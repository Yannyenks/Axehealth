"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface LabRequest {
  id: string;
  type: "LABORATOIRE" | "IMAGERIE";
  libelle: string;
  status: "DEMANDE" | "EN_COURS" | "RESULTAT_DISPONIBLE" | "ANNULE";
  createdAt: string;
  consultation: { patient: { firstName: string; lastName: string; patientNumber: string }; medecin: { firstName: string; lastName: string } };
}

export default function LaboratoirePage() {
  const queryClient = useQueryClient();
  const [resultInputs, setResultInputs] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({ queryKey: ["laboratoire", "demandes"], queryFn: () => api.get<{ labRequests: LabRequest[] }>("/api/laboratoire/demandes") });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["laboratoire", "demandes"] });

  const startExam = useMutation({
    mutationFn: (id: string) => api.post(`/api/laboratoire/demandes/${id}/demarrer`),
    onSuccess: invalidate,
  });

  const submitResult = useMutation({
    mutationFn: ({ id, resultat }: { id: string; resultat: string }) => api.post(`/api/laboratoire/demandes/${id}/resultat`, { resultat }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Laboratoire & imagerie</h1>
        <p className="text-sm text-muted-foreground">Demandes d'examens en attente et saisie des résultats</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Prescripteur</TableHead>
                <TableHead>Examen</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Résultat</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.labRequests.map((lr) => (
                <TableRow key={lr.id}>
                  <TableCell>{lr.consultation.patient.firstName} {lr.consultation.patient.lastName}</TableCell>
                  <TableCell>Dr {lr.consultation.medecin.lastName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="mr-2">{lr.type === "LABORATOIRE" ? "Labo" : "Imagerie"}</Badge>
                    {lr.libelle}
                  </TableCell>
                  <TableCell>
                    <Badge variant={lr.status === "EN_COURS" ? "warning" : "secondary"}>{lr.status === "EN_COURS" ? "En cours" : "Demandé"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Résultat…"
                        className="h-8 max-w-56"
                        value={resultInputs[lr.id] ?? ""}
                        onChange={(e) => setResultInputs({ ...resultInputs, [lr.id]: e.target.value })}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {lr.status === "DEMANDE" && (
                      <Button size="sm" variant="outline" onClick={() => startExam.mutate(lr.id)}>
                        Démarrer
                      </Button>
                    )}
                    {lr.status === "EN_COURS" && (
                      <Button
                        size="sm"
                        disabled={!resultInputs[lr.id] || submitResult.isPending}
                        onClick={() => submitResult.mutate({ id: lr.id, resultat: resultInputs[lr.id] })}
                      >
                        Valider le résultat
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data?.labRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Aucune demande en attente</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
