# Preuves de la fondation

Le test `pnpm test:e2e` produit une capture 1280×720 de la scène dans
`docs/preuves/pirate-islands-1280x720.png` et un rapport HTML Chromium dans
`docs/preuves/playwright-report/`.

Commande et URL utilisées :

```bash
pnpm dev
# puis, dans un second terminal
pnpm test:e2e
```

URL client : `http://127.0.0.1:4173`
URL santé : `http://127.0.0.1:2567/health`

## Preuves du monde déterministe

Le test `pnpm test:e2e` produit aussi les vues 1280×720 du monde ensemencé :

- `monde-ensemble-1280x720.png` : océan et trois îles étiquetées ;
- `monde-rivage-1280x720.png` : vue à hauteur de joueur sur le rivage.

Commande et URLs déterministes :

```bash
pnpm dev
# puis, dans un second terminal
pnpm exec playwright test e2e/monde.spec.ts --workers=1
```

```text
http://127.0.0.1:4173/?e2e=1&graine=mvp-defaut&camera=ensemble
http://127.0.0.1:4173/?e2e=1&graine=mvp-defaut&camera=rivage
```
