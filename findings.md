# Findings — orchestration Pirate Islands

Ce fichier regroupe uniquement les incidents distincts rencontrés pendant l’orchestration. Les heartbeats répétitifs sans changement ne sont pas recopiés.

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
- Solution appliquée pour la documentation : l’asset `mvp-docs-pr24-preuve/pirate-islands-1280x720.png` est publié depuis le commit `91bbcc7`, avec `browser_download_url`, type `image/png` et taille contrôlés. L’exécuteur #3 doit appliquer la même procédure aux captures de sa branche après résolution du conflit.
- La documentation de ce protocole est suivie dans l’issue [#25](https://github.com/train-des-reves/pirate-islands/issues/25) et la PR [#24](https://github.com/train-des-reves/pirate-islands/pull/24) ; sa première preuve réutilisait à tort l’asset historique de la PR #21.
- Le reviewer Terra a demandé une commande/scénario déterministe et un asset provenant de la branche #24 ; la branche a été resynchronisée avec `origin/main` dans `b87b670` avant cette nouvelle preuve.

## État des exécuteurs et des PR

| Élément | État | Détail |
| --- | --- | --- |
| Exécuteur #3 | Actif — déblocage conflit/preuves | Commit publié `dd2a30b`, PR [#22](https://github.com/train-des-reves/pirate-islands/pull/22) ouverte. CI #10 verte ; `mergeable:false` après l’avance de `main`. Doit intégrer `origin/main`, publier les captures en release assets et signaler son résultat par `send_message_to_thread`. |
| Exécuteur #4 | Archivé après fusion | Commit `835c97d`, PR [#23](https://github.com/train-des-reves/pirate-islands/pull/23) fusionnée par `cd739ef`. `lint`, `typecheck`, `test` (19), `build`, `test:e2e` (3/3) et formatage ciblé verts ; `format:check` global reste rouge sur 32 fichiers de base hors issue. Issue #4 fermée comme terminée. |
| Revue PR #22 | Changements demandés | La revue Terra `medium` du commit `dd2a30b3` valide la CI #10 mais demande deux P2 : collision logique à aligner sur le relief/pentes (`packages/coeur-jeu/src/monde.ts#L251`, `apps/client/src/jeu/scene.ts#L93`) et justification/réduction de `maxDiffPixelRatio` (`e2e/monde.spec.ts#L26`). |
| Revue PR #23 | Archivée après fusion | Verdict Terra `medium` favorable, avec un point P2 d’accessibilité hors blocage ; tâche archivée après fusion. |
| PR #24 documentation | Ouverte — revue relancée | Branche `codex/protocole-assets`, issue #25 ; head `91bbcc7`, asset dédié publié et description corrigée avec commande/scénario déterministe et `Closes #25`. CI du nouveau head et verdict Terra encore attendus. |

Dernier état connu : la PR #23 est fusionnée et l’issue #4 fermée ; la PR #22 a une CI #10 verte mais attend les corrections P2, la résolution de conflit avec `main`, la preuve asset affichable puis une nouvelle revue Terra `medium`. La PR #24 a désormais son asset dédié et son lien `Closes #25`, en attente de CI et du verdict Terra. `main` a été mis à jour sur `cd739ef`. Les anciennes tentatives d’exécuteurs et le worktree `2acb` restent conservés pour ne pas écraser de travail utilisateur.
