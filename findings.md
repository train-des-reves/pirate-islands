# Findings — orchestration Pirate Islands

Ce fichier regroupe uniquement les incidents distincts rencontrés pendant l’orchestration. Les heartbeats répétitifs sans changement ne sont pas recopiés.

## Décision durable

- 31 août 2026 — Les comparaisons de screenshots, baselines et toHaveScreenshot sont interdites ; elles sont remplacées par des assertions DOM/état et des captures ou vidéos observationnelles.

## Incidents et solutions

### Délégation et canal de retour

- Un surveillant lancé comme sous-agent ne pouvait pas faire remonter l’état de ses exécuteurs via le canal app-server direct ; les exécuteurs s’arrêtaient avant modification.
- Solution : coordination par tâche planifiée toutes les cinq minutes, sans surveillant permanent, et retour obligatoire via `multi_agent_v1__send_input`. La règle est inscrite dans `AGENTS.md` et dans l’automatisation.

### Isolation Git et worktrees

- Les premières relances ont utilisé le worktree principal en `HEAD` détachée, avec une modification étrangère de `AGENTS.md`. Les exécuteurs ont refusé d’écrire pour préserver l’isolation.
- L’ancien worktree #4 (`2acb`) contient encore des changements non publiés ; il n’a pas été nettoyé ni déplacé.
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

## État des exécuteurs et des PR

| Élément | État | Détail |
| --- | --- | --- |
| Exécuteur #3 | Archivé après fusion | Correctif final `303a7ef`, PR [#22](https://github.com/train-des-reves/pirate-islands/pull/22) fusionnée sous `ae2a0f5`. Simulation à pas fixe, CI #18 verte, preuves release rattachées au head final ; issue #3 fermée. |
| Exécuteur #4 | Archivé après fusion | Commit `835c97d`, PR [#23](https://github.com/train-des-reves/pirate-islands/pull/23) fusionnée par `cd739ef`. `lint`, `typecheck`, `test` (19), `build`, `test:e2e` (3/3) et formatage ciblé verts ; `format:check` global reste rouge sur 32 fichiers de base hors issue. Issue #4 fermée comme terminée. |
| Exécuteur #2 | Head anti-comparaison prêt à publier | Branche `codex/issue-2-schemas-salle` ; 8 scénarios Playwright, 38 tests Vitest, lint, typage et build verts ; preuve composite PNG 1280×720 prête. |
| Revue PR #22 | Archivée après fusion | Terra `medium` a d’abord demandé les corrections collision/seuil et le diagnostic E2E ; recontrôle final FAVORABLE sur `303a7ef`, CI #18 verte, preuves release et absence de conflit. |
| Revue PR #23 | Archivée après fusion | Verdict Terra `medium` favorable, avec un point P2 d’accessibilité hors blocage ; tâche archivée après fusion. |
| PR #24 documentation | Ouverte — synchronisation locale prête à publier | Branche `codex/protocole-assets`, issue #25 ; merge local avec `main=ae2a0f5` effectué, asset dédié et description corrigée avec commande/scénario déterministe et `Closes #25`. Il faut pousser ce head, rattacher l’asset au head final, puis obtenir CI verte et le recontrôle Terra. |

Dernier état connu : #22 est fusionnée sous `ae2a0f5`, l’issue #3 est fermée et l’exécuteur/reviewer sont archivés ; #23 est fusionnée et #4 fermée. La PR #24 a son asset dédié et son lien `Closes #25`, mais doit être poussée après synchronisation avec `main`, puis revalidée par CI et Terra. Les anciennes tentatives d’exécuteurs et le worktree `2acb` restent conservés pour ne pas écraser de travail utilisateur.
