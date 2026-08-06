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

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Shift {
  id: string;
  startAt: string;
  endAt: string;
  periode: string;
  isAstreinte: boolean;
  user: { firstName: string; lastName: string; role: string };
}

interface Payroll {
  id: string;
  periode: string;
  type: string;
  netAPayer: string;
  status: "BROUILLON" | "VALIDE" | "PAYE";
  user: { firstName: string; lastName: string; role: string };
}

const emptyShift = { userId: "", startAt: "", endAt: "", periode: "JOUR", isAstreinte: false };
const currentPeriode = new Date().toISOString().slice(0, 7);

export default function RhPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftForm, setShiftForm] = useState(emptyShift);
  const [payrollForm, setPayrollForm] = useState({ userId: "", periode: currentPeriode, type: "SALAIRE_FIXE" as "SALAIRE_FIXE" | "RETROCESSION", salaireBrut: "0", retrocessionTaux: "10" });
  const [showPayrollForm, setShowPayrollForm] = useState(false);

  const { data: usersData } = useQuery({ queryKey: ["users"], queryFn: () => api.get<{ users: User[] }>("/api/users") });
  const { data: shiftsData } = useQuery({ queryKey: ["rh", "gardes"], queryFn: () => api.get<{ shifts: Shift[] }>("/api/rh/gardes") });
  const { data: payrollsData } = useQuery({
    queryKey: ["rh", "paie", payrollForm.periode],
    queryFn: () => api.get<{ payrolls: Payroll[] }>(`/api/rh/paie?periode=${payrollForm.periode}`),
  });

  function reportError(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Une erreur est survenue");
  }

  const createShift = useMutation({
    mutationFn: () => api.post("/api/rh/gardes", shiftForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh", "gardes"] });
      setShiftForm(emptyShift);
      setShowShiftForm(false);
      setError(null);
    },
    onError: reportError,
  });

  const computePayroll = useMutation({
    mutationFn: () =>
      api.post(
        "/api/rh/paie",
        payrollForm.type === "SALAIRE_FIXE"
          ? { type: "SALAIRE_FIXE", userId: payrollForm.userId, periode: payrollForm.periode, salaireBrut: Number(payrollForm.salaireBrut) }
          : { type: "RETROCESSION", userId: payrollForm.userId, periode: payrollForm.periode, retrocessionTaux: Number(payrollForm.retrocessionTaux) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh", "paie"] });
      setShowPayrollForm(false);
      setError(null);
    },
    onError: reportError,
  });

  const updatePayrollStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "VALIDE" | "PAYE" }) => api.patch(`/api/rh/paie/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rh", "paie"] }),
    onError: reportError,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">RH & gardes</h1>
        <p className="text-sm text-muted-foreground">Planning des gardes, paie fixe et rétrocessions</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Planning des gardes (30 prochains jours)</CardTitle>
          <Button size="sm" onClick={() => setShowShiftForm((v) => !v)}>{showShiftForm ? "Annuler" : "Nouvelle garde"}</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showShiftForm && (
            <div className="grid grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-2">
              <Select value={shiftForm.userId} onChange={(e) => setShiftForm({ ...shiftForm, userId: e.target.value })}>
                <option value="">Employé…</option>
                {usersData?.users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                ))}
              </Select>
              <Select value={shiftForm.periode} onChange={(e) => setShiftForm({ ...shiftForm, periode: e.target.value })}>
                <option value="JOUR">Jour</option>
                <option value="NUIT">Nuit</option>
              </Select>
              <Input type="datetime-local" value={shiftForm.startAt} onChange={(e) => setShiftForm({ ...shiftForm, startAt: e.target.value })} />
              <Input type="datetime-local" value={shiftForm.endAt} onChange={(e) => setShiftForm({ ...shiftForm, endAt: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={shiftForm.isAstreinte} onChange={(e) => setShiftForm({ ...shiftForm, isAstreinte: e.target.checked })} />
                Astreinte
              </label>
              <Button disabled={!shiftForm.userId || !shiftForm.startAt || !shiftForm.endAt || createShift.isPending} onClick={() => createShift.mutate()}>
                Ajouter
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Période</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftsData?.shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.user.firstName} {s.user.lastName}</TableCell>
                  <TableCell>{new Date(s.startAt).toLocaleString("fr-FR")}</TableCell>
                  <TableCell>{new Date(s.endAt).toLocaleString("fr-FR")}</TableCell>
                  <TableCell>
                    {s.periode === "JOUR" ? "Jour" : "Nuit"} {s.isAstreinte && <Badge variant="secondary" className="ml-1">Astreinte</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {shiftsData?.shifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Aucune garde planifiée</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Paie — {payrollForm.periode}</CardTitle>
          <Button size="sm" onClick={() => setShowPayrollForm((v) => !v)}>{showPayrollForm ? "Annuler" : "Calculer une paie"}</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="month" value={payrollForm.periode} onChange={(e) => setPayrollForm({ ...payrollForm, periode: e.target.value })} className="max-w-xs" />

          {showPayrollForm && (
            <div className="grid grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-2">
              <Select value={payrollForm.userId} onChange={(e) => setPayrollForm({ ...payrollForm, userId: e.target.value })}>
                <option value="">Employé…</option>
                {usersData?.users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                ))}
              </Select>
              <Select value={payrollForm.type} onChange={(e) => setPayrollForm({ ...payrollForm, type: e.target.value as "SALAIRE_FIXE" | "RETROCESSION" })}>
                <option value="SALAIRE_FIXE">Salaire fixe</option>
                <option value="RETROCESSION">Rétrocession (vacataire)</option>
              </Select>
              {payrollForm.type === "SALAIRE_FIXE" ? (
                <Input
                  type="number"
                  min="0"
                  placeholder="Salaire brut (FCFA)"
                  value={payrollForm.salaireBrut}
                  onChange={(e) => setPayrollForm({ ...payrollForm, salaireBrut: e.target.value })}
                />
              ) : (
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Taux de rétrocession (%)"
                  value={payrollForm.retrocessionTaux}
                  onChange={(e) => setPayrollForm({ ...payrollForm, retrocessionTaux: e.target.value })}
                />
              )}
              <Button disabled={!payrollForm.userId || computePayroll.isPending} onClick={() => computePayroll.mutate()}>
                Calculer
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Net à payer</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollsData?.payrolls.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.user.firstName} {p.user.lastName}</TableCell>
                  <TableCell>{p.type === "SALAIRE_FIXE" ? "Salaire fixe" : "Rétrocession"}</TableCell>
                  <TableCell>{p.netAPayer} FCFA</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "PAYE" ? "success" : p.status === "VALIDE" ? "default" : "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.status === "BROUILLON" && (
                      <Button size="sm" variant="outline" onClick={() => updatePayrollStatus.mutate({ id: p.id, status: "VALIDE" })}>Valider</Button>
                    )}
                    {p.status === "VALIDE" && (
                      <Button size="sm" variant="outline" onClick={() => updatePayrollStatus.mutate({ id: p.id, status: "PAYE" })}>Marquer payé</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {payrollsData?.payrolls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Aucune paie pour cette période</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
