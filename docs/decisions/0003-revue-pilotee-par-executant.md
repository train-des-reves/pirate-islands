# Décision 0003 — Revue pilotée par l’exécuteur

## Contexte

Le surveillant coordonne plusieurs issues en parallèle. Une revue lancée directement par le surveillant peut perdre le lien opérationnel avec l’exécuteur lorsque le head, la CI ou la preuve change.

## Décision

Après publication d’une PR, son exécuteur lance lui-même une revue indépendante Terra `medium` et reste responsable de la boucle avec ce reviewer. Il annonce au surveillant l’`Entrée en revue` avec l’issue, la PR, le head, la CI, la preuve et le périmètre contrôlé. Le même reviewer est réutilisé pour chaque nouveau head de la même PR ; aucun reviewer parallèle n’est créé.

Après traitement des retours et nouvelle validation, l’exécuteur transmet un `Go final` explicite seulement lorsque la CI GitHub est verte, que le reviewer est favorable sur le head exact, que la preuve est cohérente et que la PR est fusionnable. Le surveillant fusionne alors la PR, vérifie `main` et l’issue, puis archive les tâches après confirmation de la fusion.

## Conséquences

- La responsabilité de la qualité et du dialogue de revue reste attachée à l’issue et à son exécuteur.
- Le surveillant ne fusionne pas une PR simplement parce qu’elle semble prête ou qu’un ancien head avait été validé.
- Les PR déjà en revue lors de l’adoption reprennent leur reviewer existant ; les nouvelles PR suivent ce protocole dès leur publication.
