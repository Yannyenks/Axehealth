import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { updateOrganizationProfile } from "@/services/organization.service";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

// Upload direct côté serveur (formData → Vercel Blob) plutôt qu'un flux de
// jeton client-upload: le volume attendu (un logo par établissement, changé
// rarement) ne justifie pas la complexité additionnelle de ce second flux.
export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.organisation.manage);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "LOGO_UPLOAD_NOT_CONFIGURED", message: "Le stockage des logos n'est pas configuré sur cet environnement" },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Fichier manquant" }, { status: 422 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Format d'image non supporté (PNG, JPEG, WEBP, SVG)" }, { status: 422 });
    }
    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "L'image dépasse 2 Mo" }, { status: 422 });
    }

    const extension = file.type.split("/")[1].replace("svg+xml", "svg");
    const blob = await put(`logos/${session.organizationId}-${Date.now()}.${extension}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const organization = await updateOrganizationProfile(session.organizationId, { logoUrl: blob.url });

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "ORGANIZATION_LOGO_UPDATED",
      entityType: "Organization",
      entityId: session.organizationId,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ organization });
  } catch (error) {
    return handleApiError(error);
  }
}
