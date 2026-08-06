"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      if (res.status === 423) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Compte temporairement verrouillé");
      } else {
        setError("Identifiants invalides");
      }
      return;
    }

    const body = await res.json();
    if (body.mfaRequired) {
      setChallengeToken(body.challengeToken);
      return;
    }

    router.push("/");
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/mfa/verifier-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken, code: mfaCode }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Code invalide ou expiré");
      return;
    }

    router.push("/");
  }

  if (challengeToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-4">
        <form onSubmit={handleMfaSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8 shadow-sm">
          <div className="space-y-1 text-center">
            <h1 className="font-display text-2xl font-bold text-primary">Vérification en deux étapes</h1>
            <p className="text-sm text-muted-foreground">Saisissez le code de votre application d'authentification</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="mfaCode" className="text-sm font-medium">Code à 6 chiffres (ou code de secours)</label>
            <input
              id="mfaCode"
              required
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {loading ? "Vérification…" : "Valider"}
          </button>

          <button type="button" onClick={() => setChallengeToken(null)} className="w-full text-center text-sm text-muted-foreground hover:underline">
            Retour
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-2xl font-bold text-primary">AxeHealth</h1>
          <p className="text-sm text-muted-foreground">Connexion à votre espace clinique</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Mot de passe
          </label>
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
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Nouvelle clinique ? <Link href="/signup" className="font-medium text-primary hover:underline">Créer un espace</Link>
        </p>
      </form>
    </main>
  );
}
