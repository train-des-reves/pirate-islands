import { describe, expect, it } from 'vitest';

import { construireEtatAthCombat } from '../apps/client/src/interface/ath-combat';

describe('état de l’ATH de combat', () => {
  it('présente la santé serveur du joueur et de la cible', () => {
    const etat = construireEtatAthCombat(
      { sante: 75, vivant: true },
      { identifiant: 'pirate-aube', sante: 50, vivant: true },
      {
        sequence: 2,
        cibleId: 'pirate-aube',
        degats: 25,
        pirateNeutralise: false,
        horodatageServeur: 123,
      },
    );

    expect(etat).toEqual({
      joueur: { sante: 75, vivant: true },
      cible: { identifiant: 'pirate-aube', sante: 50, vivant: true },
      dernierTir: {
        sequence: 2,
        cibleId: 'pirate-aube',
        degats: 25,
        pirateNeutralise: false,
        horodatageServeur: 123,
      },
    });
  });

  it('borne les valeurs invalides et conserve l’état mort', () => {
    const etat = construireEtatAthCombat(
      { sante: Number.NaN, vivant: false },
      { identifiant: 'pirate-mort', sante: 140, vivant: false },
      undefined,
    );

    expect(etat.joueur).toEqual({ sante: 0, vivant: false });
    expect(etat.cible).toEqual({ identifiant: 'pirate-mort', sante: 100, vivant: false });
    expect(etat.dernierTir).toBeUndefined();
  });

  it('représente l’absence de cible avant le premier tir', () => {
    const etat = construireEtatAthCombat({ sante: 100, vivant: true }, undefined, undefined);

    expect(etat.cible).toBeNull();
    expect(etat.dernierTir).toBeUndefined();
  });
});
