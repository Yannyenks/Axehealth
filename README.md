# AxeHealth v1.0 Enterprise Edition

ERP de gestion intégrée pour cliniques et centres de santé en Afrique — AxeStack Technologies.

## Stack

- **Frontend/Backend**: Next.js 14 (App Router) + TypeScript
- **UI**: TailwindCSS + Shadcn/UI + Lucide Icons
- **Data fetching / state**: React Query + Zustand
- **ORM / DB**: Prisma + PostgreSQL (multi-tenant par `organizationId`)
- **Auth**: JWT (access + refresh) + Argon2id, RBAC strict, PIN de caisse
- **Audit**: journal immuable (`AuditLog`) sur toutes les actions sensibles
- **Offline-first**: file de mutations IndexedDB + service worker (Background Sync)

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Comptes de démo créés par le seed (mot de passe `AxeHealth2026!`, PIN caisse `1234`) :
`admin@axehealth.demo`, `medecin@axehealth.demo`, `caissier1@axehealth.demo`, `caissier2@axehealth.demo`,
`pharmacien@axehealth.demo`, `infirmier@axehealth.demo`, `secretaire@axehealth.demo`.

## Architecture anti-fraude (caisse)

1. Le **caissier** enregistre un paiement (`POST /api/caisse/paiements`) → statut non validé.
2. Un **second utilisateur habilité** (jamais le même caissier) confirme via son PIN
   (`POST /api/caisse/paiements/[id]/valider`) → double validation aveugle.
   Pour le Mobile Money, la confirmation vient du fournisseur via webhook (voir plus bas) — pas de PIN,
   le tiers de confiance est l'opérateur télécom.
3. Une fois la facture soldée, les consultations liées passent de `EN_ATTENTE_CAISSE` à `EN_COURS` —
   c'est cette transition qui débloque l'écran du médecin.
4. La **clôture de caisse** (`POST /api/caisse/cloture`) exige le PIN du caissier et calcule
   automatiquement l'écart entre le théorique (espèces encaissées) et le réel déclaré.

Toutes ces actions sont journalisées dans `AuditLog` (immuable).

## Modules et API livrés

- **Schéma Prisma complet** (`prisma/schema.prisma`) : organisations, utilisateurs/RBAC, patients,
  consultations, prescriptions, rendez-vous, facturation/tiers-payant, caisse, stock/pharmacie (FEFO),
  hospitalisation/lits, soins infirmiers, RH/gardes/paie, audit.
- **Authentification** : `POST /api/auth/login`.
- **Consultations** : `GET/POST /api/consultations`, `GET/PATCH /api/consultations/[id]`, ordonnances avec
  alertes d'allergie/répétition (`POST /api/consultations/[id]/prescriptions`).
- **Caisse anti-fraude** : `POST /api/caisse/paiements`, `POST /api/caisse/paiements/[id]/valider`,
  `POST /api/caisse/cloture`, initiation Mobile Money (`POST /api/caisse/paiements/mobile-money`) et
  webhook de confirmation (`POST /api/webhooks/mobile-money`, secret partagé `MOBILE_MONEY_WEBHOOK_SECRET`).
- **Pharmacie/Stocks** : catalogue (`GET/POST /api/pharmacie/stock`), réception de lot
  (`POST /api/pharmacie/stock/[id]/lots`), vente comptoir (`POST /api/pharmacie/ventes`), dispensation sur
  ordonnance (`POST /api/pharmacie/dispensation`), alertes péremption/réapprovisionnement
  (`GET /api/pharmacie/alertes`). Sorties de stock toujours en FEFO (premier expiré, premier sorti).
- **Hospitalisation** : plan des lits temps réel (`GET /api/hospitalisation/lits`), admission
  (`POST /api/hospitalisation/admissions`), sortie/transfert (`PATCH /api/hospitalisation/admissions/[id]`),
  cahier de soins (`GET/POST /api/hospitalisation/admissions/[id]/soins`).
- **RH** : planning des gardes (`GET/POST /api/rh/gardes`), calcul de paie fixe ou rétrocession
  (`GET/POST /api/rh/paie`), validation/paiement (`PATCH /api/rh/paie/[id]`).
- **Dashboards direction** : KPI (`GET /api/dashboards/kpis` — CA facturé/encaissé, CA par pôle, taux
  d'occupation des lits, créances assurances) et rapport d'activité type RMA/SNIS
  (`GET /api/dashboards/rapports`).
- **Communications** : rappel de rendez-vous WhatsApp avec repli SMS (`POST /api/notifications/rappel-rdv`).
- **Mode offline-first** : `lib/offline/` (file de mutations IndexedDB, rejouée au retour réseau) +
  `public/sw.js` (Background Sync, avec repli sur l'événement `online` pour les navigateurs qui ne
  supportent pas cette API, notamment Safari/iOS).

## Limites connues et travail restant

- **Intégrations paiement/communication** : les endpoints/payloads exacts MTN MoMo, Orange Money et Wave
  (`lib/integrations/mobile-money.ts`) sont des squelettes à adapter au contrat marchand réel obtenu auprès
  de chaque opérateur — ne pas déployer en production sans cette étape. WhatsApp Business Cloud API est
  implémentée fidèlement à la doc officielle Meta ; le gateway SMS est un adaptateur générique à brancher
  sur le fournisseur retenu.
- **Alertes d'interaction médicamenteuse** : basées uniquement sur les allergies déclarées et les répétitions
  de prescription déjà en base — ce n'est pas une base pharmacologique certifiée (type Vidal/Thériaque).
- **RMA/SNIS** : le rapport d'activité fournit des compteurs bruts (consultations, diagnostics CIM,
  hospitalisations, examens) ; le mapping vers le formulaire réglementaire exact varie selon le pays et
  reste à faire.
- **Offline-first** : couvre la mise en file des écritures (POST/PATCH) hors-ligne ; ne couvre pas encore le
  cache d'assets applicatifs (App Shell) pour un fonctionnement 100% hors-ligne en lecture.
- **UI** : seule la page de connexion existe pour l'instant (`app/(auth)/login`) ; les écrans métier
  (dashboard, caisse, dossiers patients, etc.) restent à construire au-dessus de cette API.
