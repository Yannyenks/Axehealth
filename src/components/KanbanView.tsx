import { MOCK_DOSSIERS, STATUS_LABELS, STATUS_COLORS, type DossierStatus } from "@/lib/mockData";
import { useNavigate } from "react-router-dom";
import { Ship, MapPin } from "lucide-react";
import { motion } from "framer-motion";

const columns: DossierStatus[] = ["reception", "codage", "validation", "paiement", "bon_compagnie", "operations_kribi", "cloture"];

const KanbanView = () => {
  const navigate = useNavigate();

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[60vh]">
      {columns.map(status => {
        const dossiers = MOCK_DOSSIERS.filter(d => d.status === status);
        return (
          <div key={status} className="min-w-[240px] w-[240px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`status-badge ${STATUS_COLORS[status]}`}>
                {STATUS_LABELS[status].split(" ")[0]}
              </span>
              <span className="text-xs font-medium text-muted-foreground">{dossiers.length}</span>
            </div>
            <div className="space-y-2">
              {dossiers.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="stat-card p-3 cursor-pointer hover:border-secondary/50"
                  onClick={() => navigate(`/dossiers/${d.id}`)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-display font-bold text-foreground">{d.numero}</span>
                    <span className={`w-2 h-2 rounded-full ${
                      d.priorite === "haute" ? "bg-destructive" : d.priorite === "moyenne" ? "bg-warning" : "bg-success"
                    }`} />
                  </div>
                  <p className="text-xs text-foreground truncate">{d.client}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{d.marchandise}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground font-mono">{d.conteneur.slice(-7)}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {d.site === "Kribi" ? <MapPin className="w-2.5 h-2.5" /> : <Ship className="w-2.5 h-2.5" />}
                      {d.site}
                    </span>
                  </div>
                </motion.div>
              ))}
              {dossiers.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground opacity-50">Aucun dossier</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanView;
