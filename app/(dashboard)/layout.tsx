"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/stores/auth.store";
import { AppSidebar, NAV_GROUPS } from "@/components/app-sidebar";
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

  // Chaque profil n'atteint que les modules de son menu (matrice dans lib/rbac.ts).
  // Une page hors menu n'est pas filtrée ici : son API applique déjà les droits.
  const pathname = usePathname();
  const modules = NAV_GROUPS.flatMap((group) => group.items);
  const moduleAt = (path: string) => modules.find((m) => path === m.href || path.startsWith(`${m.href}/`));
  const pathAllowed = !user || !moduleAt(pathname) || moduleAt(pathname)!.roles.includes(user.role);
  const homeHref = user ? (modules.find((m) => m.roles.includes(user.role))?.href ?? "/dashboard") : "/dashboard";

  useEffect(() => {
    if (user && !pathAllowed) router.replace(homeHref);
  }, [user, pathAllowed, homeHref, router]);

  if (!user || needsOnboarding || !pathAllowed) {
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
          <main className="flex-1 overflow-y-auto bg-background px-4 py-6 md:px-8 md:py-8 print:bg-white print:p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
