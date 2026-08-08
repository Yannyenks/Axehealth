"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { CfoAssistantChat } from "./CfoAssistantChat";

// Copilote flottant, accessible depuis n'importe quel écran du tableau de
// bord (voir app/(dashboard)/layout.tsx) — jamais bloquant: replié par
// défaut, il n'occupe qu'une bulle en bas à droite tant que l'utilisateur ne
// l'ouvre pas explicitement.
export function CfoAssistantFloating() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 print:hidden">
      {open && (
        <div className="mb-3 h-[32rem] w-[23rem] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-lg shadow-2xl">
          <CfoAssistantChat />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer l'assistant CFO" : "Ouvrir l'assistant CFO"}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-amber-400 text-emerald-950 shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </div>
  );
}
