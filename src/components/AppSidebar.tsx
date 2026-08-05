import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Ship, LayoutDashboard, FolderOpen, Users, Bell, DollarSign,
  MapPin, ChevronLeft, ChevronRight, LogOut, Settings, ClipboardList, MessageSquare, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_ALERTS } from "@/lib/mockData";

const unreadAlerts = MOCK_ALERTS.filter(a => !a.lu).length;

const navItems = [
  { label: "Tableau de bord", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Exploitation", icon: ClipboardList, path: "/exploitation" },
  { label: "Dossiers", icon: FolderOpen, path: "/dossiers" },
  { label: "Messagerie", icon: MessageSquare, path: "/messagerie" },
  { label: "Employés", icon: Users, path: "/employes" },
  { label: "Alertes", icon: Bell, path: "/alertes", badge: unreadAlerts },
  { label: "Finance", icon: DollarSign, path: "/finance" },
  { label: "Kribi", icon: MapPin, path: "/kribi" },
  { label: "Reporting", icon: BarChart3, path: "/reporting" },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar flex flex-col transition-all duration-300 sticky top-0",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Ship className="w-6 h-6 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-xl font-display font-bold text-sidebar-foreground tracking-tight">FINITRANS</span>
            <p className="text-[10px] text-sidebar-muted truncate">Transit & Dédouanement</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn("sidebar-item", isActive ? "sidebar-item-active" : "sidebar-item-inactive")}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 space-y-1 border-t border-sidebar-border">
        <NavLink to="/parametres" className={cn("sidebar-item", location.pathname === "/parametres" ? "sidebar-item-active" : "sidebar-item-inactive")} title={collapsed ? "Paramètres" : undefined}>
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Paramètres</span>}
        </NavLink>
        <NavLink to="/" className={cn("sidebar-item sidebar-item-inactive")} title={collapsed ? "Déconnexion" : undefined}>
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </NavLink>
        <button onClick={() => setCollapsed(!collapsed)} className="sidebar-item sidebar-item-inactive w-full">
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="text-xs">Réduire</span>}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
