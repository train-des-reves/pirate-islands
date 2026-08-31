# Findings — orchestration Pirate Islands

Ce fichier regroupe uniquement les incidents distincts rencontrés pendant l’orchestration. Les heartbeats répétitifs sans changement ne sont pas recopiés.

## Incidents et solutions

### Délégation et canal de retour

- Un surveillant lancé comme sous-agent ne pouvait pas faire remonter l’état de ses exécuteurs via le canal app-server direct ; les exécuteurs s’arrêtaient avant modification.
- Solution : coordination par tâche planifiée toutes les cinq minutes, sans surveillant permanent ; les exécutants consignent leur état dans leur propre tâche et le surveillant le lit au cycle suivant. Aucun statut direct n’est envoyé au surveillant. La règle est inscrite dans `AGENTS.md` et dans l’automatisation.
- Nouvelle règle : le lead délègue la revue à un sous-agent `deepseek/deepseek-v4-pro` `max`, annonce l’`Entrée en revue`, boucle avec le même reviewer sur chaque head et consigne un `Go final` explicite. Le surveillant fusionne seulement après ce go, la CI verte, le verdict favorable sur le head exact et la preuve cohérente.
- Nouvelle règle de cadence : le surveillant n’attend ni ne sonde les tâches d’agents ; il envoie ses consignes, poursuit les actions sûres et laisse les messages des agents ou la heartbeat suivante fournir les retours.
- Nouvelle règle de modèle : aucun `github-copilot/*` n’est autorisé. Les verdicts Carver/Huygens issus de cette route ne sont pas recevables pour un `Go final`; les PR encore ouvertes doivent utiliser un sous-agent reviewer exact `deepseek/deepseek-v4-pro` en `max`.
- Nouvelle règle de modèle : tout développement d’exécuteur utilise `deepseek/deepseek-v4-flash-vision-exp` avec l’effort `high`; les revues utilisent désormais exclusivement `deepseek/deepseek-v4-pro` avec l’effort `max`.
- Nouvelle règle de canal : les exécutants ne communiquent plus directement avec le surveillant ; ils consignent une ligne `thème — état` dans leur tâche, lue par la heartbeat de cinq minutes. Les seules exceptions sont les checklists formelles d’`Entrée en revue` et de `Go final`, également consignées dans la tâche.
- Nouvelle règle de revue : chaque lead délègue la revue à un sous-agent `deepseek/deepseek-v4-pro` / `max` et réutilise ce même sous-agent pour les nouveaux heads ; le lead ne réalise pas lui-même la revue.
- Transition appliquée : les tâches reviewers Carver (`01a05807-3168-7271-b1ff-5e8676d982f9`) et Huygens (`01a05807-326a-7553-a1d9-82010eb525c5`) ont été fermées ; leurs verdicts ne peuvent plus valider #28 ou #29. Les exécutants concernés doivent relancer un sous-agent reviewer `deepseek/deepseek-v4-pro` `max` après les préconditions.

### Isolation Git et worktrees

- Les premières relances ont utilisé le worktree principal en `HEAD` détachée, avec une modification étrangère de `AGENTS.md`. Les exécuteurs ont refusé d’écrire pour préserver l’isolation.
- L’ancien worktree #4 (`2acb`) contient encore des changements non publiés ; il n’a pas été nettoyé ni déplacé.
- Le worktree #9 a rencontré le même verrou Git partagé (`C:/dev/pirate-islands/.git/worktrees/pirate-islands5/index.lock`) hors zone d’écriture au moment du commit ; les deux fichiers du correctif et toutes les barrières sont prêts, et une relance escaladée ciblée est autorisée.
- Solution : créer des tâches Codex avec worktrees dédiés et branches attachées : #3 dans `25a9`, #4 dans `9db6`. Les exécuteurs suivants ont travaillé sur les branches d’issue propres sans toucher à `2acb`.

### GitHub CLI et dépôt cible

- `gh` était bloqué par `C:\Users\ducda\AppData\Roaming\GitHub CLI\config.yml` (accès refusé) dans les worktrees isolés. Une première commande visait par erreur `FR-PAR-ASP/mono`.
- Solution : utiliser le dépôt réel `train-des-reves/pirate-islands`, avec le connecteur GitHub ou une commande autorisée hors sandbox lorsque l’écriture/lecture distante était nécessaire.

