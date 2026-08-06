"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Teintes catégorielles validées (palette de référence dataviz, ordre fixe
// par identité de pôle — jamais par ordre d'apparition dans les données).
const POLE_COLORS: Record<string, string> = {
  Consultation: "#2a78d6", // slot 1 — blue
  Laboratoire: "#eb6834", // slot 2 — orange
  Pharmacie: "#1baf7a", // slot 3 — aqua
  Hospitalisation: "#eda100", // slot 4 — yellow
};
const POLE_ORDER = ["Consultation", "Laboratoire", "Pharmacie", "Hospitalisation"];
const FALLBACK_COLOR = "#4a3aa7"; // slot 7 — violet, pour un pôle imprévu

interface DayEntry {
  date: string;
  [pole: string]: string;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

function formatFcfa(n: number): string {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function RevenueAreaChart({ data, poles }: { data: DayEntry[]; poles: string[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const orderedPoles = useMemo(() => POLE_ORDER.filter((p) => poles.includes(p)).concat(poles.filter((p) => !POLE_ORDER.includes(p))), [poles]);

  const totals = data.map((d) => orderedPoles.reduce((sum, p) => sum + Number(d[p] ?? 0), 0));
  const max = Math.max(...totals, 1000);
  const niceMax = Math.ceil(max / 1000) * 1000;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const xStep = data.length > 1 ? plotW / (data.length - 1) : 0;

  function xAt(i: number) {
    return PAD.left + i * xStep;
  }
  function yAt(value: number) {
    return PAD.top + plotH - (value / niceMax) * plotH;
  }

  // Empilement cumulatif par jour, dans l'ordre catégoriel fixe.
  const cumulative = data.map((d) => {
    let running = 0;
    return orderedPoles.map((p) => {
      const v = Number(d[p] ?? 0);
      const base = running;
      running += v;
      return { pole: p, base, top: running, value: v };
    });
  });

  function pathFor(poleIdx: number) {
    const topLine = cumulative.map((day, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(day[poleIdx].top)}`).join(" ");
    const bottomLine = cumulative
      .slice()
      .reverse()
      .map((day, i) => `L ${xAt(cumulative.length - 1 - i)} ${yAt(day[poleIdx].base)}`)
      .join(" ");
    return `${topLine} ${bottomLine} Z`;
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoveredCum = hoverIndex !== null ? cumulative[hoverIndex] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recettes par pôle</CardTitle>
        <p className="text-xs text-muted-foreground">7 derniers jours (FCFA)</p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            onMouseLeave={() => setHoverIndex(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
              const idx = Math.round((relX - PAD.left) / (xStep || 1));
              setHoverIndex(Math.min(Math.max(idx, 0), data.length - 1));
            }}
          >
            {gridLines.map((g) => (
              <line
                key={g}
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={PAD.top + plotH * (1 - g)}
                y2={PAD.top + plotH * (1 - g)}
                stroke="#e1e0d9"
                strokeWidth={1}
              />
            ))}
            {gridLines.map((g) => (
              <text key={g} x={PAD.left - 8} y={PAD.top + plotH * (1 - g) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
                {formatFcfa(niceMax * g)}
              </text>
            ))}

            {orderedPoles.map((pole, poleIdx) => (
              <path key={pole} d={pathFor(poleIdx)} fill={POLE_COLORS[pole] ?? FALLBACK_COLOR} fillOpacity={0.12} stroke="none" />
            ))}
            {orderedPoles.map((pole, poleIdx) => (
              <path
                key={`line-${pole}`}
                d={cumulative.map((day, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(day[poleIdx].top)}`).join(" ")}
                fill="none"
                stroke={POLE_COLORS[pole] ?? FALLBACK_COLOR}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            ))}

            {data.map((d, i) => (
              <text key={d.date} x={xAt(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short" })}
              </text>
            ))}

            {hoverIndex !== null && (
              <line x1={xAt(hoverIndex)} x2={xAt(hoverIndex)} y1={PAD.top} y2={PAD.top + plotH} stroke="#898781" strokeWidth={1} />
            )}
          </svg>

          {hovered && hoveredCum && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-44 rounded-md border bg-popover p-2.5 text-xs shadow-md"
              style={{ left: `min(${(xAt(hoverIndex!) / WIDTH) * 100}%, calc(100% - 11rem))` }}
            >
              <p className="mb-1.5 font-medium text-foreground">
                {new Date(hovered.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}
              </p>
              {hoveredCum.map((entry) => (
                <div key={entry.pole} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: POLE_COLORS[entry.pole] ?? FALLBACK_COLOR }} />
                    {entry.pole}
                  </span>
                  <span className="font-medium text-foreground">{formatFcfa(entry.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          {orderedPoles.map((pole) => (
            <span key={pole} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: POLE_COLORS[pole] ?? FALLBACK_COLOR }} />
              {pole}
            </span>
          ))}
          {orderedPoles.length === 0 && <p className="text-xs text-muted-foreground">Aucune facturation sur les 7 derniers jours.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
