import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { MOCK_DOSSIERS, MOCK_GATE_PASSES, MOCK_BONS_KRIBI, KRIBI_PROFILES, STATUS_LABELS, STATUS_COLORS, isDossierEnRetard, getRetardJours } from "@/lib/mockData";
import { MapPin, Ship, FileText, Camera, Send, Phone, Truck, Clock, ClipboardList, Shield, Anchor, Building, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";

const bonTypeLabel = { douane: "Bon Douane", compagnie_pak: "Bon Compagnie (PAK)", portuaire_pad: "Bon Portuaire (PAD)" };
const bonTypeIcon = { douane: Shield, compagnie_pak: Anchor, portuaire_pad: Building };
const bonTypeColor = { douane: "text-secondary", compagnie_pak: "text-accent", portuaire_pad: "text-warning" };
const bonStatutColor = { emis: "bg-amber-100 text-amber-700", valide: "bg-blue-100 text-blue-700", utilise: "bg-green-100 text-green-700", expire: "bg-red-100 text-red-700" };
const bonStatutLabel = { emis: "Émis", valide: "Validé", utilise: "Utilisé", expire: "Expiré" };

const Kribi = () => {
  const kribiDossiers = MOCK_DOSSIERS.filter(d => d.site === "Kribi");
  const [gpOpen, setGpOpen] = useState(false);
  const [gpForm, setGpForm] = useState({ chauffeur: "", telephone: "", destination: "" });
  const [rapport, setRapport] = useState("");
  const [profilFilter, setProfilFilter] = useState<"all" | "Mr ALIOU" | "Mr RAPHAEL">("all");

  const handleCreateGP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpForm.chauffeur || !gpForm.telephone) {
      toast({ title: "Champs requis", description: "Chauffeur et téléphone obligatoires", variant: "destructive" });
      return;
    }
    toast({ title: "Gate-pass créé", description: `GP-KRI-2025-${Math.floor(Math.random() * 9000 + 1000)} — ${gpForm.chauffeur}` });
    setGpOpen(false);
    setGpForm({ chauffeur: "", telephone: "", destination: "" });
  };

  const filteredBons = profilFilter === "all"
    ? MOCK_BONS_KRIBI
    : MOCK_BONS_KRIBI.filter(b => b.responsable === profilFilter);

  return (
    <AppLayout title="Module Kribi" subtitle="Opérations terrain — PAK / PAD">
      {/* Profils Kribi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {Object.entries(KRIBI_PROFILES).map(([name, profile], i) => (
          <motion.div key={name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={`stat-card cursor-pointer transition-all ${profilFilter === name ? "ring-2 ring-secondary" : "hover:bg-muted/50"}`}
            onClick={() => setProfilFilter(profilFilter === name ? "all" : name as any)}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-display font-semibold text-foreground">{name}</h4>
                <p className="text-xs text-muted-foreground">{profile.role}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.responsabilites.map(r => (
                    <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{r}</span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {MOCK_BONS_KRIBI.filter(b => b.responsable === name).length} bons gérés
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="bons">
        <TabsList className="mb-4">
          <TabsTrigger value="bons" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Bons ({filteredBons.length})</TabsTrigger>
          <TabsTrigger value="dossiers" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Dossiers ({kribiDossiers.length})</TabsTrigger>
          <TabsTrigger value="gatepasses" className="gap-1.5"><Truck className="w-3.5 h-3.5" /> Gate-Pass ({MOCK_GATE_PASSES.length})</TabsTrigger>
          <TabsTrigger value="rapport" className="gap-1.5"><Send className="w-3.5 h-3.5" /> Rapport</TabsTrigger>
        </TabsList>

        {/* Bons: Douane, Compagnie PAK, Portuaire PAD */}
        <TabsContent value="bons">
          {profilFilter !== "all" && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtré par : <strong className="text-foreground">{profilFilter}</strong></span>
              <button onClick={() => setProfilFilter("all")} className="text-xs text-secondary hover:underline">Voir tout</button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(["douane", "compagnie_pak", "portuaire_pad"] as const).map(type => {
              const bons = filteredBons.filter(b => b.type === type);
              const Icon = bonTypeIcon[type];
              return (
                <div key={type} className="stat-card">
                  <h4 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${bonTypeColor[type]}`} />
                    {bonTypeLabel[type]} ({bons.length})
                  </h4>
                  <div className="space-y-2">
                    {bons.map(bon => (
                      <div key={bon.id} className="p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-foreground">{bon.numero}</span>
                          <span className={`status-badge text-[10px] ${bonStatutColor[bon.statut]}`}>{bonStatutLabel[bon.statut]}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{bon.description}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground">{bon.dossierNumero} • {bon.responsable}</span>
                          {bon.montant && <span className="text-[10px] font-medium text-foreground">{bon.montant.toLocaleString("fr-FR")} FCFA</span>}
                        </div>
                      </div>
                    ))}
                    {bons.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Aucun bon</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Dossiers Kribi */}
        <TabsContent value="dossiers">
          <div className="max-w-2xl space-y-4">
            {kribiDossiers.map((d, i) => {
              const enRetard = isDossierEnRetard(d);
              const retardJours = getRetardJours(d);
              return (
                <motion.div key={d.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className={`stat-card ${enRetard ? "border border-destructive/30 bg-destructive/5" : ""}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <a href={`/dossiers/${d.id}`} className="text-sm font-display font-bold text-foreground hover:text-secondary">{d.numero}</a>
                        <span className={`status-badge ${enRetard ? "bg-red-100 text-red-700" : STATUS_COLORS[d.status]}`}>
                          {enRetard ? `EN RETARD +${retardJours}j` : STATUS_LABELS[d.status]}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{d.client}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.marchandise} — {d.compagnie}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" /> Kribi
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Ship className="w-3 h-3" />
                    <span className="font-mono">{d.conteneur}</span>
                    <span>•</span>
                    <span>Resp: {d.responsable}</span>
                    {d.dateLimiteSortie && (
                      <>
                        <span>•</span>
                        <span className={`flex items-center gap-1 ${enRetard ? "text-destructive font-semibold" : ""}`}>
                          <Clock className="w-3 h-3" /> Limite: {d.dateLimiteSortie}
                        </span>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* Gate-Pass */}
        <TabsContent value="gatepasses">
          <div className="max-w-2xl space-y-4">
            <Dialog open={gpOpen} onOpenChange={setGpOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary text-primary-foreground mb-2">
                  <FileText className="w-4 h-4" /> Nouveau Gate-Pass
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card sm:max-w-md">
                <DialogHeader><DialogTitle className="font-display">Nouveau Gate-Pass</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateGP} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Nom du chauffeur *</Label>
                    <Input placeholder="Ex: Emmanuel NDJOCK" value={gpForm.chauffeur} onChange={e => setGpForm({...gpForm, chauffeur: e.target.value})} className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Téléphone *</Label>
                    <Input placeholder="+237 6XX XXX XXX" value={gpForm.telephone} onChange={e => setGpForm({...gpForm, telephone: e.target.value})} className="bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Destination</Label>
                    <Input placeholder="Ex: Douala — Entrepôt client" value={gpForm.destination} onChange={e => setGpForm({...gpForm, destination: e.target.value})} className="bg-muted/50" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setGpOpen(false)}>Annuler</Button>
                    <Button type="submit" className="bg-primary text-primary-foreground">Créer & Transmettre</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            {MOCK_GATE_PASSES.map((gp, i) => (
              <motion.div key={gp.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="stat-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-display font-bold text-foreground">{gp.numero}</span>
                      <span className={`status-badge ${gp.statut === "utilise" ? "bg-green-100 text-green-700" : gp.statut === "transmis" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {gp.statut === "utilise" ? "Utilisé" : gp.statut === "transmis" ? "Transmis" : "Émis"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{gp.conteneur}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{gp.dateEmission}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> {gp.chauffeur}</div>
                  <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {gp.telephone}</div>
                  <div className="flex items-center gap-1.5 col-span-2"><MapPin className="w-3.5 h-3.5" /> {gp.destination}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Rapport */}
        <TabsContent value="rapport">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
              <h3 className="font-display font-semibold text-foreground mb-1">Compte rendu journalier</h3>
              <p className="text-sm text-muted-foreground mb-4">Résumé des opérations à Kribi</p>
              <Textarea
                placeholder="Décrivez les opérations réalisées aujourd'hui..."
                value={rapport}
                onChange={e => setRapport(e.target.value)}
                className="bg-muted/50 h-40 mb-4"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Date: {new Date().toLocaleDateString("fr-FR")}</p>
                <Button onClick={() => { if (rapport.trim()) { toast({ title: "Rapport envoyé" }); setRapport(""); } }} className="gap-2 bg-primary text-primary-foreground">
                  <Send className="w-4 h-4" /> Envoyer à Douala
                </Button>
              </div>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Kribi;
