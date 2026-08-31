# Findings — orchestration Pirate Islands

Ce fichier regroupe uniquement les incidents distincts rencontrés pendant l’orchestration. Les heartbeats répétitifs sans changement ne sont pas recopiés.

## Incidents et solutions

### Délégation et canal de retour

- Un surveillant lancé comme sous-agent ne pouvait pas faire remonter l’état de ses exécuteurs via le canal app-server direct ; les exécuteurs s’arrêtaient avant modification.
- Solution : coordination par tâche planifiée toutes les cinq minutes, sans surveillant permanent, et retour obligatoire via `multi_agent_v1__send_input`. La règle est inscrite dans `AGENTS.md` et dans l’automatisation.
- Nouvelle règle : l’exécuteur lance lui-même la revue Terra de sa PR, annonce l’`Entrée en revue`, boucle avec le même reviewer sur chaque head et transmet un `Go final` explicite. Le surveillant fusionne seulement après ce go, la CI verte, le verdict favorable sur le head exact et la preuve cohérente.

### Isolation Git et worktrees

- Les premières relances ont utilisé le worktree principal en `HEAD` détachée, avec une modification étrangère de `AGENTS.md`. Les exécuteurs ont refusé d’écrire pour préserver l’isolation.
- L’ancien worktree #4 (`2acb`) contient encore des changements non publiés ; il n’a pas été nettoyé ni déplacé.
- Le worktree #9 a rencontré le même verrou Git partagé (`C:/dev/pirate-islands/.git/worktrees/pirate-islands5/index.lock`) hors zone d’écriture au moment du commit ; les deux fichiers du correctif et toutes les barrières sont prêts, et une relance escaladée ciblée est autorisée.
- Solution : créer des tâches Codex avec worktrees dédiés et branches attachées : #3 dans `25a9`, #4 dans `9db6`. Les exécuteurs suivants ont travaillé sur les branches d’issue propres sans toucher à `2acb`.

### GitHub CLI et dépôt cible

- `gh` était bloqué par `C:\Users\ducda\AppData\Roaming\GitHub CLI\config.yml` (accès refusé) dans les worktrees isolés. Une première commande visait par erreur `FR-PAR-ASP/mono`.
- Solution : utiliser le dépôt réel `train-des-reves/pirate-islands`, avec le connecteur GitHub ou une commande autorisée hors sandbox lorsque l’écriture/lecture distante était nécessaire.

### Modèle et disponibilité des revues

- Le rôle `executeur` de la surface de collaboration était épinglé à Luna `medium`, alors que le protocole demandait Luna `max` ; la consigne a été ajoutée au protocole et à l’automatisation.
- Les revues Terra ont échoué sur `unreadable_encrypted_agent_task`. Des revues Codex dédiées Luna `max` ont ensuite été relancées après la remise à zéro du quota.
- Les deux revues Luna `max` ont terminé sans produire de verdict textuel exploitable ; aucun commentaire ou approbation automatique n’a été publié.

### Preuves visuelles GitHub et conflits de fusion

