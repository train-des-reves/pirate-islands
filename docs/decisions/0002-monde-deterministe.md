# Décision 0002 — Monde et îles déterministes

## Décision

Le monde du MVP est produit par `genererMonde(graine)` dans
`@pirate/coeur-jeu`. La graine publique par défaut est `mvp-defaut` et
produit exactement trois îles : `ile-aube`, `ile-brume` et `ile-corail`.

La génération utilise une fonction pseudo-aléatoire locale dérivée de la
chaîne fournie. Elle ne lit ni l'horloge, ni l'environnement, ni une source
aléatoire du navigateur. Une même graine reproduit donc les mêmes centres,
rotations, dimensions, reliefs et apparitions. Les descripteurs retournés
sont gelés récursivement afin que le client ne puisse pas modifier le
contrat partagé après sa création.

## Géométrie et contrats

Chaque île expose sa transformation, son ellipse de collision, son rivage,
son approche/quai, une apparition joueur, trois apparitions pirates et un
marqueur de diagnostic. Les positions sont exprimées en mètres dans le monde
main droite, avec `+Y` vers le haut et un océan à `Y = 0`. La géométrie
Babylon utilise les mêmes rayons et la même rotation que la collision
descriptive ; le terrain visible porte donc `checkCollisions`.

Les trois ancrages sont suffisamment espacés pour conserver une mer
navigable, tandis que la variation issue de la graine reste bornée. Les
marqueurs DOM ne sont créés que lorsque l’URL contient `e2e=1` ; la vue
normale ne révèle aucun diagnostic.

## Preuve

La vue d’ensemble reproductible est :

```text
http://127.0.0.1:4173/?e2e=1&graine=mvp-defaut&camera=ensemble
```

La vue de contrôle à hauteur de joueur est :

```text
http://127.0.0.1:4173/?e2e=1&graine=mvp-defaut&camera=rivage
```
