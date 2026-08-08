import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

describe("mots de passe et PIN (Argon2id)", () => {
  it("vérifie un mot de passe correct et rejette un mot de passe incorrect", async () => {
    const { hashPassword, verifyPassword } = await import("./auth");
    const hash = await hashPassword("MotDePasse123!");
    expect(await verifyPassword(hash, "MotDePasse123!")).toBe(true);
    expect(await verifyPassword(hash, "MauvaisMotDePasse")).toBe(false);
  });

});

describe("jetons JWT", () => {
  it("signe puis vérifie un access token avec les bonnes revendications", async () => {
    const { signAccessToken, verifyAccessToken } = await import("./auth");
    const token = signAccessToken({ sub: "user_1", organizationId: "org_1", role: "ADMIN" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user_1");
    expect(payload.organizationId).toBe("org_1");
    expect(payload.role).toBe("ADMIN");
  });

  it("rejette un token invalide", async () => {
    const { verifyAccessToken } = await import("./auth");
    expect(() => verifyAccessToken("token.invalide.ici")).toThrow();
  });

  it("extrait le token depuis le cookie httpOnly quand il n'y a pas de header Authorization", async () => {
    const { getBearerToken } = await import("./auth");
    const req = new Request("http://localhost/api/test", { headers: { cookie: "autre=x; axecompta_token=abc123; suite=y" } });
    expect(getBearerToken(req)).toBe("abc123");
  });

  it("préfère le header Authorization quand les deux sont présents", async () => {
    const { getBearerToken } = await import("./auth");
    const req = new Request("http://localhost/api/test", {
      headers: { authorization: "Bearer depuis-header", cookie: "axecompta_token=depuis-cookie" },
    });
    expect(getBearerToken(req)).toBe("depuis-header");
  });
});
