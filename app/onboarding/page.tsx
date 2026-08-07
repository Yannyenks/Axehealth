"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@prisma/client";
import { Check, Upload } from "lucide-react";
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

const ALL_ROLES: Role[] = ["SECRETAIRE", "MEDECIN", "INFIRMIER", "PHARMACIEN", "BIOLOGISTE", "CAISSIER", "COMPTABLE", "RH"];
const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  SECRETAIRE: "Secrétaire",
  MEDECIN: "Médecin",
  INFIRMIER: "Infirmier",
  PHARMACIEN: "Pharmacien",
  BIOLOGISTE: "Biologiste",
  CAISSIER: "Caissier",
  COMPTABLE: "Comptable",
  RH: "RH",
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

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />
      {step === 1 && <BrandingStep onNext={() => setStep(2)} />}
      {step === 2 && <TeamStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <WelcomeStep onBack={() => setStep(2)} />}
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

function TeamStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const t = useTranslations("Onboarding.team");
  const tCommon = useTranslations("Onboarding");
  const [members, setMembers] = useState<{ email: string; firstName: string; lastName: string; role: Role; tempPassword: string }[]>([]);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: "SECRETAIRE" as Role });
  const [error, setError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () => api.post<{ user: { email: string; firstName: string; lastName: string; role: Role }; tempPassword: string }>("/api/team", form),
    onSuccess: (result) => {
      setMembers((prev) => [...prev, { ...result.user, tempPassword: result.tempPassword }]);
      setForm({ email: "", firstName: "", lastName: "", role: "SECRETAIRE" });
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
