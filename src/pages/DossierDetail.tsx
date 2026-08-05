import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { MOCK_DOSSIERS, MOCK_COMMENTS, MOCK_AUDIT, MOCK_DOCUMENTS, MOCK_INVOICES, STATUS_LABELS, STATUS_COLORS, STATUS_STEP, STATUS_RESPONSABLE } from "@/lib/mockData";
import {
  ArrowLeft, Ship, MapPin, Calendar, User, Package, FileText,
  Upload, MessageSquare, Clock, CheckCircle2, History, Send,
  Paperclip, DollarSign, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import DITracker from "@/components/DITracker";

const timelineSteps = [
  { key: "reception", label: "Réception & Enregistrement", resp: "Mme YASMINE" },
  { key: "codage", label: "Codage & Déclaration", resp: "Mme ODETTE" },
  { key: "validation", label: "Validation Douanière", resp: "Mme ODETTE" },
  { key: "paiement", label: "Paiement Droits & Taxes", resp: "Mr WANDALA" },
  { key: "bon_compagnie", label: "Bon Compagnie", resp: "Mr WANDALA" },
  { key: "operations_kribi", label: "Opérations Kribi", resp: "Mr ALIOU / RAPHAEL" },
  { key: "cloture", label: "Contrôle & Clôture", resp: "Mr SOUDI" },
];

const DossierDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dossier = MOCK_DOSSIERS.find((d) => d.id === id);
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState("timeline");

  if (!dossier) {
    return (
      <AppLayout title="Dossier introuvable">
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">Ce dossier n'existe pas.</p>
          <Button onClick={() => navigate("/dossiers")} variant="outline">Retour aux dossiers</Button>
        </div>
      </AppLayout>
    );
  }

  const currentStep = STATUS_STEP[dossier.status];
  const comments = MOCK_COMMENTS.filter(c => c.dossierId === dossier.id);
  const audit = MOCK_AUDIT.filter(a => a.dossierId === dossier.id);
  const documents = MOCK_DOCUMENTS.filter(d => d.dossierId === dossier.id);
  const invoices = MOCK_INVOICES.filter(i => i.dossierId === dossier.id);

  const handleValidateStep = () => {
    toast({ title: "Étape validée", description: `Passage de ${STATUS_LABELS[dossier.status]} signé numériquement` });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    toast({ title: "Commentaire ajouté", description: newComment.slice(0, 50) + "..." });
    setNewComment("");
  };

  const totalCost = (dossier.montantTaxes || 0) + (dossier.montantHonoraires || 0) + (dossier.montantRedevances || 0);

  return (
    <AppLayout title={dossier.numero} subtitle={`${dossier.client} — ${dossier.marchandise}`}>
      <button onClick={() => navigate("/dossiers")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Retour aux dossiers
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-foreground">Progression du dossier</h3>
              {dossier.status !== "cloture" && (
                <Button onClick={handleValidateStep} className="gap-2 bg-primary text-primary-foreground hover:opacity-90" size="sm">
                  <CheckCircle2 className="w-4 h-4" /> Valider l'étape
                </Button>
              )}
            </div>
            <div className="relative">
              {timelineSteps.map((step, i) => {
                const stepNum = i + 1;
                const isCompleted = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;
                const isPending = stepNum > currentStep;

                return (
                  <div key={step.key} className="flex gap-4 mb-6 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted ? "bg-success text-success-foreground" :
                        isCurrent ? "bg-secondary text-secondary-foreground ring-4 ring-secondary/20" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{stepNum}</span>}
                      </div>
                      {i < timelineSteps.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[24px] ${isCompleted ? "bg-success" : "bg-border"}`} />
                      )}
                    </div>
                    <div className={`pb-4 flex-1 ${isPending ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{step.label}</span>
                        {isCurrent && <span className={`status-badge ${STATUS_COLORS[dossier.status]}`}>En cours</span>}
                        {isCompleted && <span className="status-badge bg-green-100 text-green-700">✓ Signé</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.resp}</p>
                      {isCompleted && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Complété le {new Date(Date.now() - (currentStep - stepNum) * 86400000 * 2).toLocaleDateString("fr-FR")}
                          <span className="ml-2 text-success text-[10px]">Signature numérique validée</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs: Documents, Comments, History */}
          <div className="stat-card">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="documents" className="gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Documents ({documents.length})</TabsTrigger>
                <TabsTrigger value="commentaires" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Commentaires ({comments.length})</TabsTrigger>
                <TabsTrigger value="historique" className="gap-1.5"><History className="w-3.5 h-3.5" /> Historique ({audit.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="documents">
                <div className="space-y-2 mb-4">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                      <FileText className="w-4 h-4 text-secondary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground">{doc.nom}.{doc.type.toLowerCase()}</span>
                        <p className="text-xs text-muted-foreground">{doc.uploadePar} • {doc.dateUpload} • Étape: {STATUS_LABELS[doc.etape].split(" ")[0]}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{doc.taille}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="gap-2 w-full">
                  <Upload className="w-4 h-4" /> Ajouter un document
                </Button>
              </TabsContent>

              <TabsContent value="commentaires">
                <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                  {comments.map(c => (
                    <div key={c.id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-[9px] font-bold text-primary-foreground">{c.auteur.split(" ").pop()?.charAt(0)}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{c.auteur}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{new Date(c.date).toLocaleString("fr-FR")}</span>
                      </div>
                      <p className="text-sm text-foreground ml-8">{c.message}</p>
                    </div>
                  ))}
                  {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire</p>}
                </div>
                <div className="flex gap-2">
                  <Textarea placeholder="Ajouter un commentaire..." value={newComment} onChange={e => setNewComment(e.target.value)} className="bg-muted/50 h-20" />
                  <Button onClick={handleAddComment} className="self-end gap-1.5 bg-primary text-primary-foreground" size="sm">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="historique">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {audit.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <History className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{a.action}</p>
                        {a.details && <p className="text-xs text-secondary mt-0.5">{a.details}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{a.auteur} • {new Date(a.date).toLocaleString("fr-FR")}</p>
                      </div>
                    </div>
                  ))}
                  {audit.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune entrée</p>}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>

        {/* Sidebar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-6">
          <div className="stat-card space-y-4">
            <h3 className="font-display font-semibold text-foreground">Informations</h3>
            {[
              { icon: Package, label: "Marchandise", value: dossier.marchandise },
              { icon: Ship, label: "Compagnie", value: dossier.compagnie },
              { icon: FileText, label: "Conteneur", value: dossier.conteneur },
              { icon: MapPin, label: "Site", value: dossier.site },
              { icon: User, label: "Responsable", value: dossier.responsable },
              { icon: Calendar, label: "Création", value: new Date(dossier.dateCreation).toLocaleDateString("fr-FR") },
              { icon: Calendar, label: "Arrivée", value: new Date(dossier.dateArrivee).toLocaleDateString("fr-FR") },
              ...(dossier.numeroDI ? [{ icon: FileText, label: "N° DI", value: dossier.numeroDI }] : []),
              ...(dossier.dateLimiteSortie ? [{ icon: AlertTriangle, label: "Limite sortie", value: new Date(dossier.dateLimiteSortie).toLocaleDateString("fr-FR") }] : []),
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Financial summary */}
          <div className="stat-card">
            <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-secondary" /> Synthèse financière
            </h3>
            <div className="space-y-2">
              {dossier.montantTaxes && (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Droits & Taxes</span><span className="font-medium text-foreground">{dossier.montantTaxes.toLocaleString("fr-FR")} FCFA</span></div>
              )}
              {dossier.montantHonoraires && (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Honoraires</span><span className="font-medium text-foreground">{dossier.montantHonoraires.toLocaleString("fr-FR")} FCFA</span></div>
              )}
              {dossier.montantRedevances && (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Redevances</span><span className="font-medium text-foreground">{dossier.montantRedevances.toLocaleString("fr-FR")} FCFA</span></div>
              )}
              {totalCost > 0 && (
                <>
                  <div className="border-t border-border my-2" />
                  <div className="flex justify-between text-sm font-display font-bold"><span className="text-foreground">Total</span><span className="text-secondary">{totalCost.toLocaleString("fr-FR")} FCFA</span></div>
                </>
              )}
            </div>
            {/* Invoices for this dossier */}
            {invoices.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase">Factures</p>
                {invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                    <div>
                      <span className="text-foreground font-medium">{inv.numero}</span>
                      <span className={`ml-2 status-badge text-[10px] ${inv.type === "reglee" ? "bg-green-100 text-green-700" : inv.type === "validee" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                        {inv.type === "reglee" ? "Réglée" : inv.type === "validee" ? "Validée" : "Proforma"}
                      </span>
                    </div>
                    <span className="text-foreground">{inv.montant.toLocaleString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DI Tracker */}
          <DITracker dossierId={dossier.id} numeroDI={dossier.numeroDI} montantDI={dossier.montantDI} />

          {/* Priority */}
          <div className="stat-card">
            <h3 className="font-display font-semibold text-foreground mb-3">Priorité</h3>
            <span className={`status-badge text-sm ${
              dossier.priorite === "haute" ? "bg-red-100 text-red-700" :
              dossier.priorite === "moyenne" ? "bg-amber-100 text-amber-700" :
              "bg-green-100 text-green-700"
            }`}>
              {dossier.priorite.charAt(0).toUpperCase() + dossier.priorite.slice(1)}
            </span>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default DossierDetail;
