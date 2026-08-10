import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Garde-fou de premier niveau: bloque l'accès aux pages (dashboard) sans
// access token valide. Le contrôle RBAC fin (par rôle/module) est appliqué
// ensuite dans chaque route API via lib/rbac.ts, exécuté en runtime Node.
// /api/webhooks/* (fournisseurs Mobile Money) et /api/cron/* (Vercel Cron)
// sont appelés sans JWT — chacun vérifie son propre secret partagé dans le
// handler (voir lib/integrations et app/api/cron/evaluer-alertes).
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/refresh",
  "/api/auth/mfa/verifier-login", // pas de session tant que le 2e facteur n'est pas confirmé
  "/api/patient/auth/signup",
  "/api/patient/auth/login",
  "/api/patient/organizations/", // charte de l'établissement affichée avant connexion, aucune donnée sensible
  "/api/webhooks",
  "/api/cron",
];

// Le portail patient est identifié par un lien propre à chaque établissement
// (/patient/<slug>) — seules la page d'accueil de ce lien et les pages
// login/signup qui en dépendent sont publiques ; tout ce qui suit
// (pré-consultation, etc.) exige une session patient, voir plus bas.
const PATIENT_PUBLIC_PATTERNS = [/^\/patient$/, /^\/patient\/[^/]+$/, /^\/patient\/[^/]+\/(login|signup)$/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Cas particulier: "/" est la landing page publique. Un `startsWith("/")`
  // dans la boucle ci-dessous matcherait *tous* les chemins (ils commencent
  // tous par "/"), donc on le traite en comparaison stricte, à part.
  if (pathname === "/") {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path)) || PATIENT_PUBLIC_PATTERNS.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }

  // Portail patient (AxeHealth AI Care): secret et cookie distincts de la
  // branche staff ci-dessous, pour qu'un token patient ne puisse jamais être
  // accepté sur une route staff et inversement, même en cas de bug.
  if (pathname.startsWith("/patient") || pathname.startsWith("/api/patient/")) {
    const patientToken = req.cookies.get("axehealth_patient_token")?.value ?? req.headers.get("authorization")?.replace("Bearer ", "");
    // /patient/<slug>/... -> redirige vers la page de connexion *de cet
    // établissement*, jamais une page de connexion générique.
    const orgSlug = pathname.match(/^\/patient\/([^/]+)/)?.[1];
    const loginUrl = orgSlug ? `/patient/${orgSlug}/login` : "/patient";

    if (!patientToken) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      return NextResponse.redirect(new URL(loginUrl, req.url));
    }

    try {
      await jwtVerify(patientToken, new TextEncoder().encode(process.env.PATIENT_JWT_SECRET));
      return NextResponse.next();
    } catch {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      return NextResponse.redirect(new URL(loginUrl, req.url));
    }
  }

  const token = req.cookies.get("axehealth_token")?.value ?? req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
