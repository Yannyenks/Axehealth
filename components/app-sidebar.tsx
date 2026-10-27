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
  FileBarChart,
  LogOut,
  Network,
  Siren,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { PERMISSIONS } from "@/lib/rbac";
import { PreConsultationRougeBadge } from "@/components/preconsultation-rouge-badge";
import { Logo, PulseLine } from "@/components/brand/Logo";

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
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: PERMISSIONS.dashboards.read },
      { href: "/alertes", label: "Alertes", icon: BellRing, roles: PERMISSIONS.alertes.manage },
      { href: "/rapports", label: "Rapports RMA / SNIS", icon: FileBarChart, roles: PERMISSIONS.dashboards.read },
    ],
  },
  {
    label: "Soins",
    items: [
      { href: "/patients", label: "Patients (DPI)", icon: Users, roles: PERMISSIONS.patients.read },
      { href: "/preconsultations", label: "Pré-consultations IA", icon: Siren, roles: PERMISSIONS.preconsultations.read },
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
      { href: "/groupe", label: "Comparatif inter-cliniques", icon: Network, roles: PERMISSIONS.groupe.read },
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

  const org = user.organization;

  return (
    // Colonne fixe : seule la zone de navigation défile, l'en-tête et la déconnexion restent visibles.
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground print:hidden">
      {/* En-tête de marque : logo officiel, ligne de pouls, puis l'établissement */}
      <div className="shrink-0 space-y-4 px-5 pb-5 pt-6">
        <Logo tone="light" />
        <PulseLine className="h-5 w-full" />
        <div className="flex items-center gap-2.5">
          {org?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-brand text-sm font-bold text-paper">
              {(org?.name ?? "A")[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold leading-tight text-sidebar-accent-foreground">{org?.name ?? "AxeHealth"}</p>
            <p className="text-[11px] leading-tight text-sidebar-muted">Propulsé par AxeHealth</p>
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-4 [scrollbar-color:hsl(var(--sidebar-border))_transparent] [scrollbar-width:thin]">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="eyebrow mb-1 px-3 text-[10px] text-sidebar-muted">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-primary"
                        : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {item.href === "/preconsultations" && <PreConsultationRougeBadge />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-4">
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
