"use client";

import Link from "next/link";
import { PatientBrandedShell } from "@/components/patient-branded-shell";

export default function PatientOrganizationLandingPage({ params }: { params: { orgSlug: string } }) {
  return (
    <PatientBrandedShell orgSlug={params.orgSlug}>
      {(org) => (
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold">Pré-consultation IA</h1>
            <p className="text-sm text-muted-foreground">
              Décrivez vos symptômes depuis chez vous, avant votre venue à {org.name}. Notre assistant IA évalue l&apos;urgence de votre situation et prépare une synthèse pour l&apos;équipe médicale.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href={`/patient/${org.slug}/signup`}
              className="block w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.01] hover:opacity-90"
            >
              Créer mon espace patient
            </Link>
            <Link
              href={`/patient/${org.slug}/login`}
              className="block w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>
      )}
    </PatientBrandedShell>
  );
}
