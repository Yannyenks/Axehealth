"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LabRequest {
  id: string;
  type: "LABORATOIRE" | "IMAGERIE";
  libelle: string;
  status: "DEMANDE" | "EN_COURS" | "RESULTAT_DISPONIBLE" | "ANNULE";
  resultat: string | null;
}

interface PrescriptionItem {
  id: string;
  denomination: string;
  posologie: string;
  quantite: number;
  interactionAlert: string | null;
  dispensedAt: string | null;
}

interface Prescription {
  id: string;
  items: PrescriptionItem[];
}

interface ConsultationDetail {
  id: string;
  status: string;
  motif: string | null;
  diagnostic: string | null;
  diagnosticCim: string | null;
  patient: { firstName: string; lastName: string; patientNumber: string; allergies: string[] };
  medecin: { firstName: string; lastName: string };
  vitalSigns: {
    temperature: number | null;
    tensionSys: number | null;
    tensionDia: number | null;
    pouls: number | null;
    poids: number | null;
    taille: number | null;
    imc: number | null;
    imcClassification: string | null;
    tensionClassification: string | null;
  }[];
  prescriptions: Prescription[];
  labRequests: LabRequest[];
}

const IMC_LABEL: Record<string, string> = { MAIGREUR: "Maigreur", NORMAL: "IMC normal", SURPOIDS: "Surpoids", OBESITE: "Obésité" };
const TENSION_LABEL: Record<string, string> = {
  NORMALE: "Tension normale",
  ELEVEE: "Tension élevée",
  HYPERTENSION_STADE_1: "HTA stade 1",
  HYPERTENSION_STADE_2: "HTA stade 2",
  CRISE_HYPERTENSIVE: "Crise hypertensive",
};

const LAB_STATUS_LABEL: Record<string, string> = {
  DEMANDE: "Demandé",
  EN_COURS: "En cours",
  RESULTAT_DISPONIBLE: "Résultat disponible",
  ANNULE: "Annulé",
};

