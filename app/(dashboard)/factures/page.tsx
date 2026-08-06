"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Invoice {
  id: string;
  numero: string;
  status: "BROUILLON" | "EN_ATTENTE_PAIEMENT" | "PARTIELLEMENT_PAYEE" | "PAYEE" | "ANNULEE";
  montantTotal: string;
  montantPartPatient: string;
  montantPaye: string;
  createdAt: string;
  patient: { firstName: string; lastName: string; patientNumber: string };
  items: { pole: string; libelle: string; montant: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  EN_ATTENTE_PAIEMENT: "En attente",
  PARTIELLEMENT_PAYEE: "Partiellement payée",
  PAYEE: "Payée",
  ANNULEE: "Annulée",
};

const CAN_ISSUE_CREDIT_NOTE = ["ADMIN", "COMPTABLE"];

function statusVariant(status: string): "success" | "warning" | "secondary" | "destructive" {
  if (status === "PAYEE") return "success";
  if (status === "EN_ATTENTE_PAIEMENT" || status === "PARTIELLEMENT_PAYEE") return "warning";
  if (status === "ANNULEE") return "destructive";
  return "secondary";
}

export default function FacturesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creditNoteInvoiceId, setCreditNoteInvoiceId] = useState<string | null>(null);
  const [creditNoteForm, setCreditNoteForm] = useState({ montant: "", motif: "GESTE_COMMERCIAL", note: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["factures", status],
    queryFn: () => api.get<{ invoices: Invoice[] }>(`/api/factures${status ? `?status=${status}` : ""}`),
  });

  const issueCreditNote = useMutation({
    mutationFn: () =>
      api.post("/api/caisse/avoirs", {
        invoiceId: creditNoteInvoiceId,
        montant: Number(creditNoteForm.montant),
        motif: creditNoteForm.motif,
        note: creditNoteForm.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      setCreditNoteInvoiceId(null);
      setCreditNoteForm({ montant: "", motif: "GESTE_COMMERCIAL", note: "" });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  const canIssueCreditNote = user && CAN_ISSUE_CREDIT_NOTE.includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Factures</h1>
          <p className="text-sm text-muted-foreground">Facturation consultations, pharmacie et tiers-payant</p>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-56">
          <option value="">Tous les statuts</option>
          <option value="EN_ATTENTE_PAIEMENT">En attente de paiement</option>
          <option value="PARTIELLEMENT_PAYEE">Partiellement payée</option>
          <option value="PAYEE">Payée</option>
          <option value="ANNULEE">Annulée</option>
        </Select>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {creditNoteInvoiceId && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Montant de l'avoir (FCFA)</Label>
              <Input type="number" min="0" value={creditNoteForm.montant} onChange={(e) => setCreditNoteForm({ ...creditNoteForm, montant: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Select value={creditNoteForm.motif} onChange={(e) => setCreditNoteForm({ ...creditNoteForm, motif: e.target.value })}>
                <option value="ERREUR_FACTURATION">Erreur de facturation</option>
                <option value="RETOUR_PRODUIT">Retour produit</option>
                <option value="GESTE_COMMERCIAL">Geste commercial</option>
                <option value="AUTRE">Autre</option>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Note</Label>
              <Input value={creditNoteForm.note} onChange={(e) => setCreditNoteForm({ ...creditNoteForm, note: e.target.value })} />
            </div>
            <div className="flex gap-2 sm:col-span-4">
              <Button disabled={!creditNoteForm.montant || issueCreditNote.isPending} onClick={() => issueCreditNote.mutate()}>
                Émettre l'avoir
              </Button>
              <Button variant="outline" onClick={() => setCreditNoteInvoiceId(null)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° facture</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Détail</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Payé</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                {canIssueCreditNote && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.numero}</TableCell>
                  <TableCell>{invoice.patient.firstName} {invoice.patient.lastName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {invoice.items.map((item) => item.libelle).join(", ")}
                  </TableCell>
                  <TableCell>{invoice.montantTotal} FCFA</TableCell>
                  <TableCell>{invoice.montantPaye} FCFA</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(invoice.status)}>{STATUS_LABEL[invoice.status]}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(invoice.createdAt).toLocaleDateString("fr-FR")}
                  </TableCell>
                  {canIssueCreditNote && (
                    <TableCell>
                      {invoice.status !== "ANNULEE" && (
                        <Button size="sm" variant="outline" onClick={() => setCreditNoteInvoiceId(invoice.id)}>
                          Avoir
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {data?.invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Aucune facture</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
