"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { PatientVoiceMode } from "@/components/patient-voice-mode";

interface PreConsultationSummary {
  id: string;
  status: "EN_COURS" | "EN_ATTENTE_REVUE" | "REVUE" | "CONVERTIE" | "ABANDONNEE";
  severity: "ROUGE" | "ORANGE" | "VERT" | null;
}

interface ChatMessage {
  id?: string;
  role: "PATIENT" | "IA";
  content: string;
}

const SEVERITY_INFO: Record<string, { label: string; description: string; className: string }> = {
  ROUGE: { label: "Urgence", description: "Appelez immédiatement les secours ou rendez-vous aux urgences les plus proches.", className: "border-destructive bg-destructive/10 text-destructive" },
  ORANGE: { label: "Téléconsultation / RDV rapproché recommandé", description: "L'équipe médicale va examiner votre pré-consultation et vous recontacter pour une prise en charge rapprochée.", className: "border-warning bg-warning/10 text-warning-foreground" },
  VERT: { label: "Conseil / RDV standard", description: "L'équipe médicale va examiner votre pré-consultation. Vous pouvez prendre rendez-vous normalement.", className: "border-success bg-success/10 text-success-foreground" },
};

// Reconnaissance vocale disponible uniquement sur Chrome/Edge (préfixe
// webkit) — on ne propose le mode vocal que si le navigateur le permet
// réellement, plutôt que d'afficher un bouton qui échouerait silencieusement.
function isVoiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

export default function PreConsultationChatPage() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [motifPatient, setMotifPatient] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<PreConsultationSummary["status"] | null>(null);
  const [severity, setSeverity] = useState<PreConsultationSummary["severity"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => setVoiceSupported(isVoiceSupported()), []);

  const { data: existingSessions, isLoading } = useQuery({
    queryKey: ["patient", "preconsultations"],
    queryFn: () => api.get<{ sessions: PreConsultationSummary[] }>("/api/patient/pre-consultations"),
  });

  useEffect(() => {
    if (!existingSessions || sessionId) return;
    const active = existingSessions.sessions.find((s) => s.status === "EN_COURS");
    if (!active) return;

    setSessionId(active.id);
    api
      .get<{ session: { messages: ChatMessage[]; status: PreConsultationSummary["status"] } }>(`/api/patient/pre-consultations/${active.id}`)
      .then((res) => {
        setMessages(res.session.messages);
        setStatus(res.session.status);
      })
      .catch(() => setError("Impossible de recharger votre pré-consultation en cours."));
  }, [existingSessions, sessionId]);

  const startSession = useMutation({
    mutationFn: () => api.post<{ session: { id: string } }>("/api/patient/pre-consultations", { motifPatient: motifPatient || undefined }),
    onSuccess: (data) => {
      setSessionId(data.session.id);
      setStatus("EN_COURS");
      queryClient.invalidateQueries({ queryKey: ["patient", "preconsultations"] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => api.post<{ reply: string; done: boolean; severity?: PreConsultationSummary["severity"] }>(`/api/patient/pre-consultations/${sessionId}/messages`, { content }),
    onSuccess: (result) => {
      setMessages((prev) => [...prev, { role: "IA", content: result.reply }]);
      if (result.done) {
        setStatus("EN_ATTENTE_REVUE");
        setSeverity(result.severity ?? null);
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 503) {
        setError("Le service de pré-consultation IA est momentanément indisponible. En cas de symptôme préoccupant, contactez directement votre établissement ou les urgences.");
      } else {
        setError("Une erreur est survenue lors de l'envoi de votre message. Veuillez réessayer.");
      }
      // Le message patient a bien été enregistré côté serveur avant l'appel
      // IA (voir services/pre-consultation.service.ts) — un nouvel envoi ne
      // le dupliquera pas, on peut donc laisser le patient réessayer.
    },
  });

  // Point d'entrée unique pour poster un message, qu'il vienne du formulaire
  // texte ou du micro (components/patient-voice-mode.tsx) — les deux modes
  // pilotent la même conversation/mutation, jamais deux flux séparés.
  function sendUserMessage(content: string) {
    if (!content.trim() || !sessionId) return;
    setError(null);
    setMessages((prev) => [...prev, { role: "PATIENT", content }]);
    sendMessage.mutate(content);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendUserMessage(input);
    setInput("");
  }

  const emergencyBanner = (
    <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive">
      En cas d&apos;urgence vitale, appelez immédiatement les secours ou rendez-vous aux urgences les plus proches — n&apos;attendez pas la réponse de l&apos;assistant IA.
    </div>
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Chargement…</div>;
  }

  if (!sessionId) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center space-y-4">
        {emergencyBanner}
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold">Nouvelle pré-consultation</h1>
          <p className="mt-2 text-sm text-muted-foreground">Décrivez brièvement le motif de votre consultation, puis échangez avec notre assistant IA — au clavier ou à voix haute — pour évaluer l&apos;urgence de votre situation.</p>

          <div className="mt-5 space-y-2">
            <label htmlFor="motif" className="text-sm font-medium">Motif (optionnel)</label>
            <input
              id="motif"
              value={motifPatient}
              onChange={(e) => setMotifPatient(e.target.value)}
              placeholder="ex: toux persistante depuis 3 jours"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            onClick={() => startSession.mutate()}
            disabled={startSession.isPending}
            className="mt-5 w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {startSession.isPending ? "Démarrage…" : "Démarrer la pré-consultation"}
          </button>
        </div>
      </div>
    );
  }

  if (voiceMode) {
    return (
      <PatientVoiceMode
        messages={messages}
        onSendMessage={sendUserMessage}
        isSending={sendMessage.isPending}
        done={status === "EN_ATTENTE_REVUE"}
        severityInfo={severity ? SEVERITY_INFO[severity] : null}
        onExit={() => setVoiceMode(false)}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {emergencyBanner}
        {voiceSupported && status === "EN_COURS" && (
          <button
            onClick={() => setVoiceMode(true)}
            className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Mic className="h-4 w-4" />
            Parler avec l&apos;IA
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border bg-card p-6 shadow-sm">
        {messages.length === 0 && <p className="text-sm text-muted-foreground">Décrivez vos symptômes pour commencer.</p>}
        {messages.map((m, i) => (
          <div key={m.id ?? i} className={`flex ${m.role === "PATIENT" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${m.role === "PATIENT" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {status === "EN_ATTENTE_REVUE" && severity && (
        <div className={`rounded-md border p-4 text-sm ${SEVERITY_INFO[severity].className}`}>
          <p className="font-semibold">{SEVERITY_INFO[severity].label}</p>
          <p className="mt-1">{SEVERITY_INFO[severity].description}</p>
        </div>
      )}

      {status === "EN_COURS" && (
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Écrivez votre message…"
            disabled={sendMessage.isPending}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button type="submit" disabled={sendMessage.isPending || !input.trim()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {sendMessage.isPending ? "Envoi…" : "Envoyer"}
          </button>
        </form>
      )}
    </div>
  );
}
