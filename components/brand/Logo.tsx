import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "mark" | "inline";
  tone?: "dark" | "light";
  className?: string;
};

/**
 * Logo officiel AxeHealth — seul point d'entrée pour afficher la marque.
 * "inline" = repère + nom sur une ligne (en-têtes, sidebars).
 * tone="light" à utiliser sur fond sombre (sidebar) : le repère passe sur une pastille papier.
 */
export function Logo({ variant = "inline", tone = "dark", className }: LogoProps) {
  if (variant === "full") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brand/axehealth-logo.png" alt="AxeHealth — Votre allié santé" className={cn("h-auto", className)} />;
  }
  if (variant === "mark") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brand/axehealth-mark.png" alt="AxeHealth" className={cn("h-auto", className)} />;
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/axehealth-mark.png"
        alt=""
        aria-hidden
        className={cn("h-8 w-auto", tone === "light" && "rounded-md bg-paper p-1")}
      />
      <span
        className={cn(
          "font-display text-xl tracking-tight",
          tone === "light" ? "text-sidebar-accent-foreground" : "text-navy dark:text-foreground",
        )}
      >
        <span className="font-extrabold">Axe</span>
        <span className="font-medium">Health</span>
      </span>
    </span>
  );
}

/** Ligne de battement du logo, élément décoratif réutilisable. */
export function PulseLine({ className, animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 600 80" fill="none" className={cn("w-full", className)} aria-hidden>
      <defs>
        <linearGradient id="pulse-grad" x1="0" x2="1">
          <stop offset="0" stopColor="hsl(var(--teal))" stopOpacity="0" />
          <stop offset="0.35" stopColor="hsl(var(--teal))" />
          <stop offset="1" stopColor="hsl(var(--pulse))" />
        </linearGradient>
      </defs>
      <path
        d="M0 50 H250 L268 30 L282 58 L300 6 L322 74 L342 22 L356 50 H600"
        stroke="url(#pulse-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={animated ? "1" : undefined}
        className={animated ? "animate-pulse-draw" : undefined}
      />
    </svg>
  );
}
