# Pirate Islands

Fondation minimale, exécutable et testable du jeu navigateur Pirate Islands. Cette étape pose les
contrats techniques ; elle n'implémente aucun gameplay.

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

## Organisation

- `apps/client` : client Vite et scène Babylon.js mer/ciel.
- `apps/serveur` : serveur HTTP Node.js, Colyseus et route `/health`.
- `packages/protocole` : contrats JSON partagés.
- `packages/coeur-jeu` : axes, unités et types du monde de jeu.
- `packages/support-tests` : assertions partagées pour les tests.
- `docs/decisions` : décisions techniques durables.

## Vérification complète

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

La preuve visuelle de la fondation est conservée dans `docs/preuves/` après l'exécution du test
Chromium.
