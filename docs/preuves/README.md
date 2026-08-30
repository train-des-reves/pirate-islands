# Preuves du client

Les tests Chromium produisent une capture 1280×720 de la scène dans
`docs/preuves/pirate-islands-1280x720.png`, une vidéo du parcours des entrées dans
`docs/preuves/entrees-camera.webm` et un rapport HTML dans `docs/preuves/playwright-report/`.

Commande et URL utilisées :

```bash
pnpm dev
# puis, dans un second terminal
pnpm test:e2e
```

URL client : `http://127.0.0.1:4173`
URL santé : `http://127.0.0.1:2567/health`

Scénario déterministe : ouvrir `/`, cliquer dans le canvas, activer le crochet E2E de verrouillage,
avancer avec `W` jusqu'au mur brun, regarder avec la souris, puis appuyer sur `Échap`. Le relecteur
vérifie le déplacement relatif, la caméra bornée, la collision qui bloque le joueur et la pause qui
libère le pointeur.
