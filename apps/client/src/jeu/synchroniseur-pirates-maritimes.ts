import {
  type BateauPirate as EtatBateauPirate,
  type EtatSalle,
  type Pirate,
} from '@pirate/protocole';
import type { Room } from '@colyseus/sdk';
import type { Scene } from 'babylonjs';

import {
  construireBateauPirate,
  type BateauPirate,
  type DonneesBateauPirate,
} from './bateau-pirate';
import {
  construirePirateTerrestre,
  type DonneesPirateTerrestre,
  type PirateTerrestre,
} from './pirate';

function statutPirate(statut: string, vivant: boolean): DonneesPirateTerrestre['etat'] {
  if (!vivant || statut === 'mort' || statut === 'detruit') {
    return 'mort';
  }
  if (statut === 'poursuite' || statut === 'attaque' || statut === 'patrouille') {
    return statut;
  }
  return 'inactif';
}

function donneesBateau(pirate: EtatBateauPirate): DonneesBateauPirate {
  const ratioSante = pirate.sante / 100;
  const etat: DonneesBateauPirate['etat'] =
    !pirate.actif || pirate.statut === 'detruit' || ratioSante <= 0
      ? 'detruit'
      : ratioSante < 0.65
        ? 'endommage'
        : 'intact';
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
    vitesse: pirate.vitesse,
    ratioSante,
    etat,
  };
}

function donneesEquipage(pirate: Pirate): DonneesPirateTerrestre {
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
    etat: statutPirate(pirate.statut, pirate.vivant),
  };
}

/** Synchronise les bateaux pirates et leur équipage depuis l'état Colyseus. */
export class SynchroniseurPiratesMaritimes {
  private readonly obtenirSalle: () => Room<unknown, EtatSalle> | undefined;
  private readonly scene: Scene;
  private readonly bateaux = new Map<string, BateauPirate>();
  private readonly equipages = new Map<string, PirateTerrestre>();

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

    const bateauxVus = new Set<string>();
    const equipagesVus = new Set<string>();
    for (const [id, bateau] of salle.state.bateauxPirates) {
      bateauxVus.add(id);
      const donnees = donneesBateau(bateau);
      const existant = this.bateaux.get(id);
      if (existant) {
        existant.recevoirEtat(donnees);
      } else {
        this.bateaux.set(id, construireBateauPirate(this.scene, donnees));
      }
    }

    for (const [id, pirate] of salle.state.pirates) {
      if (!pirate.bateauId || !bateauxVus.has(pirate.bateauId)) {
        continue;
      }
      equipagesVus.add(id);
      const donnees = donneesEquipage(pirate);
      const existant = this.equipages.get(id);
      if (existant) {
        existant.recevoirEtat(donnees);
      } else {
        this.equipages.set(id, construirePirateTerrestre(this.scene, donnees));
      }
    }

    for (const [id, bateau] of this.bateaux) {
      if (!bateauxVus.has(id)) {
        bateau.liberer();
        this.bateaux.delete(id);
      }
    }
    for (const [id, pirate] of this.equipages) {
      if (!equipagesVus.has(id)) {
        pirate.liberer();
        this.equipages.delete(id);
      }
    }
  }

  public mettreAJourInterpolation(deltaSecondes: number): void {
    for (const bateau of this.bateaux.values()) {
      bateau.mettreAJour(deltaSecondes);
    }
    for (const pirate of this.equipages.values()) {
      pirate.mettreAJour(deltaSecondes);
    }
  }

  public obtenirBateaux(): readonly BateauPirate[] {
    return [...this.bateaux.values()];
  }

  public obtenirEquipages(): readonly PirateTerrestre[] {
    return [...this.equipages.values()];
  }

  public liberer(): void {
    for (const bateau of this.bateaux.values()) {
      bateau.liberer();
    }
    for (const pirate of this.equipages.values()) {
      pirate.liberer();
    }
    this.bateaux.clear();
    this.equipages.clear();
  }
}
