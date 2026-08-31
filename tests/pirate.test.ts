import { describe, expect, it } from 'vitest';

import {
  DUREE_RETOUR_DEGATS_PIRATE,
  ETATS_PIRATE,
  ModeleVuePirateTerrestre,
  PARTIES_PIRATE,
  bornerAlphaInterpolation,
  bornerRatioSante,
  calculerPosePirate,
  interpolerAngleBorne,
  interpolerNombreBorne,
  type DonneesPirateTerrestre,
} from '../apps/client/src/jeu/pirate';

function donneesPirate(
  modifications: Partial<DonneesPirateTerrestre> = {},
): DonneesPirateTerrestre {
  return {
    id: 'pirate-test',
    transformation: {
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
    },
    ratioSante: 1,
    etat: 'inactif',
    ...modifications,
  };
}

describe('modèle de vue du pirate terrestre', () => {
  it('expose tous les états et une pose morte inactive', () => {
    expect(ETATS_PIRATE).toEqual(['inactif', 'patrouille', 'poursuite', 'attaque', 'mort']);
    expect(PARTIES_PIRATE).toHaveLength(13);

    const pose = calculerPosePirate('mort');
    expect(pose.active).toBe(false);
    expect(pose.armeVisible).toBe(false);
  });

  it('borne les ratios et les coefficients d’interpolation', () => {
    expect(bornerRatioSante(-1)).toBe(0);
    expect(bornerRatioSante(2)).toBe(1);
    expect(bornerRatioSante(Number.NaN)).toBe(1);
    expect(bornerAlphaInterpolation(-1)).toBe(0);
    expect(bornerAlphaInterpolation(2)).toBe(1);
    expect(interpolerNombreBorne(0, 10, -4)).toBe(0);
    expect(interpolerNombreBorne(0, 10, 4)).toBe(10);
    expect(interpolerAngleBorne(Math.PI * 0.9, -Math.PI * 0.9, 0.5)).toBeCloseTo(Math.PI);
  });

  it('interpole une transformation sans dépasser la cible', () => {
    const modèle = new ModeleVuePirateTerrestre(donneesPirate());
    modèle.recevoirEtat(
      donneesPirate({
        transformation: { position: { x: 10, y: 2, z: -4 }, rotationY: Math.PI },
        etat: 'poursuite',
      }),
    );

    modèle.mettreAJour(0.09);
    const intermédiaire = modèle.obtenirEtat();
    expect(intermédiaire.transformation.position.x).toBeGreaterThan(0);
    expect(intermédiaire.transformation.position.x).toBeLessThan(10);

    modèle.mettreAJour(10);
    const final = modèle.obtenirEtat();
    expect(final.transformation).toEqual({ position: { x: 10, y: 2, z: -4 }, rotationY: Math.PI });
    expect(final.pose.active).toBe(true);
  });

  it('signale une blessure pendant une durée bornée', () => {
    const modèle = new ModeleVuePirateTerrestre(donneesPirate());
    modèle.recevoirEtat(donneesPirate({ ratioSante: 0.4, etat: 'attaque' }));
    expect(modèle.obtenirEtat().retourDegatsActif).toBe(true);

    modèle.mettreAJour(DUREE_RETOUR_DEGATS_PIRATE);
    expect(modèle.obtenirEtat().retourDegatsActif).toBe(false);
    expect(modèle.obtenirEtat().ratioSante).toBeLessThan(1);
  });

  it('verrouille la mort et ignore une réactivation tardive', () => {
    const modèle = new ModeleVuePirateTerrestre(donneesPirate({ etat: 'attaque' }));
    modèle.recevoirEtat(donneesPirate({ ratioSante: 0, etat: 'mort' }));
    expect(modèle.obtenirEtat().etat).toBe('mort');
    expect(modèle.obtenirEtat().pose.active).toBe(false);

    modèle.recevoirEtat(donneesPirate({ ratioSante: 1, etat: 'poursuite' }));
    expect(modèle.obtenirEtat().etat).toBe('mort');
    expect(modèle.obtenirEtat().pose.armeVisible).toBe(false);
  });
});
