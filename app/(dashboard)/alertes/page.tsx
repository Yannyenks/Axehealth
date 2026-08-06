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

const METRIC_LABEL: Record<string, string> = {
  CA_JOUR: "Chiffre d'affaires du jour",
  CREANCES_ASSURANCES: "Créances assurances en attente",
  TAUX_OCCUPATION_LITS: "Taux d'occupation des lits (%)",
  STOCK_JOURS_AVANT_PEREMPTION: "Jours avant péremption (lot le plus urgent)",
  STOCK_SOUS_SEUIL_REAPPRO: "Nombre d'articles sous le seuil de réappro",
  ECART_CAISSE_CLOTURE: "Écart de caisse à la clôture (valeur absolue)",
};

const ROLE_OPTIONS = ["ADMIN", "SECRETAIRE", "MEDECIN", "INFIRMIER", "PHARMACIEN", "BIOLOGISTE", "CAISSIER", "COMPTABLE", "RH"];

interface AlertRule {
  id: string;
  label: string;
  metric: string;
  operator: "SUPERIEUR_A" | "INFERIEUR_A";
  threshold: string;
  isActive: boolean;
  notifyRoles: string[];
  triggerLogs: { value: string; triggeredAt: string }[];
}

const emptyForm = { label: "", metric: "CA_JOUR", operator: "INFERIEUR_A" as "SUPERIEUR_A" | "INFERIEUR_A", threshold: "0", notifyRoles: ["ADMIN"] as string[] };

export default function AlertesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["alertes", "regles"], queryFn: () => api.get<{ rules: AlertRule[] }>("/api/alertes/regles") });

  function reportError(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Une erreur est survenue");
  }

  const createRule = useMutation({
    mutationFn: () => api.post("/api/alertes/regles", { ...form, threshold: Number(form.threshold) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertes", "regles"] });
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
    },
    onError: reportError,
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/alertes/regles/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alertes", "regles"] }),
    onError: reportError,
  });

  const checkNow = useMutation({
    mutationFn: () => api.post<{ triggered: { label: string; value: number }[] }>("/api/alertes/verifier"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["alertes", "regles"] });
      setCheckResult(res.triggered.length === 0 ? "Aucune alerte déclenchée." : `${res.triggered.length} alerte(s) déclenchée(s) : ${res.triggered.map((t) => t.label).join(", ")}`);
    },
    onError: reportError,
  });

  function toggleRole(role: string) {
    setForm((f) => ({ ...f, notifyRoles: f.notifyRoles.includes(role) ? f.notifyRoles.filter((r) => r !== role) : [...f.notifyRoles, role] }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Alertes configurables</h1>
          <p className="text-sm text-muted-foreground">
            Seuils définis par la direction — évalués automatiquement toutes les 15 minutes en production (Vercel Cron)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={checkNow.isPending} onClick={() => checkNow.mutate()}>
            {checkNow.isPending ? "Vérification…" : "Vérifier maintenant"}
          </Button>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annuler" : "Nouvelle règle"}</Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
      {checkResult && (
        <Card>
          <CardContent className="p-4 text-sm">{checkResult}</CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nom de la règle</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Trésorerie basse le matin" />
            </div>
            <div className="space-y-1.5">
              <Label>Métrique</Label>
              <Select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
                {Object.entries(METRIC_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <div className="flex gap-2">
                <Select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as "SUPERIEUR_A" | "INFERIEUR_A" })} className="w-40">
                  <option value="SUPERIEUR_A">Supérieur à</option>
                  <option value="INFERIEUR_A">Inférieur à</option>
                </Select>
                <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notifier les rôles</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${form.notifyRoles.includes(role) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button disabled={!form.label || form.notifyRoles.length === 0 || createRule.isPending} onClick={() => createRule.mutate()}>
                Créer la règle
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
                <TableHead>Règle</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Dernier déclenchement</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {METRIC_LABEL[rule.metric]} {rule.operator === "SUPERIEUR_A" ? ">" : "<"} {rule.threshold}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.triggerLogs[0] ? `${rule.triggerLogs[0].value} le ${new Date(rule.triggerLogs[0].triggeredAt).toLocaleString("fr-FR")}` : "Jamais"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? "success" : "secondary"}>{rule.isActive ? "Active" : "Désactivée"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })}>
                      {rule.isActive ? "Désactiver" : "Activer"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data?.rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Aucune règle configurée</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
