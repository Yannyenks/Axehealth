import { z } from "zod";

export const createJournalSchema = z.object({
  code: z.string().min(1).max(10),
  libelle: z.string().min(1).max(150),
  type: z.enum(["ACHATS", "VENTES", "BANQUE", "CAISSE", "OPERATIONS_DIVERSES", "A_NOUVEAUX"]),
});

export const createAccountSchema = z.object({
  numero: z.string().min(1).max(20),
  libelle: z.string().min(1).max(150),
  classe: z.enum([
    "CLASSE1_RESSOURCES_DURABLES",
    "CLASSE2_ACTIF_IMMOBILISE",
    "CLASSE3_STOCKS",
    "CLASSE4_TIERS",
    "CLASSE5_TRESORERIE",
    "CLASSE6_CHARGES",
    "CLASSE7_PRODUITS",
    "CLASSE8_AUTRES_CHARGES_PRODUITS",
  ]),
  isAuxiliaire: z.boolean().optional(),
});

export const createThirdPartySchema = z.object({
  code: z.string().min(1).max(20),
  raisonSociale: z.string().min(1).max(150),
  type: z.enum(["CLIENT", "FOURNISSEUR", "AUTRE"]),
  accountId: z.string().cuid().optional(),
  telephone: z.string().max(30).optional(),
  email: z.string().email().max(150).optional(),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateThirdPartyInput = z.infer<typeof createThirdPartySchema>;
