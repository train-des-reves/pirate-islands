# ADR 0001 — Fondation technique

- **Statut :** accepté
- **Date :** 2026-08-30
- **Périmètre :** fondation exécutable du jeu navigateur, sans gameplay

## Versions de référence

- Node.js `24.19.0`, ligne LTS prise en charge.
- pnpm `11.19.0`.
- TypeScript `5.9.3` en mode strict.
- Client Vite `8.2.2` avec le paquet complet `babylonjs` `9.23.0`.
- Serveur Colyseus `0.18.10` sur Node.js, avec le transport WebSocket `0.18.2`.
- Vitest `4.1.11` et Playwright `1.62.1` pour les barrières automatisées.

Les versions sont épinglées dans les manifests afin qu'un clone propre reproduise les mêmes
contrats. Les dépendances transitives sont figées par `pnpm-lock.yaml`.

## Axes et unités

Le monde 3D utilise un repère droit :

- `X` : est-ouest, positif vers l'est ;
- `Y` : vertical, positif vers le haut ;
- `Z` : nord-sud, positif vers le nord.

Les unités de simulation sont :

- distance : unité monde, assimilée à un mètre pour les premières règles ;
- temps : seconde ;
- vitesse : unité monde par seconde.

Ces conventions sont exposées par `packages/coeur-jeu` et pourront évoluer uniquement avec une
décision versionnée.

## Autorité serveur

Le serveur est l'autorité pour l'état partagé, les horloges de simulation, les règles et toute
validation future. Le client est une vue interactive : il peut afficher une scène et proposer une
action, mais ne décide pas de l'état de jeu. Les messages échangés passent par les contrats de
`packages/protocole`.

## Pourquoi cette forme

Le monorepo sépare les applications déployables des contrats réutilisables. Vite fournit le cycle
de développement du client, Babylon.js fournit la scène 3D et Colyseus prépare le transport de
salles futures sans introduire de salle dans cette issue. Les tests de contrats tournent dans
Vitest ; Playwright vérifie le parcours navigateur réel et la connexion de santé.
