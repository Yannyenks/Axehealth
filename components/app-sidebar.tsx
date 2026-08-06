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
  ScrollText,
  Settings,
  BellRing,
  ShieldCheck,
  FlaskConical,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { PERMISSIONS } from "@/lib/rbac";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: readonly Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Un seul groupe est affiché par défaut ("Pilotage") pour les rôles n'ayant
// accès à rien d'autre ; les groupes vides après filtrage par rôle
// disparaissent entièrement (jamais un titre de section sans liens dessous).
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/", label: "Tableau de bord", icon: LayoutDashboard, roles: PERMISSIONS.dashboards.read },
      { href: "/alertes", label: "Alertes", icon: BellRing, roles: PERMISSIONS.alertes.manage },
    ],
  },
  {
    label: "Soins",
    items: [
      { href: "/patients", label: "Patients (DPI)", icon: Users, roles: PERMISSIONS.patients.read },
      { href: "/consultations", label: "Consultations", icon: Stethoscope, roles: PERMISSIONS.consultations.read },
      { href: "/laboratoire", label: "Laboratoire", icon: FlaskConical, roles: PERMISSIONS.laboratoire.read },
      { href: "/hospitalisation", label: "Hospitalisation", icon: BedDouble, roles: PERMISSIONS.hospitalisation.read },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/caisse", label: "Caisse", icon: Wallet, roles: PERMISSIONS.caisse.encaisser },
      { href: "/factures", label: "Factures", icon: Receipt, roles: PERMISSIONS.factures.read },
      { href: "/assurances", label: "Tiers-payant", icon: ShieldCheck, roles: PERMISSIONS.assurances.read },
    ],
  },
  {
    label: "Logistique",
    items: [{ href: "/pharmacie", label: "Pharmacie", icon: Pill, roles: PERMISSIONS.pharmacie.read }],
  },
  {
    label: "Administration",
    items: [
      { href: "/rh", label: "RH & congés", icon: UserCog, roles: PERMISSIONS.conges.demander },
      { href: "/audit", label: "Journal d'audit", icon: ScrollText, roles: ["ADMIN"] },
      { href: "/parametres", label: "Paramètres", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, clear } = useAuthStore();

  if (!user) return null;

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(user.role)),
  })).filter((group) => group.items.length > 0);

  async function handleLogout() {
    await api.post("/api/auth/logout");
    clear();
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-screen w-64 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">A</div>
        <div>
          <p className="font-display text-base font-bold leading-tight text-white">AxeHealth</p>
          <p className="text-[11px] leading-tight text-sidebar-muted">ERP Santé — Édition Entreprise</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 px-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
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
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
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
