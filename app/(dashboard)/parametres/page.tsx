"use client";

import type { Role } from "@prisma/client";
import { useAuthStore } from "@/stores/auth.store";
import { PERMISSIONS } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Check } from "lucide-react";

const ALL_ROLES: Role[] = ["ADMIN", "SECRETAIRE", "MEDECIN", "INFIRMIER", "PHARMACIEN", "BIOLOGISTE", "CAISSIER", "COMPTABLE", "RH"];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  SECRETAIRE: "Secrétaire",
  MEDECIN: "Médecin",
  INFIRMIER: "Infirmier",
  PHARMACIEN: "Pharmacien",
  BIOLOGISTE: "Biologiste",
  CAISSIER: "Caissier",
  COMPTABLE: "Comptable",
  RH: "RH",
};

// Dérivé directement de lib/rbac.ts — cette page ne fait qu'afficher la
// matrice réellement appliquée par les routes API, jamais une copie qui
// pourrait diverger de ce qui est effectivement autorisé.
const PERMISSION_ROWS = Object.entries(PERMISSIONS).flatMap(([module, actions]) =>
  Object.entries(actions).map(([action, roles]) => ({
    label: `${module}.${action}`,
    roles: roles as readonly Role[],
  })),
);

export default function ParametresPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Organisation et bibliothèque de rôles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Nom : </span>{user?.organization?.name}</p>
          <p><span className="text-muted-foreground">Identifiant : </span>{user?.organization?.slug}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bibliothèque de rôles</CardTitle>
          <p className="text-xs text-muted-foreground">
            Chaque rôle ne voit et n'agit que sur les modules qui lui incombent — cette matrice reflète exactement
            les contrôles appliqués côté serveur sur chaque requête.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                {ALL_ROLES.map((role) => (
                  <TableHead key={role} className="text-center">{ROLE_LABEL[role]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSION_ROWS.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-mono text-xs">{row.label}</TableCell>
                  {ALL_ROLES.map((role) => (
                    <TableCell key={role} className="text-center">
                      {row.roles.includes(role) && <Check className="mx-auto h-4 w-4 text-success" />}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
