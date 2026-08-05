import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { EMPLOYEES, MOCK_DOSSIERS, MOCK_AUDIT, STATUS_LABELS, STATUS_COLORS, EMPLOYEE_PERFORMANCE } from "@/lib/mockData";
import { ArrowLeft, FolderOpen, Clock, TrendingUp, AlertTriangle, Mail, Phone, MapPin, CheckCircle2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

const EmployeDetail = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name || "");
  const employee = EMPLOYEES.find(e => e.name === decodedName);
  const perf = EMPLOYEE_PERFORMANCE.find(e => e.name === decodedName);

  if (!employee || !perf) {
    return (
      <AppLayout title="Employé introuvable">
        <Button onClick={() => navigate("/employes")} variant="outline">Retour</Button>
      </AppLayout>
    );
  }

  const mesDossiers = MOCK_DOSSIERS.filter(d => d.responsable === employee.name);
  const mesActions = MOCK_AUDIT.filter(a => a.auteur === employee.name).slice(0, 8);

  return (
    <AppLayout title={employee.name} subtitle={`${employee.role} — ${employee.site}`}>
      <button onClick={() => navigate("/employes")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Dossiers actifs", value: perf.dossiersActifs, icon: FolderOpen, color: "text-secondary" },
              { label: "Clôturés", value: perf.dossiersClotures, icon: CheckCircle2, color: "text-success" },
              { label: "En retard", value: perf.enRetard, icon: AlertTriangle, color: "text-destructive" },
              { label: "Délai moy.", value: `${perf.delaiMoyenHeures}h`, icon: Clock, color: "text-warning" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card text-center">
                <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
                <div className="text-xl font-display font-bold text-foreground">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Performance gauges */}
          <div className="stat-card">
            <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-secondary" /> Indicateurs de performance
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Rendement</span>
                  <span className="font-display font-bold text-foreground">{perf.rendement}%</span>
                </div>
                <Progress value={perf.rendement} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Taux de retard</span>
                  <span className="font-display font-bold text-foreground">{perf.tauxRetard}%</span>
                </div>
                <Progress value={perf.tauxRetard} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Charge de travail</span>
                  <span className="font-display font-bold text-foreground">{perf.dossiersActifs}/5</span>
                </div>
                <Progress value={(perf.dossiersActifs / 5) * 100} className="h-2" />
              </div>
            </div>
          </div>

          {/* My dossiers */}
          <div className="stat-card">
            <h3 className="font-display font-semibold text-foreground mb-4">Mes dossiers</h3>
            <div className="space-y-2">
              {mesDossiers.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => navigate(`/dossiers/${d.id}`)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{d.numero}</span>
                      <span className={`status-badge ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status].split(" ")[0]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.client}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${d.priorite === "haute" ? "bg-destructive" : d.priorite === "moyenne" ? "bg-warning" : "bg-success"}`} />
                </div>
              ))}
              {mesDossiers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun dossier assigné</p>}
            </div>
          </div>
        </motion.div>

        {/* Sidebar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
          <div className="stat-card">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-primary-foreground">{employee.name.split(" ").pop()?.charAt(0)}</span>
            </div>
            <h3 className="text-center font-display font-bold text-foreground">{employee.name}</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">{employee.role}</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {employee.site}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" /> {employee.email}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /> {employee.telephone}</div>
            </div>
          </div>

          {/* Permissions */}
          <div className="stat-card">
            <h3 className="font-display font-semibold text-foreground mb-3">Droits d'accès</h3>
            <div className="space-y-2">
              {Object.entries(employee.permissions).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{key}</span>
                  <span className={`status-badge ${val === "complet" ? "bg-green-100 text-green-700" : val === "partiel" ? "bg-amber-100 text-amber-700" : val === "lecture" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent actions */}
          <div className="stat-card">
            <h3 className="font-display font-semibold text-foreground mb-3">Actions récentes</h3>
            <div className="space-y-2">
              {mesActions.map(a => (
                <div key={a.id} className="text-xs p-2 rounded bg-muted/50">
                  <p className="text-foreground">{a.action}</p>
                  <p className="text-muted-foreground mt-0.5">{new Date(a.date).toLocaleString("fr-FR")}</p>
                </div>
              ))}
              {mesActions.length === 0 && <p className="text-xs text-muted-foreground">Aucune action récente</p>}
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default EmployeDetail;
