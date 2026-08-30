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
