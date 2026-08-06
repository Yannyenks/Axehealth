// WhatsApp Business Cloud API (Meta) — https://developers.facebook.com/docs/whatsapp/cloud-api
// Nécessite WHATSAPP_BUSINESS_TOKEN et WHATSAPP_PHONE_NUMBER_ID dans l'environnement.

const GRAPH_VERSION = "v20.0";

export async function sendWhatsAppMessage(to: string, text: string): Promise<{ sent: boolean }> {
  const token = process.env.WHATSAPP_BUSINESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("WhatsApp Business API non configurée — message non envoyé");
    return { sent: false };
  }

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  return { sent: response.ok };
}
