import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { MOCK_CONVERSATIONS, MOCK_MESSAGES, MOCK_DOSSIERS } from "@/lib/mockData";
import { MessageSquare, Send, Users, FolderOpen, AlertTriangle, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const typeIcons = { dossier: FolderOpen, general: Users, urgence: AlertTriangle };
const typeColors = { dossier: "text-secondary", general: "text-muted-foreground", urgence: "text-destructive" };

const Messagerie = () => {
  const [selectedConv, setSelectedConv] = useState(MOCK_CONVERSATIONS[0].id);
  const [newMessage, setNewMessage] = useState("");
  const [searchConv, setSearchConv] = useState("");

  const conv = MOCK_CONVERSATIONS.find(c => c.id === selectedConv)!;
  const messages = MOCK_MESSAGES.filter(m => m.conversationId === selectedConv);

  const filteredConvs = MOCK_CONVERSATIONS.filter(c =>
    searchConv === "" || c.titre.toLowerCase().includes(searchConv.toLowerCase())
  );

  const handleSend = () => {
    if (!newMessage.trim()) return;
    toast({ title: "Message envoyé", description: newMessage.slice(0, 50) + "..." });
    setNewMessage("");
  };

  return (
    <AppLayout title="Espace d'Échange" subtitle="Messagerie interne — Discussions par dossier et équipe">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 stat-card overflow-hidden p-0 h-[calc(100vh-180px)]">
        {/* Sidebar conversations */}
        <div className="border-r border-border flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={searchConv} onChange={e => setSearchConv(e.target.value)} className="pl-8 h-8 text-xs bg-muted/50" />
              </div>
              <Button size="sm" className="h-8 w-8 p-0 bg-primary text-primary-foreground">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.map((c) => {
              const Icon = typeIcons[c.type];
              const unread = MOCK_MESSAGES.filter(m => m.conversationId === c.id && !m.lu).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedConv(c.id)}
                  className={cn(
                    "w-full text-left p-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                    selectedConv === c.id && "bg-muted"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", typeColors[c.type])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground truncate">{c.titre}</span>
                        {unread > 0 && (
                          <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.dernierMessage}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] text-muted-foreground">{c.participants.length} participants</span>
                        <span className="text-[9px] text-muted-foreground">• {new Date(c.dateUpdate).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-display font-semibold text-foreground">{conv.titre}</h3>
                <p className="text-[10px] text-muted-foreground">{conv.participants.join(", ")}</p>
              </div>
              {conv.dossierId && (
                <a href={`/dossiers/${conv.dossierId}`} className="text-[10px] text-secondary hover:underline flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" /> Voir le dossier
                </a>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => {
              const isMine = m.auteur === "Mr SOUDI"; // Current user mock
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn("flex", isMine ? "justify-end" : "justify-start")}
                >
                  <div className={cn(
                    "max-w-[70%] rounded-xl p-3",
                    isMine ? "bg-primary text-primary-foreground" : "bg-muted/80"
                  )}>
                    {!isMine && (
                      <p className="text-[10px] font-semibold mb-1 opacity-70">{m.auteur}</p>
                    )}
                    <p className="text-sm">{m.contenu}</p>
                    <p className={cn("text-[9px] mt-1", isMine ? "opacity-60" : "text-muted-foreground")}>
                      {new Date(m.date).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                placeholder="Écrire un message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                className="bg-muted/50 h-16 resize-none"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <Button onClick={handleSend} className="self-end bg-primary text-primary-foreground" size="sm">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Messagerie;
