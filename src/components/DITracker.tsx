import { MOCK_BL, getDISolde, type BonLivraison } from "@/lib/mockData";
import { AlertTriangle, TrendingDown, CheckCircle2, Receipt, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface DITrackerProps {
  dossierId: string;
  numeroDI?: string;
  montantDI?: number;
}

const DITracker = ({ dossierId, numeroDI, montantDI }: DITrackerProps) => {
  if (!numeroDI || !montantDI) return null;

  const { totalBL, solde, pourcentage } = getDISolde(dossierId);
  const bls = MOCK_BL.filter(bl => bl.dossierId === dossierId);
  const isAlerte = pourcentage <= 20;
  const isCritique = pourcentage <= 10;
  const consommePct = 100 - pourcentage;

  return (
    <div className="stat-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Receipt className="w-4 h-4 text-secondary" />
          Déclaration d'Importation
        </h3>
        {isAlerte && (
          <span className={`status-badge text-xs flex items-center gap-1 ${isCritique ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            <AlertTriangle className="w-3 h-3" />
            {isCritique ? "Critique" : "Seuil 20%"}
          </span>
        )}
      </div>

      {/* DI Number */}
      <div className="text-xs text-muted-foreground">
        N° DI : <span className="font-medium text-foreground">{numeroDI}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Consommé</span>
          <span className="font-medium text-foreground">{consommePct.toFixed(1)}%</span>
        </div>
        <div className="relative">
          <Progress
            value={consommePct}
            className={`h-3 ${isAlerte ? "[&>div]:bg-destructive" : consommePct > 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-success"}`}
          />
          {/* 80% threshold marker */}
          <div className="absolute top-0 left-[80%] w-0.5 h-3 bg-destructive/60" title="Seuil d'alerte (80% consommé)" />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0 FCFA</span>
          <span>{montantDI.toLocaleString("fr-FR")} FCFA</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/50 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Montant DI</p>
          <p className="text-xs font-bold text-foreground">{montantDI.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Total BL</p>
          <p className="text-xs font-bold text-foreground">{totalBL.toLocaleString("fr-FR")}</p>
        </div>
        <div className={`rounded-lg p-2 text-center ${isAlerte ? "bg-destructive/10" : "bg-success/10"}`}>
          <p className="text-[10px] text-muted-foreground">Solde restant</p>
          <p className={`text-xs font-bold ${isAlerte ? "text-destructive" : "text-success"}`}>
            {solde.toLocaleString("fr-FR")}
          </p>
        </div>
      </div>

      {/* Alert banner */}
      {isAlerte && (
        <div className={`rounded-lg p-3 flex items-start gap-2 ${isCritique ? "bg-destructive/10 border border-destructive/20" : "bg-amber-50 border border-amber-200"}`}>
          <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isCritique ? "text-destructive" : "text-amber-600"}`} />
          <div>
            <p className={`text-xs font-semibold ${isCritique ? "text-destructive" : "text-amber-700"}`}>
              {isCritique ? "Solde DI critique !" : "Solde DI bas — Alerte 20%"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Il reste {pourcentage.toFixed(1)}% du montant initial ({solde.toLocaleString("fr-FR")} FCFA).
              {isCritique ? " Action urgente requise." : " Surveillez les prochaines opérations."}
            </p>
          </div>
        </div>
      )}

      {/* BL list */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
          <TrendingDown className="w-3 h-3" /> Opérations BL ({bls.length})
        </p>
        {bls.map(bl => (
          <div key={bl.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{bl.numero}</span>
                <span className={`status-badge text-[10px] ${
                  bl.statut === "valide" ? "bg-green-100 text-green-700" :
                  bl.statut === "en_attente" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {bl.statut === "valide" ? "Validé" : bl.statut === "en_attente" ? "En attente" : "Annulé"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{bl.description}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {new Date(bl.date).toLocaleDateString("fr-FR")} • {bl.effectuePar}
              </p>
            </div>
            <span className={`font-medium ml-2 whitespace-nowrap ${bl.statut === "valide" ? "text-destructive" : "text-muted-foreground"}`}>
              -{bl.montant.toLocaleString("fr-FR")}
            </span>
          </div>
        ))}
        {bls.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Aucune opération BL enregistrée</p>
        )}
      </div>
    </div>
  );
};

export default DITracker;
