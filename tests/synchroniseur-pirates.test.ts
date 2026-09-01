import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene } from 'babylonjs';
import type { Room } from '@colyseus/sdk';

import type { EtatSalle, Pirate } from '@pirate/protocole';

import { SynchroniseurPiratesTerrestres } from '../apps/client/src/jeu/synchroniseur-pirates';

interface SalleFactice extends Omit<Room<unknown, EtatSalle>, 'state'> {
  readonly state: EtatSalle;
}

function pirate(partiel: Partial<Pirate> = {}): Pirate {
  return {
    identifiant: 'ile-aube-pirate-1',
    transformation: { x: -40, y: 3, z: 18, lacet: 0, tangage: 0, roulis: 0 },
    sante: 100,
    vivant: true,
    statut: 'patrouille',
    bateauId: '',
    ...partiel,
  } as unknown as Pirate;
}

function créerSalle(pirates: ReadonlyArray<Pirate>): SalleFactice {
  return {
    state: {
      pirates: new Map(pirates.map((entrée) => [entrée.identifiant, entrée])),
    } as unknown as EtatSalle,
  } as unknown as SalleFactice;
}

describe('synchroniseur des pirates terrestres', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;

  afterEach(() => {
    scène?.dispose();
    moteur?.dispose();
    scène = undefined;
    moteur = undefined;
  });

  it('crée les pirates reçus et répercute une mort sans simuler côté client', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);
    const salle = créerSalle([pirate()]);
    const synchroniseur = new SynchroniseurPiratesTerrestres(
      () => salle as unknown as Room<unknown, EtatSalle>,
      scène,
    );

    synchroniseur.mettreAJour();
    expect(synchroniseur.obtenirPirates()).toHaveLength(1);
    expect(synchroniseur.obtenirPirates()[0]?.obtenirEtat().etat).toBe('patrouille');

    const entrée = salle.state.pirates.get('ile-aube-pirate-1');
    if (!entrée) throw new Error('Pirate de test absent.');
    entrée.sante = 0;
    entrée.vivant = false;
    entrée.statut = 'mort';
    synchroniseur.mettreAJour();
    expect(synchroniseur.obtenirPirates()[0]?.obtenirEtat().etat).toBe('mort');
    synchroniseur.liberer();
  });

  it('retire un pirate disparu de l’état réseau', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);
    const salle = créerSalle([pirate()]);
    const synchroniseur = new SynchroniseurPiratesTerrestres(
      () => salle as unknown as Room<unknown, EtatSalle>,
      scène,
    );
    synchroniseur.mettreAJour();
    salle.state.pirates.clear();
    synchroniseur.mettreAJour();
    expect(synchroniseur.obtenirPirates()).toHaveLength(0);
    synchroniseur.liberer();
  });
});
