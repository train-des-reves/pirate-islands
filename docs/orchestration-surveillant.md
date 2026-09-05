# Boucle du surveillant

Le surveillant combine la coordination de la file de travail et la supervision opérationnelle des leads. Il ne remplace pas les leads et ne code pas leurs issues.

## Sources d'état

L'état courant se reconstruit à chaque passage depuis GitHub et les tâches Codex réelles : issues, PR, branches, worktrees, heads, CI et statuts de tâche. Le registre local et `findings.md` ne sont jamais autoritaires pour décider qu'un travail existe encore, qu'il est terminé ou qu'il doit être redispatché.

## Registre opérationnel local

Le surveillant peut conserver sous `.codex/etat-surveillant/` un fichier JSON ou Markdown par cycle ou un état consolidé. Ce répertoire est ignoré par Git.

Champs minimaux recommandés :

```text
issue
id_tache
branche
worktree
modele
dependances
etat_observe
derner_sha_pr
derniere_intervention
prochain_point_a_verifier
```

Le registre sert à reprendre rapidement après interruption et à éviter de relire inutilement des conversations complètes. Toute entrée doit être réconciliée avant action.

## Registre de dépannage

`findings.md` conserve les incidents distincts et réutilisables :

- signature observable ;
- cause comprise ou hypothèse suffisamment solide ;
- récupération validée ;
- limites ou conditions où la récupération ne s'applique pas.

Ne pas y stocker comme vérité opérationnelle la liste courante des leads, PR ou heads. Une telle vue peut rester historique, mais le prochain cycle doit l'ignorer pour toute décision de dispatch ou de fusion tant qu'elle n'a pas été vérifiée.

## Cycle de cinq minutes

1. Recharger le contrat et l'état distant.
2. Réconcilier le registre local avec les tâches, branches, PR et issues réelles.
3. Identifier les issues prêtes sans propriétaire concurrent.
4. Inspecter les leads actifs et classer leur état : progrès normal, attente, blocage connu, boucle improductive, disparu ou ambigu.
5. Pour un blocage connu, envoyer la récupération la plus courte enregistrée.
6. Pour un blocage nouveau, diagnostiquer une fois, conserver les faits localement et n'ajouter à `findings.md` que la connaissance générique réutilisable.
7. Dispatch des nouvelles issues prêtes dans des worktrees indépendants.
8. Traiter les `Entrée en revue` et `Go final` sans créer de reviewer concurrent : le lead possède sa boucle de revue DeepSeek Pro.
9. Avant fusion, revalider le head exact, la CI, la preuve, le verdict, la mergeabilité et l'issue.
10. Après fusion, archiver les tâches concernées, mettre à jour le registre local et recalculer les dépendances.
11. Rendre la main. Aucun polling ad hoc entre deux passages.

## Politique de nudge

Un nudge n'est envoyé que s'il change l'information disponible pour le lead. Il doit être court et actionnable. Exemples : route d'outil connue, rappel d'un invariant oublié, diagnostic d'une panne récurrente, instruction de vérifier un head devenu obsolète ou demande d'un blocker explicite.

Ne pas nudger une tâche qui avance normalement. Ne pas répéter le même message à chaque heartbeat. Ne pas redémarrer un lead sans avoir prouvé que l'ancien propriétaire est terminé, archivé ou irrécupérable.

## Répartition des modèles

- surveillant fusionné contrôleur/advisor : `gpt-5.6-luna`, effort `high` ;
- lead d'issue : `deepseek/deepseek-v4-flash-vision-exp`, effort `high` ;
- reviewer sous-agent du lead : `deepseek/deepseek-v4-pro`, effort `max`.

Cette répartition réserve le modèle le plus coûteux aux décisions globales et au diagnostic inter-agent, tandis que le volume d'implémentation reste sur le modèle de delivery.
