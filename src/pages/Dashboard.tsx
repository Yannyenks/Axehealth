import AppLayout from "@/components/AppLayout";
import {
  FolderOpen, CheckCircle, Clock, AlertTriangle, TrendingUp,
  ArrowUpRight, ArrowDownRight, Ship, MapPin, Users, BarChart3
} from "lucide-react";
import { MOCK_DOSSIERS, MOCK_ALERTS, WEEKLY_STATS, MONTHLY_STATS, STATUS_LABELS, STATUS_COLORS, EMPLOYEE_PERFORMANCE, type DossierStatus } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const statCards = [
  { label: "Dossiers actifs", value: 10, icon: FolderOpen, change: "+18%", up: true, color: "text-secondary" },
  { label: "Clôturés ce mois", value: 2, icon: CheckCircle, change: "+8%", up: true, color: "text-success" },
  { label: "En retard", value: 3, icon: Clock, change: "-25%", up: false, color: "text-warning" },
  { label: "Alertes critiques", value: 2, icon: AlertTriangle, change: "+1", up: true, color: "text-destructive" },
];

const pieData = [
  { name: "MSC", value: 4, color: "#0ea5e9" },
  { name: "COSCO", value: 3, color: "#d4a843" },
  { name: "MAERSK", value: 3, color: "#22c55e" },
  { name: "CMA-CGM", value: 2, color: "#f97316" },
];

const siteComparison = [
  { site: "Douala", actifs: 8, clotures: 2, enRetard: 2 },
  { site: "Kribi", actifs: 2, clotures: 0, enRetard: 1 },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const activeDossiers = MOCK_DOSSIERS.filter(d => d.status !== "cloture");

  // Heatmap data: steps x employees
  const heatmapSteps: DossierStatus[] = ["reception", "codage", "validation", "paiement", "bon_compagnie", "operations_kribi"];
  const heatmapEmployees = ["Mme YASMINE", "Mme ODETTE", "Mr WANDALA", "Mr ALIOU", "Mr SOUDI"];
  const heatmapData = heatmapSteps.map(step => {
    const row: Record<string, number | string> = { step: STATUS_LABELS[step].split(" ")[0] };
    heatmapEmployees.forEach(emp => {
      row[emp] = MOCK_DOSSIERS.filter(d => d.status === step && d.responsable === emp).length;
    });
    return row;
  });

  return (
    <AppLayout title="Tableau de Bord" subtitle="Vue de pilotage stratégique — Mr DELBA">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-medium ${stat.label === "En retard" || stat.label === "Clôturés ce mois" ? "text-success" : stat.label === "Alertes critiques" ? "text-destructive" : "text-success"}`}>
                {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.change}
              </span>
            </div>
            <div className="text-2xl font-display font-bold text-foreground">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Weekly Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2 stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Activité de la semaine</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={WEEKLY_STATS}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="jour" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="dossiers" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Nouveaux" />
              <Bar dataKey="clotures" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Clôturés" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Par compagnie</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                {pieData.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-semibold text-foreground ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Heatmap + Site Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Heatmap */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-secondary" /> Carte de chaleur — Goulots d'étranglement
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 text-muted-foreground">Étape</th>
                  {heatmapEmployees.map(e => (
                    <th key={e} className="p-2 text-muted-foreground text-center">{e.split(" ").pop()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map(row => (
                  <tr key={row.step as string}>
                    <td className="p-2 text-foreground font-medium">{row.step as string}</td>
                    {heatmapEmployees.map(e => {
                      const val = row[e] as number;
                      return (
                        <td key={e} className="p-2 text-center">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center mx-auto text-xs font-bold ${
                            val === 0 ? "bg-muted text-muted-foreground" :
                            val === 1 ? "bg-blue-100 text-blue-700" :
                            val === 2 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {val}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Site comparison */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-secondary" /> Comparaison Douala / Kribi
          </h3>
          <div className="space-y-4">
            {siteComparison.map(s => (
              <div key={s.site} className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-display font-bold text-foreground flex items-center gap-2">
                    {s.site === "Kribi" ? <MapPin className="w-4 h-4 text-secondary" /> : <Ship className="w-4 h-4 text-secondary" />}
                    {s.site}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center"><div className="text-lg font-display font-bold text-foreground">{s.actifs}</div><div className="text-[10px] text-muted-foreground">Actifs</div></div>
                  <div className="text-center"><div className="text-lg font-display font-bold text-success">{s.clotures}</div><div className="text-[10px] text-muted-foreground">Clôturés</div></div>
                  <div className="text-center"><div className="text-lg font-display font-bold text-destructive">{s.enRetard}</div><div className="text-[10px] text-muted-foreground">En retard</div></div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Employee Performance + Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Employee performance */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-secondary" /> Performance par employé
          </h3>
          <div className="space-y-3">
            {EMPLOYEE_PERFORMANCE.filter(e => e.dossiersTotal > 0).map(emp => (
              <div key={emp.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-primary-foreground">{emp.name.split(" ").pop()?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{emp.name}</span>
                    <span className="text-xs text-muted-foreground">{emp.dossiersActifs} actifs / {emp.delaiMoyenHeures}h moy.</span>
                  </div>
                  <Progress value={emp.rendement} className="h-1.5" />
                </div>
                <span className="text-xs font-display font-bold text-foreground w-10 text-right">{emp.rendement}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Monthly trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-secondary" /> Tendance mensuelle
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MONTHLY_STATS}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mois" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="dossiers" stroke="hsl(var(--secondary))" strokeWidth={2} name="Nouveaux" />
              <Line type="monotone" dataKey="clotures" stroke="hsl(var(--success))" strokeWidth={2} name="Clôturés" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">Alertes prioritaires</h3>
            <button onClick={() => navigate("/alertes")} className="text-xs font-medium text-secondary hover:underline">Voir tout</button>
          </div>
          <div className="space-y-3">
            {MOCK_ALERTS.filter(a => a.severity !== "info").slice(0, 4).map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${alert.severity === "critical" ? "bg-destructive" : "bg-warning"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.dossierNumero} • {alert.date}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Active Dossiers */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">Dossiers en cours</h3>
            <button onClick={() => navigate("/dossiers")} className="text-xs font-medium text-secondary hover:underline">Voir tout</button>
          </div>
          <div className="space-y-2">
            {activeDossiers.slice(0, 5).map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => navigate(`/dossiers/${d.id}`)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{d.numero}</span>
                    <span className={`status-badge ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status].split(" ")[0]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.client} — {d.marchandise}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {d.site === "Kribi" ? <MapPin className="w-3 h-3" /> : <Ship className="w-3 h-3" />}{d.site}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
