// Animation 3D minimaliste évoquant la médecine (double hélice d'ADN),
// entièrement en CSS (transforms 3D natifs, aucune librairie WebGL/3D) —
// cohérent avec le reste du produit qui n'embarque aucune dépendance de
// rendu graphique lourde (voir components/dashboard/*-chart.tsx, en SVG à la
// main). Composant serveur: pas de state ni d'effet, seule l'animation
// (rotation continue) vit côté CSS via la classe `animate-helix-spin`.
const SEGMENTS = 18;
const TURNS = 2;
const RADIUS = 46; // px
const HEIGHT = 120; // px
const DOT = 9; // px

const strandPoints = Array.from({ length: SEGMENTS }, (_, i) => {
  const t = i / (SEGMENTS - 1);
  return {
    key: i,
    angle: t * TURNS * 360,
    y: t * HEIGHT - HEIGHT / 2,
  };
});

export function DnaHelix() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto h-[170px] w-[170px] [perspective:900px] motion-reduce:[perspective:none]"
    >
      <div className="relative h-full w-full animate-helix-spin motion-reduce:animate-none [transform-style:preserve-3d]">
        {strandPoints.map((p) => (
          <span key={`a-${p.key}`}>
            <span
              className="absolute rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]"
              style={{
                width: DOT,
                height: DOT,
                top: `calc(50% + ${p.y}px)`,
                left: "50%",
                transform: `translate(-50%, -50%) rotateY(${p.angle}deg) translateZ(${RADIUS}px)`,
              }}
            />
            <span
              className="absolute rounded-full bg-primary/30"
              style={{
                width: DOT,
                height: DOT,
                top: `calc(50% + ${p.y}px)`,
                left: "50%",
                transform: `translate(-50%, -50%) rotateY(${p.angle + 180}deg) translateZ(${RADIUS}px)`,
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
