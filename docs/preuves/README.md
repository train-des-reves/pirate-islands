# Preuves du client

Les tests Chromium produisent des captures 1280×720 dans `docs/preuves/`, les
vues du monde ensemencé et, pour le parcours première personne, une vidéo
reproductible. Le rapport HTML est conservé dans
`docs/preuves/playwright-report/`.

Commande commune :

```bash
pnpm test:e2e
```

URL client : `http://127.0.0.1:4173`
URL santé : `http://127.0.0.1:2567/health`

## Preuves du monde déterministe

Le test `pnpm test:e2e` produit les vues du monde ensemencé :

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

Le relecteur vérifie sur la première vue l'océan et les trois îles étiquetées,
puis sur la seconde l'alignement terrain/collision depuis la hauteur
d'apparition joueur. Les marqueurs ne sont présents qu'avec `e2e=1`.

## Preuve des entrées et de la caméra

Scénario déterministe : ouvrir `/`, cliquer dans le canvas, activer le crochet
E2E de verrouillage, avancer avec `W` jusqu'au mur brun, regarder avec la
souris, puis appuyer sur `Échap`. Le relecteur vérifie le déplacement relatif,
la caméra bornée, la collision qui bloque le joueur et la pause qui libère le
pointeur. La vidéo correspondante est `entrees-camera.webm`.
