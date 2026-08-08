import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireRole, PERMISSIONS } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-error";
import { sendChatMessageSchema } from "@/lib/validations/ai";
import { sendChatMessage } from "@/services/ai-chat.service";

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    requireRole(session, PERMISSIONS.comptabilite.read);

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "AI_NOT_CONFIGURED", message: "L'assistant IA n'est pas configuré sur cet environnement" },
        { status: 500 },
      );
    }

    const input = sendChatMessageSchema.parse(await req.json());
    const result = await sendChatMessage(session.organizationId, session.sub, input);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
