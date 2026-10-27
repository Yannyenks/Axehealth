"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { OrgPlan } from "@prisma/client";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { countryOptions } from "@/lib/countries";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo, PulseLine } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

// Même mise en page que la connexion (design system) : panneau de marque à gauche,
// formulaire à droite. La logique d'inscription (champs, plan, appel API) est inchangée.
export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations("Auth.signup");
  const tPlans = useTranslations("Plans");
  const tLogin = useTranslations("Auth.login");
  const locale = useLocale();

  const [form, setForm] = useState({
    organizationName: "",
    city: "",
    country: "CM",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    plan: "STARTER" as OrgPlan,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const countries = countryOptions(locale);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? t("genericError"));
      return;
    }

    router.push("/onboarding");
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Panneau de marque : identique à la connexion */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="absolute inset-0 bg-gradient-brand opacity-[0.12]" aria-hidden />
        <Logo tone="light" />
        <div className="relative space-y-6">
          <h2 className="font-display text-4xl font-bold leading-tight text-sidebar-accent-foreground">{tLogin("brandTitle")}</h2>
          <PulseLine className="max-w-md" />
          <p className="max-w-md text-sidebar-foreground/70">{tLogin("brandText")}</p>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">© AxeHealth</p>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex items-center justify-between lg:justify-end">
            <Link href="/" className="lg:hidden">
              <Logo />
            </Link>
            <LocaleSwitcher />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-8 shadow-soft">
            <div className="space-y-1">
              <h1 className="font-display text-2xl font-bold text-navy">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="organizationName">{t("organizationName")}</Label>
              <Input
                id="organizationName"
                required
                value={form.organizationName}
                onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">{t("city")}</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">{t("country")}</Label>
                <Select id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">{t("firstName")}</Label>
                <Input id="firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">{t("lastName")}</Label>
                <Input id="lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("planLabel")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {PLAN_DEFINITIONS.map((plan) => {
                  const selected = form.plan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setForm({ ...form, plan: plan.id })}
                      className={cn(
                        "relative rounded-xl border p-3 text-left text-xs transition-all",
                        selected ? "border-teal bg-secondary shadow-soft" : "border-input bg-card hover:border-teal/50",
                      )}
                    >
                      {selected && <Check className="absolute right-2 top-2 size-3.5 text-teal" />}
                      <p className="font-display text-sm font-semibold text-navy">{tPlans(`${plan.id}.name`)}</p>
                      <p className="mt-0.5 text-muted-foreground">{tPlans(`${plan.id}.tagline`)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" variant="brand" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? t("submitting") : t("submit")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("haveAccount")}{" "}
              <Link href="/login" className="font-semibold text-teal hover:underline">
                {t("login")}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
