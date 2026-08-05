import AppLayout from "@/components/AppLayout";
import { EMPLOYEES, MOCK_DOSSIERS, EMPLOYEE_PERFORMANCE } from "@/lib/mockData";
import { User, MapPin, FolderOpen, Clock, TrendingUp, Mail, ChevronRight, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const Employes = () => {
  const navigate = useNavigate();

  return (
    <AppLayout title="Espace Employés" subtitle="Performance et suivi individuel — 8 collaborateurs">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {EMPLOYEE_PERFORMANCE.map((emp, i) => (
          <motion.div
            key={emp.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="stat-card cursor-pointer hover:border-secondary/50"
            onClick={() => navigate(`/employes/${encodeURIComponent(emp.name)}`)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-foreground">{emp.name.split(" ").pop()?.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-display font-bold text-foreground truncate">{emp.name}</h3>
                  <p className="text-xs text-muted-foreground">{emp.role}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="w-3 h-3" /> {emp.site}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-display font-bold text-foreground">{emp.dossiersActifs}</div>
                <div className="text-[10px] text-muted-foreground">Actifs</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-display font-bold text-success">{emp.dossiersClotures}</div>
                <div className="text-[10px] text-muted-foreground">Clôturés</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-display font-bold text-destructive">{emp.enRetard}</div>
                <div className="text-[10px] text-muted-foreground">Retard</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-display font-bold text-foreground">{emp.delaiMoyenHeures}h</div>
                <div className="text-[10px] text-muted-foreground">Délai</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Rendement</span>
                <span className="font-display font-bold text-foreground">{emp.rendement}%</span>
              </div>
              <Progress value={emp.rendement} className="h-1.5" />
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
};

export default Employes;
