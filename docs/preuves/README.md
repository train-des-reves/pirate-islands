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

Scénario déterministe : ouvrir `/?e2e=1`, cliquer dans le canvas, activer le crochet
E2E de verrouillage, avancer avec `W` jusqu'au mur brun, regarder avec la
souris, puis appuyer sur `Échap`. Le relecteur vérifie le déplacement relatif,
la caméra bornée, la collision qui bloque le joueur et la pause qui libère le
pointeur. La vidéo correspondante est `entrees-camera.webm`.

## Preuve des réglages et du cookie

Scénario déterministe : ouvrir /?e2e=1, verrouiller le pointeur, appuyer sur
Échap, ouvrir les réglages, cocher l’inversion verticale, remplacer Avancer
par Z, appliquer, recharger, puis avancer avec Z. Le relecteur vérifie le
focus initial, Avancer : Z, Inverser la souris : Oui, la conservation après
rechargement, l’absence de localStorage et le déplacement effectif avec Z.

Commande exacte :

pnpm exec playwright test e2e/reglages.spec.ts --config=playwright.config.ts

URL : http://127.0.0.1:4173/?e2e=1

La vidéo illustrative 1280×720 correspondante est reglages-cookie.webm.

## Preuve de la salle multijoueur

Commande et scénario déterministes :

```bash
pnpm test:e2e -- e2e/salle-jeu.spec.ts
```

Le scénario ouvre deux contextes Chromium isolés sur :

```text
http://127.0.0.1:4173/?e2e=1&diagnostic=salle&graine=mvp-defaut
```

Le premier contexte crée la salle ; le second la rejoint avec le paramètre
`room` affiché par le premier. Le relecteur vérifie le même identifiant de salle,
deux `sessionId` distincts et `Joueurs connectés : 2` dans les deux vues, puis
`Joueurs connectés : 1` après la fermeture du second contexte. La capture
composite attendue est `docs/preuves/salle-jeu-1280x720.png`.

## Preuve visuelle — pistolet et intention de tir

Scénario déterministe : ouvrir `/?e2e=1&temps=5000`, verrouiller le pointeur par le crochet E2E,
tirer trois fois, vérifier les intentions `1`, `2`, `3` espacées de 150 ms, puis avancer l’horloge
de 180 ms. Le relecteur vérifie le pistolet au repos, l’éclair et le recul pendant le tir, le
compteur augmenté exactement trois fois, la direction normalisée et la récupération visuelle.

Commande exacte :

```bash
pnpm exec playwright test e2e/entrees-camera.spec.ts --workers=1
```

URL déterministe : `http://127.0.0.1:4173/?e2e=1&temps=5000`.

La branche produit `pistolet-tir-repos-1280x720.png`, `pistolet-tir-eclair-recul-1280x720.png`,
`pistolet-tir-recuperation-1280x720.png` et `pistolet-tir.webm`.

## Preuve des règles de pêche déterministes

Scénario déterministe : ouvrir `/?e2e=1&presentation=regles-peche&graine=peche-mvp-v1`.
Le harnais présente sept lignes — Attente, Morsure, Prise, Trop tôt, Trop tard, Annulation, Hors zone —
et cinq résultats (`prise`, `trop_tot`, `trop_tard`, `hors_zone`, `annulee`) dérivés de la graine.
Le relecteur vérifie l’ordre des phases, les résultats attendus, l’absence d’erreur console et
que le harnais n’apparaît pas dans la vue normale (`/?e2e=1`).

Commande exacte :

```bash
pnpm test:e2e -- e2e/peche.spec.ts
```

URL déterministe : `http://127.0.0.1:4173/?e2e=1&presentation=regles-peche&graine=peche-mvp-v1`.

La capture composite attendue est `docs/preuves/peche-regles-1280x720.png`.

## Preuve visuelle — embarquement et pilotage du bateau de pêche

Scénario déterministe : ouvrir `/?e2e=1&graine=mvp-defaut&pilotage=1`. Le crochet
E2E simule le parcours : invite d'embarquement, prise de barre, accélération,
virage, collision bloquée au rivage, sortie de barre et marche à bord vers la
cale. Le relecteur vérifie l'invite « Prendre la barre », la vitesse et le
sillage qui augmentent, le blocage sur le rivage sans traversée, la sortie de
barre et le rattachement du passager au référentiel du bateau.

Commande exacte :

```bash
pnpm exec playwright test e2e/pilotage.spec.ts --workers=1
```

URL déterministe : `http://127.0.0.1:4173/?e2e=1&graine=mvp-defaut&pilotage=1`.

La branche produit `pilotage-barre-1280x720.png`,
`pilotage-sillage-1280x720.png`, `pilotage-collision-rivage-1280x720.png`,
`pilotage-sortie-barre-1280x720.png`, `pilotage-cale-1280x720.png` et
`pilotage-bateau.webm`.
