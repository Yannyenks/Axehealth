// Aide clinique basique, calculée à partir des constantes vitales déjà
// saisies — jamais un diagnostic, seulement une classification indicative
// selon des seuils publiés (OMS pour l'IMC, AHA pour la tension). Le
// médecin reste seul décisionnaire ; ces valeurs sont un repère, pas une
// alerte automatique envoyée à qui que ce soit.

export type ImcClassification = "MAIGREUR" | "NORMAL" | "SURPOIDS" | "OBESITE";
export type TensionClassification = "NORMALE" | "ELEVEE" | "HYPERTENSION_STADE_1" | "HYPERTENSION_STADE_2" | "CRISE_HYPERTENSIVE";

export function computeImc(poidsKg: number, tailleCm: number): number | null {
  if (poidsKg <= 0 || tailleCm <= 0) return null;
  const tailleM = tailleCm / 100;
  return Number((poidsKg / (tailleM * tailleM)).toFixed(1));
}

export function classifyImc(imc: number): ImcClassification {
  if (imc < 18.5) return "MAIGREUR";
  if (imc < 25) return "NORMAL";
  if (imc < 30) return "SURPOIDS";
  return "OBESITE";
}

// Seuils inspirés des repères AHA (tension en mmHg) — le plus sévère des
// deux chiffres (systolique/diastolique) déterminant la catégorie retenue.
export function classifyTension(tensionSys: number, tensionDia: number): TensionClassification {
  if (tensionSys >= 180 || tensionDia >= 120) return "CRISE_HYPERTENSIVE";
  if (tensionSys >= 140 || tensionDia >= 90) return "HYPERTENSION_STADE_2";
  if (tensionSys >= 130 || tensionDia >= 80) return "HYPERTENSION_STADE_1";
  if (tensionSys >= 120) return "ELEVEE";
  return "NORMALE";
}

interface VitalSignLike {
  poids: number | null;
  taille: number | null;
  tensionSys: number | null;
  tensionDia: number | null;
}

// Ajoute les champs dérivés à une constante vitale déjà enregistrée — ne
// modifie jamais la donnée saisie, seulement l'objet retourné par l'API.
export function enrichVitalSign<T extends VitalSignLike>(
  vitalSign: T,
): T & { imc: number | null; imcClassification: ImcClassification | null; tensionClassification: TensionClassification | null } {
  const imc = vitalSign.poids && vitalSign.taille ? computeImc(vitalSign.poids, vitalSign.taille) : null;
  const tensionClassification =
    vitalSign.tensionSys && vitalSign.tensionDia ? classifyTension(vitalSign.tensionSys, vitalSign.tensionDia) : null;

  return {
    ...vitalSign,
    imc,
    imcClassification: imc !== null ? classifyImc(imc) : null,
    tensionClassification,
  };
}
