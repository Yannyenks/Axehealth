"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Journal {
  id: string;
  code: string;
  libelle: string;
  type: string;
}

interface Account {
  id: string;
  numero: string;
  libelle: string;
  isAuxiliaire: boolean;
}

interface ThirdParty {
  id: string;
  code: string;
  raisonSociale: string;
}

interface JournalEntryItem {
  id: string;
  libelle: string;
  debit: string;
  credit: string;
  account: { numero: string; libelle: string };
}

interface JournalEntryRow {
  id: string;
  numeroPiece: string;
  dateEcriture: string;
  libelle: string;
  status: "BROUILLON" | "VALIDEE";
  journal: { code: string; libelle: string };
  thirdParty: { raisonSociale: string } | null;
  items: JournalEntryItem[];
}

interface LineForm {
  accountId: string;
  thirdPartyId: string;
  libelle: string;
  sens: "DEBIT" | "CREDIT";
  montant: string;
}

function emptyLine(): LineForm {
  return { accountId: "", thirdPartyId: "", libelle: "", sens: "DEBIT", montant: "" };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ComptabilitePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [header, setHeader] = useState({ journalId: "", dateEcriture: todayIso(), libelle: "", reference: "", thirdPartyId: "" });
  const [lines, setLines] = useState<LineForm[]>([emptyLine(), emptyLine()]);

  const { data: journalsData } = useQuery({
    queryKey: ["journals"],
    queryFn: () => api.get<{ journals: Journal[] }>("/api/journals"),
  });
  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<{ accounts: Account[] }>("/api/accounts"),
  });
  const { data: thirdPartiesData } = useQuery({
    queryKey: ["third-parties"],
    queryFn: () => api.get<{ thirdParties: ThirdParty[] }>("/api/third-parties"),
  });
  const { data: entriesData, isLoading } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: () => api.get<{ entries: JournalEntryRow[] }>("/api/journal-entries"),
  });

  const accountById = new Map((accountsData?.accounts ?? []).map((a) => [a.id, a]));

  const totalDebit = lines.reduce((sum, l) => sum + (l.sens === "DEBIT" ? Number(l.montant || 0) : 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.sens === "CREDIT" ? Number(l.montant || 0) : 0), 0);
  const balanced = totalDebit > 0 && totalDebit === totalCredit;

  const createEntry = useMutation({
    mutationFn: () =>
      api.post("/api/journal-entries", {
        journalId: header.journalId,
        dateEcriture: header.dateEcriture,
        libelle: header.libelle,
        reference: header.reference || undefined,
        thirdPartyId: header.thirdPartyId || undefined,
        items: lines.map((l) => ({
          accountId: l.accountId,
          thirdPartyId: l.thirdPartyId || undefined,
          libelle: l.libelle || header.libelle,
          debit: l.sens === "DEBIT" ? Number(l.montant || 0) : 0,
          credit: l.sens === "CREDIT" ? Number(l.montant || 0) : 0,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      setHeader({ journalId: "", dateEcriture: todayIso(), libelle: "", reference: "", thirdPartyId: "" });
      setLines([emptyLine(), emptyLine()]);
      setShowForm(false);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  function updateLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  }

  const canSubmit =
    balanced &&
    !!header.journalId &&
    !!header.dateEcriture &&
    !!header.libelle &&
    lines.every((l) => l.accountId && Number(l.montant) > 0 && (!accountById.get(l.accountId)?.isAuxiliaire || l.thirdPartyId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Comptabilité</h1>
          <p className="text-sm text-muted-foreground">Journaux et écritures — équilibre débit = crédit vérifié à chaque saisie</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {showForm ? "Annuler" : "Nouvelle écriture"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle écriture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Journal</Label>
                <Select value={header.journalId} onChange={(e) => setHeader({ ...header, journalId: e.target.value })}>
                  <option value="">Sélectionner…</option>
                  {journalsData?.journals.map((j) => (
                    <option key={j.id} value={j.id}>{j.code} — {j.libelle}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={header.dateEcriture} onChange={(e) => setHeader({ ...header, dateEcriture: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Libellé de l'écriture</Label>
                <Input value={header.libelle} onChange={(e) => setHeader({ ...header, libelle: e.target.value })} placeholder="Ex: Facture EDF Août 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Référence (optionnel)</Label>
                <Input value={header.reference} onChange={(e) => setHeader({ ...header, reference: e.target.value })} placeholder="N° facture" />
              </div>
              <div className="space-y-1.5">
                <Label>Tiers (optionnel)</Label>
                <Select value={header.thirdPartyId} onChange={(e) => setHeader({ ...header, thirdPartyId: e.target.value })}>
                  <option value="">Aucun</option>
                  {thirdPartiesData?.thirdParties.map((t) => (
                    <option key={t.id} value={t.id}>{t.code} — {t.raisonSociale}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => {
                const account = accountById.get(line.accountId);
                return (
                  <div key={index} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-12 sm:items-end">
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label>Compte</Label>
                      <Select value={line.accountId} onChange={(e) => updateLine(index, { accountId: e.target.value })}>
                        <option value="">Sélectionner…</option>
                        {accountsData?.accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.numero} — {a.libelle}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label>Libellé ligne</Label>
                      <Input value={line.libelle} onChange={(e) => updateLine(index, { libelle: e.target.value })} />
                    </div>
                    {account?.isAuxiliaire && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Tiers</Label>
                        <Select value={line.thirdPartyId} onChange={(e) => updateLine(index, { thirdPartyId: e.target.value })}>
                          <option value="">Sélectionner…</option>
                          {thirdPartiesData?.thirdParties.map((t) => (
                            <option key={t.id} value={t.id}>{t.raisonSociale}</option>
                          ))}
                        </Select>
                      </div>
                    )}
                    <div className={cn("space-y-1.5", account?.isAuxiliaire ? "sm:col-span-2" : "sm:col-span-2")}>
                      <Label>Sens</Label>
                      <Select value={line.sens} onChange={(e) => updateLine(index, { sens: e.target.value as "DEBIT" | "CREDIT" })}>
                        <option value="DEBIT">Débit</option>
                        <option value="CREDIT">Crédit</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label>Montant</Label>
                      <Input type="number" min="0" step="0.01" value={line.montant} onChange={(e) => updateLine(index, { montant: e.target.value })} />
                    </div>
                    <div className="flex sm:col-span-1 sm:justify-end">
                      <Button type="button" size="sm" variant="outline" disabled={lines.length <= 2} onClick={() => removeLine(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter une ligne
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2 text-sm">
              <span>
                Débit: <span className="font-medium">{totalDebit.toLocaleString("fr-FR")}</span> · Crédit:{" "}
                <span className="font-medium">{totalCredit.toLocaleString("fr-FR")}</span>
              </span>
              <Badge variant={balanced ? "success" : "destructive"}>{balanced ? "Équilibrée" : "Déséquilibrée"}</Badge>
            </div>

            <div className="flex justify-end">
              <Button disabled={!canSubmit || createEntry.isPending} onClick={() => createEntry.mutate()}>
                {createEntry.isPending ? "Enregistrement…" : "Valider l'écriture"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pièce</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Journal</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Tiers</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {entriesData?.entries.map((entry) => {
                const total = entry.items.reduce((sum, item) => sum + Number(item.debit), 0);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">{entry.numeroPiece}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(entry.dateEcriture).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>{entry.journal.code}</TableCell>
                    <TableCell className="max-w-xs truncate">{entry.libelle}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.thirdParty?.raisonSociale ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{total.toLocaleString("fr-FR")}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === "VALIDEE" ? "success" : "secondary"}>{entry.status === "VALIDEE" ? "Validée" : "Brouillon"}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {entriesData?.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Aucune écriture</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
