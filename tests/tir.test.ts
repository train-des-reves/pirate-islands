import { describe, expect, it } from 'vitest';

import {
  CADENCE_TIR_MS,
  DUREE_ECLAIR_BOUCHE_MS,
  DUREE_RECUPERATION_TIR_MS,
  GestionnaireTirLocal,
  calculerDirectionDepuisRegard,
  calculerReculTir,
  eclairBoucheVisible,
  normaliserDirection,
  type IntentionTir,
} from '../apps/client/src/jeu/tir';

describe('intention de tir locale', () => {
  it('gère la pression, le maintien, la cadence et la libération avec une horloge factice', () => {
    let maintenant = 1_000;
    const intentions: IntentionTir[] = [];
    const gestionnaire = new GestionnaireTirLocal({
      obtenirVisee: () => ({
        origine: { x: 1, y: 2, z: 3 },
        direction: { x: 3, y: 4, z: 0 },
      }),
      emetteur: { émettre: (intention) => intentions.push(intention) },
      lireHorodatage: () => maintenant,
    });

    gestionnaire.actualiser(false);
    expect(intentions).toHaveLength(0);

    gestionnaire.actualiser(true);
    expect(intentions).toHaveLength(1);
    expect(intentions[0]?.sequence).toBe(1);

    maintenant += CADENCE_TIR_MS - 1;
    gestionnaire.actualiser(true);
    expect(intentions).toHaveLength(1);

    maintenant += 1;
    gestionnaire.actualiser(true);
    expect(intentions).toHaveLength(2);
    expect(intentions.map((intention) => intention.sequence)).toEqual([1, 2]);

    gestionnaire.actualiser(false);
    expect(gestionnaire.estActif()).toBe(false);

    maintenant += CADENCE_TIR_MS;

    gestionnaire.actualiser(true);
    expect(intentions).toHaveLength(3);
    expect(intentions.map((intention) => intention.sequence)).toEqual([1, 2, 3]);
  });

  it('émet une origine finie et une direction normalisée', () => {
    const intentions: IntentionTir[] = [];
    const gestionnaire = new GestionnaireTirLocal({
      obtenirVisee: () => ({
        origine: { x: 4, y: 5, z: 6 },
        direction: { x: 3, y: 4, z: 0 },
      }),
      emetteur: { émettre: (intention) => intentions.push(intention) },
      lireHorodatage: () => 250,
    });

    gestionnaire.actualiser(true);

    expect(intentions[0]).toMatchObject({
      sequence: 1,
      origine: { x: 4, y: 5, z: 6 },
      direction: { x: 0.6, y: 0.8, z: 0 },
      horodatageClient: 250,
    });
    expect(
      Math.hypot(...Object.values(intentions[0]?.direction ?? { x: 0, y: 0, z: 0 })),
    ).toBeCloseTo(1);
  });

  it('sépare la direction de visée du recul visuel', () => {
    const direction = calculerDirectionDepuisRegard({ lacet: 0, tangage: 0 });
    expect(direction).toEqual({ x: 0, y: 0, z: 1 });

    const droite = calculerDirectionDepuisRegard({ lacet: Math.PI / 2, tangage: 0 });
    expect(droite.x).toBeCloseTo(1);
    expect(droite.y).toBeCloseTo(0);
    expect(droite.z).toBeCloseTo(0);

    expect(normaliserDirection({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('calcule la récupération et la durée de l’éclair de bouche', () => {
    expect(calculerReculTir(0, undefined)).toBe(0);
    expect(calculerReculTir(0, 0)).toBe(1);
    expect(calculerReculTir(DUREE_RECUPERATION_TIR_MS / 2, 0)).toBeCloseTo(0.5);
    expect(calculerReculTir(DUREE_RECUPERATION_TIR_MS, 0)).toBe(0);
    expect(eclairBoucheVisible(0, 0)).toBe(true);
    expect(eclairBoucheVisible(DUREE_ECLAIR_BOUCHE_MS, 0)).toBe(false);
  });
});
