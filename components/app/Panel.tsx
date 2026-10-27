import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Carte de section du design system : titre navy, surface ombrée douce. */
export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-soft", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-base font-bold text-navy">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Indicateur clé (KPI) du design system : libellé, icône, grande valeur display. */
export function Kpi({ label, value, hint, icon: Icon, tone = "teal" }: { label: string; value: string; hint?: string; icon: LucideIcon; tone?: "teal" | "warning" | "critical" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            tone === "teal" && "bg-secondary text-teal",
            tone === "warning" && "bg-warning-soft text-warning-foreground",
            tone === "critical" && "bg-critical-soft text-critical",
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs font-medium text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** État vide : texte discret centré dans la section. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
