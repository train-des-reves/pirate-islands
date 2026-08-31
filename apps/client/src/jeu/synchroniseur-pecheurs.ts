import { NOMS_MESSAGES, type EtatSalle, type Joueur } from '@pirate/protocole';
import type { Room } from '@colyseus/sdk';
import type { Scene } from 'babylonjs';

import { construirePecheur, type Pecheur } from './pecheur';
import type { Vecteur3 } from './mouvement';
import type { TransformationInterpolable } from './interpolation';

export const INTERVALLE_ENVOI_TRANSFORMATION_MS = 50;

export interface DonneesEmetteur {
  readonly position: Vecteur3;
  readonly lacet: number;
  readonly tangage: number;
  readonly roulis: number;
}

export interface EmetteurTransformation {
  readonly envoyer: (donnees: DonneesEmetteur) => void;
}

function transformationJoueur(joueur: Joueur): TransformationInterpolable {
  return {
    position: {
      x: joueur.transformation.x,
      y: joueur.transformation.y,
      z: joueur.transformation.z,
    },
    lacet: joueur.transformation.lacet,
    tangage: joueur.transformation.tangage,
    roulis: joueur.transformation.roulis,
  };
}

export class SynchroniseurPecheursDistants {
  private readonly obtenirSalle: () => Room<unknown, EtatSalle> | undefined;
  private readonly infosSession: () => string;
  private readonly scene: Scene;
  private readonly pecheurs = new Map<string, Pecheur>();

  public constructor(
    obtenirSalle: () => Room<unknown, EtatSalle> | undefined,
    infosSession: () => string,
    scene: Scene,
  ) {
    this.obtenirSalle = obtenirSalle;
    this.infosSession = infosSession;
    this.scene = scene;
  }

  public mettreAJour(): void {
    const salle = this.obtenirSalle();
    if (!salle) {
      return;
    }

    const sessionLocale = this.infosSession();
    const sessionsVues = new Set<string>();

    for (const [sessionId, joueur] of salle.state.joueurs) {
      if (sessionId === sessionLocale) {
        continue;
      }

      sessionsVues.add(sessionId);
      const existant = this.pecheurs.get(sessionId);
      if (existant) {
        existant.recevoirEtat({
          sessionId,
          nom: joueur.nom,
          transformation: transformationJoueur(joueur),
        });
      } else {
        this.pecheurs.set(
          sessionId,
          construirePecheur(this.scene, {
            sessionId,
            nom: joueur.nom,
            transformation: transformationJoueur(joueur),
          }),
        );
      }
    }

    for (const [sessionId, pecheur] of this.pecheurs) {
      if (!sessionsVues.has(sessionId)) {
        pecheur.liberer();
        this.pecheurs.delete(sessionId);
      }
    }
  }

  public obtenirPecheurs(): Pecheur[] {
    return [...this.pecheurs.values()];
  }

  public liberer(): void {
    for (const pecheur of this.pecheurs.values()) {
      pecheur.liberer();
    }
    this.pecheurs.clear();
  }
}

export function creerEmetteurTransformation(
  obtenirSalle: () => Room<unknown, EtatSalle> | undefined,
  lireHorodatage: () => number = () => Date.now(),
): EmetteurTransformation {
  let dernierEnvoi = Number.NEGATIVE_INFINITY;

  return {
    envoyer: (donnees) => {
      const salle = obtenirSalle();
      if (!salle) {
        return;
      }

      const maintenant = lireHorodatage();
      if (maintenant - dernierEnvoi < INTERVALLE_ENVOI_TRANSFORMATION_MS) {
        return;
      }

      dernierEnvoi = maintenant;
      salle.send(NOMS_MESSAGES.transformationJoueur, {
        position: {
          x: donnees.position.x,
          y: donnees.position.y,
          z: donnees.position.z,
        },
        lacet: donnees.lacet,
        tangage: donnees.tangage,
        roulis: donnees.roulis,
        horodatage: maintenant,
      });
    },
  };
}