export default function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["consultations", params.id],
    queryFn: () => api.get<{ consultation: ConsultationDetail }>(`/api/consultations/${params.id}`),
  });

  const [diagnostic, setDiagnostic] = useState("");
  const [diagnosticCim, setDiagnosticCim] = useState("");
  const [vitals, setVitals] = useState({ temperature: "", tensionSys: "", tensionDia: "", pouls: "", poids: "", taille: "" });
  const [rx, setRx] = useState({ denomination: "", posologie: "", quantite: "1" });
  const [exam, setExam] = useState({ type: "LABORATOIRE" as "LABORATOIRE" | "IMAGERIE", libelle: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["consultations", params.id] });

  const updateConsultation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/consultations/${params.id}`, body),
    onSuccess: invalidate,
  });

  const addPrescription = useMutation({
    mutationFn: () =>
      api.post(`/api/consultations/${params.id}/prescriptions`, {
        items: [{ denomination: rx.denomination, posologie: rx.posologie, quantite: Number(rx.quantite) }],
      }),
    onSuccess: () => {
      invalidate();
      setRx({ denomination: "", posologie: "", quantite: "1" });
    },
  });

  const requestExam = useMutation({
    mutationFn: () => api.post(`/api/consultations/${params.id}/examens`, exam),
    onSuccess: () => {
      invalidate();
      setExam({ type: "LABORATOIRE", libelle: "" });
    },
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Chargement…</p>;

  const { consultation } = data;
  const locked = consultation.status === "EN_ATTENTE_CAISSE";
  const lastVitalSign = consultation.vitalSigns.at(-1);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">
          {consultation.patient.firstName} {consultation.patient.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">{consultation.patient.patientNumber} · Dr {consultation.medecin.lastName}</p>
      </div>

      {locked && (
        <Card className="border-warning">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm text-foreground">
              <Badge variant="warning" className="mr-2">Verrouillée</Badge>
              Cet acte est payant et attend la validation caisse (double contrôle) avant de pouvoir être démarré.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Constantes vitales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Température (°C)</Label>
            <Input disabled={locked} type="number" step="0.1" value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tension sys.</Label>
            <Input disabled={locked} type="number" value={vitals.tensionSys} onChange={(e) => setVitals({ ...vitals, tensionSys: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tension dia.</Label>
            <Input disabled={locked} type="number" value={vitals.tensionDia} onChange={(e) => setVitals({ ...vitals, tensionDia: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Pouls</Label>
            <Input disabled={locked} type="number" value={vitals.pouls} onChange={(e) => setVitals({ ...vitals, pouls: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Poids (kg)</Label>
            <Input disabled={locked} type="number" step="0.1" value={vitals.poids} onChange={(e) => setVitals({ ...vitals, poids: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Taille (cm)</Label>
            <Input disabled={locked} type="number" value={vitals.taille} onChange={(e) => setVitals({ ...vitals, taille: e.target.value })} />
          </div>

          {lastVitalSign && (lastVitalSign.imc || lastVitalSign.tensionClassification) && (
            <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-4">
              {lastVitalSign.imc && (
                <Badge variant={lastVitalSign.imcClassification === "NORMAL" ? "success" : "warning"}>
                  IMC {lastVitalSign.imc} — {IMC_LABEL[lastVitalSign.imcClassification!]}
                </Badge>
              )}
              {lastVitalSign.tensionClassification && (
                <Badge variant={lastVitalSign.tensionClassification === "NORMALE" ? "success" : "warning"}>
                  {TENSION_LABEL[lastVitalSign.tensionClassification]}
                </Badge>
              )}
            </div>
          )}

          <div className="col-span-2 sm:col-span-4">
            <Button
              disabled={locked || updateConsultation.isPending}
              onClick={() =>
                updateConsultation.mutate({
                  vitalSigns: {
                    temperature: vitals.temperature ? Number(vitals.temperature) : undefined,
                    tensionSys: vitals.tensionSys ? Number(vitals.tensionSys) : undefined,
                    tensionDia: vitals.tensionDia ? Number(vitals.tensionDia) : undefined,
                    pouls: vitals.pouls ? Number(vitals.pouls) : undefined,
                    poids: vitals.poids ? Number(vitals.poids) : undefined,
                    taille: vitals.taille ? Number(vitals.taille) : undefined,
                  },
                })
              }
            >
              Enregistrer les constantes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnostic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Diagnostic</Label>
            <Input disabled={locked} value={diagnostic || consultation.diagnostic || ""} onChange={(e) => setDiagnostic(e.target.value)} />
          </div>
          <div className="space-y-1.5 max-w-xs">
            <Label>Code CIM-10</Label>
            <Input disabled={locked} value={diagnosticCim || consultation.diagnosticCim || ""} onChange={(e) => setDiagnosticCim(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              disabled={locked || updateConsultation.isPending}
              onClick={() => updateConsultation.mutate({ diagnostic, diagnosticCim })}
            >
              Enregistrer le diagnostic
            </Button>
            <Button
              variant="secondary"
              disabled={locked || consultation.status === "TERMINEE" || updateConsultation.isPending}
              onClick={() => updateConsultation.mutate({ status: "TERMINEE" })}
            >
              Clôturer la consultation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ordonnance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {consultation.prescriptions.flatMap((p) => p.items).map((item) => (
            <div key={item.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{item.denomination} — {item.posologie} (x{item.quantite})</p>
              {item.interactionAlert && <p className="mt-1 text-warning">⚠ {item.interactionAlert}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{item.dispensedAt ? "Dispensé" : "Non dispensé"}</p>
            </div>
          ))}

          {!locked && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input placeholder="Médicament" value={rx.denomination} onChange={(e) => setRx({ ...rx, denomination: e.target.value })} />
              <Input placeholder="Posologie" value={rx.posologie} onChange={(e) => setRx({ ...rx, posologie: e.target.value })} />
              <Input type="number" min="1" placeholder="Qté" value={rx.quantite} onChange={(e) => setRx({ ...rx, quantite: e.target.value })} />
              <Button disabled={!rx.denomination || !rx.posologie || addPrescription.isPending} onClick={() => addPrescription.mutate()}>
                Ajouter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Examens (laboratoire / imagerie)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {consultation.labRequests.map((lr) => (
            <div key={lr.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{lr.type === "LABORATOIRE" ? "Labo" : "Imagerie"} — {lr.libelle}</p>
                <Badge variant={lr.status === "RESULTAT_DISPONIBLE" ? "success" : lr.status === "ANNULE" ? "destructive" : "secondary"}>
                  {LAB_STATUS_LABEL[lr.status]}
                </Badge>
              </div>
              {lr.resultat && <p className="mt-1 text-muted-foreground">{lr.resultat}</p>}
            </div>
          ))}
          {consultation.labRequests.length === 0 && <p className="text-sm text-muted-foreground">Aucun examen demandé.</p>}

          {!locked && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Select value={exam.type} onChange={(e) => setExam({ ...exam, type: e.target.value as "LABORATOIRE" | "IMAGERIE" })}>
                <option value="LABORATOIRE">Laboratoire</option>
                <option value="IMAGERIE">Imagerie</option>
              </Select>
              <Input placeholder="Ex: NFS, radio thorax…" className="sm:col-span-2" value={exam.libelle} onChange={(e) => setExam({ ...exam, libelle: e.target.value })} />
              <Button disabled={!exam.libelle || requestExam.isPending} onClick={() => requestExam.mutate()}>
                Demander
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
