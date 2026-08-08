import { describe, it, expect } from "vitest";
import { computeImc, classifyImc, classifyTension } from "./clinical";

describe("computeImc", () => {
  it("calcule l'IMC standard (poids / taille² en mètres)", () => {
    expect(computeImc(70, 175)).toBeCloseTo(22.9, 1);
  });

  it("retourne null pour une entrée invalide", () => {
    expect(computeImc(0, 175)).toBeNull();
    expect(computeImc(70, 0)).toBeNull();
  });
});

describe("classifyImc", () => {
  it.each([
    [17, "MAIGREUR"],
    [22, "NORMAL"],
    [27, "SURPOIDS"],
    [32, "OBESITE"],
  ] as const)("classe %f comme %s", (imc, expected) => {
    expect(classifyImc(imc)).toBe(expected);
  });
});

describe("classifyTension", () => {
  it.each([
    [110, 70, "NORMALE"],
    [125, 75, "ELEVEE"],
    [132, 82, "HYPERTENSION_STADE_1"],
    [145, 92, "HYPERTENSION_STADE_2"],
    [185, 100, "CRISE_HYPERTENSIVE"],
  ] as const)("classe %d/%d comme %s", (sys, dia, expected) => {
    expect(classifyTension(sys, dia)).toBe(expected);
  });

  it("retient la catégorie la plus sévère entre systolique et diastolique", () => {
    expect(classifyTension(115, 125)).toBe("CRISE_HYPERTENSIVE"); // diastolique seule au-delà du seuil
  });
});
