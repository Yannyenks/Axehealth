"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface PreConsultationRow {
  id: string;
  status: "EN_COURS" | "EN_ATTENTE_REVUE" | "REVUE" | "CONVERTIE" | "ABANDONNEE";
  severity: "ROUGE" | "ORANGE" | "VERT" | null;
  motifPatient: string | null;
  startedAt: string;
  patient: { firstName: string; lastName: string; patientNumber: string };
}

const STATUS_LABEL: Record<string, string> = {
  EN_COURS: "En cours (patient)",
  EN_ATTENTE_REVUE: "À revoir",
  REVUE: "Revue",
  CONVERTIE: "Convertie",
  ABANDONNEE: "Abandonnée",
};

function severityVariant(severity: string | null): "default" | "warning" | "success" | "secondary" | "destructive" {
  if (severity === "ROUGE") return "destructive";
  if (severity === "ORANGE") return "warning";
  if (severity === "VERT") return "success";
  return "secondary";
}

const ACTIVE_STATUSES = ["EN_COURS", "EN_ATTENTE_REVUE"];

// Lien à partager avec les patients — propre à l'établissement (charte et
// personnalisation appliquées automatiquement, voir components/patient-branded-shell.tsx).
function PatientLinkBanner({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // window n'existe pas au premier rendu serveur — on récupère l'origine une
  // fois monté côté client plutôt que de risquer un mismatch d'hydratation.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = `${origin}/patient/${slug}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!origin) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Lien patient de votre établissement</p>
          <p className="font-mono text-sm text-muted-foreground">{link}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copié" : "Copier le lien"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PreConsultationsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"actives" | "traitees">("actives");

  const { data } = useQuery({
    queryKey: ["preconsultations"],
    queryFn: () => api.get<{ sessions: PreConsultationRow[] }>("/api/pre-consultations"),
    refetchInterval: 15000,
  });

  const sessions = (data?.sessions ?? []).filter((s) => (tab === "actives" ? ACTIVE_STATUSES.includes(s.status) : !ACTIVE_STATUSES.includes(s.status)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Pré-consultations IA</h1>
        <p className="text-sm text-muted-foreground">Triage et synthèses générés par l&apos;assistant IA depuis le portail patient.</p>
      </div>

      {user?.organization?.slug && <PatientLinkBanner slug={user.organization.slug} />}

      <div className="flex gap-2">
        <Button variant={tab === "actives" ? "default" : "outline"} size="sm" onClick={() => setTab("actives")}>À traiter</Button>
        <Button variant={tab === "traitees" ? "default" : "outline"} size="sm" onClick={() => setTab("traitees")}>Traitées</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Sévérité</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Reçu le</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.patient.firstName} {s.patient.lastName} <span className="text-xs text-muted-foreground">({s.patient.patientNumber})</span></TableCell>
                  <TableCell>{s.severity ? <Badge variant={severityVariant(s.severity)}>{s.severity}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{s.motifPatient ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{STATUS_LABEL[s.status] ?? s.status}</Badge></TableCell>
                  <TableCell>{new Date(s.startedAt).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>
                    <Link href={`/preconsultations/${s.id}`} className="text-sm font-medium text-primary hover:underline">
                      Ouvrir
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Aucune pré-consultation</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
