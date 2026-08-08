import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("Chiffrement PHI (AES-256-GCM)", () => {
  it("déchiffre exactement ce qui a été chiffré", async () => {
    const { encrypt, decrypt } = await import("./encryption");
    const plaintext = JSON.stringify({ familiaux: "Diabète type 2 (père)", chirurgicaux: "Appendicectomie 2015" });

    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toContain("Diabète");
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produit un chiffré différent à chaque appel (IV aléatoire), même pour un texte identique", async () => {
    const { encrypt } = await import("./encryption");
    const a = encrypt("même contenu");
    const b = encrypt("même contenu");
    expect(a).not.toBe(b);
  });

  it("refuse de déchiffrer avec une autre clé", async () => {
    const { encrypt, decrypt } = await import("./encryption");
    const encrypted = encrypt("secret");

    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64"); // change la clé
    expect(() => decrypt(encrypted)).toThrow();
  });

  it("refuse une clé qui ne décode pas en exactement 32 octets", async () => {
    const { encrypt } = await import("./encryption");
    process.env.ENCRYPTION_KEY = Buffer.from("trop-courte").toString("base64");
    expect(() => encrypt("x")).toThrow();
  });
});
