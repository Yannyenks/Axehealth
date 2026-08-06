import { describe, it, expect } from "vitest";
import { generateBase32Secret, generateTotp, verifyTotp, buildOtpAuthUri, generateBackupCodes } from "./totp";

describe("TOTP (RFC 6238)", () => {
  it("génère un secret base32 valide et distinct à chaque appel", () => {
    const a = generateBase32Secret();
    const b = generateBase32Secret();
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(a).not.toBe(b);
  });

  it("le code généré pour l'instant présent se vérifie avec succès", () => {
    const secret = generateBase32Secret();
    const code = generateTotp(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it("rejette un code incorrect", () => {
    const secret = generateBase32Secret();
    const code = generateTotp(secret);
    const wrongCode = code === "000000" ? "111111" : "000000";
    expect(verifyTotp(secret, wrongCode)).toBe(false);
  });

  it("rejette un code valide pour un secret différent", () => {
    const secretA = generateBase32Secret();
    const secretB = generateBase32Secret();
    const codeForA = generateTotp(secretA);
    expect(verifyTotp(secretB, codeForA)).toBe(false);
  });

  it("tolère un décalage d'horloge de ±1 pas (30s)", () => {
    const secret = generateBase32Secret();
    const now = Date.now();
    const codeOneStepAgo = generateTotp(secret, now - 30_000);
    expect(verifyTotp(secret, codeOneStepAgo, now)).toBe(true);
  });

  it("refuse un code trop ancien (hors fenêtre de tolérance)", () => {
    const secret = generateBase32Secret();
    const now = Date.now();
    const oldCode = generateTotp(secret, now - 5 * 60_000);
    expect(verifyTotp(secret, oldCode, now)).toBe(false);
  });

  it("construit une URI otpauth:// valide", () => {
    const uri = buildOtpAuthUri("ABCD1234", "admin@clinique.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABCD1234");
    expect(uri).toContain(encodeURIComponent("admin@clinique.com"));
  });

  it("génère des codes de secours uniques", () => {
    const codes = generateBackupCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
  });
});
