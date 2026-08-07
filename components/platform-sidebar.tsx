"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, ShieldCheck, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

const NAV_ITEMS = [{ href: "/super-admin", label: "Vue d'ensemble", icon: LayoutDashboard }];

// Shell dédié à la console plateforme — délibérément distinct de AppSidebar
// (aucun module clinique, pas de branding d'établissement) pour qu'un
// super-admin sache immédiatement qu'il est sorti du contexte d'une clinique
// pour piloter la plateforme AxeHealth elle-même.
export function PlatformSidebar() {
  const pathname = usePathname();
  const { clear } = useAuthStore();

  async function handleLogout() {
    await api.post("/api/auth/logout");
    clear();
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-screen w-64 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground print:hidden">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-warning text-warning-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-base font-bold leading-tight text-white">AxeHealth</p>
          <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-warning">Console plateforme</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-sidebar-border px-3 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Building2 className="h-4 w-4" />
          Retour à mon espace clinique
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
