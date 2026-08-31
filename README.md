# Pirate Islands

Fondation exécutable et testable du jeu navigateur Pirate Islands. Le client contient maintenant
un monde déterministe et un bac à sable première personne : les actions sémantiques pilotent le
déplacement, le regard et les collisions locales sans exposer les touches brutes au gameplay.

## Démarrage rapide

Pré-requis : Node.js `24.19.0` et pnpm `11.19.0`.

```bash
pnpm install
pnpm dev
```

Le client est disponible sur [http://127.0.0.1:4173](http://127.0.0.1:4173) et le serveur sur
[http://127.0.0.1:2567](http://127.0.0.1:2567). La route de santé est
[http://127.0.0.1:2567/health](http://127.0.0.1:2567/health).

Copier `.env.example` vers `.env` pour modifier les URLs et ports locaux. Les variables `VITE_*`
sont publiques et ne doivent jamais contenir de secret.

## Commandes

| Commande         | Rôle                                            |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Lance le client Vite et le serveur Colyseus     |
| `pnpm build`     | Construit les packages, le client et le serveur |
| `pnpm lint`      | Vérifie ESLint                                  |
| `pnpm typecheck` | Vérifie les projets TypeScript et les outils    |
| `pnpm test`      | Lance les tests fumée Vitest, dont `/health`    |
| `pnpm test:e2e`  | Lance le test Chromium Playwright               |

## Contrôles par défaut

Les mêmes actions fonctionnent sur les claviers français et QWERTY :

| Action    | Raccourci par défaut       |
| --------- | -------------------------- |
| Avancer   | `Z` ou `W`                 |
| Reculer   | `S`                        |
| Gauche    | `Q` ou `A`                 |
| Droite    | `D`                        |
| Interagir | `E`                        |
| Tirer     | bouton gauche de la souris |
| Pause     | `Échap`                    |

Un clic dans la scène verrouille le pointeur. La souris regarde autour du joueur, le déplacement
reste relatif à son lacet et `Échap` libère le pointeur en ouvrant la pause.

Le pistolet local attaché à la caméra tire au plus une fois toutes les 150 ms. Chaque tir accepté
produit une intention typée (séquence, origine, direction normalisée et horodatage client), avec
recul, récupération et éclair de bouche purement visuels.

## Monde déterministe

Les URLs qui fournissent `graine` ou `camera` affichent l'océan et les trois îles produites par
`genererMonde('mvp-defaut')`. La vue d'ensemble E2E est disponible à
`http://127.0.0.1:4173/?e2e=1&graine=mvp-defaut&camera=ensemble` et la vue rivage à
`http://127.0.0.1:4173/?e2e=1&graine=mvp-defaut&camera=rivage`.

Le profil de relief partagé par `@pirate/coeur-jeu` et Babylon aligne la collision logique sur la
pente visible ; les apparitions joueur et pirates sont validées sur cette surface locale.

## Organisation

- `apps/client` : client Vite, scène Babylon.js, entrées sémantiques et bac à sable première personne.
- `apps/serveur` : serveur HTTP Node.js, Colyseus et route `/health`.
- `packages/protocole` : contrats JSON partagés.
- `packages/coeur-jeu` : axes, unités, génération déterministe et types du monde de jeu.
- `packages/support-tests` : assertions partagées pour les tests.
- `docs/decisions` : décisions techniques durables.

## Vérification complète

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

Les preuves visuelles du monde déterministe et du parcours première personne sont conservées dans
`docs/preuves/` après l'exécution du test Chromium.
