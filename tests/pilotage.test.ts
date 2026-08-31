import { describe, expect, it } from 'vitest';

import { créerDescripteurBateau } from '../apps/client/src/jeu/bateau';
import {
  ACCELERATION_BATEAU,
  INTENTIONS_AUCUNE,
  TRAINEE_BATEAU,
  VITESSE_MAXIMALE_BATEAU,
  calculerIntentionsDepuisActions,
  calculerVitesseAngulaireBateau,
  creerEtatNavigationBateau,
  determinerInvite,
  positionLocaleVersMonde,
  positionMondeVersLocale,
  simulerNavigationBateau,
  simulerVitesseBateau,
  type ObstacleNavigation,
} from '../apps/client/src/jeu/pilotage';

describe('pilotage du bateau de pêche', () => {
  it('convertit les actions sémantiques en intentions bornées', () => {
    expect(
      calculerIntentionsDepuisActions({
        avancer: true,
        reculer: false,
        gauche: false,
        droite: false,
      }),
    ).toEqual({
      poussee: 1,
      gouvernail: 0,
    });
    expect(
      calculerIntentionsDepuisActions({
        avancer: false,
        reculer: true,
        gauche: true,
        droite: false,
      }),
    ).toEqual({
      poussee: -1,
      gouvernail: -1,
    });
    expect(
      calculerIntentionsDepuisActions({ avancer: true, reculer: true, gauche: true, droite: true }),
    ).toEqual({
      poussee: 0,
      gouvernail: 0,
    });
    // Les valeurs aberrantes sont bornées.
    expect(
      calculerIntentionsDepuisActions({ avancer: true, reculer: true, gauche: true, droite: true }),
    ).toEqual(INTENTIONS_AUCUNE);
  });

  it('accélère puis ralentit avec traînée, indépendamment du découpage du delta', () => {
    const étape = simulerVitesseBateau(0, 1, 1, ACCELERATION_BATEAU, TRAINEE_BATEAU);
    expect(étape).toBeGreaterThan(0);
    expect(étape).toBeLessThanOrEqual(VITESSE_MAXIMALE_BATEAU);

    // La vitesse reste bornée même en conduite prolongée.
    let vitesse = 0;
    for (let index = 0; index < 100; index += 1) {
      vitesse = simulerVitesseBateau(vitesse, 1, 0.1, ACCELERATION_BATEAU, TRAINEE_BATEAU);
    }
    expect(vitesse).toBeLessThanOrEqual(VITESSE_MAXIMALE_BATEAU + 1e-9);
    expect(vitesse).toBeGreaterThan(0);

    // Sans poussée, la traînée ramène la vitesse vers zéro.
    const frein = simulerVitesseBateau(6, 0, 1, ACCELERATION_BATEAU, TRAINEE_BATEAU);
    expect(frein).toBeLessThan(6);
    expect(frein).toBeGreaterThanOrEqual(0);
  });

  it('converge vers la même vitesse asymptotique quel que soit le découpage du temps', () => {
    // Grands pas sur une durée totale longue.
    let grandsPas = 0;
    for (let index = 0; index < 500; index += 1) {
      grandsPas = simulerVitesseBateau(grandsPas, 1, 0.2, ACCELERATION_BATEAU, TRAINEE_BATEAU);
    }

    // Petits pas sur la même durée totale.
    let petitsPas = 0;
    for (let index = 0; index < 5000; index += 1) {
      petitsPas = simulerVitesseBateau(petitsPas, 1, 0.02, ACCELERATION_BATEAU, TRAINEE_BATEAU);
    }

    // Les deux trajectoires convergent vers le même régime permanent borné.
    expect(Number.isFinite(grandsPas)).toBe(true);
    expect(Number.isFinite(petitsPas)).toBe(true);
    expect(Math.abs(grandsPas - petitsPas)).toBeLessThan(1.2);
    expect(grandsPas).toBeLessThanOrEqual(VITESSE_MAXIMALE_BATEAU + 1e-9);
    expect(petitsPas).toBeLessThanOrEqual(VITESSE_MAXIMALE_BATEAU + 1e-9);
  });

  it('borde la rotation et rend la rotation dépendante de la vitesse', () => {
    expect(calculerVitesseAngulaireBateau(0, 5)).toBe(0);
    expect(calculerVitesseAngulaireBateau(0.5, 0)).toBe(0);
    expect(Math.abs(calculerVitesseAngulaireBateau(1, 10))).toBeGreaterThan(0);
    expect(Number.isFinite(calculerVitesseAngulaireBateau(Number.NaN, 5))).toBe(true);
  });

  it('convertit correctement entre les coordonnées locales et monde', () => {
    const position = { x: 10, y: 0.04, z: -5 };
    const rotation = Math.PI / 3;
    const local = { x: 2, y: 1.5, z: -3 };
    const monde = positionLocaleVersMonde(local, position, rotation);
    const retrouve = positionMondeVersLocale(monde, position, rotation);
    expect(retrouve.x).toBeCloseTo(local.x, 6);
    expect(retrouve.y).toBeCloseTo(local.y, 6);
    expect(retrouve.z).toBeCloseTo(local.z, 6);
  });

  it('bloque le bateau sur un rivage sans traverser', () => {
    const obstacles: readonly ObstacleNavigation[] = [
      {
        id: 'rivage-test',
        type: 'rivage',
        centre: { x: 0, y: 0, z: 12 },
        rayonX: 2.8,
        rayonZ: 2.8,
        rotationY: 0,
      },
    ];
    const etat = creerEtatNavigationBateau({ x: 0, y: 0, z: 0 }, 0);
    let courant = etat;
    let collisionDetectee = false;
    for (let index = 0; index < 200; index += 1) {
      courant = simulerNavigationBateau(courant, { poussee: 1, gouvernail: 0 }, 0.05, obstacles);
      if (courant.collision !== 'aucune') {
        collisionDetectee = true;
      }
      // Le bateau ne doit jamais pénétrer dans la bande du rivage.
      expect(courant.position.z).toBeLessThan(9.6);
      expect(Number.isFinite(courant.position.z)).toBe(true);
    }
    expect(collisionDetectee).toBe(true);
  });

  it('détermine une invite correcte selon le mode et la distance', () => {
    const bateau = créerDescripteurBateau();
    const ancre = bateau.ancrages.find((a) => a.type === 'embarquement');
    if (!ancre) {
      throw new Error('L’ancre d’embarquement est attendue.');
    }
    const ancres = [{ id: ancre.id, type: ancre.type, position: ancre.position }];

    expect(determinerInvite('pied', ancre.position, ancres)).toBe('embarquer');
    expect(determinerInvite('pied', { x: ancre.position.x + 4, z: ancre.position.z }, ancres)).toBe(
      'aucune',
    );
    expect(determinerInvite('bord', ancre.position, ancres)).toBe('debarcher');
  });
});
