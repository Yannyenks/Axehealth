"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, ShieldCheck } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo, PulseLine } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mise en page alignée sur le design system (src/routes/auth.tsx) : panneau de marque
// sombre à gauche (desktop), formulaire à droite. Seule la présentation a changé ;
// la logique de connexion et de vérification MFA est inchangée.
export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Auth.login");
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
        setError(body?.message ?? t("locked"));
      } else {
        setError(t("invalidCredentials"));
      }
      return;
    }

    const body = await res.json();
    if (body.mfaRequired) {
      setChallengeToken(body.challengeToken);
      return;
    }

    router.push("/dashboard");
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
      setError(t("mfaInvalid"));
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Panneau de marque : visible à partir de lg, comme dans le design system */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="absolute inset-0 bg-gradient-brand opacity-[0.12]" aria-hidden />
        <Logo tone="light" />
        <div className="relative space-y-6">
          <h2 className="font-display text-4xl font-bold leading-tight text-sidebar-accent-foreground">
            {t("brandTitle")}
          </h2>
          <PulseLine className="max-w-md" />
          <p className="max-w-md text-sidebar-foreground/70">{t("brandText")}</p>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">© AxeHealth</p>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:justify-end">
            <Link href="/" className="lg:hidden">
              <Logo />
            </Link>
            <LocaleSwitcher />
          </div>

          {challengeToken ? (
            <form onSubmit={handleMfaSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-8 shadow-soft">
              <div className="space-y-1 text-center">
                <ShieldCheck className="mx-auto size-10 text-teal" />
                <h1 className="mt-3 text-2xl font-bold text-navy">{t("mfaTitle")}</h1>
                <p className="text-sm text-muted-foreground">{t("mfaSubtitle")}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mfaCode">{t("mfaCode")}</Label>
                <Input
                  id="mfaCode"
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="h-11 text-center text-lg tracking-widest"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                {t("mfaSubmit")}
              </Button>

              <button
                type="button"
                onClick={() => setChallengeToken(null)}
                className="w-full text-center text-sm font-semibold text-teal hover:underline"
              >
                {t("mfaBack")}
              </button>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-navy">{t("title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {loading ? t("submitting") : t("submit")}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t("noAccount")}{" "}
                <Link href="/signup" className="font-semibold text-teal hover:underline">
                  {t("createSpace")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
