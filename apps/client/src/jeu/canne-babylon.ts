import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type FreeCamera,
  type Scene,
} from 'babylonjs';

import type { EtatCanne } from './canne';

export interface CanneBabylon {
  readonly racine: TransformNode;
  readonly meshes: readonly AbstractMesh[];
  readonly liberer: () => void;
  readonly afficherEtat: (etat: EtatCanne) => void;
}

function créerMatériau(
  scene: Scene,
  nom: string,
  diffuse: Color3,
  options: { readonly speculaire?: Color3; readonly emissive?: Color3 } = {},
): StandardMaterial {
  const matériau = new StandardMaterial(nom, scene);
  matériau.diffuseColor = diffuse;
  matériau.specularColor = options.speculaire ?? new Color3(0.18, 0.14, 0.08);
  matériau.emissiveColor = options.emissive ?? new Color3(0, 0, 0);
  return matériau;
}

/**
 * Canne à pêche procédurale attachée à la caméra de première personne.
 * Aucun asset téléchargé : les primitives Babylon.js suffisent.
 */
export function construireCanneBabylon(camera: FreeCamera, scene: Scene): CanneBabylon {
  const racine = new TransformNode('canne-premiere-personne', scene);
  racine.parent = camera;
  racine.position.set(0.38, -0.42, 0.72);
  racine.rotation.set(-0.14, 0.02, 0.05);

  const matériauBois = créerMatériau(
    scene,
    'materiau-canne-bois',
    new Color3(0.3, 0.14, 0.05),
  );
  const matériauTresse = créerMatériau(
    scene,
    'materiau-canne-fil',
    new Color3(0.9, 0.9, 0.86),
  );
  const matériauFlotteur = créerMatériau(
    scene,
    'materiau-canne-flotteur',
    new Color3(0.85, 0.12, 0.08),
    { emissive: new Color3(0.2, 0.02, 0.01) },
  );
  const matériauAnneau = créerMatériau(
    scene,
    'materiau-canne-anneau',
    new Color3(0.7, 0.72, 0.75),
  );

  const manche = MeshBuilder.CreateCylinder(
    'canne-manche',
    { height: 0.3, diameter: 0.028, tessellation: 8 },
    scene,
  );
  manche.parent = racine;
  manche.position.set(0, 0, 0.12);
  manche.rotation.x = Math.PI / 2;
  manche.material = matériauBois;
  manche.isPickable = false;

  const corpsCane = MeshBuilder.CreateCylinder(
    'canne-corps',
    { height: 0.88, diameterTop: 0.008, diameterBottom: 0.024, tessellation: 8 },
    scene,
  );
  corpsCane.parent = racine;
  corpsCane.position.set(0, 0.16, 0.58);
  corpsCane.rotation.x = Math.PI / 2;
  corpsCane.material = matériauBois;
  corpsCane.isPickable = false;

  const reel = MeshBuilder.CreateCylinder(
    'canne-moulinet',
    { height: 0.04, diameter: 0.09, tessellation: 10 },
    scene,
  );
  reel.parent = racine;
  reel.rotation.x = Math.PI / 2;
  reel.rotation.y = Math.PI / 2;
  reel.position.set(0.02, -0.04, 0.22);
  reel.material = matériauAnneau;
  reel.isPickable = false;

  const scion = MeshBuilder.CreateCylinder(
    'canne-scion',
    { height: 0.32, diameterTop: 0.008, diameterBottom: 0.014, tessellation: 8 },
    scene,
  );
  scion.parent = racine;
  scion.position.set(0, 0.38, 0.94);
  scion.rotation.x = Math.PI / 2;
  scion.material = matériauBois;
  scion.isPickable = false;

  const fil = new TransformNode('canne-fil-repere', scene);
  fil.parent = racine;
  fil.position.set(0, 0.44, 1.0);

  const segmentFil = MeshBuilder.CreateCylinder(
    'canne-fil',
    { height: 0.9, diameterTop: 0.002, diameterBottom: 0.002, tessellation: 6 },
    scene,
  );
  segmentFil.parent = fil;
  segmentFil.position.set(0, -0.45, 0.1);
  segmentFil.rotation.x = Math.PI / 2;
  segmentFil.material = matériauTresse;
  segmentFil.isPickable = false;

  const flotteur = MeshBuilder.CreateSphere(
    'canne-flotteur',
    { diameter: 0.05, segments: 8 },
    scene,
  );
  flotteur.parent = fil;
  flotteur.position.set(0, -0.9, 0.2);
  flotteur.material = matériauFlotteur;
  flotteur.isPickable = false;

  const meshes: readonly AbstractMesh[] = [manche, corpsCane, reel, scion, segmentFil, flotteur];

  const afficherEtat = (etat: EtatCanne): void => {
    const lancé = etat.vue === 'lancee' || etat.vue === 'morsure' || etat.vue === 'remontee';
    fil.setEnabled(lancé);
    segmentFil.isVisible = lancé;
    flotteur.isVisible = lancé;
    // En morsure, le flotteur plonge brièvement pour traduire la touche.
    const plongée = etat.vue === 'morsure' ? -0.18 : 0;
    flotteur.position.y = -0.9 + plongée;
    segmentFil.scaling.y = etat.vue === 'morsure' ? 1.15 : 1;
    racine.setEnabled(etat.vue !== 'rangee');
  };

  afficherEtat({ vue: 'rangee', sequence: 0, peche: { phase: 'inactive', sequence: 0, lanceAuMs: 0, tempsCourantMs: 0 } });

  return {
    racine,
    meshes,
    afficherEtat,
    liberer: () => {
      racine.dispose(false, true);
      for (const mesh of meshes) {
        mesh.dispose(false, true);
      }
    },
  };
}
