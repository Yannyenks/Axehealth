"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Provider {
  id: string;
  name: string;
  tauxPriseEnCharge: number;
  plafondAnnuel: string | null;
  contact: string | null;
}

interface Claim {
  id: string;
  numeroBordereau: string | null;
  montant: string;
  status: "EN_PREPARATION" | "TRANSMIS" | "ACCEPTE" | "REJETE" | "PAYE";
  insuranceProvider: { name: string };
  invoice: { numero: string; patient: { firstName: string; lastName: string } };
}

interface Invoice {
  id: string;
  numero: string;
  montantPartAssurance: string;
  patient: { firstName: string; lastName: string };
}

const STATUS_LABEL: Record<string, string> = {
  EN_PREPARATION: "En préparation",
  TRANSMIS: "Transmis",
  ACCEPTE: "Accepté",
  REJETE: "Rejeté",
  PAYE: "Payé",
};

function statusVariant(status: string): "success" | "warning" | "secondary" | "destructive" {
  if (status === "PAYE" || status === "ACCEPTE") return "success";
  if (status === "TRANSMIS") return "warning";
  if (status === "REJETE") return "destructive";
  return "secondary";
}

const NEXT_STATUS: Record<string, "TRANSMIS" | "ACCEPTE" | "REJETE" | "PAYE" | null> = {
  EN_PREPARATION: "TRANSMIS",
  TRANSMIS: "ACCEPTE",
  ACCEPTE: "PAYE",
  REJETE: null,
  PAYE: null,
};

export default function AssurancesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [providerForm, setProviderForm] = useState({ name: "", tauxPriseEnCharge: "80", contact: "" });
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  const providers = useQuery({ queryKey: ["assurances", "prestataires"], queryFn: () => api.get<{ providers: Provider[] }>("/api/assurances/prestataires") });
  const claims = useQuery({ queryKey: ["assurances", "dossiers"], queryFn: () => api.get<{ claims: Claim[] }>("/api/assurances/dossiers") });
  const invoices = useQuery({ queryKey: ["factures", "avec-assurance"], queryFn: () => api.get<{ invoices: Invoice[] }>("/api/factures") });

  function reportError(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Une erreur est survenue");
  }

  const createProvider = useMutation({
    mutationFn: () => api.post("/api/assurances/prestataires", { ...providerForm, tauxPriseEnCharge: Number(providerForm.tauxPriseEnCharge) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assurances", "prestataires"] });
      setProviderForm({ name: "", tauxPriseEnCharge: "80", contact: "" });
      setShowProviderForm(false);
      setError(null);
    },
    onError: reportError,
  });

  const createClaim = useMutation({
    mutationFn: () => api.post("/api/assurances/dossiers", { invoiceId: selectedInvoiceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assurances", "dossiers"] });
      setSelectedInvoiceId("");
      setError(null);
    },
    onError: reportError,
  });

  const advanceStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/api/assurances/dossiers/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assurances", "dossiers"] }),
    onError: reportError,
  });

  const claimableInvoices = (invoices.data?.invoices ?? []).filter(
    (i) => Number(i.montantPartAssurance) > 0 && !claims.data?.claims.some((c) => c.invoice.numero === i.numero),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Tiers-payant & assurances</h1>
        <p className="text-sm text-muted-foreground">Prestataires, répartition patient/assurance, bordereaux de transmission</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Prestataires d'assurance</CardTitle>
          <Button size="sm" onClick={() => setShowProviderForm((v) => !v)}>{showProviderForm ? "Annuler" : "Nouveau prestataire"}</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showProviderForm && (
            <div className="grid grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-3">
              <Input placeholder="Nom" value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} />
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="Taux de prise en charge (%)"
                value={providerForm.tauxPriseEnCharge}
                onChange={(e) => setProviderForm({ ...providerForm, tauxPriseEnCharge: e.target.value })}
              />
              <Input placeholder="Contact" value={providerForm.contact} onChange={(e) => setProviderForm({ ...providerForm, contact: e.target.value })} />
              <Button disabled={!providerForm.name || createProvider.isPending} onClick={() => createProvider.mutate()}>
                Créer
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Taux de prise en charge</TableHead>
                <TableHead>Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.data?.providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.tauxPriseEnCharge}%</TableCell>
                  <TableCell>{p.contact ?? "—"}</TableCell>
                </TableRow>
              ))}
              {providers.data?.providers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">Aucun prestataire</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Créer un dossier / bordereau</CardTitle>
          <p className="text-xs text-muted-foreground">Uniquement les factures avec une part assurance non encore réclamée</p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Select value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)} className="max-w-md">
            <option value="">Sélectionner une facture…</option>
            {claimableInvoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.numero} — {i.patient.firstName} {i.patient.lastName} ({i.montantPartAssurance} FCFA)
              </option>
            ))}
          </Select>
          <Button disabled={!selectedInvoiceId || createClaim.isPending} onClick={() => createClaim.mutate()}>
            Créer le dossier
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dossiers en cours</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bordereau</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Prestataire</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.data?.claims.map((c) => {
                const next = NEXT_STATUS[c.status];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.numeroBordereau}</TableCell>
                    <TableCell>{c.invoice.patient.firstName} {c.invoice.patient.lastName}</TableCell>
                    <TableCell>{c.insuranceProvider.name}</TableCell>
                    <TableCell>{c.montant} FCFA</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(c.status)}>{STATUS_LABEL[c.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {next && (
                        <Button size="sm" variant="outline" onClick={() => advanceStatus.mutate({ id: c.id, status: next })}>
                          → {STATUS_LABEL[next]}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {claims.data?.claims.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Aucun dossier</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
