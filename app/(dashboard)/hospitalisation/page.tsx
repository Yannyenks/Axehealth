"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Bed {
  id: string;
  numero: string;
  status: "LIBRE" | "OCCUPE" | "RESERVE" | "MAINTENANCE";
  hospitalizationId: string | null;
  patientActuel: { id: string; firstName: string; lastName: string; patientNumber: string } | null;
}

interface Room {
  id: string;
  numero: string;
  type: string;
  department: { name: string } | null;
  beds: Bed[];
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber: string;
}

const STATUS_STYLE: Record<Bed["status"], string> = {
  LIBRE: "bg-success/15 text-success border-success/30",
  OCCUPE: "bg-primary/15 text-primary border-primary/30",
  RESERVE: "bg-warning/15 text-warning border-warning/30",
  MAINTENANCE: "bg-muted text-muted-foreground border-border",
};

export default function HospitalisationPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [showAdmit, setShowAdmit] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [admitForm, setAdmitForm] = useState({ patientId: "", bedId: "", motifEntree: "" });
  const [note, setNote] = useState({ periode: "JOUR" as "JOUR" | "NUIT", note: "" });

  const { data, isLoading } = useQuery({ queryKey: ["hospitalisation", "lits"], queryFn: () => api.get<{ rooms: Room[] }>("/api/hospitalisation/lits") });
  const { data: patientsData } = useQuery({
    queryKey: ["patients", "search", patientQuery],
    queryFn: () => api.get<{ patients: Patient[] }>(`/api/patients?q=${encodeURIComponent(patientQuery)}`),
    enabled: patientQuery.length > 0,
  });

  function reportError(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Une erreur est survenue");
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["hospitalisation"] });

  const admitPatient = useMutation({
    mutationFn: () => api.post("/api/hospitalisation/admissions", admitForm),
    onSuccess: () => {
      invalidate();
      setShowAdmit(false);
      setAdmitForm({ patientId: "", bedId: "", motifEntree: "" });
      setError(null);
    },
    onError: reportError,
  });

  const dischargePatient = useMutation({
    mutationFn: (hospitalizationId: string) => api.patch(`/api/hospitalisation/admissions/${hospitalizationId}`, { action: "SORTIE" }),
    onSuccess: () => {
      invalidate();
      setSelectedBed(null);
      setError(null);
    },
    onError: reportError,
  });

  const addNote = useMutation({
    mutationFn: (hospitalizationId: string) => api.post(`/api/hospitalisation/admissions/${hospitalizationId}/soins`, note),
    onSuccess: () => {
      setNote({ periode: "JOUR", note: "" });
      setError(null);
    },
    onError: reportError,
  });

  const freeBeds = data?.rooms.flatMap((r) => r.beds.filter((b) => b.status === "LIBRE").map((b) => ({ ...b, roomLabel: r.numero }))) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Hospitalisation</h1>
          <p className="text-sm text-muted-foreground">Plan des lits en temps réel</p>
        </div>
        <Button onClick={() => setShowAdmit((v) => !v)}>{showAdmit ? "Annuler" : "Admettre un patient"}</Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {showAdmit && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Patient</Label>
              <Input placeholder="Rechercher…" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
              {patientsData && patientsData.patients.length > 0 && (
                <Select value={admitForm.patientId} onChange={(e) => setAdmitForm({ ...admitForm, patientId: e.target.value })}>
                  <option value="">Sélectionner…</option>
                  {patientsData.patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.patientNumber})</option>
                  ))}
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Lit disponible</Label>
              <Select value={admitForm.bedId} onChange={(e) => setAdmitForm({ ...admitForm, bedId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {freeBeds.map((b) => (
                  <option key={b.id} value={b.id}>Chambre {b.roomLabel} — lit {b.numero}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Motif d'entrée</Label>
              <Input value={admitForm.motifEntree} onChange={(e) => setAdmitForm({ ...admitForm, motifEntree: e.target.value })} />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button disabled={!admitForm.patientId || !admitForm.bedId || admitPatient.isPending} onClick={() => admitPatient.mutate()}>
                Admettre
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(["LIBRE", "OCCUPE", "RESERVE", "MAINTENANCE"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full border", STATUS_STYLE[s])} />
            {s === "LIBRE" ? "Libre" : s === "OCCUPE" ? "Occupé" : s === "RESERVE" ? "Réservé" : "Maintenance"}
          </span>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.rooms.map((room) => (
          <Card key={room.id}>
            <CardHeader>
              <CardTitle className="text-base">Chambre {room.numero}</CardTitle>
              <p className="text-xs text-muted-foreground">{room.department?.name ?? room.type}</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {room.beds.map((bed) => (
                <button
                  key={bed.id}
                  onClick={() => setSelectedBed(bed.status === "OCCUPE" ? bed : null)}
                  className={cn("rounded-md border p-2 text-left text-xs", STATUS_STYLE[bed.status])}
                >
                  <p className="font-medium">Lit {bed.numero}</p>
                  {bed.patientActuel && <p className="truncate">{bed.patientActuel.firstName} {bed.patientActuel.lastName}</p>}
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
        {data?.rooms.length === 0 && <p className="text-muted-foreground">Aucune chambre configurée.</p>}
      </div>

      {selectedBed?.patientActuel && selectedBed.hospitalizationId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedBed.patientActuel.firstName} {selectedBed.patientActuel.lastName} — Lit {selectedBed.numero}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select value={note.periode} onChange={(e) => setNote({ ...note, periode: e.target.value as "JOUR" | "NUIT" })}>
                <option value="JOUR">Équipe jour</option>
                <option value="NUIT">Équipe nuit</option>
              </Select>
              <Input placeholder="Note de soins…" className="sm:col-span-2" value={note.note} onChange={(e) => setNote({ ...note, note: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button disabled={!note.note || addNote.isPending} onClick={() => addNote.mutate(selectedBed.hospitalizationId!)}>
                Ajouter la note
              </Button>
              <Button variant="secondary" disabled={dischargePatient.isPending} onClick={() => dischargePatient.mutate(selectedBed.hospitalizationId!)}>
                Sortie du patient
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
