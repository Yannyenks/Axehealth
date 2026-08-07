"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/stores/auth.store";
import { PlatformSidebar } from "@/components/platform-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

// Console plateforme: réservée aux vrais super-admins (jamais accessible en
// mode assistance, puisqu'une session d'assistance ne porte jamais
// isSuperAdmin — voir services/superadmin.service.ts). Tout autre profil est
// renvoyé vers son propre tableau de bord clinique.
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
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

  const notAllowed = !!user && !user.isSuperAdmin;

  useEffect(() => {
    if (notAllowed) router.replace("/dashboard");
  }, [notAllowed, router]);

  if (!user || notAllowed) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <PlatformSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6 print:hidden">
          <p className="text-sm text-muted-foreground">
            Connecté en tant que <span className="font-medium text-foreground">{user.firstName} {user.lastName}</span>
          </p>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/30 p-8 print:bg-white print:p-0">{children}</main>
      </div>
    </div>
  );
}