### Modèle et disponibilité des revues

- Le rôle `executeur` de la surface de collaboration était épinglé à Luna `medium`, alors que le protocole demandait `deepseek/deepseek-v4-pro` `max` ; la consigne a été ajoutée au protocole et à l’automatisation.
- Les revues Terra ont échoué sur `unreadable_encrypted_agent_task`. Des revues Codex dédiées `deepseek/deepseek-v4-pro` `max` ont ensuite été relancées après la remise à zéro du quota.
- Les deux revues `deepseek/deepseek-v4-pro` `max` ont terminé sans produire de verdict textuel exploitable ; aucun commentaire ou approbation automatique n’a été publié.

### Preuves visuelles GitHub et conflits de fusion

- La PR #22 affichait ses captures avec des chemins relatifs `docs/preuves/...`; GitHub ne les rendait pas visibles dans la description, et l’avance de `main` après la fusion de #23 la signalait `mergeable:false`.
- Solution appliquée pour la documentation : l’asset `mvp-docs-pr24-preuve/pirate-islands-1280x720.png` a été publié depuis la branche #24 avec `browser_download_url`, type `image/png` et taille contrôlés. L’exécuteur #3 a appliqué la même procédure aux captures de sa branche après résolution du conflit.
- La documentation de ce protocole est suivie dans l’issue [#25](https://github.com/train-des-reves/pirate-islands/issues/25) et la PR [#24](https://github.com/train-des-reves/pirate-islands/pull/24) ; sa première preuve réutilisait à tort l’asset historique de la PR #21.
- Le reviewer Terra a demandé une commande/scénario déterministe et un asset provenant de la branche #24 ; la branche a été resynchronisée avec `origin/main` dans `b87b670` avant cette nouvelle preuve.
- Après la synchronisation, la CI #22 a reproduit sur Ubuntu un déplacement trop lent : le delta de rendu plafonné à 0,05 s ne simulait pas assez de temps réel et l’E2E restait sur `sol` au lieu d’atteindre `mur`. Solution : simulation à pas fixe de 50 ms avec accumulateur borné à 250 ms (`303a7ef`), régression sur frames lentes, puis CI #18 entièrement verte.
- Les captures #22 ont été remplacées depuis le head final `303a7ef` dans `mvp-1b-pr22-preuve` (deux PNG `image/png`, URLs `browser_download_url` absolues). La PR #22 a été fusionnée sous `ae2a0f5` ; `main` a été avancé en fast-forward.
- La preuve documentaire a ensuite été republiée dans `mvp-docs-pr24-preuve-626910f` depuis le head `626910f`; CI #20 et le recontrôle Terra sont favorables. La PR #24 a été fusionnée sous `d096f50`, puis l’issue #25 a été fermée.
- La PR #30 de l’issue #5 a publié six preuves bateau mais sa CI `33396133967` échoue sur la comparaison historique `e2e/monde.spec.ts` (14 533 pixels différents, ratio 0,02) alors que les trois scénarios bateau passent. Le head `5ee19e6` conserve `toHaveScreenshot` et une baseline déterministe sans barrière affaiblie ; CI `33405611461` est SUCCESS et le reviewer `deepseek/deepseek-v4-pro` unique est lancé. Aucun Go final avant son verdict.
- La PR #28 de l’issue #9 a eu la CI `33399387771` en échec uniquement sur `e2e/reglages.spec.ts:133` après trois tentatives ; neuf scénarios passaient et lint, typage, Vitest et build restaient verts. Le correctif E2E est maintenant poussé dans `12fb3b8`, avec CI `33402672618` SUCCESS, release `mvp-2a-pr9-preuve-12fb3b8` alignée et reviewer `deepseek/deepseek-v4-pro` unique lancé ; aucun Go final avant son verdict.
- La PR #26 de l’issue #8 a été resynchronisée sur `main=15281a2d`, puis validée sur le head `5c2d4dd` par la CI `33401490823`, la preuve dédiée et le reviewer Terra direct. Le Go final a été consigné ; la PR a été fusionnée sous `778dbd1`, l’issue #8 est fermée et l’exécuteur/reviewer sont archivés.

## État des exécuteurs et des PR

| Élément | État | Détail |
| --- | --- | --- |
| Exécuteur #3 | Archivé après fusion | Correctif final `303a7ef`, PR [#22](https://github.com/train-des-reves/pirate-islands/pull/22) fusionnée sous `ae2a0f5`. Simulation à pas fixe, CI #18 verte, preuves release rattachées au head final ; issue #3 fermée. |
| Exécuteur #4 | Archivé après fusion | Commit `835c97d`, PR [#23](https://github.com/train-des-reves/pirate-islands/pull/23) fusionnée par `cd739ef`. `lint`, `typecheck`, `test` (19), `build`, `test:e2e` (3/3) et formatage ciblé verts ; `format:check` global reste rouge sur 32 fichiers de base hors issue. Issue #4 fermée comme terminée. |
| Revue PR #22 | Archivée après fusion | Terra `medium` a d’abord demandé les corrections collision/seuil et le diagnostic E2E ; recontrôle final FAVORABLE sur `303a7ef`, CI #18 verte, preuves release et absence de conflit. |
| Revue PR #23 | Archivée après fusion | Verdict Terra `medium` favorable, avec un point P2 d’accessibilité hors blocage ; tâche archivée après fusion. |
| PR #24 documentation | Fusionnée — suivi terminé | Head `626910f`, release `mvp-docs-pr24-preuve-626910f`, CI #20 verte et verdict Terra FAVORABLE ; fusion `d096f50`, issue #25 fermée, reviewer archivé. |
| PR #26 acteur pirate | Fusionnée — suivi terminé | Head `5c2d4dd`, CI `33401490823` SUCCESS, preuve dédiée alignée, revue Terra favorable et Go final reçu ; fusion GitHub sous `778dbd1`, issue #8 fermée, exécuteur et reviewer archivés. |
| PR #27 pistolet | Fusionnée — suivi terminé | Head `65ce1b4`, CI `33392373483` verte, revue Terra APPROUVABLE, fusion GitHub `cfa0d654`, issue #6 fermée ; exécuteur archivé, reviewer conservé pour la PR #26. |
| Exécuteur #7 combat serveur | Lancé — développement en cours | Dépendances #2 et #1 fusionnées ; worktree isolé créé avec DeepSeek `high`, aucune PR encore. |
| Exécuteur #10 IA pirate | Lancé — développement en cours | Dépendances #2 et #1 fusionnées ; worktree isolé créé avec DeepSeek `high`, aucune PR encore. |
| Exécuteur #11 bateau pirate | Lancé — développement en cours | Dépendances #3 et #1 fusionnées ; worktree isolé créé avec DeepSeek `high`, aucune PR encore. |
| Exécuteur #12 arrivée en salle | Lancé — développement en cours | Dépendances #2 et #1 fusionnées ; worktree isolé créé avec DeepSeek `high`, aucune PR encore. |
| PR #28 réglages | Ouverte — revue deepseek-v4-pro en cours | Head `12fb3b8`, CI `33402672618` SUCCESS, release `mvp-2a-pr9-preuve-12fb3b8` alignée et PR CLEAN/MERGEABLE ; reviewer `deepseek/deepseek-v4-pro` lancé, Go final attendu. |
| PR #29 salle Colyseus | Fusionnée — suivi terminé | Head `b3a191d`, CI `33399155131` SUCCESS, revue directe `gpt-5.6-terra` medium favorable, preuve PNG alignée et PR `MERGEABLE/CLEAN`. Go final reçu ; fusion GitHub sous `15281a2d`, issue #2 fermée et tâches #2/reviewer archivées. |
| PR #30 bateau | Ouverte — revue deepseek-v4-pro en cours | Head `5ee19e6`, CI `33405611461` SUCCESS après restauration de `toHaveScreenshot` et baseline déterministe ; reviewer `deepseek/deepseek-v4-pro` unique lancé, Go final attendu. |

Dernier état connu : #22 est fusionnée sous `ae2a0f5`, #23 est fusionnée, #24 est fusionnée sous `d096f50`, #26 est fusionnée sous `778dbd1`, #27 est fusionnée sous `cfa0d654` et #29 sous `15281a2d`, avec les issues #8, #6 et #2 fermées. #28 et #30 ont une CI verte, une preuve cohérente et un reviewer `deepseek/deepseek-v4-pro` unique en cours ; leurs Go finaux restent attendus. Les exécutants #7, #10, #11 et #12 sont lancés. Les anciennes tentatives et le worktree `2acb` restent conservés pour ne pas écraser de travail utilisateur.
