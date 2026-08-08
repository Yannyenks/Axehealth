"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber: string;
}

interface Consultation {
  id: string;
  status: string;
  motif: string | null;
  createdAt: string;
  patient: { firstName: string; lastName: string; patientNumber: string };
  medecin: { firstName: string; lastName: string };
}

const STATUS_LABEL: Record<string, string> = {
  PLANIFIEE: "Planifiée",
  EN_ATTENTE_CAISSE: "En attente caisse",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

function statusVariant(status: string): "default" | "warning" | "success" | "secondary" | "destructive" {
  if (status === "EN_ATTENTE_CAISSE") return "warning";
  if (status === "EN_COURS") return "default";
  if (status === "TERMINEE") return "success";
  if (status === "ANNULEE") return "destructive";
  return "secondary";
}

export default function ConsultationsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [motif, setMotif] = useState("");
  const [isPayant, setIsPayant] = useState(true);
  const [montant, setMontant] = useState("5000");

  const { data } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => api.get<{ consultations: Consultation[] }>("/api/consultations"),
  });

  const { data: patientsData } = useQuery({
    queryKey: ["patients", "search", patientQuery],
    queryFn: () => api.get<{ patients: Patient[] }>(`/api/patients?q=${encodeURIComponent(patientQuery)}`),
    enabled: patientQuery.length > 0,
  });

  const createConsultation = useMutation({
    mutationFn: () =>
      api.post("/api/consultations", {
        patientId,
        medecinId: user?.id,
        motif: motif || undefined,
        isPayant,
        montant: isPayant ? Number(montant) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      setShowForm(false);
      setPatientId("");
      setPatientQuery("");
      setMotif("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Consultations</h1>
          <p className="text-sm text-muted-foreground">
            {user?.role === "MEDECIN" ? "Vos consultations" : "Toutes les consultations"}
          </p>
        </div>
        {user?.role === "MEDECIN" && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annuler" : "Nouvelle consultation"}</Button>}
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-1.5">
              <Label htmlFor="patientQuery">Patient</Label>
              <Input id="patientQuery" placeholder="Rechercher un patient…" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
              {patientsData && patientsData.patients.length > 0 && (
                <Select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {patientsData.patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.patientNumber})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motif">Motif</Label>
              <Input id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} />
            </div>

            <div className="flex items-center gap-2">
              <input id="isPayant" type="checkbox" checked={isPayant} onChange={(e) => setIsPayant(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="isPayant">Acte payant (verrouillé jusqu'à validation caisse)</Label>
            </div>

            {isPayant && (
              <div className="space-y-1.5 max-w-xs">
                <Label htmlFor="montant">Montant (FCFA)</Label>
                <Input id="montant" type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
              </div>
            )}

            <Button disabled={!patientId || createConsultation.isPending} onClick={() => createConsultation.mutate()}>
              {createConsultation.isPending ? "Création…" : "Créer la consultation"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Médecin</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.consultations.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.patient.firstName} {c.patient.lastName}</TableCell>
                  <TableCell>Dr {c.medecin.lastName}</TableCell>
                  <TableCell>{c.motif ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/consultations/${c.id}`} className="text-sm font-medium text-primary hover:underline">
                      Ouvrir
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {data?.consultations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Aucune consultation</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
