"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Wallet,
  Pill,
  BedDouble,
  UserCog,
  Receipt,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, roles: ["ADMIN"] },
  { href: "/patients", label: "Patients", icon: Users, roles: ["ADMIN", "SECRETAIRE", "MEDECIN", "INFIRMIER", "CAISSIER", "PHARMACIEN"] },
  { href: "/consultations", label: "Consultations", icon: Stethoscope, roles: ["ADMIN", "MEDECIN", "INFIRMIER", "SECRETAIRE"] },
  { href: "/caisse", label: "Caisse", icon: Wallet, roles: ["ADMIN", "CAISSIER"] },
  { href: "/factures", label: "Factures", icon: Receipt, roles: ["ADMIN", "CAISSIER", "COMPTABLE", "SECRETAIRE"] },
  { href: "/pharmacie", label: "Pharmacie", icon: Pill, roles: ["ADMIN", "PHARMACIEN", "MEDECIN"] },
  { href: "/hospitalisation", label: "Hospitalisation", icon: BedDouble, roles: ["ADMIN", "MEDECIN", "INFIRMIER"] },
  { href: "/rh", label: "RH", icon: UserCog, roles: ["ADMIN", "RH"] },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, clear } = useAuthStore();

  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  async function handleLogout() {
    await api.post("/api/auth/logout");
    clear();
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-6">
        <p className="font-display text-xl font-bold text-white">AxeHealth</p>
        <p className="text-xs text-sidebar-muted">{user.organization?.name ?? "Clinique"}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="mb-2 px-3">
          <p className="truncate text-sm font-medium text-white">{user.firstName} {user.lastName}</p>
          <p className="text-xs text-sidebar-muted">{user.role}</p>
        </div>
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
