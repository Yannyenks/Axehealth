"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user: { firstName: string; lastName: string; role: string } | null;
}

export default function AuditPage() {
  const [action, setAction] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", action],
    queryFn: () => api.get<{ logs: LogEntry[] }>(`/api/audit?action=${encodeURIComponent(action)}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Journal d'audit</h1>
          <p className="text-sm text-muted-foreground">Journal immuable de toutes les actions sensibles (100 dernières entrées)</p>
        </div>
        <a href={`/api/audit?format=csv&action=${encodeURIComponent(action)}`}>
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        </a>
      </div>

      <Input placeholder="Filtrer par type d'action (ex: PAYMENT, CONSULTATION…)" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-md" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead>Utilisateur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              )}
              {data?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{new Date(log.createdAt).toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.entityType} · {log.entityId.slice(0, 10)}…</TableCell>
                  <TableCell>{log.user ? `${log.user.firstName} ${log.user.lastName}` : "—"}</TableCell>
                </TableRow>
              ))}
              {data?.logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Aucune entrée</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
