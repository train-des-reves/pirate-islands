# Pirate Islands — guide des agents

## Langue obligatoire

Tout le projet est en français : interface, erreurs, documentation, issues, PR, commits, commentaires, preuves visuelles et noms métier dans le code. Préférer `avancer`, `reculer`, `interagir`, `tirer`, `Joueur`, `Bateau` et `Pirate`.

Ne pas traduire les noms imposés par une API, une bibliothèque, un protocole ou un outil externe (`package.json`, TypeScript, WebSocket, méthodes Babylon.js, clés Colyseus, scripts usuels `build` et `test`). Toute formulation choisie par l'équipe reste française.

## Contexte produit

Pirate Islands est un jeu multijoueur 3D en vue à la première personne dans un navigateur. Les joueurs sont des pêcheurs qui voyagent d'île en île sur un petit bateau. Celui-ci comporte visiblement un toit, des hublots et une cale accessible. Les joueurs utilisent un pistolet contre des pirates en mer, sur leurs bateaux, et à terre.

Boucle du MVP :

1. Ouvrir le jeu et rejoindre une salle partagée.
2. Se déplacer et regarder autour de soi à la première personne.
3. Embarquer et piloter le bateau de pêche entre les îles.
4. Explorer le bateau, notamment son toit, ses hublots et sa cale.
5. Rencontrer des pirates en mer et à terre.
6. Tirer sur les pirates, subir des dégâts et réapparaître.
7. Modifier l'inversion verticale et les touches ; recharger et conserver ces réglages dans un cookie.

Ne pas ajouter comptes, progression, monétisation, monde persistant, mécanique de pêche, commandes tactiles, chat vocal ou chaîne d'assets complexe sans issue explicite.

## Direction technique

Le dépôt démarre vide. L'issue de fondation crée l'espace de travail et épingle les versions prises en charge. Sauf décision ultérieure :

- TypeScript strict partout.
- Espaces de travail `pnpm`, sans orchestrateur supplémentaire non justifié.
- `apps/client` : Vite et version complète de Babylon.js pour WebGL/WebGPU, collisions, caméras, picking et glTF.
- `apps/serveur` : Node.js, salles Colyseus et état synchronisé possédé par le serveur.
- `packages/protocole` : schémas réseau, messages, validation et types sérialisables ; aucun import navigateur/Babylon.js.
- `packages/coeur-jeu` : règles et calculs déterministes ; aucun import de rendu.
- `packages/support-tests` : fixtures ensemencées et aides réservées aux tests.
- Menus, ATH et réglages en DOM/CSS natif ; pas de framework d'interface sans issue.
- Primitives procédurales et assets appartenant au dépôt ; aucun asset à licence incertaine.

Le serveur fait autorité sur transformations acceptées, santé, dégâts, pirates, validation des tirs, mort et réapparition. Le client possède présentation, entrées, caméra locale, interpolation, audio et interface. Ne jamais accepter d'un client un résultat de dégâts, une santé ou une transformation arbitraire.

Utiliser les API publiques stables et les versions épinglées. Ne pas mettre à jour les dépendances dans une PR de fonctionnalité.

## Arborescence prévue

```text
apps/
  client/
    src/jeu/           # scène, rendu, caméras, systèmes client
    src/interface/     # menus, ATH, réglages
    tests/
  serveur/
    src/salles/        # cycle Colyseus et simulation autoritaire
    tests/
packages/
  protocole/src/
  coeur-jeu/src/
  support-tests/src/
e2e/
docs/decisions/
```

Limiter une fonctionnalité à sa zone. Pour un contrat partagé, effectuer le plus petit changement rétrocompatible dans `packages/protocole` et le signaler. Éviter renommages larges et reformatage parasite.

## Contrats d'intégration

- Monde main droite, `+Y` vers le haut ; l'issue de fondation fixe l'axe avant.
- Une unité vaut un mètre. Horodatages réseau en millisecondes ; deltas de simulation en secondes.
- État continu partagé dans les schémas synchronisés ; requêtes/événements dans des messages nommés.
- Le jeu consomme `avancer`, `reculer`, `gauche`, `droite`, `interagir`, `tirer`, `pause`, jamais des touches brutes.
- Cookie de réglages : préférences non sensibles, JSON versionné compatible URL, `Path=/`, `SameSite=Lax`, `Max-Age` d'un an. Valeur invalide, absente, dupliquée ou obsolète : défauts sûrs.
- Monde et IA exposent une graine fixe pour les tests ; aucune dépendance à une horloge réelle non contrôlée.
- Crochets navigateur réservés aux tests protégés par le mode E2E et absents ou inertes en production.
- Contrôles DOM libellés, focus visible et clavier. Le verrouillage du pointeur exige un geste ; Échap le libère et ouvre la pause.

