import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { writeAuditLog, ipFromRequest } from "@/lib/audit";
import { applyOcrResult, createScannedDocument, runOcrExtraction } from "@/services/ai-ocr.service";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

// Le scan ne fait que PROPOSER une écriture (extractedData / ecritureProposee)
// — poser réellement l'écriture reste un acte volontaire de l'utilisateur via
// POST /api/journal-entries, qui revalide l'équilibre indépendamment de ce
// que l'IA a suggéré.
export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.write);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "STORAGE_NOT_CONFIGURED", message: "Le stockage des documents scannés n'est pas configuré sur cet environnement" },
        { status: 500 },
      );
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "AI_NOT_CONFIGURED", message: "L'assistant IA n'est pas configuré sur cet environnement" },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Fichier manquant" }, { status: 422 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Format non supporté (PNG, JPEG, WEBP, PDF)" }, { status: 422 });
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Le document dépasse 10 Mo" }, { status: 422 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const extension = file.type.split("/")[1];
    const blob = await put(`documents/${session.organizationId}-${Date.now()}.${extension}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    let document = await createScannedDocument(session.organizationId, session.sub, {
      fileUrl: blob.url,
      fileName: file.name,
      mimeType: file.type,
    });

    const ocrResult = await runOcrExtraction(base64, file.type);
    document = await applyOcrResult(document.id, ocrResult);

    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.sub,
      action: "SCANNED_DOCUMENT_IMPORTED",
      entityType: "ScannedDocument",
      entityId: document.id,
      metadata: { status: document.status, fileName: document.fileName },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ document, extraction: ocrResult.extraction }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
