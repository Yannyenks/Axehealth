"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  sexe: "M" | "F";
  dateNaissance: string;
  phone: string | null;
}

const emptyForm = { firstName: "", lastName: "", sexe: "F" as "M" | "F", dateNaissance: "", phone: "" };

export default function PatientsPage() {
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["patients", q],
    queryFn: () => api.get<{ patients: Patient[] }>(`/api/patients?q=${encodeURIComponent(q)}`),
  });

  const createPatient = useMutation({
    mutationFn: () => api.post("/api/patients", { ...form, dateNaissance: form.dateNaissance }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Patients</h1>
          <p className="text-sm text-muted-foreground">Dossier patient informatisé</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annuler" : "Nouveau patient"}</Button>
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
            <div className="flex items-end sm:col-span-2">
              <Button
                disabled={!form.firstName || !form.lastName || !form.dateNaissance || createPatient.isPending}
                onClick={() => createPatient.mutate()}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.patients.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.patientNumber}</TableCell>
                  <TableCell>{p.firstName} {p.lastName}</TableCell>
                  <TableCell>{p.sexe}</TableCell>
                  <TableCell>{new Date(p.dateNaissance).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>{p.phone ?? "—"}</TableCell>
                </TableRow>
              ))}
              {data?.patients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Aucun patient trouvé</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
