import { prisma } from "@/lib/prisma";
import { getGeminiModel } from "@/lib/ai/gemini";
import { NotFoundError } from "@/lib/api-error";
import type { SendChatMessageInput } from "@/lib/validations/ai";

const SYSTEM_PROMPT = `Tu es le copilote financier CFO d'AxeCompta, un assistant comptable pour PME en zone OHADA. Tu réponds en français, de façon concise et actionnable, en te basant sur le plan comptable et la fiscalité SYSCOHADA révisée (TVA, obligations déclaratives du Code Général des Impôts). Si une question dépasse la comptabilité générale, analytique ou fiscale, dis-le clairement plutôt que d'improviser. Tu ne peux pas consulter les comptes réels de l'utilisateur: si la question porte sur des données précises de son organisation (soldes, écritures), invite-le à consulter le module concerné plutôt que d'inventer un chiffre.`;

// Une conversation appartient à un seul utilisateur (pas de fil partagé au
// niveau organisation) — le copilote reste un outil de travail individuel,
// distinct de l'audit trail comptable qui, lui, est partagé par organisation.
export async function sendChatMessage(organizationId: string, userId: string, input: SendChatMessageInput) {
  const conversation = input.conversationId
    ? await prisma.aiConversation.findFirst({
        where: { id: input.conversationId, organizationId, userId },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
      })
    : null;
  if (input.conversationId && !conversation) throw new NotFoundError("Conversation introuvable");

  const history = conversation?.messages ?? [];

  const model = getGeminiModel();
  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Compris, je suis prêt à assister sur la comptabilité SYSCOHADA." }] },
      ...history.map((entry) => ({ role: entry.role === "USER" ? "user" : "model", parts: [{ text: entry.contenu }] })),
    ],
  });

  const result = await chat.sendMessage(input.message);
  const replyText = result.response.text();

  return prisma.$transaction(async (tx) => {
    const activeConversation =
      conversation ?? (await tx.aiConversation.create({ data: { organizationId, userId, titre: input.message.slice(0, 80) } }));

    await tx.aiMessage.create({ data: { conversationId: activeConversation.id, role: "USER", contenu: input.message } });
    const assistantMessage = await tx.aiMessage.create({
      data: { conversationId: activeConversation.id, role: "ASSISTANT", contenu: replyText },
    });

    return { conversationId: activeConversation.id, message: assistantMessage };
  });
}
