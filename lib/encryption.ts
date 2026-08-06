import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Chiffrement au repos pour les champs PHI les plus sensibles (voir
// Patient.antecedents) — AES-256-GCM avec le module `crypto` natif, pas de
// dépendance tierce. ENCRYPTION_KEY doit être 32 octets encodés en base64
// (ex: `openssl rand -base64 32`). La perte de cette clé rend les données
// chiffrées définitivement irrécupérables — pas de recouvrement possible.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommandé pour GCM

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set");
  const buffer = Buffer.from(key, "base64");
  if (buffer.length !== 32) throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  return buffer;
}

// Retourne `iv.authTag.ciphertext` en base64, séparés par des points —
// tout ce qu'il faut pour déchiffrer est dans la valeur stockée elle-même.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decrypt(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error("Invalid encrypted payload format");

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
