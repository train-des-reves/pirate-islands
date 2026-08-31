# Findings — orchestration Pirate Islands

Ce fichier regroupe uniquement les incidents distincts rencontrés pendant l’orchestration. Les heartbeats répétitifs sans changement ne sont pas recopiés.

## Incidents et solutions

### Délégation et canal de retour

- Un surveillant lancé comme sous-agent ne pouvait pas faire remonter l’état de ses exécuteurs via le canal app-server direct ; les exécuteurs s’arrêtaient avant modification.
- Solution : coordination par tâche planifiée toutes les cinq minutes, sans surveillant permanent ; les exécutants consignent leur état dans leur propre tâche et le surveillant le lit au cycle suivant. Aucun statut direct n’est envoyé au surveillant. La règle est inscrite dans `AGENTS.md` et dans l’automatisation.
- Nouvelle règle : l’exécuteur lance lui-même la revue Terra de sa PR, annonce l’`Entrée en revue`, boucle avec le même reviewer sur chaque head et transmet un `Go final` explicite. Le surveillant fusionne seulement après ce go, la CI verte, le verdict favorable sur le head exact et la preuve cohérente.
- Nouvelle règle de cadence : le surveillant n’attend ni ne sonde les tâches d’agents ; il envoie ses consignes, poursuit les actions sûres et laisse les messages des agents ou la heartbeat suivante fournir les retours.
- Nouvelle règle de modèle : aucun `github-copilot/*` n’est autorisé. Les verdicts Carver/Huygens issus de cette route ne sont pas recevables pour un `Go final`; #2 et #9 doivent relancer eux-mêmes un reviewer direct `gpt-5.6-terra`, tandis que la revue directe existante de #8 peut être réutilisée.
- Nouvelle règle de modèle : tout développement d’exécuteur utilise désormais `deepseek/deepseek-v4-flash-vision-exp` avec l’effort `high`; les revues utilisent exclusivement `gpt-5.6-terra` avec l’effort `medium`.
- Nouvelle règle de canal : les exécutants ne communiquent plus directement avec le surveillant ; ils consignent une ligne `thème — état` dans leur tâche, lue par la heartbeat de cinq minutes. Les seules exceptions sont les checklists formelles d’`Entrée en revue` et de `Go final`, également consignées dans la tâche.
- Transition appliquée : les tâches reviewers Carver (`01a05807-3168-7271-b1ff-5e8676d982f9`) et Huygens (`01a05807-326a-7553-a1d9-82010eb525c5`) ont été fermées ; leurs verdicts ne peuvent plus valider #28 ou #29. Les exécutants concernés doivent relancer un reviewer direct Terra après les préconditions.

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
- La PR #30 de l’issue #5 a publié six preuves bateau mais sa CI `33396133967` échoue sur la comparaison historique `e2e/monde.spec.ts` (14 533 pixels différents, ratio 0,02) alors que les trois scénarios bateau passent. Le head `dd5ae864` conserve `toHaveScreenshot` restauré, sans baseline fabriquée ni barrière affaiblie ; les tentatives locales ont échoué avant capture faute de marqueurs E2E ou par `spawn EPERM`. Une relance unique avec `VITE_E2E=1` explicite est en cours avant tout arbitrage CI.
- La PR #28 de l’issue #9 a eu la CI `33399387771` en échec uniquement sur `e2e/reglages.spec.ts:133` après trois tentatives ; neuf scénarios passaient et lint, typage, Vitest et build restaient verts. Le premier correctif `blur()` n’a pas suffi : le second corrige le verrouillage du pointeur uniquement en mode E2E, sans modifier le chemin navigateur normal, et est poussé dans `2bcc9ef`. Aucun run ne cible encore ce head ; release, revue et Go restent interdits jusque-là.
- Après la fusion de la PR #29, la PR #26 de l’issue #8 est redevenue `CONFLICTING/DIRTY` contre `main` malgré la CI `33399797676` verte et la preuve alignée sur son ancien head `480f14c`. La resynchronisation a produit le nouveau head `5c2d4dd` ; barrières, preuve et recontrôle du même reviewer Terra direct restent à valider avant tout Go ou merge.

## État des exécuteurs et des PR

| Élément | État | Détail |
| --- | --- | --- |
| Exécuteur #3 | Archivé après fusion | Correctif final `303a7ef`, PR [#22](https://github.com/train-des-reves/pirate-islands/pull/22) fusionnée sous `ae2a0f5`. Simulation à pas fixe, CI #18 verte, preuves release rattachées au head final ; issue #3 fermée. |
| Exécuteur #4 | Archivé après fusion | Commit `835c97d`, PR [#23](https://github.com/train-des-reves/pirate-islands/pull/23) fusionnée par `cd739ef`. `lint`, `typecheck`, `test` (19), `build`, `test:e2e` (3/3) et formatage ciblé verts ; `format:check` global reste rouge sur 32 fichiers de base hors issue. Issue #4 fermée comme terminée. |
| Revue PR #22 | Archivée après fusion | Terra `medium` a d’abord demandé les corrections collision/seuil et le diagnostic E2E ; recontrôle final FAVORABLE sur `303a7ef`, CI #18 verte, preuves release et absence de conflit. |
| Revue PR #23 | Archivée après fusion | Verdict Terra `medium` favorable, avec un point P2 d’accessibilité hors blocage ; tâche archivée après fusion. |
| PR #24 documentation | Fusionnée — suivi terminé | Head `626910f`, release `mvp-docs-pr24-preuve-626910f`, CI #20 verte et verdict Terra FAVORABLE ; fusion `d096f50`, issue #25 fermée, reviewer archivé. |
| PR #26 acteur pirate | Ouverte — resynchronisation en cours | Nouveau head `5c2d4dd` poussé après le conflit suivant #29 ; CI, preuve et recontrôle du reviewer Terra direct restent à confirmer. Go précédent invalidé. |
| PR #27 pistolet | Fusionnée — suivi terminé | Head `65ce1b4`, CI `33392373483` verte, revue Terra APPROUVABLE, fusion GitHub `cfa0d654`, issue #6 fermée ; exécuteur archivé, reviewer conservé pour la PR #26. |
| PR #28 réglages | Ouverte — conflit à résynchroniser | Head `2bcc9ef`, branche propre mais `main` a avancé ; resynchronisation ciblée nécessaire avant tout nouveau run CI, release ou revue directe. |
| PR #29 salle Colyseus | Fusionnée — suivi terminé | Head `b3a191d`, CI `33399155131` SUCCESS, revue directe `gpt-5.6-terra` medium favorable, preuve PNG alignée et PR `MERGEABLE/CLEAN`. Go final reçu ; fusion GitHub sous `15281a2d`, issue #2 fermée et tâches #2/reviewer archivées. |
| PR #30 bateau | Ouverte — génération de baseline en cours | Head `dd5ae864`, CI `33396133967` rouge sur la comparaison monde historique ; `toHaveScreenshot` est restauré et aucune barrière n’est affaiblie. #5 tente une relance `VITE_E2E=1` explicite avant de produire une baseline déterministe cohérente avec le bateau au quai. |

Dernier état connu : #22 est fusionnée sous `ae2a0f5`, #23 est fusionnée, #24 est fusionnée sous `d096f50`, #27 est fusionnée sous `cfa0d654` et #29 sous `15281a2d`, avec les issues #6 et #2 fermées. #26 est en resynchronisation après conflit ; #28 est en resynchronisation avant CI/release/revue ; #30 tente encore une génération de baseline sans affaiblir sa comparaison historique. Les anciennes tentatives et le worktree `2acb` restent conservés pour ne pas écraser de travail utilisateur.
