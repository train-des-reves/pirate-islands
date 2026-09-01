import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type FreeCamera,
  type Scene,
} from 'babylonjs';

import {
  AMPLITUDE_RECUL_TIR,
  calculerReculTir,
  eclairBoucheVisible,
  normaliserDirection,
  type IntentionTir,
  type ViseeTir,
} from './tir';

export interface EtatPistolet {
  readonly recul: number;
  readonly eclairBouche: boolean;
}

function créerMatériau(
  scene: Scene,
  nom: string,
  diffuse: Color3,
  emissive = new Color3(0, 0, 0),
): StandardMaterial {
  const matériau = new StandardMaterial(nom, scene);
  matériau.diffuseColor = diffuse;
  matériau.specularColor = new Color3(0.28, 0.3, 0.32);
  matériau.emissiveColor = emissive;
  return matériau;
}

function versVecteur3D(vecteur: Vector3): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  return { x: vecteur.x, y: vecteur.y, z: vecteur.z };
}

/** Pistolet local, procédural et attaché à la caméra de première personne. */
export class PistoletPremierePersonne {
  private readonly camera: FreeCamera;
  private readonly racine: TransformNode;
  private readonly eclair: AbstractMesh;
  private readonly repereBouche: TransformNode;
  private readonly positionInitiale = new Vector3(0.34, -0.29, 0.68);
  private readonly rotationInitiale = new Vector3(-0.045, 0.025, 0);
  private dernierTir: number | undefined;
  private etat: EtatPistolet = { recul: 0, eclairBouche: false };

  public constructor(camera: FreeCamera, scene: Scene) {
    this.camera = camera;
    this.racine = new TransformNode('pistolet-premiere-personne', scene);
    this.racine.parent = camera;
    this.racine.position.copyFrom(this.positionInitiale);
    this.racine.rotation.copyFrom(this.rotationInitiale);

    this.repereBouche = new TransformNode('pistolet-repere-bouche', scene);
    this.repereBouche.parent = camera;
    this.repereBouche.position.set(0.34, -0.28, 1.34);

    const métal = créerMatériau(scene, 'materiau-pistolet-metal', new Color3(0.12, 0.17, 0.22));
    const bois = créerMatériau(scene, 'materiau-pistolet-poignee', new Color3(0.28, 0.12, 0.06));
    const laiton = créerMatériau(
      scene,
      'materiau-pistolet-laiton',
      new Color3(0.68, 0.39, 0.08),
      new Color3(0.08, 0.035, 0.005),
    );
    const matériauEclair = créerMatériau(
      scene,
      'materiau-eclair-bouche',
      new Color3(1, 0.66, 0.08),
      new Color3(1, 0.24, 0.015),
    );

    const corps = MeshBuilder.CreateBox(
      'pistolet-corps',
      { width: 0.28, height: 0.15, depth: 0.42 },
      scene,
    );
    corps.parent = this.racine;
    corps.position.set(0, 0, 0.1);
    corps.material = métal;
    corps.isPickable = false;

    const culasse = MeshBuilder.CreateBox(
      'pistolet-culasse',
      { width: 0.22, height: 0.11, depth: 0.32 },
      scene,
    );
    culasse.parent = this.racine;
    culasse.position.set(0, 0.115, 0.1);
    culasse.material = laiton;
    culasse.isPickable = false;

    const canon = MeshBuilder.CreateCylinder(
      'pistolet-canon',
      { height: 0.34, diameter: 0.06, tessellation: 10 },
      scene,
    );
    canon.parent = this.racine;
    canon.rotation.x = Math.PI / 2;
    canon.position.set(0, 0.01, 0.47);
    canon.material = métal;
    canon.isPickable = false;

    const poignée = MeshBuilder.CreateBox(
      'pistolet-poignee',
      { width: 0.13, height: 0.34, depth: 0.16 },
      scene,
    );
    poignée.parent = this.racine;
    poignée.position.set(0, -0.2, 0.03);
    poignée.rotation.x = -0.12;
    poignée.material = bois;
    poignée.isPickable = false;

    const pontet = MeshBuilder.CreateTorus(
      'pistolet-pontet',
      { diameter: 0.13, thickness: 0.025, tessellation: 10 },
      scene,
    );
    pontet.parent = this.racine;
    pontet.rotation.x = Math.PI / 2;
    pontet.position.set(0, -0.08, 0.06);
    pontet.scaling.y = 0.72;
    pontet.material = laiton;
    pontet.isPickable = false;

    const hausse = MeshBuilder.CreateBox(
      'pistolet-hausse',
      { width: 0.04, height: 0.045, depth: 0.07 },
      scene,
    );
    hausse.parent = this.racine;
    hausse.position.set(0, 0.095, 0.3);
    hausse.material = laiton;
    hausse.isPickable = false;

    this.eclair = MeshBuilder.CreateCylinder(
      'pistolet-eclair-bouche',
      { height: 0.22, diameterTop: 0, diameterBottom: 0.18, tessellation: 6 },
      scene,
    );
    this.eclair.parent = this.racine;
    this.eclair.rotation.x = Math.PI / 2;
    this.eclair.position.set(0, 0.01, 0.77);
    this.eclair.scaling.set(1, 1, 1.2);
    this.eclair.material = matériauEclair;
    this.eclair.isPickable = false;
    this.eclair.isVisible = false;
  }

  public déclencher(intention: IntentionTir): void {
    this.dernierTir = intention.horodatageClient;
    this.actualiser(intention.horodatageClient);
  }

  public actualiser(maintenant: number): void {
    const recul = calculerReculTir(maintenant, this.dernierTir);
    const eclairBouche = eclairBoucheVisible(maintenant, this.dernierTir);
    this.etat = { recul, eclairBouche };
    this.racine.position.z = this.positionInitiale.z - recul * AMPLITUDE_RECUL_TIR;
    this.racine.rotation.x = this.rotationInitiale.x + recul * 0.045;
    this.eclair.isVisible = eclairBouche;
  }

  public lireEtat(): EtatPistolet {
    return { ...this.etat };
  }

  public lireVisee(): ViseeTir {
    this.repereBouche.computeWorldMatrix(true);
    const rayon = this.camera.getForwardRay(1);
    return {
      // La visée sémantique vient de la caméra; le recul du modèle reste
      // purement visuel et ne modifie donc ni l'origine ni la direction.
      origine: versVecteur3D(this.repereBouche.getAbsolutePosition()),
      direction: normaliserDirection(versVecteur3D(rayon.direction)),
    };
  }

  public reinitialiser(maintenant = 0): void {
    this.dernierTir = undefined;
    this.actualiser(maintenant);
  }

  /** Masque ou affiche le modèle local (canne et pistolet ne sont jamais actifs ensemble). */
  public setVisible(visible: boolean): void {
    this.racine.setEnabled(visible);
  }

  public liberer(): void {
    this.racine.dispose(false, true);
    this.repereBouche.dispose();
  }
}
