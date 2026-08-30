# Pirate Islands — règles de contribution

## Langue et périmètre

- Le projet, sa documentation, ses messages d'interface et ses commentaires sont rédigés en français.
- Les issues et PR restent ciblées : pas de gameplay, d'art final ou de fonctionnalité hors contrat sans issue dédiée.
- Les choix structurants sont documentés dans `docs/decisions/`.

## Qualité technique

- Node.js `24.19.0` et pnpm `11.19.0` sont les versions de référence.
- TypeScript est strict ; les packages partagés restent indépendants du navigateur.
- Avant toute PR, exécuter `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` et `pnpm test:e2e`.
- Aucun secret, crochet de test ou dépendance de développement ne doit entrer dans le build client.

## GitHub et revue

- Une PR doit expliquer le résumé, les critères, les tests, la preuve visuelle et les risques/suites.
- La PR associe l'issue concernée avec `Closes #...`.
- Ne pas fusionner sa propre PR ; traiter les retours actionnables et relancer les barrières touchées.
