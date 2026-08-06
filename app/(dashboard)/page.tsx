export default function DashboardHome() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="font-display text-3xl font-bold text-primary">AxeHealth</h1>
      <p className="max-w-md text-muted-foreground">
        Tableau de bord en cours de construction. Modules disponibles côté API : authentification, consultations,
        ordonnances, caisse anti-fraude.
      </p>
    </main>
  );
}
