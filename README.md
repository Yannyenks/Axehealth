# AxeHealth v1.0 Enterprise Edition

Plateforme SaaS internationale de gestion intégrée pour cliniques et centres de santé — AxeStack Technologies.

**En ligne** : https://axehealth.vercel.app (Vercel + PostgreSQL Neon + Vercel Blob).
Compte de démo : `admin@axehealth.demo` / `AxeHealth2026!` (super-admin plateforme — voir « Console
super-admin »). Déploiement production sur `master`, redéployé automatiquement à chaque push.

## Stack

- **Frontend/Backend**: Next.js 14 (App Router) + TypeScript
- **UI**: TailwindCSS + Shadcn/UI + Lucide Icons
- **i18n**: next-intl (FR/EN/PT sur les surfaces publiques — voir section dédiée)
- **Data fetching / state**: React Query + Zustand
- **ORM / DB**: Prisma + PostgreSQL (multi-tenant par `organizationId`)
- **Auth**: JWT (access + refresh) + Argon2id, RBAC strict, PIN de caisse
- **Fichiers**: Vercel Blob (logo par établissement)
- **Audit**: journal immuable (`AuditLog`) sur toutes les actions sensibles
- **Offline-first**: file de mutations IndexedDB + service worker (Background Sync)

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, BLOB_READ_WRITE_TOKEN
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

`BLOB_READ_WRITE_TOKEN` (à créer depuis un store Vercel Blob sur le projet) n'est nécessaire que pour
l'upload de logo pendant l'onboarding — le reste de l'app fonctionne sans, et cette étape du parcours
reste simplement ignorable si la variable est absente.

Comptes de démo créés par le seed (mot de passe `AxeHealth2026!`, PIN caisse `1234`) :
`admin@axehealth.demo`, `medecin@axehealth.demo`, `caissier1@axehealth.demo`, `caissier2@axehealth.demo`,
`pharmacien@axehealth.demo`, `infirmier@axehealth.demo`, `secretaire@axehealth.demo`.

## Déploiement (Vercel)

Projet lié à `axso-s-projects/axehealth`, déployé automatiquement à chaque push sur `master`. Base
PostgreSQL et stockage provisionnés via le marketplace Vercel :

- **Base de données** : Neon (`vercel install neon --claim`), connectée aux environnements
  Production/Preview/Development — injecte `DATABASE_URL` automatiquement.