- La PR #22 affichait ses captures avec des chemins relatifs `docs/preuves/...`; GitHub ne les rendait pas visibles dans la description, et l’avance de `main` après la fusion de #23 la signalait `mergeable:false`.
- Solution appliquée pour la documentation : l’asset `mvp-docs-pr24-preuve/pirate-islands-1280x720.png` a été publié depuis la branche #24 avec `browser_download_url`, type `image/png` et taille contrôlés. L’exécuteur #3 a appliqué la même procédure aux captures de sa branche après résolution du conflit.
- La documentation de ce protocole est suivie dans l’issue [#25](https://github.com/train-des-reves/pirate-islands/issues/25) et la PR [#24](https://github.com/train-des-reves/pirate-islands/pull/24) ; sa première preuve réutilisait à tort l’asset historique de la PR #21.
- Le reviewer Terra a demandé une commande/scénario déterministe et un asset provenant de la branche #24 ; la branche a été resynchronisée avec `origin/main` dans `b87b670` avant cette nouvelle preuve.
- Après la synchronisation, la CI #22 a reproduit sur Ubuntu un déplacement trop lent : le delta de rendu plafonné à 0,05 s ne simulait pas assez de temps réel et l’E2E restait sur `sol` au lieu d’atteindre `mur`. Solution : simulation à pas fixe de 50 ms avec accumulateur borné à 250 ms (`303a7ef`), régression sur frames lentes, puis CI #18 entièrement verte.
- Les captures #22 ont été remplacées depuis le head final `303a7ef` dans `mvp-1b-pr22-preuve` (deux PNG `image/png`, URLs `browser_download_url` absolues). La PR #22 a été fusionnée sous `ae2a0f5` ; `main` a été avancé en fast-forward.
- La preuve documentaire a ensuite été republiée dans `mvp-docs-pr24-preuve-626910f` depuis le head `626910f`; CI #20 et le recontrôle Terra sont favorables. La PR #24 a été fusionnée sous `d096f50`, puis l’issue #25 a été fermée.
- La PR #30 de l’issue #5 a publié six preuves bateau mais sa CI `33396133967` échoue sur la comparaison historique `e2e/monde.spec.ts` (14 533 pixels différents, ratio 0,02) alors que les trois scénarios bateau passent ; la PR reste bloquée jusqu’au diagnostic et au correctif de la régression, sans affaiblir la baseline monde.

## État des exécuteurs et des PR

| Élément | État | Détail |
| --- | --- | --- |
| Exécuteur #3 | Archivé après fusion | Correctif final `303a7ef`, PR [#22](https://github.com/train-des-reves/pirate-islands/pull/22) fusionnée sous `ae2a0f5`. Simulation à pas fixe, CI #18 verte, preuves release rattachées au head final ; issue #3 fermée. |
| Exécuteur #4 | Archivé après fusion | Commit `835c97d`, PR [#23](https://github.com/train-des-reves/pirate-islands/pull/23) fusionnée par `cd739ef`. `lint`, `typecheck`, `test` (19), `build`, `test:e2e` (3/3) et formatage ciblé verts ; `format:check` global reste rouge sur 32 fichiers de base hors issue. Issue #4 fermée comme terminée. |
| Revue PR #22 | Archivée après fusion | Terra `medium` a d’abord demandé les corrections collision/seuil et le diagnostic E2E ; recontrôle final FAVORABLE sur `303a7ef`, CI #18 verte, preuves release et absence de conflit. |
| Revue PR #23 | Archivée après fusion | Verdict Terra `medium` favorable, avec un point P2 d’accessibilité hors blocage ; tâche archivée après fusion. |
| PR #24 documentation | Fusionnée — suivi terminé | Head `626910f`, release `mvp-docs-pr24-preuve-626910f`, CI #20 verte et verdict Terra FAVORABLE ; fusion `d096f50`, issue #25 fermée, reviewer archivé. |
| PR #26 acteur pirate | Ouverte — resynchronisation requise | Head `869f316`, CI `33391934291` verte et reviewer Terra FAVORABLE sur ce head, mais après la fusion de #27 GitHub indique `CONFLICTING/DIRTY` contre `main=cfa0d654`; le `Go final` précédent est invalidé. #8 doit fusionner `origin/main`, résoudre, revalider puis renvoyer un go. |
| PR #27 pistolet | Fusionnée — suivi à archiver | Head `65ce1b4`, CI `33392373483` verte, revue Terra APPROUVABLE, fusion GitHub `cfa0d654`, issue #6 fermée ; l’archivage de l’exécuteur/reviewer reste à effectuer. |
| PR #28 réglages | Ouverte — correction prête, commit bloqué | Head `9890514`, CI `33393655971` verte et PR CLEAN ; Terra demande le rejet strict des champs inconnus du cookie à la racine et dans `liaisons`, avec tests de régression. #9 a envoyé son `Entrée en revue`, les barrières passent et le diff est limité aux deux fichiers, mais le commit/push est bloqué par `index.lock` hors zone d’écriture ; pas de go final. |
| PR #29 salle Colyseus | Ouverte — correction en revue | Head `ae1a64c`, CI `33393144041` verte mais PR CONFLICTING/DIRTY ; Terra demande une resynchronisation avec `origin/main` et l’isolation des changements hors périmètre (`AGENTS.md`, décision monde, E2E monde, baseline, configuration, findings). #2 a envoyé son `Entrée en revue` et traite ces findings ; pas de go final. |
| PR #30 bateau | Ouverte — CI rouge | Head `7adf297`, CI `33396133967` échoue sur la baseline monde historique ; les trois tests bateau passent. Aucun reviewer ni go final avant correction et CI verte. |

Dernier état connu : #22 est fusionnée sous `ae2a0f5`, #23 est fusionnée, #24 est fusionnée sous `d096f50`, et #27 vient d’être fusionnée sous `cfa0d654` avec #6 fermée. #26 attend le go formel de #8 ; #28 et #29 ont des changements demandés ; #30 est bloquée par sa CI rouge. Les anciennes tentatives et le worktree `2acb` restent conservés pour ne pas écraser de travail utilisateur.
