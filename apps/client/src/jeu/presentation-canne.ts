import {
  Color3,
  Color4,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  type Engine,
} from 'babylonjs';

import { genererMonde, type ZonePeche } from '@pirate/coeur-jeu';

import { construireCanneBabylon, type CanneBabylon } from './canne-babylon';
import {
  construireAdaptateurPecheCoeurJeu,
  GestionnaireCanne,
  type EtatCanne,
  type EtatVueCanne,
} from './canne';
import type { Vecteur3 } from './mouvement';

export interface PresentationCanneBabylon {
  readonly moteur: Engine;
  readonly gestionnaire: GestionnaireCanne;
  readonly canne: CanneBabylon;
  readonly zone: ZonePeche;
  readonly lireEtat: () => EtatCanne;
  readonly forcerEtat: (vue: EtatVueCanne) => void;
  readonly liberer: () => void;
}

function positionDeZone(zone: ZonePeche): Vecteur3 {
  return { x: zone.centre.x, y: 0, z: zone.centre.z };
}

/**
 * Harnais Babylon déterministe pour la canne : une caméra à hauteur d'yeux
 * regarde l'eau, la canne est attachée à la scène et l'état autoritaire est
 * fourni par le contrôleur connecté aux règles de #32.
 */
export function construirePresentationCanne(
  moteur: Engine,
  scene: Scene,
  graine: string,
): PresentationCanneBabylon {
  scene.clearColor = new Color4(0.31, 0.66, 0.82, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.31, 0.66, 0.82);
  scene.fogDensity = 0.0034;

  const monde = genererMonde(graine);
  const zone = monde.zonesPeche[0];
  if (!zone) {
    throw new Error('Le monde doit exposer au moins une zone de pêche.');
  }

  const lumière = new HemisphericLight('lumiere-canne', new Vector3(0.1, 1, 0.2), scene);
  lumière.intensity = 1.15;
  lumière.diffuse = new Color3(0.85, 0.95, 1);
  lumière.groundColor = new Color3(0.035, 0.12, 0.17);

  const ciel = MeshBuilder.CreateBox('ciel-canne', { size: 260 }, scene);
  ciel.isPickable = false;
  ciel.infiniteDistance = true;
  const materiauCiel = new StandardMaterial('materiau-ciel-canne', scene);
  materiauCiel.backFaceCulling = false;
  materiauCiel.disableLighting = true;
  materiauCiel.emissiveColor = new Color3(0.18, 0.46, 0.69);
  ciel.material = materiauCiel;

  const ocean = MeshBuilder.CreateGround('ocean-canne', { width: 240, height: 240, subdivisions: 8 }, scene);
  ocean.position.y = 0;
  ocean.isPickable = false;
  const materiauOcean = new StandardMaterial('materiau-ocean-canne', scene);
  materiauOcean.diffuseColor = new Color3(0.015, 0.28, 0.42);
  materiauOcean.specularColor = new Color3(0.3, 0.65, 0.75);
  materiauOcean.emissiveColor = new Color3(0.005, 0.04, 0.07);
  ocean.material = materiauOcean;

  const camera = new FreeCamera('camera-canne', new Vector3(zone.centre.x, 1.62, zone.centre.z + 2.4), scene);
  camera.minZ = 0.08;
  camera.maxZ = 1000;
  camera.fov = 1.05;
  camera.inertia = 0;
  camera.rotationQuaternion = null;
  camera.rotation.set(-0.12, 0, 0);
  scene.activeCamera = camera;

  const gestionnaire = new GestionnaireCanne({
    lireZone: () => zone,
    lirePosition: () => positionDeZone(zone),
    lireHorodatage: () => 0,
    graine,
    interfacePeche: {
      afficherInvite: () => undefined,
      afficherStatut: () => undefined,
      afficherResultat: () => undefined,
    },
    adaptateur: construireAdaptateurPecheCoeurJeu(monde),
  });
  const canne = construireCanneBabylon(camera, scene);

  const forcerEtat = (vue: EtatVueCanne): void => {
    gestionnaire.reinitialiser();
    if (vue === 'prete') {
      gestionnaire.actualiser({ tirer: false, interagir: true }, 0);
    } else if (vue === 'lancee') {
      gestionnaire.actualiser({ tirer: false, interagir: true }, 0);
      gestionnaire.actualiser({ tirer: true, interagir: false }, 0);
    } else if (vue === 'morsure') {
      gestionnaire.actualiser({ tirer: false, interagir: true }, 0);
      gestionnaire.actualiser({ tirer: true, interagir: false }, 0);
      const delai = gestionnaire.lireEtat().peche.delaiMorsureMs ?? 1;
      gestionnaire.actualiser({ tirer: false, interagir: false }, delai);
    } else if (vue === 'remontee') {
      gestionnaire.actualiser({ tirer: false, interagir: true }, 0);
      gestionnaire.actualiser({ tirer: true, interagir: false }, 0);
      const delai = gestionnaire.lireEtat().peche.delaiMorsureMs ?? 1;
      gestionnaire.actualiser({ tirer: false, interagir: false }, delai);
      gestionnaire.actualiser({ tirer: true, interagir: false }, delai);
    }
    canne.afficherEtat(gestionnaire.lireEtat());
  };

  return {
    moteur,
    gestionnaire,
    canne,
    zone,
    lireEtat: () => gestionnaire.lireEtat(),
    forcerEtat,
    liberer: () => canne.liberer(),
  };
}
