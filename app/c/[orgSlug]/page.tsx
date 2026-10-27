import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Logo, PulseLine } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

// Accueil de l'espace d'une clinique : premier écran, avant la connexion du personnel.
export default async function ClinicSpacePage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    select: { name: true, city: true, isActive: true },
  });
  if (!org || !org.isActive) notFound();

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="absolute inset-0 bg-gradient-brand opacity-[0.12]" aria-hidden />
        <Logo tone="light" />
        <div className="relative space-y-6">
          <p className="eyebrow text-pulse">{org.city ?? "Espace clinique"}</p>
          <h2 className="font-display text-4xl font-bold leading-tight text-sidebar-accent-foreground">{org.name}</h2>
          <PulseLine className="max-w-md" />
          <p className="max-w-md text-sidebar-foreground/70">Espace de travail sécurisé du personnel de l'établissement.</p>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">© AxeHealth</p>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-soft">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-navy">{org.name}</h1>
            <p className="text-sm text-muted-foreground">Connectez-vous à votre compte pour accéder aux modules qui vous sont attribués.</p>
          </div>
          <Button asChild variant="brand" className="w-full">
            <Link href={`/c/${params.orgSlug}/login`}>
              Se connecter <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
