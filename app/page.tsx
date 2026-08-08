import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Users,
  Wallet,
  Pill,
  BedDouble,
  UserCog,
  ScrollText,
  CloudOff,
  Building2,
  ArrowRight,
  Check,
} from "lucide-react";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { DnaHelix } from "@/components/landing/dna-helix";

const FEATURE_ICONS = {
  patients: Users,
  caisse: Wallet,
  pharmacie: Pill,
  hospitalisation: BedDouble,
  rh: UserCog,
  audit: ScrollText,
  offline: CloudOff,
  multiEtablissement: Building2,
} as const;

export default async function LandingPage() {
  const t = await getTranslations("Landing");
  const tPlans = await getTranslations("Plans");

  const featureKeys = Object.keys(FEATURE_ICONS) as (keyof typeof FEATURE_ICONS)[];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl font-bold text-primary">AxeHealth</span>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
            <a href="#features" className="hover:text-foreground">{t("nav.features")}</a>
            <a href="#pricing" className="hover:text-foreground">{t("nav.pricing")}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">{t("nav.login")}</Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {t("nav.cta")}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_60%)]" />
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <DnaHelix />
          <p className="mb-4 mt-2 inline-block rounded-full border bg-muted px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("hero.eyebrow")}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{t("hero.title")}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
            >
              {t("hero.ctaPrimary")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border px-6 py-3 text-sm font-semibold hover:bg-muted"
            >
              {t("hero.ctaSecondary")}
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("hero.ctaHint")}</p>
        </div>
      </section>

      <section id="features" className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold">{t("features.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("features.subtitle")}</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureKeys.map((key) => {
              const Icon = FEATURE_ICONS[key];
              return (
                <div key={key} className="rounded-lg border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-sm font-semibold">{t(`features.items.${key}.title`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`features.items.${key}.description`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold">{t("pricing.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {PLAN_DEFINITIONS.map((plan, i) => (
              <div
                key={plan.id}
                className={`flex flex-col rounded-lg border p-6 ${i === 1 ? "border-primary shadow-md" : "shadow-sm"}`}
              >
                <h3 className="font-display text-lg font-semibold">{tPlans(`${plan.id}.name`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tPlans(`${plan.id}.tagline`)}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {[0, 1, 2].map((idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{tPlans(`${plan.id}.highlights.${idx}`)}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ${
                    i === 1 ? "bg-primary text-primary-foreground hover:opacity-90" : "border hover:bg-muted"
                  }`}
                >
                  {t("pricing.cta", { plan: tPlans(`${plan.id}.name`) })}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <div>
            <p className="font-display font-semibold text-foreground">AxeHealth</p>
            <p>{t("footer.tagline")}</p>
          </div>
          <p>© {new Date().getFullYear()} AxeStack Technologies — {t("footer.rights")}</p>
        </div>
      </footer>
    </div>
  );
}
