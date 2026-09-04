import type { Room } from '@colyseus/sdk';
import type { Scene } from 'babylonjs';

import { SANTE_PIRATE_MAXIMALE, type EtatSalle, type Pirate } from '@pirate/protocole';

import {
  construirePirateTerrestre,
  type DonneesPirateTerrestre,
  type EtatPirate,
  type PirateTerrestre,
} from './pirate';

function estEtatPirate(valeur: string): valeur is EtatPirate {
  return (
    valeur === 'inactif' ||
    valeur === 'patrouille' ||
    valeur === 'poursuite' ||
    valeur === 'attaque' ||
    valeur === 'mort'
  );
}

function convertirEtat(pirate: Pirate): DonneesPirateTerrestre {
  const état =
    pirate.vivant && estEtatPirate(pirate.statut)
      ? pirate.statut
      : pirate.vivant
        ? 'patrouille'
        : 'mort';
  return {
    id: pirate.identifiant,
    transformation: {
      position: {
        x: pirate.transformation.x,
        y: pirate.transformation.y,
        z: pirate.transformation.z,
      },
      rotationY: pirate.transformation.lacet,
    },
    ratioSante: pirate.sante / SANTE_PIRATE_MAXIMALE,
    etat: état,
  };
}

/** Synchronise les acteurs pirates depuis l’état autoritaire Colyseus. */
export class SynchroniseurPirates {
  private readonly obtenirSalle: () => Room<unknown, EtatSalle> | undefined;
  private readonly scene: Scene;
  private readonly pirates = new Map<string, PirateTerrestre>();

  public constructor(obtenirSalle: () => Room<unknown, EtatSalle> | undefined, scene: Scene) {
    this.obtenirSalle = obtenirSalle;
    this.scene = scene;
  }

  public mettreAJour(): void {
    const salle = this.obtenirSalle();
    if (!salle) {
      this.liberer();
      return;
    }

    const piratesVus = new Set<string>();
    for (const [identifiant, pirate] of salle.state.pirates) {
      piratesVus.add(identifiant);
      const données = convertirEtat(pirate);
      const existant = this.pirates.get(identifiant);
      if (existant) {
        existant.recevoirEtat(données);
      } else {
        this.pirates.set(identifiant, construirePirateTerrestre(this.scene, données));
      }
    }

    for (const [identifiant, pirate] of this.pirates) {
      if (piratesVus.has(identifiant)) {
        continue;
      }
      pirate.liberer();
      this.pirates.delete(identifiant);
    }
  }

  public obtenirPirates(): PirateTerrestre[] {
    return [...this.pirates.values()];
  }

  public liberer(): void {
    for (const pirate of this.pirates.values()) {
      pirate.liberer();
    }
    this.pirates.clear();
  }
}

export const creerSynchroniseurPirates = (
  obtenirSalle: () => Room<unknown, EtatSalle> | undefined,
  scene: Scene,
): SynchroniseurPirates => new SynchroniseurPirates(obtenirSalle, scene);
