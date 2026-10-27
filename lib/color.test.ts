import { describe, it, expect } from "vitest";
import { hexToHslTriplet, isValidHexColor } from "@/lib/color";

describe("hexToHslTriplet", () => {
  it("convertit le noir et le blanc", () => {
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
  });

  it("convertit le Sarcelle du logo AxeHealth, couleur par défaut du sélecteur d'onboarding", () => {
    // #1B7F86 (Sarcelle, design system) — couleur par défaut au sélecteur d'onboarding.
    expect(hexToHslTriplet("#1B7F86")).toBe("184 66% 32%");
  });

  it("rejette une couleur hex invalide", () => {
    expect(() => hexToHslTriplet("teal")).toThrow();
    expect(() => hexToHslTriplet("#fff")).toThrow();
  });
});

describe("isValidHexColor", () => {
  it("valide uniquement le format #rrggbb", () => {
    expect(isValidHexColor("#0EA5A4")).toBe(true);
    expect(isValidHexColor("#0ea5a4")).toBe(true);
    expect(isValidHexColor("0ea5a4")).toBe(false);
    expect(isValidHexColor("#0ea5")).toBe(false);
  });
});
