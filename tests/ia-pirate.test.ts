import { describe, expect, it } from 'vitest';

import {
  ETATS_IA_PIRATE,
  MachineEtatPirate,
  PROFIL_MER,
  PROFIL_TERRE,
  type CiblePerçue,
  type ProfilIaPirate,
} from '@pirate/coeur-jeu';

const DELTA = 0.05;

function profiler(milieu: 'terre' | 'mer'): ProfilIaPirate {
  return milieu === 'terre' ? { ...PROFIL_TERRE } : { ...PROFIL_MER };
}

function cible(identifiant: string, x: number, z: number): CiblePerçue {
  return { id: identifiant, position: { x, z } };
}

function avancer(
  machine: MachineEtatPirate,
  nombrePas: number,
  cibleVisible?: CiblePerçue | undefined,
): void {
  for (let index = 0; index < nombrePas; index += 1) {
    machine.actualiser(DELTA, cibleVisible);
  }
}

describe('machine à états de l’IA pirate', () => {
  it('expose les six états dans un ordre stable', () => {
    expect(ETATS_IA_PIRATE).toEqual([
      'inactif',
      'patrouille',
      'poursuite',
      'attaque',
      'retour',
      'mort',
    ]);
  });

  it('passe de inactif à patrouille quand le délai de perception expire', () => {
    const machine = new MachineEtatPirate({
      graine: 'test-patrouille',
      profil: profiler('terre'),
      positionDepart: { x: 0, z: 0 },
    });

    expect(machine.lireEtat()).toBe('inactif');
    avancer(machine, 10);
    expect(machine.lireEtat()).toBe('patrouille');
  });

  it('perçoit une cible et passe à poursuite depuis inactif', () => {
    const machine = new MachineEtatPirate({
      graine: 'test-poursuite',
      profil: profiler('terre'),
      positionDepart: { x: 0, z: 0 },
    });

    machine.actualiser(DELTA, cible('cible-1', 4, 0));
    expect(machine.lireEtat()).toBe('poursuite');
    expect(machine.lireCible()?.id).toBe('cible-1');
  });

  it('passe en attaque quand la cible entre dans la portée', () => {
    const machine = new MachineEtatPirate({
      graine: 'test-attaque',
      profil: profiler('terre'),
      positionDepart: { x: 0, z: 0 },
    });

    avancer(machine, 10, cible('cible-1', 1, 0));
    expect(machine.lireEtat()).toBe('attaque');
  });

  it('respecte la cadence d’attaque et émet des intentions bornées', () => {
    const machine = new MachineEtatPirate({
      graine: 'test-cadence',
      profil: profiler('terre'),
      positionDepart: { x: 0, z: 0 },
    });

    let intentions = 0;
    let dernière: ReturnType<MachineEtatPirate['actualiser']> | undefined;
    for (let index = 0; index < 60; index += 1) {
      const sortie = machine.actualiser(DELTA, cible('cible-1', 2, 0));
      if (sortie.intentionAttaque) {
        intentions += 1;
        dernière = sortie;
      }
    }

    expect(intentions).toBeGreaterThanOrEqual(1);
    expect(intentions).toBeLessThanOrEqual(3);
    expect(dernière?.intentionAttaque?.portee).toBe(PROFIL_TERRE.porteeAttaque);
    expect(dernière?.intentionAttaque?.cible).toBe('cible-1');
  });

  it('revient en patrouille après perte de cible', () => {
    const machine = new MachineEtatPirate({
      graine: 'test-retour',
      profil: profiler('terre'),
      positionDepart: { x: 0, z: 0 },
    });

    const visible = cible('cible-1', 15, 0);
    avancer(machine, 5, visible);
    expect(machine.lireEtat()).toBe('poursuite');

    avancer(machine, 40, undefined);
    expect(machine.lireEtat()).toBe('retour');
    avancer(machine, 80, undefined);
    expect(['patrouille', 'retour']).toContain(machine.lireEtat());
  });

  it('la mort est terminale et irréversible', () => {
    const machine = new MachineEtatPirate({
      graine: 'test-mort',
      profil: profiler('terre'),
      positionDepart: { x: 0, z: 0 },
    });

    machine.tuer();
    expect(machine.lireEtat()).toBe('mort');
    const sortie = machine.actualiser(DELTA, cible('cible-1', 1, 0));
    expect(sortie.etat).toBe('mort');
    expect(sortie.intentionAttaque).toBeUndefined();
    expect(sortie.intentionDeplacement).toBeUndefined();
  });

  it('les profils terre et mer partagent les règles mais ont des réglages distincts', () => {
    const terre = PROFIL_TERRE;
    const mer = PROFIL_MER;

    expect(terre.milieu).toBe('terre');
    expect(mer.milieu).toBe('mer');
    expect(terre.porteePerception).not.toBe(mer.porteePerception);
    expect(terre.vitessePoursuite).not.toBe(mer.vitessePoursuite);
  });

  it('ignore un delta invalide sans déplacer l’état', () => {
    const machine = new MachineEtatPirate({
      graine: 'test-delta',
      profil: profiler('terre'),
      positionDepart: { x: 0, z: 0 },
    });

    const avant = machine.lirePosition();
    const sortie = machine.actualiser(Number.NaN, undefined);
    expect(sortie.position).toEqual(avant);
    expect(Number.isFinite(sortie.cap)).toBe(true);
  });

  it('borne le déplacement et les sorties à tout moment', () => {
    const machine = new MachineEtatPirate({
      graine: 'test-borner',
      profil: profiler('mer'),
      positionDepart: { x: 109, z: -109 },
    });

    for (let index = 0; index < 200; index += 1) {
      const sortie = machine.actualiser(DELTA, cible('cible-1', 200, 200));
      expect(Number.isFinite(sortie.position.x)).toBe(true);
      expect(Number.isFinite(sortie.position.z)).toBe(true);
      expect(Math.abs(sortie.position.x)).toBeLessThanOrEqual(110);
      expect(Math.abs(sortie.position.z)).toBeLessThanOrEqual(110);
      if (sortie.intentionDeplacement) {
        expect(Number.isFinite(sortie.intentionDeplacement.x)).toBe(true);
        expect(Math.hypot(sortie.intentionDeplacement.x, sortie.intentionDeplacement.z)).toBeLessThanOrEqual(
          PROFIL_MER.vitessePoursuite + 0.001,
        );
      }
    }
  });
});
