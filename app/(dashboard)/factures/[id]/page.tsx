"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface InvoiceDetail {
  numero: string;
  status: string;
  montantTotal: string;
  montantPartPatient: string;
  montantPartAssurance: string;
  montantPaye: string;
  createdAt: string;
  patient: { firstName: string; lastName: string; patientNumber: string };
  organization: { name: string; address: string | null; city: string | null; phone: string | null };
  items: { libelle: string; pole: string; quantite: number; prixUnitaire: string; montant: string }[];
  payments: { mode: string; montant: string; createdAt: string; validatedAt: string | null }[];
  creditNotes: { montant: string; motif: string; createdAt: string }[];
}

export default function FactureDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["factures", params.id],
    queryFn: () => api.get<{ invoice: InvoiceDetail }>(`/api/factures/${params.id}`),
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Chargement…</p>;

  const { invoice } = data;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl font-bold">Facture {invoice.numero}</h1>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimer
        </Button>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <p className="font-display text-lg font-bold text-primary">{invoice.organization.name}</p>
              {invoice.organization.address && <p className="text-sm text-muted-foreground">{invoice.organization.address}</p>}
              {invoice.organization.city && <p className="text-sm text-muted-foreground">{invoice.organization.city}</p>}
              {invoice.organization.phone && <p className="text-sm text-muted-foreground">{invoice.organization.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Facture</p>
              <p className="font-mono text-sm font-medium">{invoice.numero}</p>
              <p className="text-sm text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString("fr-FR")}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Patient</p>
            <p className="font-medium">{invoice.patient.firstName} {invoice.patient.lastName}</p>
            <p className="text-sm text-muted-foreground">{invoice.patient.patientNumber}</p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Désignation</th>
                <th className="py-2 text-right">Qté</th>
                <th className="py-2 text-right">Prix unitaire</th>
                <th className="py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{item.libelle} <span className="text-xs text-muted-foreground">({item.pole})</span></td>
                  <td className="py-2 text-right">{item.quantite}</td>
                  <td className="py-2 text-right">{item.prixUnitaire} FCFA</td>
                  <td className="py-2 text-right">{item.montant} FCFA</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant total</span>
              <span className="font-medium">{invoice.montantTotal} FCFA</span>
            </div>
            {Number(invoice.montantPartAssurance) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Part assurance</span>
                <span>{invoice.montantPartAssurance} FCFA</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Part patient</span>
              <span>{invoice.montantPartPatient} FCFA</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Payé</span>
              <span>{invoice.montantPaye} FCFA</span>
            </div>
          </div>

          {invoice.creditNotes.length > 0 && (
            <div className="border-t pt-4 text-sm">
              <p className="mb-1 text-muted-foreground">Avoirs</p>
              {invoice.creditNotes.map((c, i) => (
                <div key={i} className="flex justify-between">
                  <span>{c.motif}</span>
                  <span>-{c.montant} FCFA</span>
                </div>
              ))}
            </div>
          )}

          <p className="border-t pt-4 text-center text-xs text-muted-foreground">
            Document généré par AxeHealth — {new Date().toLocaleDateString("fr-FR")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
