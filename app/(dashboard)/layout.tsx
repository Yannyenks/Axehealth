"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/stores/auth.store";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { AssistanceBanner } from "@/components/assistance-banner";
import { hexToHslTriplet, isValidHexColor } from "@/lib/color";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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

  // Un ADMIN qui n'a pas encore terminé /onboarding y est renvoyé avant de
  // pouvoir accéder au reste du tableau de bord — voir app/onboarding/layout.tsx.
  const needsOnboarding = !!user && user.role === "ADMIN" && !user.organization?.onboardingCompletedAt;

  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  if (!user || needsOnboarding) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  const primaryColor = user.organization?.primaryColor;
  const brandStyle = primaryColor && isValidHexColor(primaryColor) ? ({ "--primary": hexToHslTriplet(primaryColor) } as React.CSSProperties) : undefined;

  return (
    <div className="flex min-h-screen flex-col" style={brandStyle}>
      <AssistanceBanner />
      <div className="flex flex-1">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-8 print:bg-white print:p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