- **Logos** : store Vercel Blob public (`vercel blob create-store <nom> --access public`).
- **Secrets** (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`) : générés
  aléatoirement par environnement, jamais réutilisés depuis `.env` local — `vercel env add <NAME> <env>
  --value <valeur> --sensitive` (`--sensitive` non supporté sur Development).
- **Protection de déploiement** : désactivée (`ssoProtection: null`) — sans ça, les URLs `*.vercel.app`
  exigent une connexion à l'équipe Vercel, ce qui bloque l'accès public à une landing page/API SaaS.
- **Cron** (`vercel.json`) : réglé à une fois par jour — le plan Hobby ne supporte pas les crons
  infra-journaliers (`*/15 * * * *` nécessite Pro).
- **argon2** (hashage de mot de passe) embarque un binaire natif que le bundling standard de Vercel
  casse en production (`No native build was found for platform=linux...`). Deux réglages sont
  nécessaires dans `next.config.js` (`experimental.serverComponentsExternalPackages` **et**
  `experimental.outputFileTracingIncludes` pointant vers `node_modules/argon2/prebuilds/**/*`) — le
  premier seul ne suffit pas, le traçage de fichiers de Vercel exclut quand même le binaire sans le
  second.

Migrations à appliquer manuellement après un changement de schéma (pas de hook de build automatique) :
`DATABASE_URL="<url de prod>" npx prisma migrate deploy`.

## Parcours SaaS: de la landing page au tableau de bord

1. **Landing page** (`/`, publique) — présentation, tarifs (`lib/plans.ts`), CTA vers `/signup` ou `/login`.
2. **Création de l'établissement** (`/signup`, publique) — nom de la clinique, localisation, compte
   administrateur et choix d'une offre (Starter/Pro/Enterprise, scaffold sans paiement réel — voir
   « Limites connues »). Crée le tenant (`Organization`) et son premier utilisateur `ADMIN`
   (`services/organization.service.ts::signupOrganization`).
3. **Assistant d'onboarding** (`/onboarding`, réservé à l'ADMIN tant que non terminé) — personnalisation
   (logo via Vercel Blob, couleur de marque, adresse) puis constitution de l'équipe (invitation de
   collègues avec leur rôle, étape ignorable). `POST /api/organization/onboarding` marque la fin
   du parcours (`Organization.onboardingCompletedAt`) ; tant que ce champ est vide, l'ADMIN y est
   redirigé automatiquement depuis le tableau de bord.
4. **Tableau de bord** (`/dashboard`) — personnalisé avec le logo/la couleur de l'établissement
   (`app/(dashboard)/layout.tsx`), chaque rôle ne voyant que les modules qui le concernent
   (`lib/rbac.ts`, filtrage à la fois dans la navigation et dans chaque route API).

L'équipe peut ensuite être complétée à tout moment depuis **Paramètres** (`/parametres`), qui réunit
profil de l'organisation, gestion d'équipe, configuration des services/chambres/lits et abonnement.

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

## Internationalisation (i18n)

`next-intl` est branché sans routing par préfixe de locale (pas de `/en/...`) : la langue est résolue via
le cookie `NEXT_LOCALE` (`i18n/request.ts`), avec un sélecteur FR/EN/PT (`components/locale-switcher.tsx`).
Le portugais a été ajouté pour couvrir le Cap-Vert (`CV` dans `lib/countries.ts`). Périmètre actuel,
volontairement ciblé pour ne pas risquer de régression sur les modules déjà testés :
- **Traduites (FR/EN/PT)** : landing page, `/login`, `/signup`, `/onboarding` (`messages/fr.json`,
  `messages/en.json`, `messages/pt.json`). Ajouter une langue = ajouter son code à `SUPPORTED_LOCALES`
  (`i18n/locales.ts`) + un fichier `messages/<code>.json` avec les mêmes clés.
- **Encore en français uniquement** : les 15 modules du tableau de bord (patients, caisse, pharmacie,
  hospitalisation, RH, etc.) — chantier de traduction complète à mener séparément.

## Console super-admin (plateforme)

`/super-admin`, réservée aux comptes `User.isSuperAdmin` (posé uniquement par le seed — jamais par
l'inscription self-service). Au-delà de la liste des établissements :

- **KPI plateforme** (`GET /api/superadmin/kpis`) : établissements actifs/suspendus, nouveaux ce mois,
  répartition par offre, **MRR estimé** (nb d'établissements actifs × prix indicatif de `lib/plans.ts` —
  une estimation, aucun paiement réel branché) et **volume d'affaires réel** (somme des paiements validés,
  tous établissements, agrégée — jamais le détail patient/facture).
- **Gestion des offres** : changement de plan par établissement, appliqué immédiatement (`PATCH
  /api/superadmin/organisations/[id]`), cohérent avec l'absence de facturation réelle.
- **Mode assistance** (`POST /api/superadmin/organisations/[id]/assistance`) : accès complet et tracé à
  un établissement, comme si le super-admin en était l'ADMIN. Techniquement, un compte technique réel
  (`User.isSupportAccount`) est créé par établissement au premier usage — jamais connectable via
  `/api/auth/login`, jamais visible dans l'équipe du client (`services/team.service.ts`) — et le super-admin
  bascule dessus via un token JWT dédié (claim `impersonatedBy`), son token d'origine étant conservé dans
  un cookie séparé pour permettre le retour (`POST /api/superadmin/assistance/exit`). Un bandeau permanent
  (`components/assistance-banner.tsx`) signale la session active ; chaque entrée/sortie est journalisée
  (`ASSISTANCE_SESSION_STARTED`/`ASSISTANCE_SESSION_ENDED`). Une session d'assistance ne porte jamais
  `isSuperAdmin` — elle ne peut donc ni démarrer une autre assistance, ni lister les organisations : la
  sortie explicite est l'unique chemin de retour aux privilèges plateforme.

## Offres / scaffold commercial

`lib/plans.ts` définit trois offres (Starter/Pro/Enterprise) affichées sur la landing page, choisies à
l'inscription et visibles en lecture seule dans Paramètres/Console plateforme. **Aucune intégration de
paiement n'est branchée** : `Organization.plan` et `trialEndsAt` sont posés à l'inscription mais rien ne
facture ni ne bloque un compte en fin d'essai — à faire avant un lancement commercial réel (Stripe ou
équivalent), de même que l'application stricte des limites de comptes par offre (actuellement juste
affichée à titre indicatif dans Paramètres).

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
- **Facturation SaaS et sous-domaine par établissement** : voir « Offres / scaffold commercial » ci-dessus —
  aucun paiement réel, pas de sous-domaine/domaine personnalisé par clinique pour l'instant.
- **Invitation d'équipe** : mot de passe provisoire affiché une seule fois à l'écran (aucun envoi d'email),
  et pas encore d'édition/suppression des services/chambres créés (création uniquement).
- **Durée des sessions** : aucun flux de refresh token n'est branché (le endpoint existe dans `lib/auth.ts`
  mais aucune route `/api/auth/refresh` ne l'utilise) — chaque session, y compris une session d'assistance
  super-admin, expire après 15 minutes et nécessite une reconnexion. À traiter avant un usage intensif du
  mode assistance sur de longues interventions.
