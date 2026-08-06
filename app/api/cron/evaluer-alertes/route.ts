import { NextResponse, type NextRequest } from "next/server";
import { evaluateAllOrganizations } from "@/services/alert-rule.service";

// Appelé par Vercel Cron (voir vercel.json) — Vercel ajoute automatiquement
// `Authorization: Bearer $CRON_SECRET` sur ces requêtes quand la variable
// d'environnement CRON_SECRET est configurée sur le projet. Sans cron actif
// (dev local, autre hébergeur), l'évaluation à la demande via
// POST /api/alertes/verifier reste disponible.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await evaluateAllOrganizations();

  return NextResponse.json(result);
}
