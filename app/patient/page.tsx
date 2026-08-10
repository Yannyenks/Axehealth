export default function PatientPortalFallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm space-y-2 text-center">
        <p className="font-display text-xl font-bold">Espace patient AxeHealth</p>
        <p className="text-sm text-muted-foreground">
          Chaque établissement dispose de son propre lien d&apos;accès (ex: axehealth.com/patient/votre-clinique). Utilisez le lien fourni par votre clinique ou centre de santé.
        </p>
      </div>
    </main>
  );
}
