"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface OrganizationUsage {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  utilisateurs: number;
  patients: number;
}

export default function SuperAdminPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "organisations"],
    queryFn: () => api.get<{ organizations: OrganizationUsage[] }>("/api/superadmin/organisations"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/superadmin/organisations/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "organisations"] });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Console plateforme</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble des organisations abonnées à AxeHealth</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Utilisateurs</TableHead>
                <TableHead>Patients</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{org.slug}</TableCell>
                  <TableCell>{org.utilisateurs}</TableCell>
                  <TableCell>{org.patients}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(org.createdAt).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={org.isActive ? "success" : "destructive"}>{org.isActive ? "Active" : "Suspendue"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate({ id: org.id, isActive: !org.isActive })}
                    >
                      {org.isActive ? "Suspendre" : "Réactiver"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data?.organizations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Aucune organisation</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
