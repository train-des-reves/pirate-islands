import { afterEach, describe, expect, it } from 'vitest';

import { Client, type Room } from '@colyseus/sdk';
import { EtatSalleSchema, NOM_SALLE_JEU, type EtatSalle } from '@pirate/protocole';

import { démarrerServeur, type ServeurDemarre } from '../apps/serveur/src/server.js';

let serveur: ServeurDemarre | undefined;
let salle: Room<unknown, EtatSalle> | undefined;

afterEach(async () => {
  await salle?.leave();
  salle = undefined;
  await serveur?.arreter();
  serveur = undefined;
});

describe('rencontre maritime dans SalleJeu', () => {
  it('synchronise un sloop, son équipage, sa poursuite et ses dégâts serveur', async () => {
    serveur = await démarrerServeur({ host: '127.0.0.1', port: 0 });
    const client = new Client(serveur.url);
    salle = (await client.joinOrCreate(
      NOM_SALLE_JEU,
      { graine: 'salle-maritime-test' },
      EtatSalleSchema,
    )) as Room<unknown, EtatSalle>;

    await expect.poll(() => salle!.state.bateauxPirates.size, { timeout: 2_000 }).toBe(1);
    const bateau = [...salle.state.bateauxPirates.values()][0];
    expect(bateau?.routeId).toBe('route-maritime-1');
    expect(
      [...salle.state.pirates.values()].filter((pirate) => pirate.bateauId === bateau?.identifiant),
    ).toHaveLength(2);

    await expect
      .poll(
        () =>
          [...salle!.state.pirates.values()].some(
            (pirate) => pirate.bateauId === bateau?.identifiant && pirate.statut === 'attaque',
          ),
        { timeout: 8_000 },
      )
      .toBe(true);
    await expect
      .poll(() => salle!.state.joueurs.get(salle!.sessionId)?.sante ?? 100, { timeout: 5_000 })
      .toBeLessThan(100);

    const position = salle.state.joueurs.get(salle.sessionId)?.transformation;
    expect(position).toBeDefined();
    expect(Number.isFinite(bateau?.transformation.x)).toBe(true);
    expect(Number.isFinite(bateau?.transformation.lacet)).toBe(true);
  }, 20_000);
});
