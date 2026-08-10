"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { hexToHslTriplet, isValidHexColor } from "@/lib/color";

export interface PatientOrganization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

// Coquille visuelle partagée par toutes les pages du lien patient
// (/patient/[orgSlug]/...): applique la charte de l'établissement (logo,
// couleur — mêmes champs Organization.logoUrl/primaryColor déjà utilisés
// côté dashboard staff, voir app/(dashboard)/layout.tsx) avant même que le
// patient soit connecté, et centralise le chargement/l'état "établissement
// introuvable" pour ne pas le dupliquer dans chaque page.
export function usePatientOrganization(orgSlug: string) {
  return useQuery({
    queryKey: ["patient", "organization", orgSlug],
    queryFn: () => api.get<{ organization: PatientOrganization }>(`/api/patient/organizations/${orgSlug}`),
    retry: false,
  });
}

export function PatientBrandedShell({ orgSlug, children }: { orgSlug: string; children: (org: PatientOrganization) => React.ReactNode }) {
  const { data, error, isLoading } = usePatientOrganization(orgSlug);

  const brandStyle =
    data?.organization.primaryColor && isValidHexColor(data.organization.primaryColor)
      ? ({ "--primary": hexToHslTriplet(data.organization.primaryColor) } as React.CSSProperties)
      : undefined;

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm space-y-2 text-center">
          <p className="font-display text-xl font-bold">Établissement introuvable</p>
          <p className="text-sm text-muted-foreground">Le lien utilisé ne correspond à aucun établissement AxeHealth actif. Vérifiez le lien fourni par votre clinique.</p>
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main
      style={brandStyle}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {data.organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.organization.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-lg ring-4 ring-background" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg ring-4 ring-background">
              {data.organization.name[0]}
            </div>
          )}
          <div>
            <p className="font-display text-2xl font-bold">{data.organization.name}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Espace patient · AxeHealth AI Care</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/95 p-8 shadow-xl backdrop-blur-sm">{children(data.organization)}</div>
      </div>
    </main>
  );
}
