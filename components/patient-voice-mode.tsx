"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, X, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id?: string;
  role: "PATIENT" | "IA";
  content: string;
}

interface SeverityInfo {
  label: string;
  description: string;
  className: string;
}

interface PatientVoiceModeProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isSending: boolean;
  done: boolean;
  severityInfo: SeverityInfo | null;
  onExit: () => void;
}

const VOICE_STORAGE_KEY = "axehealth_patient_voice_uri";
const PREVIEW_TEXT = "Bonjour, je suis votre assistant de pré-consultation. Décrivez-moi vos symptômes.";

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// Mode vocal immersif ("comme avec ChatGPT") — le patient parle, l'IA
// répond à voix haute. Reste volontairement isolé de la logique métier
// (envoi/réception des messages) : ce composant ne fait qu'écouter/parler,
// c'est app/patient/[orgSlug]/(portal)/pre-consultation/page.tsx qui pilote
// la conversation via `messages`/`onSendMessage`, identique au mode texte.
export function PatientVoiceMode({ messages, onSendMessage, isSending, done, severityInfo, onExit }: PatientVoiceModeProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const spokenCountRef = useRef(0);

  // La liste des voix se peuple de façon asynchrone (parfois après un délai)
  // — on écoute l'évènement dédié plutôt que de ne lire qu'au montage.
  useEffect(() => {
    function loadVoices() {
      const list = window.speechSynthesis.getVoices();
      if (list.length === 0) return;
      setVoices(list);
      setSelectedVoiceURI((current) => {
        if (current) return current;
        const stored = localStorage.getItem(VOICE_STORAGE_KEY);
        if (stored && list.some((v) => v.voiceURI === stored)) return stored;
        return (list.find((v) => v.lang.startsWith("fr")) ?? list[0])?.voiceURI ?? null;
      });
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  function speak(text: string) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.voiceURI === selectedVoiceURI);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "fr-FR";
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  // Prononce chaque nouvelle réponse IA une seule fois (spokenCountRef suit
  // le nombre de messages déjà traités, pas leur contenu — évite de reparler
  // au moindre re-render).
  useEffect(() => {
    if (messages.length <= spokenCountRef.current) return;
    const newMessages = messages.slice(spokenCountRef.current);
    spokenCountRef.current = messages.length;
    const lastAiMessage = [...newMessages].reverse().find((m) => m.role === "IA");
    if (lastAiMessage) speak(lastAiMessage.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  function toggleListening() {
    setMicError(null);

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    if (speaking) window.speechSynthesis.cancel(); // interruption façon conversation humaine

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setMicError("Reconnaissance vocale non prise en charge par ce navigateur.");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interim += result[0].transcript;
      }
      setInterimTranscript(interim);
      if (finalTranscript.trim()) {
        onSendMessage(finalTranscript.trim());
        setInterimTranscript("");
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setMicError(event.error === "not-allowed" ? "Accès au microphone refusé." : "Erreur de reconnaissance vocale.");
      }
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  const lastPatientMessage = [...messages].reverse().find((m) => m.role === "PATIENT");
  const lastAiMessage = [...messages].reverse().find((m) => m.role === "IA");

  const orbState = speaking ? "speaking" : listening ? "listening" : "idle";
  const orbAnimation = speaking ? "animate-[orb-speaking_1.4s_ease-in-out_infinite]" : listening ? "animate-[orb-listening_1.2s_ease-in-out_infinite]" : "animate-[orb-idle_3s_ease-in-out_infinite]";

  const frenchVoices = voices.filter((v) => v.lang.startsWith("fr"));
  const otherVoices = voices.filter((v) => !v.lang.startsWith("fr"));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ background: "radial-gradient(60% 45% at 50% 20%, hsl(var(--primary)) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex items-center gap-2 border-b bg-card/80 px-3 py-2.5 backdrop-blur-sm sm:px-4 sm:py-3">
        <div className="min-w-0 flex-1 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-destructive sm:px-3 sm:text-xs">
          Urgence vitale : appelez les secours immédiatement, n&apos;attendez pas l&apos;IA.
        </div>
        <button onClick={onExit} className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Quitter le mode vocal">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <div
          className={cn("relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full bg-primary shadow-2xl sm:h-64 sm:w-64", orbAnimation)}
          style={{ background: "radial-gradient(circle at 35% 30%, hsl(var(--primary)) 0%, hsl(var(--primary)) 55%, hsl(var(--primary) / 0.7) 100%)" }}
        >
          {isSending && !speaking && <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary-foreground/30 border-t-primary-foreground sm:h-16 sm:w-16" />}
        </div>

        <div className="max-w-lg space-y-3 text-center">
          {interimTranscript && <p className="text-base text-muted-foreground sm:text-lg">{interimTranscript}…</p>}
          {!interimTranscript && lastPatientMessage && <p className="text-sm text-muted-foreground">Vous : {lastPatientMessage.content}</p>}
          {lastAiMessage && <p className="font-display text-lg font-semibold sm:text-xl">{lastAiMessage.content}</p>}
          {!lastAiMessage && !interimTranscript && <p className="text-muted-foreground">Appuyez sur le micro et décrivez vos symptômes.</p>}
          {micError && <p className="text-sm text-destructive">{micError}</p>}
        </div>

        {done && severityInfo && (
          <div className={cn("max-w-lg rounded-md border p-4 text-sm", severityInfo.className)}>
            <p className="font-semibold">{severityInfo.label}</p>
            <p className="mt-1">{severityInfo.description}</p>
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 border-t bg-card/80 px-4 py-4 backdrop-blur-sm sm:gap-6 sm:px-6 sm:py-6">
        <div className="relative shrink-0">
          <button
            onClick={() => setShowVoicePicker((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent sm:px-4"
          >
            <Volume2 className="h-4 w-4" />
            <span className="hidden sm:inline">{voices.find((v) => v.voiceURI === selectedVoiceURI)?.name.split(" ")[0] ?? "Voix"}</span>
          </button>

          {showVoicePicker && (
            <div className="absolute bottom-full left-1/2 mb-2 max-h-72 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-y-auto rounded-lg border bg-card p-2 shadow-xl">
              {frenchVoices.length === 0 && otherVoices.length === 0 && <p className="p-2 text-sm text-muted-foreground">Aucune voix disponible.</p>}
              {frenchVoices.map((voice) => (
                <VoiceOption key={voice.voiceURI} voice={voice} selected={voice.voiceURI === selectedVoiceURI} onSelect={() => { setSelectedVoiceURI(voice.voiceURI); localStorage.setItem(VOICE_STORAGE_KEY, voice.voiceURI); setShowVoicePicker(false); }} onPreview={() => speak(PREVIEW_TEXT)} />
              ))}
              {otherVoices.length > 0 && frenchVoices.length > 0 && <div className="my-1 border-t" />}
              {otherVoices.map((voice) => (
                <VoiceOption key={voice.voiceURI} voice={voice} selected={voice.voiceURI === selectedVoiceURI} onSelect={() => { setSelectedVoiceURI(voice.voiceURI); localStorage.setItem(VOICE_STORAGE_KEY, voice.voiceURI); setShowVoicePicker(false); }} onPreview={() => speak(PREVIEW_TEXT)} />
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleListening}
          disabled={isSending || done}
          aria-label={listening ? "Arrêter l'écoute" : "Parler"}
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-full shadow-lg transition-all disabled:opacity-40",
            listening ? "scale-110 bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground hover:scale-105",
          )}
        >
          <Mic className="h-6 w-6" />
        </button>

        <button onClick={onExit} className="flex shrink-0 items-center gap-2 rounded-full border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent sm:px-4">
          <Keyboard className="h-4 w-4" />
          <span className="hidden sm:inline">Mode texte</span>
        </button>
      </div>
    </div>
  );
}

function VoiceOption({ voice, selected, onSelect, onPreview }: { voice: SpeechSynthesisVoice; selected: boolean; onSelect: () => void; onPreview: () => void }) {
  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm", selected ? "bg-accent text-accent-foreground" : "hover:bg-muted")}>
      <button onClick={onSelect} className="flex-1 truncate text-left">
        {voice.name} <span className="text-xs text-muted-foreground">({voice.lang})</span>
      </button>
      <button onClick={onPreview} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={`Écouter un extrait de ${voice.name}`}>
        <Volume2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
