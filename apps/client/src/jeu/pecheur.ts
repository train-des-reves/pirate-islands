import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type InstancedMesh,
  type Mesh,
  type AbstractMesh,
  type Scene,
} from 'babylonjs';

import type { Vecteur3 } from './mouvement';
import {
  distanceEntre,
  interpolerTransformation,
  type TransformationInterpolable,
} from './interpolation';

export const DUREE_INTERPOLATION_PECHEUR = 0.18;
export const DELTA_MAXIMUM_INTERPOLATION_PECHEUR = 0.25;
export const SEUIL_TELEPORTATION_PECHEUR = 5;

export interface EtatPecheur {
  readonly sessionId: string;
  readonly nom: string;
  readonly transformation: TransformationInterpolable;
}

type PartiePecheur =
  | 'corps'
  | 'tete'
  | 'chapeau'
  | 'bordsChapeau'
  | 'gilet'
  | 'brasGauche'
  | 'brasDroit'
  | 'jambeGauche'
  | 'jambeDroite';

const PARTIES_PECHEUR: readonly PartiePecheur[] = [
  'corps',
  'tete',
  'chapeau',
  'bordsChapeau',
  'gilet',
  'brasGauche',
  'brasDroit',
  'jambeGauche',
  'jambeDroite',
];

type NomGabaritPecheur =
  | 'corps'
  | 'tete'
  | 'chapeau'
  | 'bords'
  | 'bras'
  | 'jambe'
  | 'gilet';

interface PosePartiePecheur {
  readonly position: Vecteur3;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly echelle: Vecteur3;
}

function vecteur(x: number, y: number, z: number): Vecteur3 {
  return { x, y, z };
}

function partie(
  position: Vecteur3,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  echelle = vecteur(1, 1, 1),
): PosePartiePecheur {
  return { position, rotationX, rotationY, rotationZ, echelle };
}

function calculerPosePecheur(): Readonly<Record<PartiePecheur, PosePartiePecheur>> {
  return {
    corps: partie(vecteur(0, 1.22, 0)),
    tete: partie(vecteur(0, 2.03, 0.02)),
    chapeau: partie(vecteur(0, 2.42, 0.02)),
    bordsChapeau: partie(vecteur(0, 2.32, 0.02)),
    gilet: partie(vecteur(0, 1.5, 0.02)),
    brasGauche: partie(vecteur(-0.48, 1.34, 0), 0, 0, -0.12),
    brasDroit: partie(vecteur(0.48, 1.34, 0), 0, 0, 0.12),
    jambeGauche: partie(vecteur(-0.2, 0.43, 0), 0, 0, 0),
    jambeDroite: partie(vecteur(0.2, 0.43, 0), 0, 0, 0),
  };
}

interface RessourcesPecheur {
  readonly gabarits: Readonly<Record<NomGabaritPecheur, Mesh>>;
  readonly materiaux: readonly StandardMaterial[];
  references: number;
}

const ressourcesParScene = new WeakMap<Scene, RessourcesPecheur>();

function créerMatériau(
  scene: Scene,
  nom: string,
  couleur: Color3,
  speculaire = new Color3(0.08, 0.08, 0.08),
): StandardMaterial {
  const matériau = new StandardMaterial(nom, scene);
  matériau.diffuseColor = couleur;
  matériau.specularColor = speculaire;
  return matériau;
}

function configurerGabarit(mesh: Mesh, matériau: StandardMaterial, nom: string): Mesh {
  mesh.material = matériau;
  mesh.position.y = -1000;
  mesh.isVisible = false;
  mesh.isPickable = false;
  mesh.metadata = { type: 'gabarit-pecheur', partie: nom };
  return mesh;
}

