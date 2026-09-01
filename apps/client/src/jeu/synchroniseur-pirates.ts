import type { Room } from '@colyseus/sdk';
import type { Scene } from 'babylonjs';

import type { EtatSalle, Pirate } from '@pirate/protocole';

import {
  construirePirateTerrestre,
  type DonneesPirateTerrestre,
  type PirateTerrestre,
} from './pirate';

function donneesPirate(pirate: Pirate): DonneesPirateTerrestre {
  const etat = pirate.statut;
  const etats = ['inactif', 'patrouille', 'poursuite', 'attaque', 'mort'] as const;
  const état = (etats as readonly string[]).includes(etat)
    ? (etat as DonneesPirateTerrestre['etat'])
    : pirate.vivant
      ? 'inactif'
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
    ratioSante: pirate.sante / 100,
    etat: état,
  };
}

/** Synchronise les acteurs pirates autoritaires, sans simulation côté client. */
export class SynchroniseurPiratesTerrestres {
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
    for (const [id, pirate] of salle.state.pirates) {
      piratesVus.add(id);
      const données = donneesPirate(pirate);
      const existant = this.pirates.get(id);
      if (existant) {
        existant.recevoirEtat(données);
      } else {
        this.pirates.set(id, construirePirateTerrestre(this.scene, données));
      }
    }

    for (const [id, pirate] of this.pirates) {
      if (piratesVus.has(id)) {
        continue;
      }
      pirate.liberer();
      this.pirates.delete(id);
    }
  }

  public mettreAJourInterpolation(deltaSecondes: number): void {
    for (const pirate of this.pirates.values()) {
      pirate.mettreAJour(deltaSecondes);
    }
  }

  public obtenirPirates(): readonly PirateTerrestre[] {
    return [...this.pirates.values()];
  }

  public liberer(): void {
    for (const pirate of this.pirates.values()) {
      pirate.liberer();
    }
    this.pirates.clear();
  }
}
