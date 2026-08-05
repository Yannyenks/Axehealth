import AppLayout from "@/components/AppLayout";
import { MOCK_DOSSIERS, MOCK_TIMING, STATUS_LABELS, STATUS_STEP, isDossierEnRetard, getRetardJours, getDISolde, isDIAlerte } from "@/lib/mockData";
import { Clock, TrendingUp, AlertTriangle, BarChart3, Timer, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

const Reporting = () => {
  // Timing moyen par étape
  const etapes = ["reception", "codage", "validation", "paiement", "bon_compagnie", "operations_kribi", "cloture"] as const;
  const timingByEtape = etapes.map(etape => {
    const timings = MOCK_TIMING.filter(t => t.etape === etape && t.dateFin);
    const durees = timings.map(t => {
      const d1 = new Date(t.dateDebut).getTime();
      const d2 = new Date(t.dateFin!).getTime();
      return (d2 - d1) / (1000 * 60 * 60 * 24);
    });
    const moyenne = durees.length > 0 ? durees.reduce((a, b) => a + b, 0) / durees.length : 0;
    const prevue = timings.length > 0 ? timings[0].dureePrevueJours : 0;
    return {
      etape: STATUS_LABELS[etape].split(" ")[0],
      etapeFull: STATUS_LABELS[etape],
      moyenne: Math.round(moyenne * 10) / 10,
      prevue,
      depassement: moyenne > prevue,
    };
  });

  // Dossiers en retard
  const dossiersEnRetard = MOCK_DOSSIERS.filter(isDossierEnRetard);

  // DI en alerte
  const dossiersAlerteDI = MOCK_DOSSIERS.filter(d => d.montantDI && isDIAlerte(d.id));

  // Durée totale par dossier (pour ceux avec timing)
  const dossierDurees = MOCK_DOSSIERS.map(d => {
    const timings = MOCK_TIMING.filter(t => t.dossierId === d.id);
    if (timings.length === 0) return null;
    const debut = new Date(Math.min(...timings.map(t => new Date(t.dateDebut).getTime())));
    const fin = timings.some(t => !t.dateFin) ? new Date() : new Date(Math.max(...timings.filter(t => t.dateFin).map(t => new Date(t.dateFin!).getTime())));
    const dureeJours = Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24));
    const enRetard = isDossierEnRetard(d);
    return { ...d, dureeJours, enRetard };
  }).filter(Boolean) as any[];

  const totalDossiers = MOCK_DOSSIERS.length;
  const clotures = MOCK_DOSSIERS.filter(d => d.status === "cloture").length;
  const enCours = totalDossiers - clotures;

  return (
    <AppLayout title="Reporting & Timing" subtitle="Suivi avancement des dossiers et performance">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Dossiers total", value: totalDossiers, icon: BarChart3, color: "text-secondary" },
          { label: "En cours", value: enCours, icon: Timer, color: "text-accent" },
          { label: "Clôturés", value: clotures, icon: CheckCircle2, color: "text-success" },
          { label: "En retard", value: dossiersEnRetard.length, icon: AlertTriangle, color: "text-destructive" },
          { label: "Alertes DI", value: dossiersAlerteDI.length, icon: AlertTriangle, color: "text-warning" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <span className="text-2xl font-display font-bold text-foreground">{stat.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Timing moyen par étape */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" /> Durée moyenne par étape (jours)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={timingByEtape} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="etape" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v: number, name: string) => [`${v} jour(s)`, name === "moyenne" ? "Réel" : "Prévu"]}
              />
              <Bar dataKey="prevue" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} name="Prévu" />
              <Bar dataKey="moyenne" radius={[0, 4, 4, 0]} name="Réel">
                {timingByEtape.map((entry, idx) => (
                  <Cell key={idx} fill={entry.depassement ? "hsl(var(--destructive))" : "hsl(var(--secondary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Dossiers en retard */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="stat-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Dossiers en retard ({dossiersEnRetard.length})
          </h3>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {dossiersEnRetard.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun dossier en retard 🎉</p>
            ) : (
              dossiersEnRetard.map(d => {
                const retard = getRetardJours(d);
                return (
                  <a key={d.id} href={`/dossiers/${d.id}`} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{d.numero}</span>
                      <p className="text-xs text-muted-foreground">{d.client} — {d.marchandise}</p>
                      <p className="text-[10px] text-muted-foreground">{STATUS_LABELS[d.status]} {d.status === "cloture" && "(Clôturé)"}</p>
                    </div>
                    <span className="status-badge bg-red-100 text-red-700 text-xs whitespace-nowrap">
                      +{retard}j retard
                    </span>
                  </a>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Durée totale par dossier */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="stat-card overflow-hidden p-0">
        <div className="p-4 border-b border-border">
          <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-secondary" /> Avancement détaillé des dossiers
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Dossier</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Étape actuelle</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Durée (j)</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Progression</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
            </tr>
          </thead>
          <tbody>
            {dossierDurees.map(d => {
              const step = STATUS_STEP[d.status as keyof typeof STATUS_STEP];
              const progressPct = Math.round((step / 7) * 100);
              return (
                <tr key={d.id} className={`border-b border-border/50 hover:bg-muted/30 ${d.enRetard ? "bg-destructive/5" : ""}`}>
                  <td className="px-4 py-3">
                    <a href={`/dossiers/${d.id}`} className="text-sm font-semibold text-foreground hover:text-secondary">{d.numero}</a>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{d.client}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{STATUS_LABELS[d.status as keyof typeof STATUS_LABELS]}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${d.enRetard ? "text-destructive" : "text-foreground"}`}>{d.dureeJours}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${d.enRetard ? "bg-destructive" : "bg-secondary"}`} style={{ width: `${progressPct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8">{progressPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.enRetard ? (
                      <span className="status-badge bg-red-100 text-red-700">+{getRetardJours(d)}j</span>
                    ) : d.status === "cloture" ? (
                      <span className="status-badge bg-green-100 text-green-700">✓ OK</span>
                    ) : (
                      <span className="status-badge bg-blue-100 text-blue-700">En cours</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
    </AppLayout>
  );
};

export default Reporting;
