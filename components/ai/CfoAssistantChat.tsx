"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  contenu: string;
}

interface ChatResponse {
  conversationId: string;
  message: { id: string; role: "ASSISTANT"; contenu: string };
}

// Copilote IA financier — questions sur la trésorerie, une écriture ou une
// règle fiscale SYSCOHADA/CGI. Chaque échange est persisté côté serveur
// (voir app/api/ai/chat/route.ts) mais l'affichage reste optimiste: le
// message utilisateur apparaît avant la réponse du modèle.
export function CfoAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const { mutate: sendMessage, isPending, error } = useMutation({
    mutationFn: (contenu: string) => api.post<ChatResponse>("/api/ai/chat", { conversationId, message: contenu }),
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { id: data.message.id, role: "ASSISTANT", contenu: data.message.contenu }]);
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const contenu = input.trim();
    if (!contenu || isPending) return;

    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "USER", contenu }]);
    setInput("");
    sendMessage(contenu);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-emerald-900/40 bg-[#0b1310] text-emerald-50 shadow-lg">
      <div className="flex items-center gap-2 border-b border-emerald-900/40 bg-gradient-to-r from-emerald-950 to-[#0b1310] px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-amber-400">
          <Sparkles className="h-4 w-4 text-emerald-950" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-emerald-50">Assistant CFO</p>
          <p className="text-xs text-emerald-400/70">SYSCOHADA · CGI · Trésorerie</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-emerald-400/60">
            Posez une question sur vos comptes, une écriture ou une règle fiscale OHADA.
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={cn("flex gap-2", message.role === "USER" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                message.role === "USER" ? "bg-emerald-800" : "bg-gradient-to-br from-emerald-400 to-amber-400",
              )}
            >
              {message.role === "USER" ? (
                <User className="h-3.5 w-3.5 text-emerald-100" />
              ) : (
                <Bot className="h-3.5 w-3.5 text-emerald-950" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
                message.role === "USER"
                  ? "bg-emerald-800/70 text-emerald-50"
                  : "border border-emerald-900/50 bg-emerald-950/60 text-emerald-100",
              )}
            >
              {message.contenu}
            </div>
          </div>
        ))}
        {isPending && (
          <div className="flex items-center gap-2 text-xs text-emerald-400/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            L&apos;assistant réfléchit...
          </div>
        )}
        {error && (
          <p className="text-xs text-red-400">
            {error instanceof ApiError ? error.message : "Une erreur est survenue, réessayez."}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-emerald-900/40 bg-[#0b1310] p-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          placeholder="Ex: Quelle écriture pour une facture d'électricité de 45 000 XAF ?"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-md border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || isPending}
          className="bg-gradient-to-br from-emerald-500 to-amber-400 text-emerald-950 hover:opacity-90"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
