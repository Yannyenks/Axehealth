"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PreConsultationDetail {
  id: string;
  status: "EN_COURS" | "EN_ATTENTE_REVUE" | "REVUE" | "CONVERTIE" | "ABANDONNEE";
  severity: "ROUGE" | "ORANGE" | "VERT" | null;
  motifPatient: string | null;
  summary: string | null;
  startedAt: string;
  patient: { id: string; firstName: string; lastName: string; patientNumber: string; dateNaissance: string; sexe: "M" | "F" };
  reviewedBy: { firstName: string; lastName: string } | null;
  messages: { id: string; role: "PATIENT" | "IA"; content: string; createdAt: string }[];
}

function severityVariant(severity: string | null): "default" | "warning" | "success" | "secondary" | "destructive" {
  if (severity === "ROUGE") return "destructive";
  if (severity === "ORANGE") return "warning";
  if (severity === "VERT") return "success";
  return "secondary";
}

export default function PreConsultationDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [medecinId, setMedecinId] = useState(user?.role === "MEDECIN" ? user.id : "");
  const [montant, setMontant] = useState("5000");
  const [rdvDate, setRdvDate] = useState("");
  const [practitionerId, setPractitionerId] = useState(user?.role === "MEDECIN" ? user.id : "");

  const { data } = useQuery({
    queryKey: ["preconsultations", params.id],
    queryFn: () => api.get<{ session: PreConsultationDetail }>(`/api/pre-consultations/${params.id}`),
  });

  const markReviewed = useMutation({
    mutationFn: () => api.patch(`/api/pre-consultations/${params.id}/reviewer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preconsultations"] });
      queryClient.invalidateQueries({ queryKey: ["preconsultations", params.id] });
    },
  });

  const convertToConsultation = useMutation({
    mutationFn: () => api.post(`/api/pre-consultations/${params.id}/convertir-consultation`, { medecinId, isPayant: true, montant: Number(montant) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preconsultations"] });
      queryClient.invalidateQueries({ queryKey: ["preconsultations", params.id] });
    },
  });

  const convertToAppointment = useMutation({
    mutationFn: () => api.post(`/api/pre-consultations/${params.id}/convertir-rdv`, { practitionerId, scheduledAt: rdvDate, duration: 30 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preconsultations"] });
      queryClient.invalidateQueries({ queryKey: ["preconsultations", params.id] });
    },
  });

  if (!data) return <div className="text-muted-foreground">Chargement…</div>;
  const session = data.session;
  const canAct = session.status !== "CONVERTIE";
  const canConvertToConsultation = user && ["ADMIN", "MEDECIN"].includes(user.role);
  const canConvertToRdv = user && ["ADMIN", "MEDECIN", "SECRETAIRE"].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{session.patient.firstName} {session.patient.lastName}</h1>
          <p className="text-sm text-muted-foreground">{session.patient.patientNumber} · Reçu le {new Date(session.startedAt).toLocaleString("fr-FR")}</p>
        </div>
        {session.severity && <Badge variant={severityVariant(session.severity)} className="text-sm">{session.severity}</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Synthèse clinique (IA)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{session.summary ?? "La pré-consultation est encore en cours côté patient — pas de synthèse disponible."}</p>
          {session.reviewedBy && (
            <p className="mt-3 text-xs text-muted-foreground">Revue par {session.reviewedBy.firstName} {session.reviewedBy.lastName}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Échange patient / IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "PATIENT" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.role === "PATIENT" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {canAct && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {session.status === "EN_ATTENTE_REVUE" && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm text-muted-foreground">Marquer cette pré-consultation comme prise en compte par l&apos;équipe.</p>
                <Button variant="secondary" onClick={() => markReviewed.mutate()} disabled={markReviewed.isPending}>
                  {markReviewed.isPending ? "…" : "Marquer comme revu"}
                </Button>
              </CardContent>
            </Card>
          )}

          {canConvertToConsultation && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm font-medium">Convertir en consultation</p>
                <div className="space-y-1.5">
                  <Label htmlFor="medecinId">ID du médecin</Label>
                  <Input id="medecinId" value={medecinId} onChange={(e) => setMedecinId(e.target.value)} placeholder="cuid du médecin" />
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <Label htmlFor="montant">Montant (FCFA)</Label>
                  <Input id="montant" type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
                </div>
                <Button onClick={() => convertToConsultation.mutate()} disabled={!medecinId || convertToConsultation.isPending}>
                  {convertToConsultation.isPending ? "…" : "Créer la consultation"}
                </Button>
              </CardContent>
            </Card>
          )}

          {canConvertToRdv && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm font-medium">Convertir en rendez-vous</p>
                <div className="space-y-1.5">
                  <Label htmlFor="practitionerId">ID du praticien</Label>
                  <Input id="practitionerId" value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} placeholder="cuid du praticien" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rdvDate">Date et heure</Label>
                  <Input id="rdvDate" type="datetime-local" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)} />
                </div>
                <Button onClick={() => convertToAppointment.mutate()} disabled={!practitionerId || !rdvDate || convertToAppointment.isPending}>
                  {convertToAppointment.isPending ? "…" : "Créer le RDV"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
