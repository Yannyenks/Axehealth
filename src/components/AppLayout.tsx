import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import NotificationPanel from "./NotificationPanel";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const AppLayout = ({ children, title, subtitle }: AppLayoutProps) => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher un dossier..." className="pl-9 w-64 h-9 bg-muted/50 border-none text-sm" />
              </div>
              <NotificationPanel />
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">DG</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-foreground leading-tight">Mr DELBA</p>
                  <p className="text-[11px] text-muted-foreground">Directeur Général</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
