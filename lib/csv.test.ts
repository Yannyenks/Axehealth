import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("génère un en-tête et une ligne par entrée", () => {
    const csv = toCsv([{ nom: "Ada", role: "ADMIN" }], [{ key: "nom", header: "Nom" }, { key: "role", header: "Rôle" }]);
    expect(csv).toBe("Nom,Rôle\r\nAda,ADMIN");
  });

  it("échappe les virgules et guillemets (RFC 4180)", () => {
    const csv = toCsv([{ libelle: 'Consultation, "urgente"' }], [{ key: "libelle", header: "Libellé" }]);
    expect(csv).toBe('Libellé\r\n"Consultation, ""urgente"""');
  });

  it("échappe les valeurs contenant un saut de ligne", () => {
    const csv = toCsv([{ note: "ligne1\nligne2" }], [{ key: "note", header: "Note" }]);
    expect(csv).toBe('Note\r\n"ligne1\nligne2"');
  });

  it("rend une valeur nulle/indéfinie comme une cellule vide", () => {
    const csv = toCsv([{ valeur: null }, { valeur: undefined }], [{ key: "valeur", header: "Valeur" }]);
    expect(csv).toBe("Valeur\r\n\r\n");
  });
});
