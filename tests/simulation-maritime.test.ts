import { describe, expect, it } from 'vitest';

import {
  DEGATS_ATTAQUE_PIRATE,
  PAS_SIMULATION_MARITIME_SEC,
  SimulationPiratesMaritimes,
  genererMonde,
  type CiblePerçue,
} from '@pirate/coeur-jeu';

function avancer(
  simulation: SimulationPiratesMaritimes,
  secondes: number,
  cibles: readonly CiblePerçue[],
): ReturnType<SimulationPiratesMaritimes['actualiser']> {
  let sortie = simulation.actualiser(0, cibles);
  for (let temps = 0; temps < secondes; temps += PAS_SIMULATION_MARITIME_SEC) {
    sortie = simulation.actualiser(PAS_SIMULATION_MARITIME_SEC, cibles);
  }
  return sortie;
}

describe('simulation autoritaire des pirates maritimes', () => {
  it('reproduit une route, un cap et une transition identiques pour une même graine', () => {
    const monde = genererMonde('simulation-maritime');
    const cible = [{ id: 'joueur-1', position: { x: 0, z: -10 } }];
    const première = new SimulationPiratesMaritimes({ monde, graine: 'fixe' });
    const seconde = new SimulationPiratesMaritimes({ monde, graine: 'fixe' });

    expect(avancer(première, 3, cible).bateaux).toEqual(avancer(seconde, 3, cible).bateaux);
  });

  it('passe en poursuite puis attaque et cadence ses dégâts', () => {
    const simulation = new SimulationPiratesMaritimes({
      monde: genererMonde('attaque-maritime'),
      graine: 'attaque-fixe',
      nombreBateaux: 1,
    });
    const cible = [{ id: 'joueur-1', position: { x: 0, z: -10 } }];
    let aAttaqué = false;
    let nombreAttaques = 0;
    let état = 'inactif';
    for (let index = 0; index < 180; index += 1) {
      const sortie = simulation.actualiser(PAS_SIMULATION_MARITIME_SEC, cible);
      état = sortie.bateaux[0]?.etat ?? état;
      nombreAttaques += sortie.attaques.length;
      aAttaqué ||= sortie.attaques.length > 0;
    }

    expect(état).toBe('attaque');
    expect(aAttaqué).toBe(true);
    expect(nombreAttaques).toBeGreaterThanOrEqual(2);
    expect(nombreAttaques * DEGATS_ATTAQUE_PIRATE).toBeGreaterThan(0);
  });

  it('perd la cible, revient vers sa route et n’attaque plus', () => {
    const simulation = new SimulationPiratesMaritimes({
      monde: genererMonde('cible-perdue'),
      graine: 'perte-fixe',
      nombreBateaux: 1,
    });
    const cible = [{ id: 'joueur-1', position: { x: 0, z: -10 } }];
    let attaquesAvantPerte = 0;
    for (let index = 0; index < 100; index += 1) {
      attaquesAvantPerte += simulation.actualiser(PAS_SIMULATION_MARITIME_SEC, cible).attaques
        .length;
    }

    let dernière = simulation.actualiser(PAS_SIMULATION_MARITIME_SEC, []);
    let attaquesAprèsPerte = dernière.attaques.length;
    for (let index = 0; index < 100; index += 1) {
      dernière = simulation.actualiser(PAS_SIMULATION_MARITIME_SEC, []);
      attaquesAprèsPerte += dernière.attaques.length;
    }

    expect(['retour', 'patrouille']).toContain(dernière.bateaux[0]?.etat);
    expect(attaquesAvantPerte).toBeGreaterThan(0);
    expect(attaquesAprèsPerte).toBe(0);
    expect(dernière.bateaux[0]?.vitesse).toBeGreaterThanOrEqual(0);
  });
});