function créerRessourcesPecheur(scene: Scene): RessourcesPecheur {
  const peau = créerMatériau(scene, 'matériau-pecheur-peau', new Color3(0.86, 0.66, 0.5));
  const chemise = créerMatériau(scene, 'matériau-pecheur-chemise', new Color3(0.2, 0.36, 0.62));
  const gilet = créerMatériau(scene, 'matériau-pecheur-gilet', new Color3(0.9, 0.42, 0.08));
  const chapeau = créerMatériau(scene, 'matériau-pecheur-chapeau', new Color3(0.62, 0.46, 0.24));
  const pantalon = créerMatériau(scene, 'matériau-pecheur-pantalon', new Color3(0.12, 0.24, 0.28));

  const gabarits: Record<NomGabaritPecheur, Mesh> = {
    corps: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pecheur-corps',
        { width: 0.72, height: 1.15, depth: 0.42 },
        scene,
      ),
      chemise,
      'corps',
    ),
    tete: configurerGabarit(
      MeshBuilder.CreateSphere('gabarit-pecheur-tete', { diameter: 0.54, segments: 10 }, scene),
      peau,
      'tete',
    ),
    chapeau: configurerGabarit(
      MeshBuilder.CreateCylinder(
        'gabarit-pecheur-chapeau',
        { diameter: 0.33, height: 0.3, tessellation: 12 },
        scene,
      ),
      chapeau,
      'chapeau',
    ),
    bords: configurerGabarit(
      MeshBuilder.CreateCylinder(
        'gabarit-pecheur-bords',
        { diameter: 0.72, height: 0.08, tessellation: 12 },
        scene,
      ),
      chapeau,
      'bords',
    ),
    gilet: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pecheur-gilet',
        { width: 0.76, height: 0.52, depth: 0.46 },
        scene,
      ),
      gilet,
      'gilet',
    ),
    bras: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pecheur-bras',
        { width: 0.16, height: 0.72, depth: 0.18 },
        scene,
      ),
      chemise,
      'bras',
    ),
    jambe: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pecheur-jambe',
        { width: 0.2, height: 0.75, depth: 0.22 },
        scene,
      ),
      pantalon,
      'jambe',
    ),
  };

  return {
    gabarits,
    materiaux: [peau, chemise, gilet, chapeau, pantalon],
    references: 1,
  };
}

function obtenirRessourcesPecheur(scene: Scene): RessourcesPecheur {
  const existantes = ressourcesParScene.get(scene);
  if (existantes) {
    existantes.references += 1;
    return existantes;
  }

  const ressources = créerRessourcesPecheur(scene);
  ressourcesParScene.set(scene, ressources);
  return ressources;
}

function libérerRessourcesPecheur(scene: Scene, ressources: RessourcesPecheur): void {
  ressources.references -= 1;
  if (ressources.references > 0) {
    return;
  }

  for (const gabarit of Object.values(ressources.gabarits)) {
    gabarit.dispose(false, false);
  }
  for (const matériau of ressources.materiaux) {
    matériau.dispose();
  }
  ressourcesParScene.delete(scene);
}

function créerInstance(
  ressources: RessourcesPecheur,
  nom: NomGabaritPecheur,
  id: string,
  racine: TransformNode,
): InstancedMesh {
  const instance = ressources.gabarits[nom].createInstance('pecheur-' + id + '-' + nom);
  instance.parent = racine;
  instance.isVisible = true;
  instance.isPickable = false;
  instance.metadata = { type: 'pecheur', pecheurId: id, partie: nom };
  return instance;
}

function appliquerPartie(instance: InstancedMesh, pose: PosePartiePecheur): void {
  instance.position.set(pose.position.x, pose.position.y, pose.position.z);
  instance.rotation.set(pose.rotationX, pose.rotationY, pose.rotationZ);
  instance.scaling.set(pose.echelle.x, pose.echelle.y, pose.echelle.z);
}

function normaliserEtat(état: EtatPecheur): EtatPecheur {
  const transformation: TransformationInterpolable = {
    position: {
      x: Number.isFinite(état.transformation.position.x)
        ? état.transformation.position.x
        : 0,
      y: Number.isFinite(état.transformation.position.y)
        ? état.transformation.position.y
        : 0,
      z: Number.isFinite(état.transformation.position.z)
        ? état.transformation.position.z
        : 0,
    },
    lacet: Number.isFinite(état.transformation.lacet) ? état.transformation.lacet : 0,
    tangage: Number.isFinite(état.transformation.tangage) ? état.transformation.tangage : 0,
    roulis: Number.isFinite(état.transformation.roulis) ? état.transformation.roulis : 0,
  };
  return {
    sessionId: état.sessionId.trim() || 'pecheur-sans-session',
    nom: état.nom.trim() || 'Pêcheur',
    transformation,
  };
}

