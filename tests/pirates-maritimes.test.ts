import { describe, expect, it } from 'vitest';

import {
  DEGATS_ATTAQUE_PIRATE_MARITIME,
  NOMBRE_BATEAUX_PIRATES_MARITIMES,
  PAS_SIMULATION_MARITIME,
  SimulationPiratesMaritimes,
  genererMonde,
  genererRoutesMaritimes,
  routeMaritimeValide,
} from '@pirate/coeur-jeu';

describe('rencontre maritime déterministe', () => {
  it('génère les mêmes routes sûres pour une même graine', () => {
    const monde = genererMonde('rencontre-maritime');
    const première = genererRoutesMaritimes('rencontre-maritime', monde);
    const seconde = genererRoutesMaritimes('rencontre-maritime', monde);

    expect(première).toEqual(seconde);
    expect(première.length).toBeGreaterThan(0);
    expect(première.every((route) => routeMaritimeValide(route, monde))).toBe(true);
  });

  it('borne le nombre de sloops et évite les îles à chaque pas', () => {
    const simulation = new SimulationPiratesMaritimes({ graine: 'bornes-maritime' });
    expect(simulation.lireEtats()).toHaveLength(NOMBRE_BATEAUX_PIRATES_MARITIMES);

    for (let index = 0; index < 800; index += 1) {
      const sortie = simulation.actualiser(PAS_SIMULATION_MARITIME, []);
      expect(sortie.attaques).toHaveLength(0);
      for (const bateau of sortie.bateaux) {
        expect(Math.abs(bateau.position.x)).toBeLessThanOrEqual(107);
        expect(Math.abs(bateau.position.z)).toBeLessThanOrEqual(107);
        expect(bateau.vitesse).toBeLessThanOrEqual(5);
        expect(Number.isFinite(bateau.cap)).toBe(true);
      }
    }
  });

  it('poursuit puis attaque une cible vivante à cadence fixe', () => {
    const simulation = new SimulationPiratesMaritimes({
      graine: 'attaque-maritime',
      nombreBateaux: 1,
    });
    const cible = { id: 'joueur-cible', position: { x: 0, z: 0 }, vivant: true };
    const étatsVus = new Set<string>();
    let attaques = 0;
    for (let index = 0; index < 300; index += 1) {
      const sortie = simulation.actualiser(PAS_SIMULATION_MARITIME, [cible]);
      for (const bateau of sortie.bateaux) {
        étatsVus.add(bateau.etat);
      }
      attaques += sortie.attaques.length;
    }

    expect(étatsVus.has('poursuite')).toBe(true);
    expect(étatsVus.has('attaque')).toBe(true);
    expect(attaques).toBeGreaterThan(0);
    expect(attaques).toBeLessThanOrEqual(12);
  });

  it('arrête les attaques et le mouvement après destruction', () => {
    const simulation = new SimulationPiratesMaritimes({
      graine: 'destruction-maritime',
      nombreBateaux: 1,
    });
    const id = simulation.lireEtats()[0]!.id;
    expect(simulation.appliquerDegats(id, 100)).toBe(true);
    expect(simulation.appliquerDegats(id, 1)).toBe(false);
    const sortie = simulation.actualiser(PAS_SIMULATION_MARITIME, [
      { id: 'joueur-cible', position: { x: 0, z: 0 }, vivant: true },
    ]);
    const bateau = sortie.bateaux[0]!;
    expect(bateau.etat).toBe('detruit');
    expect(bateau.vitesse).toBe(0);
    expect(sortie.attaques).toHaveLength(0);
    expect(DEGATS_ATTAQUE_PIRATE_MARITIME).toBeGreaterThan(0);
  });
});
