import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { MOCK_DOSSIERS, STATUS_LABELS, STATUS_COLORS, EMPLOYEES, isDossierEnRetard, getRetardJours, type DossierStatus, type Compagnie } from "@/lib/mockData";
import { Search, Filter, Ship, MapPin, ChevronRight, LayoutGrid, List, Download, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import NouveauDossierDialog from "@/components/NouveauDossierDialog";
import KanbanView from "@/components/KanbanView";

const Dossiers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<DossierStatus | "all">("all");
  const [filterCompagnie, setFilterCompagnie] = useState<Compagnie | "all">("all");
  const [filterSite, setFilterSite] = useState<"all" | "Douala" | "Kribi">("all");
  const [filterPriorite, setFilterPriorite] = useState<"all" | "haute" | "moyenne" | "basse">("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  const filtered = MOCK_DOSSIERS.filter((d) => {
    const matchSearch = search === "" ||
      d.numero.toLowerCase().includes(search.toLowerCase()) ||
      d.client.toLowerCase().includes(search.toLowerCase()) ||
      d.conteneur.toLowerCase().includes(search.toLowerCase()) ||
      d.marchandise.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    const matchCompagnie = filterCompagnie === "all" || d.compagnie === filterCompagnie;
    const matchSite = filterSite === "all" || d.site === filterSite;
    const matchPriorite = filterPriorite === "all" || d.priorite === filterPriorite;
    return matchSearch && matchStatus && matchCompagnie && matchSite && matchPriorite;
  });

  return (
    <AppLayout title="Gestion des Dossiers" subtitle={`${MOCK_DOSSIERS.length} dossiers au total`}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro, client, conteneur, marchandise..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode("list")} className={`p-2 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("kanban")} className={`p-2 ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" /> Export</Button>
            <NouveauDossierDialog />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as DossierStatus | "all")} className="h-9 px-3 rounded-lg border border-border bg-card text-xs text-foreground">
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
          </select>
          <select value={filterCompagnie} onChange={(e) => setFilterCompagnie(e.target.value as Compagnie | "all")} className="h-9 px-3 rounded-lg border border-border bg-card text-xs text-foreground">
            <option value="all">Toutes compagnies</option>
            <option value="MSC">MSC</option><option value="COSCO">COSCO</option><option value="MAERSK">MAERSK</option><option value="CMA-CGM">CMA-CGM</option>
          </select>
          <select value={filterSite} onChange={(e) => setFilterSite(e.target.value as "all" | "Douala" | "Kribi")} className="h-9 px-3 rounded-lg border border-border bg-card text-xs text-foreground">
            <option value="all">Tous sites</option>
            <option value="Douala">Douala</option><option value="Kribi">Kribi</option>
          </select>
          <select value={filterPriorite} onChange={(e) => setFilterPriorite(e.target.value as "all" | "haute" | "moyenne" | "basse")} className="h-9 px-3 rounded-lg border border-border bg-card text-xs text-foreground">
            <option value="all">Toutes priorités</option>
            <option value="haute">Haute</option><option value="moyenne">Moyenne</option><option value="basse">Basse</option>
          </select>
          {(filterStatus !== "all" || filterCompagnie !== "all" || filterSite !== "all" || filterPriorite !== "all" || search) && (
            <button onClick={() => { setFilterStatus("all"); setFilterCompagnie("all"); setFilterSite("all"); setFilterPriorite("all"); setSearch(""); }}
              className="text-xs text-secondary hover:underline px-2">Réinitialiser les filtres</button>
          )}
          <span className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <KanbanView />
      ) : (
        <div className="stat-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">N° Dossier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compagnie</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteneur</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responsable</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priorité</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const enRetard = isDossierEnRetard(d);
                  const retard = getRetardJours(d);
                  return (
                  <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${enRetard ? "bg-destructive/5" : ""}`}
                    onClick={() => navigate(`/dossiers/${d.id}`)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {enRetard && <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                        <span className={`text-sm font-semibold ${enRetard ? "text-destructive" : "text-foreground"}`}>{d.numero}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground">{d.client}</td>
                    <td className="px-5 py-3.5"><span className="text-sm font-medium text-foreground">{d.compagnie}</span></td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono text-xs">{d.conteneur}</td>
                    <td className="px-5 py-3.5">
                      {enRetard ? (
                        <span className="status-badge bg-red-100 text-red-700">EN RETARD +{retard}j</span>
                      ) : (
                        <span className={`status-badge ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground">{d.responsable}</td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        {d.site === "Kribi" ? <MapPin className="w-3 h-3" /> : <Ship className="w-3 h-3" />}{d.site}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`status-badge ${d.priorite === "haute" ? "bg-red-100 text-red-700" : d.priorite === "moyenne" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{d.priorite}</span>
                    </td>
                    <td className="px-5 py-3.5"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                  </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucun dossier trouvé</p>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default Dossiers;
