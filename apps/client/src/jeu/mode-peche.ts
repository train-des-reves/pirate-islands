import { genererMonde, type ZonePeche } from '@pirate/coeur-jeu';
import type { FreeCamera, Scene } from 'babylonjs';

import {
  construireAdaptateurPecheCoeurJeu,
  GestionnaireCanne,
  type EtatCanne,
  type InterfacePeche,
} from './canne';
import { construireCanneBabylon, type CanneBabylon } from './canne-babylon';
import type { EtatActions } from './entrees';
import type { Vecteur3 } from './mouvement';

export interface OptionsModePeche {
  readonly graine: string;
  readonly lirePosition: () => Vecteur3;
  readonly lireHorodatage: () => number;
  readonly camera: FreeCamera;
  readonly scene: Scene;
  readonly interfacePeche: InterfacePeche;
}

export interface ModePeche {
  readonly lireEtat: () => EtatCanne;
  readonly estModeActif: () => boolean;
  readonly actualiser: (actions: Pick<EtatActions, 'tirer' | 'interagir'>) => boolean;
  readonly reinitialiser: () => void;
  readonly liberer: () => void;
  readonly canneBabylon: CanneBabylon;
}

function zoneProcheDe(position: Vecteur3, zones: readonly ZonePeche[]): ZonePeche | undefined {
  for (const zone of zones) {
    const distance = Math.hypot(position.x - zone.centre.x, position.z - zone.centre.z);
    if (distance <= zone.rayon) {
      return zone;
    }
  }
  return undefined;
}

/**
 * Contrôleur du mode pêche local. Il relie le contrôleur de canne à la
 * présentation Babylon et aux états autoritaires fournis par l'adaptateur.
 */
export function construireModePeche(options: OptionsModePeche): ModePeche {
  const monde = genererMonde(options.graine);
  const zones = monde.zonesPeche;
  const adaptateur = construireAdaptateurPecheCoeurJeu(monde);

  const gestionnaire = new GestionnaireCanne({
    lireZone: () => zoneProcheDe(options.lirePosition(), zones),
    lirePosition: options.lirePosition,
    lireHorodatage: options.lireHorodatage,
    graine: options.graine,
    interfacePeche: options.interfacePeche,
    adaptateur,
  });
  const canneBabylon = construireCanneBabylon(options.camera, options.scene);

  return {
    lireEtat: () => gestionnaire.lireEtat(),
    estModeActif: () => gestionnaire.estModeActif(),
    actualiser: (actions) => {
      const consommé = gestionnaire.actualiser(actions, options.lireHorodatage());
      canneBabylon.afficherEtat(gestionnaire.lireEtat());
      return consommé;
    },
    reinitialiser: () => {
      gestionnaire.reinitialiser();
      canneBabylon.afficherEtat(gestionnaire.lireEtat());
    },
    liberer: () => canneBabylon.liberer(),
    canneBabylon,
  };
}
