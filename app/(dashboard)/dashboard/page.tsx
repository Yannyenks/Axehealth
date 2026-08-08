"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/dashboard/stat-tile";

interface JournalEntryRow {
  id: string;
  numeroPiece: string;
  dateEcriture: string;
  libelle: string;
  status: "BROUILLON" | "VALIDEE";
  journal: { code: string; libelle: string };
  thirdParty: { raisonSociale: string } | null;
  items: { debit: string; credit: string }[];
}

interface BusinessProfile {
  secteurActivite: string;
  maturiteComptable: "DEBUTANT" | "INTERMEDIAIRE" | "AVANCE";
  principauxRisques: string[];
  prioritesRecommandees: string[];
  modulesRecommandes: string[];
  syntheseTexte: string;
}

interface OrganizationDto {
  name: string;
  businessProfile: BusinessProfile | null;
  auditCompletedAt: string | null;
}

const MATURITY_LABEL: Record<BusinessProfile["maturiteComptable"], string> = {
  DEBUTANT: "À structurer",
  INTERMEDIAIRE: "Partiellement structurée",
  AVANCE: "Mature",
};

const MODULE_LABEL: Record<string, { label: string; href?: string }> = {
  comptabilite: { label: "Comptabilité", href: "/comptabilite" },
  tresorerie: { label: "Trésorerie" },
  tiers: { label: "Tiers" },
  immobilisations: { label: "Immobilisations" },
  fiscalite: { label: "Fiscalité" },
};

function isSameMonth(dateIso: string, ref: Date): boolean {
  const date = new Date(dateIso);
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth();
}

export default function DashboardHome() {
  const { user } = useAuthStore();

  const { data: orgData } = useQuery({
    queryKey: ["organization"],
    queryFn: () => api.get<{ organization: OrganizationDto }>("/api/organization"),
  });

  const { data: entriesData, isLoading } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: () => api.get<{ entries: JournalEntryRow[] }>("/api/journal-entries"),
  });

  const { data: journalsData } = useQuery({
    queryKey: ["journals"],
    queryFn: () => api.get<{ journals: { id: string }[] }>("/api/journals"),
  });

  const entries = entriesData?.entries ?? [];
  const now = new Date();
  const entriesThisMonth = entries.filter((e) => isSameMonth(e.dateEcriture, now));
  const volumeThisMonth = entriesThisMonth.reduce(
    (sum, entry) => sum + entry.items.reduce((s, item) => s + Number(item.debit), 0),
    0,
  );

  const profile = orgData?.organization.businessProfile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">{orgData?.organization.name}</p>
      </div>

      {profile && (
        <Card className="border-emerald-600/30 bg-gradient-to-br from-emerald-950/5 to-transparent">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-amber-400">
                <Sparkles className="h-4 w-4 text-emerald-950" />
              </div>
              <CardTitle className="text-base">Diagnostic de l'assistant IA</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{profile.syntheseTexte}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">{profile.secteurActivite}</span>
              <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">{MATURITY_LABEL[profile.maturiteComptable]}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Priorités recommandées</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {profile.prioritesRecommandees.map((priorite, i) => (
                    <li key={i}>• {priorite}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium">Modules recommandés pour vous</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.modulesRecommandes.map((moduleKey) => {
                    const module = MODULE_LABEL[moduleKey];
                    if (!module) return null;
                    if (!module.href) {
                      return (
                        <span key={moduleKey} className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
                          {module.label}
                        </span>
                      );
                    }
                    return (
                      <Link
                        key={moduleKey}
                        href={module.href}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                      >
                        {module.label} <ArrowRight className="h-3 w-3" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Écritures ce mois-ci" value={entriesThisMonth.length} isCurrency={false} href="/comptabilite" />
        <StatTile label="Volume débité ce mois-ci" value={volumeThisMonth} href="/comptabilite" />
        <StatTile label="Écritures au total" value={entries.length} isCurrency={false} href="/comptabilite" />
        <StatTile label="Journaux actifs" value={journalsData?.journals.length ?? 0} isCurrency={false} href="/comptabilite" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières écritures</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pièce</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Journal</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {entries.slice(0, 5).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">{entry.numeroPiece}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(entry.dateEcriture).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>{entry.journal.code}</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.libelle}</TableCell>
                  <TableCell>
                    <Badge variant={entry.status === "VALIDEE" ? "success" : "secondary"}>{entry.status === "VALIDEE" ? "Validée" : "Brouillon"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Aucune écriture pour l'instant</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
