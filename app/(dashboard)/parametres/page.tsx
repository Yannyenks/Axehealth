"use client";

import { useState } from "react";
import type { OrgPlan, Role } from "@prisma/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { PERMISSIONS } from "@/lib/rbac";
import { getPlanDefinition } from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MfaCard } from "@/components/settings/mfa-card";
import { Check } from "lucide-react";

const ALL_ROLES: Role[] = ["ADMIN", "COMPTABLE", "CAISSIER"];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  COMPTABLE: "Comptable",
  CAISSIER: "Caissier",
};

interface Organization {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  plan: OrgPlan;
  trialEndsAt: string | null;
}

interface TeamMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  totpEnabled: boolean;
}

// Dérivé directement de lib/rbac.ts — cette section ne fait qu'afficher la
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
  const queryClient = useQueryClient();

  const canManageOrg = !!user && PERMISSIONS.organisation.manage.includes(user.role);
  const canManageEquipe = !!user && PERMISSIONS.equipe.manage.includes(user.role);

  // ---- Organisation ----
  const { data: orgData } = useQuery({
    queryKey: ["organization"],
    queryFn: () => api.get<{ organization: Organization }>("/api/organization"),
  });
  const [orgForm, setOrgForm] = useState<{ name: string; address: string; city: string; phone: string; email: string } | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const org = orgForm ?? (orgData ? { name: orgData.organization.name, address: orgData.organization.address ?? "", city: orgData.organization.city ?? "", phone: orgData.organization.phone ?? "", email: orgData.organization.email ?? "" } : null);

  const saveOrg = useMutation({
    mutationFn: () => api.patch("/api/organization", org),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      setOrgError(null);
    },
    onError: (e) => setOrgError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  // ---- Équipe ----
  const { data: teamData } = useQuery({
    queryKey: ["team"],
    queryFn: () => api.get<{ members: TeamMember[] }>("/api/team"),
    enabled: canManageEquipe,
  });
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", firstName: "", lastName: "", role: "CAISSIER" as Role });
  const [teamError, setTeamError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; tempPassword: string } | null>(null);

  const inviteMember = useMutation({
    mutationFn: () => api.post<{ user: TeamMember; tempPassword: string }>("/api/team", inviteForm),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setInviteForm({ email: "", firstName: "", lastName: "", role: "CAISSIER" });
      setShowInviteForm(false);
      setTeamError(null);
      setCreatedCredentials({ email: result.user.email, tempPassword: result.tempPassword });
    },
    onError: (e) => setTeamError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, ...input }: { id: string; role?: Role; isActive?: boolean }) => api.patch(`/api/team/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setTeamError(null);
    },
    onError: (e) => setTeamError(e instanceof ApiError ? e.message : "Une erreur est survenue"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Organisation, équipe et bibliothèque de rôles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orgError && <p className="text-sm text-destructive">{orgError}</p>}
          {org && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input value={org.name} disabled={!canManageOrg} onChange={(e) => setOrgForm({ ...org, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Identifiant</Label>
                  <Input value={orgData?.organization.slug ?? ""} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Adresse</Label>
                  <Input value={org.address} disabled={!canManageOrg} onChange={(e) => setOrgForm({ ...org, address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ville</Label>
                  <Input value={org.city} disabled={!canManageOrg} onChange={(e) => setOrgForm({ ...org, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input value={org.phone} disabled={!canManageOrg} onChange={(e) => setOrgForm({ ...org, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={org.email} disabled={!canManageOrg} onChange={(e) => setOrgForm({ ...org, email: e.target.value })} />
                </div>
              </div>
              {canManageOrg && (
                <Button size="sm" disabled={saveOrg.isPending} onClick={() => saveOrg.mutate()}>Enregistrer</Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {orgData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Abonnement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Offre actuelle</p>
              <p className="font-medium">{getPlanDefinition(orgData.organization.plan).name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Comptes utilisés</p>
              <p className="font-medium">
                {teamData?.members.length ?? "—"} / {Number.isFinite(getPlanDefinition(orgData.organization.plan).maxUsers) ? getPlanDefinition(orgData.organization.plan).maxUsers : "∞"}
              </p>
            </div>
            {orgData.organization.trialEndsAt && (
              <div>
                <p className="text-muted-foreground">Fin de l'essai</p>
                <p className="font-medium">{new Date(orgData.organization.trialEndsAt).toLocaleDateString("fr-FR")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <MfaCard />

      {canManageEquipe && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Équipe</CardTitle>
            <Button size="sm" onClick={() => setShowInviteForm((v) => !v)}>{showInviteForm ? "Annuler" : "Inviter un membre"}</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamError && <p className="text-sm text-destructive">{teamError}</p>}

            {createdCredentials && (
              <Card className="border-success">
                <CardContent className="p-4 text-sm">
                  <p className="font-medium">Compte créé pour {createdCredentials.email}</p>
                  <p className="text-muted-foreground">
                    Mot de passe provisoire (à communiquer une seule fois, non récupérable ensuite) :{" "}
                    <span className="font-mono font-semibold text-foreground">{createdCredentials.tempPassword}</span>
                  </p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setCreatedCredentials(null)}>Fermer</Button>
                </CardContent>
              </Card>
            )}

            {showInviteForm && (
              <div className="grid grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Prénom</Label>
                  <Input value={inviteForm.firstName} onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input value={inviteForm.lastName} onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Rôle</Label>
                  <Select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as Role })}>
                    {ALL_ROLES.map((role) => (
                      <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-4">
                  <Button size="sm" disabled={!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName || inviteMember.isPending} onClick={() => inviteMember.mutate()}>
                    Créer le compte
                  </Button>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamData?.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.firstName} {member.lastName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        disabled={member.id === user?.id}
                        onChange={(e) => updateMember.mutate({ id: member.id, role: e.target.value as Role })}
                        className="h-8 w-40"
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>{member.totpEnabled ? <Check className="h-4 w-4 text-success" /> : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString("fr-FR") : "Jamais"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "success" : "destructive"}>{member.isActive ? "Actif" : "Désactivé"}</Badge>
                    </TableCell>
                    <TableCell>
                      {member.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateMember.isPending}
                          onClick={() => updateMember.mutate({ id: member.id, isActive: !member.isActive })}
                        >
                          {member.isActive ? "Désactiver" : "Réactiver"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
