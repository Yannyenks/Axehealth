"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { usePatientOrganization } from "@/components/patient-branded-shell";
import { hexToHslTriplet, isValidHexColor } from "@/lib/color";

interface PatientMe {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  organizationId: string;
}

export default function PatientPortalLayout({ children, params }: { children: React.ReactNode; params: { orgSlug: string } }) {
  const router = useRouter();
  const loginUrl = `/patient/${params.orgSlug}/login`;

  const { data: org } = usePatientOrganization(params.orgSlug);

  const { data: meData, error } = useQuery({
    queryKey: ["patient", "me"],
    queryFn: () => api.get<{ patient: PatientMe }>("/api/patient/auth/me"),
    retry: false,
  });

  // Le cookie de session patient n'est pas scindé par établissement — un
  // patient déjà connecté sur la clinique A qui ouvre le lien de la clinique
  // B ne doit jamais se retrouver silencieusement à agir sous son compte A.
  // On le renvoie donc vers la connexion *de cet établissement* si son
  // organisation ne correspond pas à celle du lien ouvert.
  const wrongOrganization = !!(meData && org && meData.patient.organizationId !== org.organization.id);

  useEffect(() => {
    if ((error instanceof ApiError && error.status === 401) || wrongOrganization) {
      router.push(loginUrl);
    }
  }, [error, wrongOrganization, router, loginUrl]);

  async function handleLogout() {
    await api.post("/api/patient/auth/logout");
    window.location.href = loginUrl;
  }

  if (!meData || !org || wrongOrganization) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  const { patient } = meData;
  const brandStyle = org.organization.primaryColor && isValidHexColor(org.organization.primaryColor) ? ({ "--primary": hexToHslTriplet(org.organization.primaryColor) } as React.CSSProperties) : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30" style={brandStyle}>
      <header className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          {org.organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.organization.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{org.organization.name[0]}</div>
          )}
          <div>
            <p className="font-display text-base font-bold leading-tight">{org.organization.name}</p>
            <p className="text-[11px] leading-tight text-muted-foreground">Espace patient</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{patient.firstName} {patient.lastName}</span>
          <button onClick={handleLogout} className="text-sm font-medium text-primary hover:underline">
            Déconnexion
          </button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
