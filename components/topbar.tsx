"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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
    <header className="flex h-16 items-center justify-between border-b bg-card px-6 print:hidden">
      <form onSubmit={handleSearch} className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un patient…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="text-right">
          <p className="text-sm font-medium leading-tight text-foreground">{user.firstName} {user.lastName}</p>
          <p className="text-xs leading-tight text-muted-foreground">{user.organization?.name}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials(user.firstName, user.lastName)}
        </div>
      </div>
    </header>
  );
}
