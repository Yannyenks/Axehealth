import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Comparaison de magnitude entre quelques catégories nommées: une seule
// teinte (primary), la longueur de la barre porte la valeur — pas de
// palette catégorielle nécessaire ici (l'identité n'est pas la question).
export function PoleBreakdown({ caParPole }: { caParPole: Record<string, string> }) {
  const entries = Object.entries(caParPole)
    .map(([pole, montant]) => ({ pole, montant: Number(montant) }))
    .sort((a, b) => b.montant - a.montant);

  const max = Math.max(...entries.map((e) => e.montant), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chiffre d'affaires par pôle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Aucune facturation sur la période.</p>}
        {entries.map((entry) => (
          <div key={entry.pole}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-foreground">{entry.pole}</span>
              <span className="text-muted-foreground">{new Intl.NumberFormat("fr-FR").format(entry.montant)} FCFA</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-primary/15">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(entry.montant / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
