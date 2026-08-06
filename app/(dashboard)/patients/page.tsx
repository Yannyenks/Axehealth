"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  sexe: "M" | "F";
  dateNaissance: string;
  phone: string | null;
  allergies?: string[];
  insuranceProvider?: { name: string } | null;
}

interface Provider {
  id: string;
  name: string;
}

interface DuplicateMatch {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
}

const emptyForm = { firstName: "", lastName: "", sexe: "F" as "M" | "F", dateNaissance: "", phone: "", insuranceProviderId: "", insuranceNumber: "" };

export default function PatientsPage() {
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["patients", q],
    queryFn: () => api.get<{ patients: Patient[] }>(`/api/patients?q=${encodeURIComponent(q)}`),
  });

  const { data: providersData } = useQuery({
    queryKey: ["assurances", "prestataires"],
    queryFn: () => api.get<{ providers: Provider[] }>("/api/assurances/prestataires"),
  });

  const createPatient = useMutation({
    mutationFn: (force?: boolean) =>
      api.post("/api/patients", {
        ...form,
        insuranceProviderId: form.insuranceProviderId || undefined,
        insuranceNumber: form.insuranceNumber || undefined,
        force,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setForm(emptyForm);
      setShowForm(false);
      setDuplicates(null);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        setDuplicates((e.body as { duplicates: DuplicateMatch[] }).duplicates);
      }
    },
  });

  const updatePhone = useMutation({
    mutationFn: (id: string) => api.patch(`/api/patients/${id}`, { phone: editPhone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setEditingId(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Patients</h1>
          <p className="text-sm text-muted-foreground">Dossier patient informatisé</p>
        </div>
        <Button onClick={() => { setShowForm((v) => !v); setDuplicates(null); }}>{showForm ? "Annuler" : "Nouveau patient"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Nom</Label>
              <Input id="lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sexe">Sexe</Label>
              <Select id="sexe" value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value as "M" | "F" })}>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateNaissance">Date de naissance</Label>
              <Input id="dateNaissance" type="date" value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insuranceProviderId">Assurance (tiers-payant)</Label>
              <Select id="insuranceProviderId" value={form.insuranceProviderId} onChange={(e) => setForm({ ...form, insuranceProviderId: e.target.value })}>
                <option value="">Aucune — 100% à la charge du patient</option>
                {providersData?.providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            {form.insuranceProviderId && (
              <div className="space-y-1.5">
                <Label htmlFor="insuranceNumber">N° d'adhérent</Label>
                <Input id="insuranceNumber" value={form.insuranceNumber} onChange={(e) => setForm({ ...form, insuranceNumber: e.target.value })} />
              </div>
            )}

            {duplicates && duplicates.length > 0 && (
              <div className="space-y-2 rounded-md border border-warning bg-warning/10 p-3 sm:col-span-2">
                <p className="text-sm font-medium text-foreground">
                  Patient(s) similaire(s) déjà enregistré(s) — vérifiez avant de continuer :
                </p>
                <ul className="text-sm text-muted-foreground">
                  {duplicates.map((d) => (
                    <li key={d.id}>{d.patientNumber} — {d.firstName} {d.lastName}</li>
                  ))}
                </ul>
                <Button size="sm" variant="secondary" onClick={() => createPatient.mutate(true)}>
                  Créer quand même un nouveau dossier
                </Button>
              </div>
            )}

            <div className="flex items-end sm:col-span-2">
              <Button
                disabled={!form.firstName || !form.lastName || !form.dateNaissance || createPatient.isPending}
                onClick={() => createPatient.mutate(undefined)}
              >
                {createPatient.isPending ? "Création…" : "Créer le patient"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Input placeholder="Rechercher par nom, numéro ou téléphone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° patient</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Sexe</TableHead>
                <TableHead>Date de naissance</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Assurance</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.patients.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.patientNumber}</TableCell>
                  <TableCell>{p.firstName} {p.lastName}</TableCell>
                  <TableCell>{p.sexe}</TableCell>
                  <TableCell>{new Date(p.dateNaissance).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>
                    {editingId === p.id ? (
                      <div className="flex gap-1">
                        <Input className="h-8 w-32" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                        <Button size="sm" disabled={updatePhone.isPending} onClick={() => updatePhone.mutate(p.id)}>OK</Button>
                      </div>
                    ) : (
                      p.phone ?? "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {p.insuranceProvider?.name ? <Badge variant="secondary">{p.insuranceProvider.name}</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    {editingId !== p.id && (
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(p.id); setEditPhone(p.phone ?? ""); }}>
                        Modifier le téléphone
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data?.patients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Aucun patient trouvé</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
