import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { MOCK_DOSSIERS, MOCK_INVOICES, MOCK_TRANSFERS, MOCK_PAIEMENTS_DOUANE, MOCK_PAIEMENTS_COMPAGNIE, getDISolde, isDIAlerte, type InvoiceStatus } from "@/lib/mockData";
import { DollarSign, TrendingUp, Receipt, FileText, ArrowRight, Download, RefreshCw, Ship, Landmark, AlertTriangle, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const paiementDouaneLabel = { droits: "Droits", taxes: "Taxes", redevances: "Redevances", penalite: "Pénalité" };
const paiementCompagnieLabel = { surestaries: "Surestaries", frais_portuaires: "Frais portuaires", manutention: "Manutention", terminal: "Terminal" };
const statutColor = { paye: "bg-green-100 text-green-700", en_attente: "bg-amber-100 text-amber-700", en_retard: "bg-red-100 text-red-700" };
const statutLabel = { paye: "Payé", en_attente: "En attente", en_retard: "En retard" };

const Finance = () => {
  // Totaux douane
  const totalDouane = MOCK_PAIEMENTS_DOUANE.reduce((s, p) => s + p.montant, 0);
  const douanePaye = MOCK_PAIEMENTS_DOUANE.filter(p => p.statut === "paye").reduce((s, p) => s + p.montant, 0);
  const douaneAttente = MOCK_PAIEMENTS_DOUANE.filter(p => p.statut !== "paye").reduce((s, p) => s + p.montant, 0);

  // Totaux compagnie
  const totalCompagnie = MOCK_PAIEMENTS_COMPAGNIE.reduce((s, p) => s + p.montant, 0);
  const compagniePaye = MOCK_PAIEMENTS_COMPAGNIE.filter(p => p.statut === "paye").reduce((s, p) => s + p.montant, 0);
  const compagnieAttente = MOCK_PAIEMENTS_COMPAGNIE.filter(p => p.statut !== "paye").reduce((s, p) => s + p.montant, 0);

  // DI par client
  const clientsDI = [...new Set(MOCK_DOSSIERS.filter(d => d.montantDI).map(d => d.client))];
  const diParClient = clientsDI.map(client => {
    const dossiers = MOCK_DOSSIERS.filter(d => d.client === client && d.montantDI);
    const totalDI = dossiers.reduce((s, d) => s + (d.montantDI || 0), 0);
    const totalConsomme = dossiers.reduce((s, d) => { const { totalBL } = getDISolde(d.id); return s + totalBL; }, 0);
    const solde = totalDI - totalConsomme;
    const pct = totalDI > 0 ? (solde / totalDI) * 100 : 100;
    const enAlerte = dossiers.some(d => isDIAlerte(d.id));
    return { client, totalDI, totalConsomme, solde, pct, enAlerte, dossiers: dossiers.length };
  });

  // Par compagnie
  const compagnies = ["MSC", "COSCO", "MAERSK", "CMA-CGM"];
  const compagnieData = compagnies.map(c => ({
    compagnie: c,
    douane: MOCK_PAIEMENTS_DOUANE.filter(p => MOCK_DOSSIERS.find(d => d.id === p.dossierId)?.compagnie === c).reduce((s, p) => s + p.montant, 0),
    compagnieFrais: MOCK_PAIEMENTS_COMPAGNIE.filter(p => p.compagnie === c).reduce((s, p) => s + p.montant, 0),
  }));

  return (
    <AppLayout title="Finance & Contrôle" subtitle="Droits de douane, paiements compagnie, suivi DI">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Droits de Douane", value: totalDouane, sub: `${douanePaye.toLocaleString("fr-FR")} payé`, icon: Landmark, color: "text-secondary" },
          { label: "Paiements Compagnies", value: totalCompagnie, sub: `${compagniePaye.toLocaleString("fr-FR")} payé`, icon: Ship, color: "text-accent" },
          { label: "En attente Douane", value: douaneAttente, sub: `${MOCK_PAIEMENTS_DOUANE.filter(p => p.statut === "en_retard").length} en retard`, icon: AlertTriangle, color: "text-warning" },
          { label: "En attente Compagnies", value: compagnieAttente, sub: `${MOCK_PAIEMENTS_COMPAGNIE.filter(p => p.statut === "en_retard").length} en retard`, icon: AlertTriangle, color: "text-destructive" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <div className="text-lg font-display font-bold text-foreground">{stat.value.toLocaleString("fr-FR")}</div>
            <div className="text-[10px] text-muted-foreground">{stat.sub}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="douane" className="mb-6">
        <TabsList>
          <TabsTrigger value="douane" className="gap-1.5"><Landmark className="w-3.5 h-3.5" /> Droits de Douane ({MOCK_PAIEMENTS_DOUANE.length})</TabsTrigger>
          <TabsTrigger value="compagnies" className="gap-1.5"><Ship className="w-3.5 h-3.5" /> Paiements Compagnies ({MOCK_PAIEMENTS_COMPAGNIE.length})</TabsTrigger>
          <TabsTrigger value="di_client" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Suivi DI par Client</TabsTrigger>
          <TabsTrigger value="transferts" className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Transferts ({MOCK_TRANSFERS.length})</TabsTrigger>
        </TabsList>

        {/* Droits de Douane */}
        <TabsContent value="douane">
          <div className="stat-card overflow-hidden p-0 mt-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                <Landmark className="w-4 h-4 text-secondary" /> Paiements Droits de Douane
              </h3>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" /> Export</Button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Référence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Dossier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Montant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PAIEMENTS_DOUANE.map(p => (
                  <tr key={p.id} className={`border-b border-border/50 hover:bg-muted/30 ${p.statut === "en_retard" ? "bg-destructive/5" : ""}`}>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{p.reference}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{p.dossierNumero}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{paiementDouaneLabel[p.type]}</td>
                    <td className="px-4 py-3 text-sm text-right font-display font-bold text-foreground">{p.montant.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3"><span className={`status-badge ${statutColor[p.statut]}`}>{statutLabel[p.statut]}</span></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Paiements Compagnies */}
        <TabsContent value="compagnies">
          <div className="stat-card overflow-hidden p-0 mt-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                <Ship className="w-4 h-4 text-secondary" /> Paiements aux Compagnies Maritimes
              </h3>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" /> Export</Button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Référence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Dossier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Compagnie</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Montant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PAIEMENTS_COMPAGNIE.map(p => (
                  <tr key={p.id} className={`border-b border-border/50 hover:bg-muted/30 ${p.statut === "en_retard" ? "bg-destructive/5" : ""}`}>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{p.reference}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{p.dossierNumero}</td>
                    <td className="px-4 py-3"><span className="text-sm font-medium text-foreground">{p.compagnie}</span></td>
                    <td className="px-4 py-3 text-sm text-foreground">{paiementCompagnieLabel[p.type]}</td>
                    <td className="px-4 py-3 text-sm text-right font-display font-bold text-foreground">{p.montant.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3"><span className={`status-badge ${statutColor[p.statut]}`}>{statutLabel[p.statut]}</span></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Suivi DI par client */}
        <TabsContent value="di_client">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {diParClient.map((c, i) => (
              <motion.div key={c.client} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`stat-card ${c.enAlerte ? "border border-destructive/30" : ""}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-display font-semibold text-foreground">{c.client}</h4>
                    <p className="text-[10px] text-muted-foreground">{c.dossiers} dossier(s)</p>
                  </div>
                  {c.enAlerte && (
                    <span className="status-badge bg-red-100 text-red-700 flex items-center gap-1 text-[10px]">
                      <AlertTriangle className="w-3 h-3" /> Alerte DI
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Enveloppe DI totale</span>
                    <span className="font-medium text-foreground">{c.totalDI.toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Consommé</span>
                    <span className="font-medium text-foreground">{c.totalConsomme.toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.pct <= 20 ? "bg-destructive" : c.pct <= 40 ? "bg-amber-500" : "bg-success"}`}
                      style={{ width: `${100 - c.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Solde restant</span>
                    <span className={`font-bold ${c.pct <= 20 ? "text-destructive" : "text-success"}`}>
                      {c.solde.toLocaleString("fr-FR")} FCFA ({c.pct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Transferts */}
        <TabsContent value="transferts">
          <div className="stat-card overflow-hidden p-0 mt-4">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold text-foreground">Transferts de fonds</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Référence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">De → Vers</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Montant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TRANSFERS.map(t => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{t.reference}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-1">{t.de} <ArrowRight className="w-3 h-3" /> {t.vers}</td>
                    <td className="px-4 py-3 text-sm text-right font-display font-bold text-foreground">{t.montant.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${t.statut === "effectue" ? "bg-green-100 text-green-700" : t.statut === "en_attente" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {t.statut === "effectue" ? "Effectué" : t.statut === "en_attente" ? "En attente" : "Annulé"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Chart: Douane vs Compagnie par compagnie maritime */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="stat-card">
        <h3 className="font-display font-semibold text-foreground mb-4">Douane vs Compagnie — par transporteur</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={compagnieData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="compagnie" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString("fr-FR")} FCFA`]} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="douane" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Droits de Douane" />
            <Bar dataKey="compagnieFrais" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Frais Compagnie" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </AppLayout>
  );
};

export default Finance;
