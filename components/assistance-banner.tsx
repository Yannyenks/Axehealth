"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

// Bandeau permanent, impossible à manquer, affiché tant qu'une session
// d'assistance super-admin est active (voir stores/auth.store.ts::impersonationActive)
// — rendu à la fois dans le dashboard et dans l'onboarding, puisqu'un
// établissement assisté peut être en cours d'onboarding.
export function AssistanceBanner() {
  const router = useRouter();
  const { user, impersonationActive, clear } = useAuthStore();
  const [exiting, setExiting] = useState(false);

  if (!impersonationActive) return null;

  async function handleExit() {
    setExiting(true);
    try {
      await api.post("/api/superadmin/assistance/exit");
      clear();
      router.push("/super-admin");
      router.refresh();
    } catch {
      clear();
      router.push("/login");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground print:hidden">
      <span className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        Mode assistance — vous agissez actuellement sur {user?.organization?.name ?? "cet établissement"}
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="rounded-md border border-warning-foreground/30 px-3 py-1 text-xs font-semibold hover:bg-warning-foreground/10 disabled:opacity-50"
      >
        {exiting ? "…" : "Quitter le mode assistance"}
      </button>
    </div>
  );
}
