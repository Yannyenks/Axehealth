"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PatientBrandedShell } from "@/components/patient-branded-shell";

export default function PatientSignupPage({ params }: { params: { orgSlug: string } }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sexe, setSexe] = useState<"M" | "F">("F");
  const [dateNaissance, setDateNaissance] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/patient/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationSlug: params.orgSlug, firstName, lastName, sexe, dateNaissance, phone: phone || undefined, email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        setError("Un compte existe déjà pour cette adresse email dans cet établissement.");
      } else if (body?.issues) {
        setError("Merci de vérifier les informations saisies.");
      } else {
        setError("Une erreur est survenue, veuillez réessayer.");
      }
      return;
    }

    router.push(`/patient/${params.orgSlug}/pre-consultation`);
  }

  return (
    <PatientBrandedShell orgSlug={params.orgSlug}>
      {() => (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-center">
            <h1 className="font-display text-xl font-bold">Créer mon espace patient</h1>
            <p className="text-sm text-muted-foreground">Pour démarrer une pré-consultation IA depuis chez vous.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium">Prénom</label>
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium">Nom</label>
              <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="sexe" className="text-sm font-medium">Sexe</label>
              <select id="sexe" value={sexe} onChange={(e) => setSexe(e.target.value as "M" | "F")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="dateNaissance" className="text-sm font-medium">Date de naissance</label>
              <input id="dateNaissance" type="date" required value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">Téléphone (optionnel)</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Mot de passe</label>
            <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {loading ? "Création…" : "Créer mon compte"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Déjà un compte ? <Link href={`/patient/${params.orgSlug}/login`} className="font-medium text-primary hover:underline">Se connecter</Link>
          </p>
        </form>
      )}
    </PatientBrandedShell>
  );
}
