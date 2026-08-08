// Gateway SMS générique — le format exact (endpoint, auth, payload) dépend
// du fournisseur retenu (Africa's Talking, Twilio, gateway local...). Adapter
// buildRequest() au contrat réel avant mise en production.

export async function sendSms(to: string, message: string): Promise<{ sent: boolean }> {
  const apiKey = process.env.SMS_GATEWAY_API_KEY;
  const baseUrl = process.env.SMS_GATEWAY_BASE_URL;

  if (!apiKey || !baseUrl) {
    console.warn("Gateway SMS non configurée — message non envoyé");
    return { sent: false };
  }

  const response = await fetch(`${baseUrl}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ to, message }),
  });

  return { sent: response.ok };
}
