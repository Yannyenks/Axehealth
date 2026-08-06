"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Select } from "@/components/ui/select";
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

function statusVariant(status: string): "success" | "warning" | "secondary" | "destructive" {
  if (status === "PAYEE") return "success";
  if (status === "EN_ATTENTE_PAIEMENT" || status === "PARTIELLEMENT_PAYEE") return "warning";
  if (status === "ANNULEE") return "destructive";
  return "secondary";
}

export default function FacturesPage() {
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["factures", status],
    queryFn: () => api.get<{ invoices: Invoice[] }>(`/api/factures${status ? `?status=${status}` : ""}`),
  });

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Chargement…</TableCell>
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
                </TableRow>
              ))}
              {data?.invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Aucune facture</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
