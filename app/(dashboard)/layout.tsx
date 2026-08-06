"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/stores/auth.store";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser, clear } = useAuthStore();

  const { data, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<{ user: AuthUser }>("/api/auth/me"),
    retry: false,
  });

  useEffect(() => {
    if (data?.user) setUser(data.user);
  }, [data, setUser]);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      clear();
      router.push("/login");
    }
  }, [error, clear, router]);

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-8 print:bg-white print:p-0">{children}</main>
      </div>
    </div>
  );
}
