# Décision 0003 — Revue pilotée par l’exécuteur

## Contexte

Le surveillant coordonne plusieurs issues en parallèle. Une revue lancée directement par le surveillant peut perdre le lien opérationnel avec l’exécuteur lorsque le head, la CI ou la preuve change.

## Décision

Tout exécuteur développe avec le modèle exact `deepseek/deepseek-v4-flash-vision-exp` et l’effort `high`. Après publication d’une PR, son lead délègue la revue indépendante à un sous-agent avec le modèle exact `gpt-5.6-terra` et l’effort `medium`, puis reste responsable de la boucle avec ce reviewer. Le lead ne réalise pas lui-même la revue. Il consigne dans sa tâche l’`Entrée en revue` avec l’issue, la PR, le head, la CI, la preuve et le périmètre contrôlé ; le surveillant la lit au passage planifié suivant. Le même reviewer est réutilisé pour chaque nouveau head de la même PR ; aucun reviewer parallèle n’est créé. Tout changement d’étape, blocage, nouveau head ou résultat de barrière est consigné dans la tâche sous la forme minimale `thème — état`, sans communication directe au surveillant. Les messages formels gardent uniquement les champs requis par la checklist.

Après traitement des retours et nouvelle validation, l’exécuteur transmet un `Go final` explicite seulement lorsque la CI GitHub est verte, que le reviewer est favorable sur le head exact, que la preuve est cohérente et que la PR est fusionnable. Le surveillant fusionne alors la PR, vérifie `main` et l’issue, puis archive les tâches après confirmation de la fusion.

## Conséquences

- La responsabilité de la qualité et du dialogue de revue reste attachée à l’issue et à son exécuteur.
- Le surveillant ne fusionne pas une PR simplement parce qu’elle semble prête ou qu’un ancien head avait été validé.
- Les PR déjà en revue lors de l’adoption reprennent leur reviewer existant ; les nouvelles PR suivent ce protocole dès leur publication.
- Le surveillant ne bloque pas sur l’attente d’un agent : il s’appuie sur les statuts consignés dans les tâches et sur le prochain passage planifié.
- Aucun modèle `github-copilot/*` n’est autorisé. Une revue déjà produite par cette route ne constitue pas un verdict recevable pour le `Go final` ; l’exécuteur doit lancer un reviewer direct `gpt-5.6-terra`.
- La revue doit être exécutée par un sous-agent Terra `medium` délégué par le lead ; le lead ne s’auto-revoit pas et réutilise ce même sous-agent pour chaque nouveau head.
