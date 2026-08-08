# AxeCompta Enterprise Edition

SaaS de comptabilité générale, analytique et fiscale (norme SYSCOHADA révisée) augmenté par un copilote
IA conversationnel — AxeStack Technologies.

**En ligne** : https://axecompta.vercel.app (Vercel + PostgreSQL Neon + Vercel Blob).
Compte de démo : `admin@axecompta.demo` / `AxeCompta2026!` (super-admin plateforme — voir « Console
super-admin »). Déploiement production sur `master`, redéployé automatiquement à chaque push.

## Stack

- **Frontend/Backend**: Next.js 14 (App Router) + TypeScript
- **UI**: TailwindCSS + Shadcn/UI + Lucide Icons
- **i18n**: next-intl (FR/EN/PT sur les surfaces publiques — voir section dédiée)
- **Data fetching / state**: React Query + Zustand
- **ORM / DB**: Prisma + PostgreSQL (multi-tenant par `organizationId`)
- **Auth**: JWT (access + refresh) + Argon2id, RBAC strict (ADMIN/COMPTABLE/CAISSIER)
- **IA**: Gemini 1.5 Pro (`lib/ai/gemini.ts`) — OCR de factures/reçus, audit financier d'accueil, chat CFO
- **Fichiers**: Vercel Blob (logo d'organisation, documents scannés)
- **Audit**: journal immuable (`AuditLog`) sur toutes les actions sensibles
- **Offline-first**: file de mutations IndexedDB + service worker (Background Sync)

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, GEMINI_API_KEY, BLOB_READ_WRITE_TOKEN
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

`BLOB_READ_WRITE_TOKEN` (à créer depuis un store Vercel Blob sur le projet) n'est nécessaire que pour
l'upload de logo/documents scannés — le reste de l'app fonctionne sans. `GEMINI_API_KEY` conditionne le
copilote IA (scanner OCR, audit d'onboarding, chat) ; en son absence, ces trois fonctionnalités retombent
sur un comportement dégradé explicite (message d'erreur clair côté OCR/chat, diagnostic générique côté
audit) plutôt que de planter.

Comptes de démo créés par le seed (mot de passe `AxeCompta2026!`) :
`admin@axecompta.demo` (ADMIN, super-admin plateforme), `comptable@axecompta.demo` (COMPTABLE),
`caissier@axecompta.demo` (CAISSIER).

## Déploiement (Vercel)

Projet lié à `axso-s-projects/axecompta`, déployé automatiquement à chaque push sur `master`. Base
PostgreSQL et stockage provisionnés via le marketplace Vercel :

- **Base de données** : Neon (`vercel install neon --claim`), connectée aux environnements
  Production/Preview/Development — injecte `DATABASE_URL` automatiquement.
- **Fichiers** : store Vercel Blob public (`vercel blob create-store <nom> --access public`).
- **Secrets** (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`) : générés/obtenus par environnement,
  jamais réutilisés depuis `.env` local — `vercel env add <NAME> <env> --value <valeur> --sensitive`
  (`--sensitive` non supporté sur Development).
- **Protection de déploiement** : désactivée (`ssoProtection: null`) — sans ça, les URLs `*.vercel.app`
  exigent une connexion à l'équipe Vercel, ce qui bloque l'accès public à une landing page/API SaaS.
- **argon2** (hashage de mot de passe) embarque un binaire natif que le bundling standard de Vercel
  casse en production (`No native build was found for platform=linux...`). Deux réglages sont
  nécessaires dans `next.config.js` (`experimental.serverComponentsExternalPackages` **et**
  `experimental.outputFileTracingIncludes` pointant vers `node_modules/argon2/prebuilds/**/*`) — le
  premier seul ne suffit pas, le traçage de fichiers de Vercel exclut quand même le binaire sans le
  second.

Migrations à appliquer manuellement après un changement de schéma (pas de hook de build automatique) :
`DATABASE_URL="<url de prod>" npx prisma migrate deploy`.

## Parcours SaaS: de la landing page au tableau de bord personnalisé

1. **Landing page** (`/`, publique) — présentation, tarifs (`lib/plans.ts`), CTA vers `/signup` ou `/login`.
2. **Création de l'organisation** (`/signup`, publique) — nom de l'entreprise, localisation, compte
   administrateur et choix d'une offre (Starter/Pro/Enterprise, scaffold sans paiement réel — voir
   « Offres / scaffold commercial »). Crée le tenant (`Organization`) et son premier utilisateur `ADMIN`
   (`services/organization.service.ts::signupOrganization`).
3. **Assistant d'onboarding** (`/onboarding`, réservé à l'ADMIN tant que non terminé), en 4 étapes :
   1. **Personnalisation** — logo (Vercel Blob), couleur de marque, adresse.
   2. **Audit express par l'IA** — un copilote pose une série de questions simples (secteur, taille,
      chiffre d'affaires, gestion comptable actuelle, principal défi financier) comme un expert-comptable
      qui découvre un nouveau dossier client, puis produit un diagnostic (`POST
      /api/organization/business-audit`, `services/business-audit.service.ts`) stocké sur
      `Organization.businessProfile` : maturité comptable, risques, priorités et modules recommandés.
      Étape sautable à tout moment — jamais bloquante.
   3. **Constitution de l'équipe** — invitation de collègues avec leur rôle.
   4. **Récapitulatif** — `POST /api/organization/onboarding` marque la fin du parcours
      (`Organization.onboardingCompletedAt`) ; tant que ce champ est vide, l'ADMIN y est redirigé
      automatiquement depuis le tableau de bord.
4. **Tableau de bord** (`/dashboard`) — personnalisé avec le logo/la couleur de l'organisation
   (`app/(dashboard)/layout.tsx`) et le diagnostic de l'audit IA (priorités, modules recommandés),
   chaque rôle ne voyant que les modules qui le concernent (`lib/rbac.ts`, filtrage à la fois dans la
   navigation et dans chaque route API). Le copilote CFO reste accessible en permanence via une bulle
   flottante (`components/ai/CfoAssistantFloating.tsx`).

L'équipe peut ensuite être complétée à tout moment depuis **Paramètres** (`/parametres`), qui réunit
profil de l'organisation, gestion d'équipe et abonnement.

## Comptabilité en partie double

`POST /api/journal-entries` (`services/journal-entry.service.ts`) est le point d'entrée unique de
création d'écriture : la somme des débits doit égaler la somme des crédits au centime près avant tout
`prisma.journalEntry.create`, chaque ligne référence un compte du plan comptable de l'organisation
(`Account`, numérotation SYSCOHADA), et un compte auxiliaire (401/411) exige un tiers (`ThirdParty`) sur
la ligne correspondante. Une écriture validée est immuable (aucune route de mise à jour/suppression) —
une correction se fait par contre-passation, même logique que le journal d'audit.

Le copilote IA (`POST /api/ai/ocr-import`) scanne une facture/un reçu (Gemini Vision) et **propose**
une écriture équilibrée sans jamais l'écrire directement en base — la validation humaine passe
obligatoirement par `/api/journal-entries`, qui revalide l'équilibre indépendamment de ce que l'IA a
suggéré.

## Modules et API livrés

- **Schéma Prisma** (`prisma/schema.prisma`) : organisations, utilisateurs/RBAC, plan comptable
  (`Account`), journaux (`Journal`), écritures (`JournalEntry`/`JournalItem`), tiers (`ThirdParty`),
  centres de coûts (`CostCenter`, comptabilité analytique), immobilisations (`Asset`), documents scannés
  (`ScannedDocument`), conversations IA (`AiConversation`/`AiMessage`), relevés bancaires
  (`BankStatement`/`BankStatementLine`), audit (`AuditLog`).
- **Authentification** : `POST /api/auth/login` (+ MFA TOTP, `POST /api/auth/signup`).
- **Comptabilité** : `GET/POST /api/journal-entries`, `GET/POST /api/journals`, `GET/POST /api/accounts`,
  `GET/POST /api/third-parties`.
- **Copilote IA** : `POST /api/ai/ocr-import` (scan facture/reçu → proposition d'écriture),
  `POST /api/ai/chat` (chat CFO conversationnel, `AiConversation`/`AiMessage`),
  `POST /api/organization/business-audit` (audit financier d'accueil).
- **Organisation & équipe** : `GET/PATCH /api/organization`, `POST /api/organization/onboarding`,
  `POST /api/organization/logo`, `GET/POST /api/team`, `PATCH /api/team/[id]`.
- **Mode offline-first** : `lib/offline/` (file de mutations IndexedDB, rejouée au retour réseau) +
  `public/sw.js` (Background Sync, avec repli sur l'événement `online` pour les navigateurs qui ne
  supportent pas cette API, notamment Safari/iOS).

## Internationalisation (i18n)

`next-intl` est branché sans routing par préfixe de locale (pas de `/en/...`) : la langue est résolue via
le cookie `NEXT_LOCALE` (`i18n/request.ts`), avec un sélecteur FR/EN/PT (`components/locale-switcher.tsx`).
- **Traduites (FR/EN/PT)** : landing page, `/login`, `/signup`, `/onboarding` (`messages/fr.json`,
  `messages/en.json`, `messages/pt.json`). Ajouter une langue = ajouter son code à `SUPPORTED_LOCALES`
  (`i18n/locales.ts`) + un fichier `messages/<code>.json` avec les mêmes clés.
- **Encore en français uniquement** : le tableau de bord et le module Comptabilité — chantier de
  traduction complète à mener séparément.

## Console super-admin (plateforme)

`/super-admin`, réservée aux comptes `User.isSuperAdmin` (posé uniquement par le seed — jamais par
l'inscription self-service). Au-delà de la liste des organisations :

- **KPI plateforme** (`GET /api/superadmin/kpis`) : organisations actives/suspendues, nouvelles ce mois,
  répartition par offre, **MRR estimé** (nb d'organisations actives × prix indicatif de `lib/plans.ts` —
  une estimation déclarative, aucun paiement réel branché).
- **Gestion des offres** : changement de plan par organisation, appliqué immédiatement (`PATCH
  /api/superadmin/organisations/[id]`), cohérent avec l'absence de facturation réelle.
- **Mode assistance** (`POST /api/superadmin/organisations/[id]/assistance`) : accès complet et tracé à
  une organisation, comme si le super-admin en était l'ADMIN. Techniquement, un compte technique réel
  (`User.isSupportAccount`) est créé par organisation au premier usage — jamais connectable via
  `/api/auth/login`, jamais visible dans l'équipe du client (`services/team.service.ts`) — et le
  super-admin bascule dessus via un token JWT dédié (claim `impersonatedBy`), son token d'origine étant
  conservé dans un cookie séparé pour permettre le retour (`POST /api/superadmin/assistance/exit`). Un
  bandeau permanent (`components/assistance-banner.tsx`) signale la session active ; chaque entrée/sortie
  est journalisée (`ASSISTANCE_SESSION_STARTED`/`ASSISTANCE_SESSION_ENDED`). Une session d'assistance ne
  porte jamais `isSuperAdmin` — elle ne peut donc ni démarrer une autre assistance, ni lister les
  organisations : la sortie explicite est l'unique chemin de retour aux privilèges plateforme.

## Offres / scaffold commercial

`lib/plans.ts` définit trois offres (Starter/Pro/Enterprise) affichées sur la landing page, choisies à
l'inscription et visibles en lecture seule dans Paramètres/Console plateforme. **Aucune intégration de
paiement n'est branchée** : `Organization.plan` et `trialEndsAt` sont posés à l'inscription mais rien ne
facture ni ne bloque un compte en fin d'essai — à faire avant un lancement commercial réel (Stripe ou
équivalent), de même que l'application stricte des limites de comptes par offre (actuellement juste
affichée à titre indicatif dans Paramètres).

## Limites connues et travail restant

- **RAG SYSCOHADA/CGI** : le copilote IA embarque les règles de numérotation OHADA directement dans ses
  prompts (`services/ai-ocr.service.ts`, `services/ai-chat.service.ts`) — ce n'est pas un pipeline RAG
  réel (ingestion de textes réglementaires, base vectorielle, retrieval). À construire séparément si un
  ancrage documentaire complet est requis.
- **Comptabilité analytique** : `CostCenter` et `JournalItem.costCenterId` posent la structure, mais
  aucune interface de gestion des centres de coûts n'est encore livrée (création uniquement possible via
  Prisma Studio ou une future route dédiée).
- **Rapprochement bancaire** : `BankStatement`/`BankStatementLine` sont modélisés côté schéma, sans API
  d'import ni interface de pointage pour l'instant.
- **Immobilisations** : le modèle `Asset` calcule un `cumulAmortissement` stocké, mais aucun job de
  dotation périodique automatique n'est branché.
- **Offline-first** : couvre la mise en file des écritures (POST/PATCH) hors-ligne ; ne couvre pas encore
  le cache d'assets applicatifs (App Shell) pour un fonctionnement 100% hors-ligne en lecture.
- **Facturation SaaS et sous-domaine par organisation** : voir « Offres / scaffold commercial » ci-dessus —
  aucun paiement réel, pas de sous-domaine/domaine personnalisé par organisation pour l'instant.
- **Invitation d'équipe** : mot de passe provisoire affiché une seule fois à l'écran (aucun envoi d'email).
- **Durée des sessions** : aucun flux de refresh token n'est branché (le endpoint existe dans `lib/auth.ts`
  mais aucune route `/api/auth/refresh` ne l'utilise) — chaque session, y compris une session d'assistance
  super-admin, expire après 15 minutes et nécessite une reconnexion. À traiter avant un usage intensif du
  mode assistance sur de longues interventions.
