import { describe, expect, it } from 'vitest';

import {
  ACCELERATION_BATEAU,
  avancerPilotageParPasFixes,
  appliquerIntentionPilotage,
  creerEtatBateauPilotage,
  DELTA_SIMULATION_BATEAU,
  simulerPasPilotage,
  VITESSE_ANGULAIRE_MAXIMALE_BATEAU,
  VITESSE_MAXIMALE_BATEAU,
} from '@pirate/coeur-jeu';

function bateauPilote(): ReturnType<typeof creerEtatBateauPilotage> {
  const bateau = creerEtatBateauPilotage('bateau-salle', 'session-a');
  bateau.piloteSessionId = 'session-a';
  return bateau;
}

describe('simulation autoritaire du pilotage', () => {
  it('avance par pas fixes malgré des deltas irréguliers', () => {
    const grandsPas = bateauPilote();
    const petitsPas = bateauPilote();

    let accumulationGrandsPas = 0;
    for (const delta of [17, 83, 31, 69, 250, 550]) {
      accumulationGrandsPas = avancerPilotageParPasFixes(
        grandsPas,
        { poussee: 1, gouvernail: 0 },
        delta,
        accumulationGrandsPas,
      );
    }

    let accumulationPetitsPas = 0;
    for (let index = 0; index < 1_000; index += 1) {
      accumulationPetitsPas = avancerPilotageParPasFixes(
        petitsPas,
        { poussee: 1, gouvernail: 0 },
        1,
        accumulationPetitsPas,
      );
    }

    expect(grandsPas.positionZ).toBeCloseTo(petitsPas.positionZ, 8);
    expect(grandsPas.vitesse).toBeCloseTo(petitsPas.vitesse, 8);
    expect(grandsPas.vitesse).toBeLessThanOrEqual(VITESSE_MAXIMALE_BATEAU);
    expect(grandsPas.vitesse).toBeGreaterThan(0);
  });

  it('borne la vitesse et la rotation sans produire de valeur non finie', () => {
    const bateau = bateauPilote();
    for (let index = 0; index < 1_000; index += 1) {
      simulerPasPilotage(bateau, { poussee: 1, gouvernail: 1 });
    }

    expect(bateau.vitesse).toBeLessThanOrEqual(VITESSE_MAXIMALE_BATEAU);
    expect(bateau.vitesse).toBeGreaterThan(0);
    expect(Math.abs(bateau.vitesseAngulaire)).toBeLessThanOrEqual(
      VITESSE_ANGULAIRE_MAXIMALE_BATEAU,
    );
    expect(Number.isFinite(bateau.positionX)).toBe(true);
    expect(Number.isFinite(bateau.positionZ)).toBe(true);
    expect(Number.isFinite(bateau.rotationY)).toBe(true);
  });

  it('refuse le non-pilote, le rejeu, la cadence trop rapide et les temps invalides', () => {
    const bateau = bateauPilote();
    expect(appliquerIntentionPilotage(bateau, 'autre-session', 1, 1, 0, 100)).toBe(false);
    expect(appliquerIntentionPilotage(bateau, 'session-a', 1, 1, 0, 100)).toBe(true);
    const positionAprèsPremierPas = bateau.positionZ;
    expect(appliquerIntentionPilotage(bateau, 'session-a', 1, 1, 0, 150)).toBe(false);
    expect(bateau.positionZ).toBe(positionAprèsPremierPas);
    expect(appliquerIntentionPilotage(bateau, 'session-a', 2, Number.NaN, 0, 200)).toBe(false);
    expect(Number.isFinite(bateau.positionZ)).toBe(true);
    expect(appliquerIntentionPilotage(bateau, 'session-a', 3, 1, 0, Number.NaN)).toBe(false);
  });

  it('accélère selon le pas contractuel', () => {
    const bateau = bateauPilote();
    simulerPasPilotage(bateau, { poussee: 1, gouvernail: 0 });

    expect(bateau.vitesse).toBeCloseTo(
      ACCELERATION_BATEAU * DELTA_SIMULATION_BATEAU * (1 - 1.6 * DELTA_SIMULATION_BATEAU),
      8,
    );
    expect(bateau.positionZ).toBeCloseTo(bateau.vitesse * DELTA_SIMULATION_BATEAU, 8);
  });
});
