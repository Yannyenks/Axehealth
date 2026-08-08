"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { OrgPlan } from "@prisma/client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { countryOptions } from "@/lib/countries";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations("Auth.signup");
  const tPlans = useTranslations("Plans");
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
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-5 rounded-lg border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-primary">AxeHealth</Link>
          <LocaleSwitcher />
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationName">{t("organizationName")}</Label>
          <input
            id="organizationName"
            required
            value={form.organizationName}
            onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">{t("city")}</Label>
            <input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">{t("country")}</Label>
            <Select id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("firstName")}</Label>
            <input
              id="firstName"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t("lastName")}</Label>
            <input
              id="lastName"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        </div>

        <div className="space-y-2">
          <Label>{t("planLabel")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {PLAN_DEFINITIONS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setForm({ ...form, plan: plan.id })}
                className={cn(
                  "relative rounded-md border p-3 text-left text-xs transition-colors",
                  form.plan === plan.id ? "border-primary bg-primary/5" : "border-input hover:bg-muted",
                )}
              >
                {form.plan === plan.id && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />}
                <p className="font-semibold">{tPlans(`${plan.id}.name`)}</p>
                <p className="mt-0.5 text-muted-foreground">{tPlans(`${plan.id}.tagline`)}</p>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? t("submitting") : t("submit")}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          {t("haveAccount")} <Link href="/login" className="font-medium text-primary hover:underline">{t("login")}</Link>
        </p>
      </form>
    </main>
  );
}
