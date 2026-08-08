import { createHmac, randomBytes } from "crypto";

// TOTP (RFC 6238) sur HMAC-SHA1 (RFC 4226) implémenté directement avec le
// module `crypto` natif de Node — pas de dépendance tierce pour un
// mécanisme aussi sensible que le second facteur d'authentification.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function generateBase32Secret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);

  return String(binCode % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotp(base32Secret: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

// Tolère un décalage d'horloge de ±1 pas (30s) entre le serveur et
// l'application d'authentification du client.
export function verifyTotp(base32Secret: string, token: string, at: number = Date.now(), window = 1): boolean {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  const secretBuffer = base32Decode(base32Secret);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    if (hotp(secretBuffer, counter + errorWindow) === token) return true;
  }
  return false;
}

export function buildOtpAuthUri(base32Secret: string, accountEmail: string, issuer = "AxeHealth"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  return `otpauth://totp/${label}?secret=${base32Secret}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex").toUpperCase());
}
