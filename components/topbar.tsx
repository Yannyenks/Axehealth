"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { ThemeToggle } from "@/components/theme-toggle";

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function Topbar() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [q, setQ] = useState("");

  if (!user) return null;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/patients?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-8 print:hidden">
      <form onSubmit={handleSearch} className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un patient…"
          className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      <div className="flex items-center gap-3">
        {user.isSuperAdmin && (
          <Link
            href="/super-admin"
            className="flex items-center gap-1.5 rounded-xl border border-warning/40 bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning-foreground hover:brightness-95"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Console plateforme
          </Link>
        )}
        <ThemeToggle />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold leading-tight text-navy dark:text-foreground">{user.firstName} {user.lastName}</p>
          <p className="text-xs leading-tight text-muted-foreground">{user.organization?.name}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-full bg-gradient-brand font-display text-sm font-bold text-paper">
          {initials(user.firstName, user.lastName)}
        </div>
      </div>
    </header>
  );
}