## Barrières qualité

L'issue de fondation crée et toutes les PR maintiennent :

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Exécuter d'abord le test ciblé, puis toutes les barrières applicables avant revue.

- Règles pures, cookie, touches, calculs et protocole : Vitest.
- Multijoueur : vrai serveur en processus de test ; arrivée/départ, validation, autorité et état.
- Parcours navigateur : Playwright sur Chromium épinglé.
- Interface ou scène stable : comparaison de captures, avec contenu non déterministe masqué.
- Deux joueurs : deux contextes navigateur isolés, jamais deux pages partageant le stockage.
- Régression : test rouge avant le correctif, vert après.

Préférer les assertions comportementales. Ne pas relâcher un seuil, ajouter une attente arbitraire ou supprimer une assertion pour faire passer la CI.

## Preuve visuelle obligatoire

Chaque PR contient `## Preuve visuelle`, y compris infrastructure, serveur et protocole, avec :

- au moins une image ou courte vidéo/GIF intégrée dans la description ;
- commande exacte et URL/scénario déterministe ;
- une phrase disant ce que le relecteur vérifie ;
- pour un travail invisible, un harnais visuel : fenêtres synchronisées, état réseau, diagnostic ou rapport Playwright. Une capture de terminal seule ne suffit pas.

Fournir toutes les vues nommées dans l'issue, en 1280×720 sauf indication. Masquer les diagnostics sans rapport. La preuve provient obligatoirement de la branche de PR.

## Processus issue et PR

Chaque agent implémente exactement une issue.

1. Lire ce fichier, l'issue et ses dépendances.
2. Vérifier que les dépendances sont fusionnées ; sinon signaler le blocage sans les recréer.
3. Créer `codex/issue-<numéro>-<résumé>` depuis la branche par défaut à jour.
4. Limiter le diff à l'issue ; aucun refactor voisin ni mise à jour opportuniste.
5. Ajouter les tests demandés et générer la preuve visuelle depuis la branche.
6. Ouvrir une PR non brouillon en français avec `Closes #<numéro>` et `Résumé`, `Critères d'acceptation`, `Tests`, `Preuve visuelle`, `Risques / suites`.
7. Demander une revue, ne pas fusionner sa propre PR, traiter chaque retour actionnable et relancer les barrières touchées.

La PR reste incomplète sans tests, preuve, lien d'issue ou revue. Commits compréhensibles et français. Aucun secret, dépendance générée, fichier local ou artefact sans rapport.

## Revue GitHub et auto-approbation

Le compte GitHub qui a ouvert une PR ne peut pas l'approuver lui-même. Si le reviewer et l'auteur utilisent le même compte, GitHub peut refuser l'action `APPROVE` : publier alors une revue `COMMENT` détaillée avec le verdict, les contrôles effectués et les éventuels points restants. Ne jamais présenter cette revue comme une approbation ; une validation `APPROVED` doit venir d'un autre compte habilité.

## Protocole de mise à jour d'une PR

Lorsqu'une PR ouverte devient en conflit ou que `main` évolue :

1. Vérifier via GitHub l'issue, la PR, sa branche, son commit de tête et son état de fusion.
2. Vérifier localement que le worktree est propre et que la branche suit bien son remote.
3. Récupérer `origin/main`, puis fusionner `origin/main` dans la branche de la PR. Ne pas réinitialiser la branche et ne pas recréer la PR.
4. Résoudre chaque conflit au fichier près : conserver les règles de `main`, les changements de l'issue et les contrats existants ; ne jamais supprimer silencieusement une règle ou un test. En cas d'ambiguïté produit, demander une décision dans l'issue.
5. Vérifier l'absence de marqueurs de conflit et exécuter `git diff --check`.
6. Relancer les barrières applicables, au minimum `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` et `pnpm test:e2e`, puis `pnpm format:check` si la documentation ou le formatage ont changé.
7. Créer un commit de merge explicite en français, pousser la même branche et vérifier sur GitHub que le commit de tête est à jour et que la PR est redevenue fusionnable.
8. Signaler les checks CI encore en attente ou absents ; ne pas déclarer la PR validée sans revue humaine ou approbation GitHub.

## Définition de terminé

Une issue est terminée seulement si tous les critères sont démontrés, les tests demandés et existants passent, la construction réussit, les cas invalides pertinents sont gérés, toutes les preuves visuelles sont présentes, la revue est faite et aucun changement sans rapport ou asset sans licence n'est inclus.

En cas de conflit ou de rupture de contrat, demander une décision dans l'issue. Consigner toute décision durable dans `docs/decisions/`.