export interface Pecheur {
  readonly sessionId: string;
  readonly nom: string;
  readonly racine: TransformNode;
  readonly objets: readonly AbstractMesh[];
  recevoirEtat: (état: EtatPecheur) => void;
  mettreAJour: (deltaSecondes: number) => void;
  obtenirEtat: () => EtatPecheur;
  liberer: () => void;
}

export function construirePecheur(scene: Scene, étatInitial: EtatPecheur): Pecheur {
  const étatNormalisé = normaliserEtat(étatInitial);
  const racine = new TransformNode('pecheur-' + étatNormalisé.sessionId, scene);
  racine.metadata = { type: 'pecheur', pecheurId: étatNormalisé.sessionId };
  const ressources = obtenirRessourcesPecheur(scene);
  const instances: Record<PartiePecheur, InstancedMesh> = {
    corps: créerInstance(ressources, 'corps', étatNormalisé.sessionId, racine),
    tete: créerInstance(ressources, 'tete', étatNormalisé.sessionId, racine),
    chapeau: créerInstance(ressources, 'chapeau', étatNormalisé.sessionId, racine),
    bordsChapeau: créerInstance(ressources, 'bords', étatNormalisé.sessionId, racine),
    gilet: créerInstance(ressources, 'gilet', étatNormalisé.sessionId, racine),
    brasGauche: créerInstance(ressources, 'bras', étatNormalisé.sessionId + '-gauche', racine),
    brasDroit: créerInstance(ressources, 'bras', étatNormalisé.sessionId + '-droit', racine),
    jambeGauche: créerInstance(ressources, 'jambe', étatNormalisé.sessionId + '-gauche', racine),
    jambeDroite: créerInstance(ressources, 'jambe', étatNormalisé.sessionId + '-droit', racine),
  };
  const objets = Object.values(instances);
  const pose = calculerPosePecheur();
  let modèle = étatNormalisé;
  let affichage = étatNormalisé;
  let libéré = false;

  const appliquer = (): void => {
    racine.position.set(
      affichage.transformation.position.x,
      affichage.transformation.position.y,
      affichage.transformation.position.z,
    );
    racine.rotation.set(
      affichage.transformation.roulis,
      affichage.transformation.lacet,
      affichage.transformation.tangage,
    );
    for (const nom of PARTIES_PECHEUR) {
      appliquerPartie(instances[nom], pose[nom]);
    }
    racine.metadata = { type: 'pecheur', pecheurId: étatNormalisé.sessionId, nom: affichage.nom };
  };

  appliquer();

  return {
    sessionId: étatNormalisé.sessionId,
    nom: étatNormalisé.nom,
    racine,
    objets,
    recevoirEtat: (état) => {
      if (libéré) {
        return;
      }
      const normalisé = normaliserEtat(état);
      const distance = distanceEntre(affichage.transformation.position, normalisé.transformation.position);
      // Téléportation au-delà du seuil documenté : on saute l'interpolation.
      if (distance >= SEUIL_TELEPORTATION_PECHEUR) {
        affichage = normalisé;
        modèle = normalisé;
      } else {
        modèle = normalisé;
      }
      appliquer();
    },
    mettreAJour: (deltaSecondes) => {
      if (libéré) {
        return;
      }
      const delta = Number.isFinite(deltaSecondes)
        ? Math.min(DELTA_MAXIMUM_INTERPOLATION_PECHEUR, Math.max(0, deltaSecondes))
        : 0;
      const alpha = delta / DUREE_INTERPOLATION_PECHEUR;
      affichage = {
        ...affichage,
        transformation: interpolerTransformation(
          affichage.transformation,
          modèle.transformation,
          alpha,
        ),
      };
      appliquer();
    },
    obtenirEtat: () => ({ ...affichage, transformation: { ...affichage.transformation } }),
    liberer: () => {
      if (libéré) {
        return;
      }
      libéré = true;
      racine.dispose(false, false);
      libérerRessourcesPecheur(scene, ressources);
    },
  };
}

export const creerPecheur = construirePecheur;
export const créerVuePecheur = construirePecheur;
export const creerVuePecheur = construirePecheur;
