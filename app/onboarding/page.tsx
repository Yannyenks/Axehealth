"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@prisma/client";
import { Check, Upload, Sparkles, ArrowRight } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { countryOptions } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ALL_ROLES: Role[] = ["COMPTABLE", "CAISSIER"];
const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  COMPTABLE: "Comptable",
  CAISSIER: "Caissier",
};

interface OrganizationDto {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  plan: "STARTER" | "PRO" | "ENTERPRISE";
}

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />
      {step === 1 && <BrandingStep onNext={() => setStep(2)} />}
      {step === 2 && <AuditStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <TeamStep onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <WelcomeStep onBack={() => setStep(3)} />}
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const t = useTranslations("Onboarding");
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("stepIndicator", { current: step, total: TOTAL_STEPS })}
      </p>
      <div className="flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
    </div>
  );
}

function BrandingStep({ onNext }: { onNext: () => void }) {
  const t = useTranslations("Onboarding.branding");
  const tCommon = useTranslations("Onboarding");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const countries = countryOptions(locale);

  const { data } = useQuery({
    queryKey: ["organization"],
    queryFn: () => api.get<{ organization: OrganizationDto }>("/api/organization"),
  });

  const [form, setForm] = useState<{ address: string; city: string; country: string; phone: string; email: string; primaryColor: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const org = data?.organization;
  const current = form ?? {
    address: org?.address ?? "",
    city: org?.city ?? "",
    country: org?.country ?? "CM",
    phone: org?.phone ?? "",
    email: org?.email ?? "",
    primaryColor: org?.primaryColor ?? "#0d9488",
  };
  const currentLogo = logoUrl ?? org?.logoUrl ?? null;

  const save = useMutation({
    mutationFn: () => api.patch("/api/organization", current),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      onNext();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/organization/logo", { method: "POST", body: formData, credentials: "include" });
    setUploading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? "Envoi du logo impossible");
      return;
    }

    const body: { organization: OrganizationDto } = await res.json();
    setLogoUrl(body.organization.logoUrl);
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          <Label>{t("logoLabel")}</Label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {currentLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <input id="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoChange} className="text-sm" disabled={uploading} />
              <p className="mt-1 text-xs text-muted-foreground">{uploading ? t("logoUploading") : t("logoHint")}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primaryColor">{t("colorLabel")}</Label>
          <input
            id="primaryColor"
            type="color"
            value={current.primaryColor}
            onChange={(e) => setForm({ ...current, primaryColor: e.target.value })}
            className="h-10 w-20 cursor-pointer rounded-md border border-input bg-background p-1"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="address">{t("address")}</Label>
            <Input id="address" value={current.address} onChange={(e) => setForm({ ...current, address: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">{t("city")}</Label>
            <Input id="city" value={current.city} onChange={(e) => setForm({ ...current, city: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">{t("country")}</Label>
            <Select id="country" value={current.country} onChange={(e) => setForm({ ...current, country: e.target.value })}>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" value={current.phone} onChange={(e) => setForm({ ...current, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="orgEmail">{t("email")}</Label>
            <Input id="orgEmail" type="email" value={current.email} onChange={(e) => setForm({ ...current, email: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>{tCommon("continue")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface BusinessAuditAnswers {
  secteurActivite: string;
  tailleEquipe: string;
  chiffreAffairesEstime: string;
  gestionComptableActuelle: string;
  principalDefiFinancier: string;
  obligationsFiscales: string;
}

interface BusinessAuditDiagnostic {
  secteurActivite: string;
  maturiteComptable: "DEBUTANT" | "INTERMEDIAIRE" | "AVANCE";
  principauxRisques: string[];
  prioritesRecommandees: string[];
  modulesRecommandes: string[];
  syntheseTexte: string;
}

const MATURITY_LABEL: Record<BusinessAuditDiagnostic["maturiteComptable"], string> = {
  DEBUTANT: "Comptabilité à structurer",
  INTERMEDIAIRE: "Comptabilité partiellement structurée",
  AVANCE: "Comptabilité déjà mature",
};

type AuditQuestion =
  | { key: keyof BusinessAuditAnswers; question: string; type: "select"; options: string[] }
  | { key: keyof BusinessAuditAnswers; question: string; type: "text"; placeholder: string; optional?: boolean };

const AUDIT_QUESTIONS: AuditQuestion[] = [
  {
    key: "secteurActivite",
    question: "Quel est le secteur d'activité principal de votre entreprise ?",
    type: "select",
    options: ["Commerce / Négoce", "Services", "Industrie / Production", "BTP / Construction", "Agriculture", "Technologie / IT", "Autre"],
  },
  {
    key: "tailleEquipe",
    question: "Combien de personnes travaillent dans votre entreprise ?",
    type: "select",
    options: ["1 (solo)", "2 à 5", "6 à 20", "21 à 50", "Plus de 50"],
  },
  {
    key: "chiffreAffairesEstime",
    question: "Quel est approximativement votre chiffre d'affaires annuel ?",
    type: "select",
    options: ["Moins de 10M XAF", "10M à 50M XAF", "50M à 200M XAF", "200M à 1Md XAF", "Plus de 1Md XAF"],
  },
  {
    key: "gestionComptableActuelle",
    question: "Comment gérez-vous votre comptabilité aujourd'hui ?",
    type: "select",
    options: ["Rien de structuré", "Excel / papier", "Un(e) comptable externe", "Un logiciel existant"],
  },
  {
    key: "principalDefiFinancier",
    question: "Quel est votre plus grand défi financier en ce moment ?",
    type: "text",
    placeholder: "Ex: suivre ma trésorerie, ne pas rater mes déclarations TVA, factures en retard…",
  },
  {
    key: "obligationsFiscales",
    question: "Des obligations fiscales particulières à surveiller (TVA, IS, CNPS…) ?",
    type: "text",
    placeholder: "Optionnel",
    optional: true,
  },
];

// Interview d'accueil menée par le copilote IA (voir services/business-audit.service.ts):
// une question à la fois, comme un expert-comptable qui prend connaissance
// d'un nouveau dossier client, pour produire un diagnostic qui personnalise
// le tableau de bord. Sautable à tout moment — jamais bloquant.
function AuditStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<BusinessAuditAnswers>({
    secteurActivite: "",
    tailleEquipe: "",
    chiffreAffairesEstime: "",
    gestionComptableActuelle: "",
    principalDefiFinancier: "",
    obligationsFiscales: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<BusinessAuditDiagnostic | null>(null);

  const submit = useMutation({
    mutationFn: () => api.post<{ organization: { businessProfile: BusinessAuditDiagnostic } }>("/api/organization/business-audit", answers),
    onSuccess: (result) => setDiagnostic(result.organization.businessProfile),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  if (diagnostic) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-amber-400">
              <Sparkles className="h-4 w-4 text-emerald-950" />
            </div>
            <CardTitle>Votre diagnostic</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">{diagnostic.syntheseTexte}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">{diagnostic.secteurActivite}</span>
            <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">{MATURITY_LABEL[diagnostic.maturiteComptable]}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium">Points de vigilance</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {diagnostic.principauxRisques.map((risque, i) => (
                  <li key={i}>• {risque}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium">Priorités recommandées</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {diagnostic.prioritesRecommandees.map((priorite, i) => (
                  <li key={i}>• {priorite}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onNext}>
              Continuer <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const current = AUDIT_QUESTIONS[index];
  const value = answers[current.key];
  const isLast = index === AUDIT_QUESTIONS.length - 1;
  const canAdvance = current.type === "text" && current.optional ? true : value.trim().length > 0;

  function handleNext() {
    if (isLast) {
      submit.mutate();
      return;
    }
    setIndex((i) => i + 1);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-amber-400">
            <Sparkles className="h-4 w-4 text-emerald-950" />
          </div>
          <CardTitle>Audit express par l'IA</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Quelques questions simples pour que votre tableau de bord soit personnalisé dès le premier jour.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-1.5">
          {AUDIT_QUESTIONS.map((_, i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full", i <= index ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">{current.question}</p>
        </div>

        {current.type === "select" ? (
          <Select value={value} onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}>
            <option value="">Sélectionner…</option>
            {current.options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        ) : (
          <Input
            value={value}
            placeholder={current.placeholder}
            onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
          />
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={index === 0 ? onBack : () => setIndex((i) => i - 1)}>
            {index === 0 ? "Retour" : "Précédent"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onNext}>Passer cette étape</Button>
            <Button disabled={!canAdvance || submit.isPending} onClick={handleNext}>
              {isLast ? (submit.isPending ? "Analyse en cours…" : "Obtenir mon diagnostic") : "Suivant"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const t = useTranslations("Onboarding.team");
  const tCommon = useTranslations("Onboarding");
  const [members, setMembers] = useState<{ email: string; firstName: string; lastName: string; role: Role; tempPassword: string }[]>([]);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: "CAISSIER" as Role });
  const [error, setError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () => api.post<{ user: { email: string; firstName: string; lastName: string; role: Role }; tempPassword: string }>("/api/team", form),
    onSuccess: (result) => {
      setMembers((prev) => [...prev, { ...result.user, tempPassword: result.tempPassword }]);
      setForm({ email: "", firstName: "", lastName: "", role: "CAISSIER" });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>{t("firstName")}</Label>
            <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("lastName")}</Label>
            <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("role")}</Label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABEL[role]}</option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-4">
            <Button
              size="sm"
              variant="outline"
              disabled={!form.email || !form.firstName || !form.lastName || invite.isPending}
              onClick={() => invite.mutate()}
            >
              {t("addButton")}
            </Button>
          </div>
        </div>

        {members.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("addedTitle")}</p>
            {members.map((m) => (
              <div key={m.email} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{m.firstName} {m.lastName} · {ROLE_LABEL[m.role]}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {t("credentialsNotice", { email: m.email, password: m.tempPassword })}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={onBack}>{tCommon("back")}</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onNext}>{tCommon("skip")}</Button>
            <Button onClick={onNext}>{tCommon("continue")}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WelcomeStep({ onBack }: { onBack: () => void }) {
  const t = useTranslations("Onboarding.welcome");
  const tPlans = useTranslations("Plans");
  const tCommon = useTranslations("Onboarding");
  const router = useRouter();
  const { user, impersonationActive, setUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["organization"],
    queryFn: () => api.get<{ organization: OrganizationDto }>("/api/organization"),
  });
  const { data: teamData } = useQuery({
    queryKey: ["team"],
    queryFn: () => api.get<{ members: unknown[] }>("/api/team"),
  });

  const complete = useMutation({
    mutationFn: () => api.post("/api/organization/onboarding"),
    onSuccess: () => {
      if (user) {
        setUser(
          {
            ...user,
            organization: user.organization ? { ...user.organization, onboardingCompletedAt: new Date().toISOString() } : user.organization,
          },
          impersonationActive,
        );
      }
      router.push("/dashboard");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  const org = data?.organization;
  const plan = PLAN_DEFINITIONS.find((p) => p.id === org?.plan) ?? PLAN_DEFINITIONS[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title", { name: user?.firstName ?? "" })}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-4 rounded-md border p-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-muted">
            {org?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-primary">{org?.name?.[0] ?? "A"}</span>
            )}
          </div>
          <div>
            <p className="font-display text-lg font-semibold">{org?.name}</p>
            <p className="text-sm text-muted-foreground">
              {t("planLabel")}: {tPlans(`${plan.id}.name`)} · {t("membersLabel")}: {teamData?.members.length ?? 1}
            </p>
          </div>
          <Check className="ml-auto h-6 w-6 text-success" />
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={onBack}>{tCommon("back")}</Button>
          <Button disabled={complete.isPending} onClick={() => complete.mutate()}>{t("cta")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
