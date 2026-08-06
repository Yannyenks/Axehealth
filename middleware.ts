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
  "/api/webhooks",
  "/api/cron",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
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
