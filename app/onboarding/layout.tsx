"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/stores/auth.store";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AssistanceBanner } from "@/components/assistance-banner";

// Assistant d'onboarding: réservé à l'ADMIN qui vient de créer son
// établissement, tant qu'il n'a pas été marqué comme terminé — voir
// services/organization.service.ts::completeOnboarding. Tout autre profil
// (déjà onboardé, ou membre non-admin invité en cours de route) est renvoyé
// directement sur le tableau de bord.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser, clear } = useAuthStore();

  const { data, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<{ user: AuthUser; impersonation: { active: boolean } }>("/api/auth/me"),
    retry: false,
  });

  useEffect(() => {
    if (data?.user) setUser(data.user, data.impersonation.active);
  }, [data, setUser]);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      clear();
      router.push("/login");
    }
  }, [error, clear, router]);

  const shouldSkip = !!user && (user.role !== "ADMIN" || !!user.organization?.onboardingCompletedAt);

  useEffect(() => {
    if (shouldSkip) router.replace("/dashboard");
  }, [shouldSkip, router]);

  if (!user || shouldSkip) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <AssistanceBanner />
      <header className="flex items-center justify-between border-b bg-card px-6 py-4">
        <span className="font-display text-xl font-bold text-primary">AxeCompta</span>
        <LocaleSwitcher />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">{children}</main>
    </div>
  );
}
