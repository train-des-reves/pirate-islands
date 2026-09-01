import { type BateauPirate, type EtatSalle, type Pirate } from '@pirate/protocole';
import type { Room } from '@colyseus/sdk';
import type { Scene } from 'babylonjs';

import {
  construireBateauPirate,
  type BateauPirate as VueBateauPirate,
  type DonneesBateauPirate,
} from './bateau-pirate';
import {
  construirePirateTerrestre,
  type DonneesPirateTerrestre,
  type PirateTerrestre,
} from './pirate';

export interface EtatBateauPirateE2E {
  readonly id: string;
  readonly routeId: string;
  readonly état: string;
  readonly sante: number;
  readonly vitesse: number;
  readonly cibleId: string;
  readonly attaqueActive: boolean;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly equipage: number;
  readonly sillage: number;
}

/** Synchronise les sloops et leurs membres depuis l'état Colyseus serveur. */
export class SynchroniseurBateauxPiratesMaritimes {
  private readonly obtenirSalle: () => Room<unknown, EtatSalle> | undefined;
  private readonly scene: Scene;
  private readonly bateaux = new Map<string, VueBateauPirate>();
  private readonly equipages = new Map<string, PirateTerrestre>();
  private readonly cibles = new Map<string, string>();
  private readonly routes = new Map<string, string>();

  public constructor(obtenirSalle: () => Room<unknown, EtatSalle> | undefined, scene: Scene) {
    this.obtenirSalle = obtenirSalle;
    this.scene = scene;
  }

  public mettreAJour(deltaSecondes: number): void {
    const salle = this.obtenirSalle();
    if (!salle) {
      this.liberer();
      return;
    }

    const présents = new Set<string>();
    for (const [, bateau] of salle.state.bateauxPirates) {
      présents.add(bateau.identifiant);
      const données = donnéesBateau(bateau);
      this.cibles.set(bateau.identifiant, bateau.cibleId);
      this.routes.set(bateau.identifiant, bateau.routeId);
      const vue = this.bateaux.get(bateau.identifiant);
      if (vue) {
        vue.recevoirEtat(données);
      } else {
        this.bateaux.set(bateau.identifiant, construireBateauPirate(this.scene, données));
      }

      const membres = [...salle.state.pirates.values()].filter(
        (pirate) => pirate.bateauId === bateau.identifiant,
      );
      const membresPrésents = new Set<string>();
      for (const membre of membres) {
        membresPrésents.add(membre.identifiant);
        const donnéesMembre = donnéesPirate(membre);
        const vueMembre = this.equipages.get(membre.identifiant);
        if (vueMembre) {
          vueMembre.recevoirEtat(donnéesMembre);
        } else {
          this.equipages.set(
            membre.identifiant,
            construirePirateTerrestre(this.scene, donnéesMembre),
          );
        }
      }
      for (const [id, membre] of this.equipages) {
        if (membresPrésents.has(id)) {
          membre.mettreAJour(deltaSecondes);
        }
      }
    }

    for (const [id, bateau] of this.bateaux) {
      if (!présents.has(id)) {
        bateau.liberer();
        this.bateaux.delete(id);
      } else {
        bateau.mettreAJour(deltaSecondes);
      }
    }

    const membresPrésents = new Set(
      [...salle.state.pirates.values()]
        .filter((pirate) => pirate.bateauId !== '')
        .map((pirate) => pirate.identifiant),
    );
    for (const [id, membre] of this.equipages) {
      if (!membresPrésents.has(id)) {
        membre.liberer();
        this.equipages.delete(id);
      }
    }
  }

  public obtenirBateaux(): readonly VueBateauPirate[] {
    return [...this.bateaux.values()];
  }

  public obtenirEtat(): readonly EtatBateauPirateE2E[] {
    return [...this.bateaux.values()].map((bateau) => {
      const état = bateau.obtenirEtat();
      const equipage = [...this.equipages.values()].filter((membre) =>
        membre.obtenirEtat().id.startsWith(état.id + '-equipage-'),
      ).length;
      return {
        id: état.id,
        routeId: this.routes.get(état.id) ?? '',
        état: état.etat,
        sante: état.ratioSante * 100,
        vitesse: état.vitesse,
        cibleId: this.cibles.get(état.id) ?? '',
        attaqueActive: état.etat === 'intact' && (this.cibles.get(état.id) ?? '') !== '',
        position: { ...état.transformation.position },
        equipage,
        sillage: bateau.obtenirIntensiteSillage(),
      };
    });
  }

  public liberer(): void {
    for (const bateau of this.bateaux.values()) {
      bateau.liberer();
    }
    for (const membre of this.equipages.values()) {
      membre.liberer();
    }
    this.bateaux.clear();
    this.equipages.clear();
    this.cibles.clear();
    this.routes.clear();
  }
}

function donnéesBateau(bateau: BateauPirate): DonneesBateauPirate {
  const état =
    bateau.statut === 'detruit'
      ? 'detruit'
      : bateau.statut === 'endommage'
        ? 'endommage'
        : 'intact';
  return {
    id: bateau.identifiant,
    transformation: {
      position: {
        x: bateau.transformation.x,
        y: bateau.transformation.y,
        z: bateau.transformation.z,
      },
      rotationY: bateau.transformation.lacet,
    },
    vitesse: Number.isFinite(bateau.vitesse) ? Math.max(0, bateau.vitesse) : 0,
    ratioSante: Math.max(0, Math.min(1, bateau.sante / 100)),
    etat: état,
  };
}

function donnéesPirate(pirate: Pirate): DonneesPirateTerrestre {
  const états = ['inactif', 'patrouille', 'poursuite', 'attaque', 'mort'] as const;
  const état = états.includes(pirate.statut as (typeof états)[number])
    ? (pirate.statut as (typeof états)[number])
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
    ratioSante: Math.max(0, Math.min(1, pirate.sante / 100)),
    etat: état,
  };
}
