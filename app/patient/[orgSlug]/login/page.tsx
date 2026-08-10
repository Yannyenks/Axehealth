"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PatientBrandedShell } from "@/components/patient-branded-shell";

export default function PatientLoginPage({ params }: { params: { orgSlug: string } }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/patient/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationSlug: params.orgSlug, email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      if (res.status === 423) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Compte temporairement verrouillé.");
      } else {
        setError("Email ou mot de passe incorrect.");
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
            <h1 className="font-display text-xl font-bold">Connexion</h1>
            <p className="text-sm text-muted-foreground">Accédez à votre pré-consultation.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Mot de passe</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ? <Link href={`/patient/${params.orgSlug}/signup`} className="font-medium text-primary hover:underline">Créer mon espace</Link>
          </p>
        </form>
      )}
    </PatientBrandedShell>
  );
}
