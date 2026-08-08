// Intégration Mobile Money (MTN MoMo, Orange Money, Wave).
//
// IMPORTANT: les URLs, en-têtes et formats de payload exacts (sandbox vs
// production, souscription API, clé de collecte...) sont propres à chaque
// contrat marchand et évoluent par pays. Cette couche fixe le contrat
// interne (MobileMoneyProvider) attendu par le reste de l'application ;
// chaque implémentation ci-dessous doit être complétée avec les
// identifiants et l'endpoint réels fournis par l'agrégateur/opérateur
// avant mise en production.

export interface InitiatePaymentParams {
  amount: number;
  currency: string; // "XAF"
  phoneNumber: string;
  reference: string; // référence interne (ex: invoiceId)
}

export interface InitiatePaymentResult {
  providerReference: string;
  status: "PENDING" | "FAILED";
}

export interface MobileMoneyProvider {
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
}

abstract class HttpMobileMoneyProvider implements MobileMoneyProvider {
  protected abstract baseUrl: string;
  protected abstract apiKeyEnvVar: string;

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const apiKey = process.env[this.apiKeyEnvVar];
    if (!apiKey) {
      throw new Error(`${this.apiKeyEnvVar} n'est pas configurée — intégration Mobile Money désactivée`);
    }

    // Requête à adapter au contrat réel du fournisseur (endpoint de collecte,
    // en-têtes d'authentification, structure du corps de requête).
    const response = await fetch(`${this.baseUrl}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        payerPhone: params.phoneNumber,
        externalReference: params.reference,
      }),
    });

    if (!response.ok) {
      return { providerReference: params.reference, status: "FAILED" };
    }

    const data = (await response.json()) as { transactionId?: string };
    return { providerReference: data.transactionId ?? params.reference, status: "PENDING" };
  }
}

class MtnMomoProvider extends HttpMobileMoneyProvider {
  protected baseUrl = process.env.MTN_MOMO_BASE_URL ?? "https://sandbox.momodeveloper.mtn.com/collection/v1_0";
  protected apiKeyEnvVar = "MTN_MOMO_API_KEY" as const;
}

class OrangeMoneyProvider extends HttpMobileMoneyProvider {
  protected baseUrl = process.env.ORANGE_MONEY_BASE_URL ?? "https://api.orange.com/orange-money-webpay/cm/v1";
  protected apiKeyEnvVar = "ORANGE_MONEY_API_KEY" as const;
}

class WaveProvider extends HttpMobileMoneyProvider {
  protected baseUrl = process.env.WAVE_BASE_URL ?? "https://api.wave.com/v1";
  protected apiKeyEnvVar = "WAVE_API_KEY" as const;
}

const providers: Record<"MTN_MOMO" | "ORANGE_MONEY" | "WAVE", MobileMoneyProvider> = {
  MTN_MOMO: new MtnMomoProvider(),
  ORANGE_MONEY: new OrangeMoneyProvider(),
  WAVE: new WaveProvider(),
};

export function getMobileMoneyProvider(mode: "MTN_MOMO" | "ORANGE_MONEY" | "WAVE"): MobileMoneyProvider {
  return providers[mode];
}
