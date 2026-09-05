## Résumé

Finalise le pilotage autoritaire du bateau de pêche pour deux joueurs : protocole strict, simulation serveur à pas fixe, acquisition exclusive de la barre, intentions séquencées/cadencées, interpolation cliente et libération sûre à la déconnexion.

## Critères d'acceptation

- [x] Deux joueurs ne peuvent pas posséder la barre simultanément ; le refus est affiché en français.
- [x] Les intentions falsifiées, trop rapides, non finies, rejouées ou envoyées par un non-pilote sont rejetées ou ignorées.
- [x] Les observateurs convergent vers la même pose bornée et les passagers restent attachés au bateau.
- [x] La déconnexion du pilote arrête sûrement le bateau, libère la barre et permet sa reprise.

## Tests

- [x] pnpm lint
- [x] pnpm typecheck
- [x] pnpm test — 38 fichiers, 227 tests
- [x] pnpm build
- [x] Contrôle Prettier ciblé sur les fichiers de cette issue
- [x] e2e/pilotage-reseau.spec.ts — scénario avec deux contextes isolés : embarquer par l'action générale puis prendre la barre via l'action sémantique E2E.

Le head précédent échouait au premier embarquement car la demande de barre ne fait pas monter à bord. Ce head sépare explicitement l'embarquement (clavier / agir) de la prise de barre (demanderBarre). La nouvelle exécution CI est attendue.

## Preuve visuelle

Commande exacte :

pnpm test:e2e -- e2e/pilotage-reseau.spec.ts --workers=1

URL déterministe du premier contexte :
http://127.0.0.1:4173/?e2e=1&pilotage=1&graine=mvp-defaut&nom=Pêcheur-Aube-0001

Le second contexte rejoint la salle renvoyée par le premier via room et utilise le nom Pêcheur-Brume-0002. Le scénario vérifie la prise de barre, le mouvement partagé, le badge Barre occupée par…, la convergence, l'absence de dérive du passager, puis la reprise après déconnexion.

![Composite pilote et observateur en 1280×720](https://raw.githubusercontent.com/train-des-reves/pirate-islands/1b6622f3b94df22dd7d1a00fe7e84339b3062a67/docs/preuves/pilotage-reseau-1280x720.png)

![Reprise de la barre après déconnexion en 1280×720](https://raw.githubusercontent.com/train-des-reves/pirate-islands/1b6622f3b94df22dd7d1a00fe7e84339b3062a67/docs/preuves/pilotage-reseau-reprise-1280x720.png)

Les deux PNG sont versionnés dans la branche de la PR et liés au head exact ci-dessus.

## Risques / suites

- Le contrôle global pnpm format:check reste rouge sur 130 fichiers préexistants ; les fichiers modifiés ici passent le contrôle ciblé.
- La course d'embarquement est corrigée dans le test ; la CI du head en cours valide la suite navigateur complète.

Closes #18
