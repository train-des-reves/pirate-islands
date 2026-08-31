import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type InstancedMesh,
  type Mesh,
  type Scene,
} from 'babylonjs';

export const ETATS_BATEAU_PIRATE = ['intact', 'endommage', 'detruit'] as const;

export type EtatBateauPirate = (typeof ETATS_BATEAU_PIRATE)[number];

export interface VecteurBateauPirate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TransformationBateauPirate {
  readonly position: VecteurBateauPirate;
  readonly rotationY: number;
}

export interface DonneesBateauPirate {
  readonly id: string;
  readonly transformation: TransformationBateauPirate;
  readonly vitesse: number;
  readonly ratioSante: number;
  readonly etat: EtatBateauPirate;
}

/** Ancres nommées, rattachées au référentiel local du sloop. */
export const ANCRES_BATEAU_PIRATE = [
  'pilote',
  'equipage',
  'origine',
  'sillage',
] as const;

export type AncreBateauPirate = (typeof ANCRES_BATEAU_PIRATE)[number];

export interface Ancre {
  readonly nom: AncreBateauPirate;
  readonly position: VecteurBateauPirate;
}

export const ANCRES_BATEAU_PIRATE_DETAIL: Readonly<Record<AncreBateauPirate, Ancre>> = {
  pilote: { nom: 'pilote', position: { x: 0, y: 2.0, z: 2.4 } },
  equipage: { nom: 'equipage', position: { x: 0.7, y: 1.9, z: 1.1 } },
  origine: { nom: 'origine', position: { x: 0, y: 1.15, z: 0 } },
  sillage: { nom: 'sillage', position: { x: 0, y: 0.55, z: -3.4 } },
};

/** Limites de collision finies autour du sloop, dans le référentiel local. */
export interface LimitesCollisionBateauPirate {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const LIMITES_BATEAU_PIRATE: LimitesCollisionBateauPirate = {
  minX: -1.25,
  maxX: 1.25,
  minY: -0.5,
  maxY: 3.4,
  minZ: -3.8,
  maxZ: 3.8,
};

export type PartieBateauPirate =
  | 'coque'
  | 'pont'
  | 'mat'
  | 'voile'
  | 'proue'
  | 'poupe'
  | 'gouvernail'
  | 'pavillon'
  | 'barreSanteFond'
  | 'barreSante'
  | 'auraBlessure'
  | 'sillage';

export const PARTIES_BATEAU_PIRATE: readonly PartieBateauPirate[] = [
  'coque',
  'pont',
  'mat',
  'voile',
  'proue',
  'poupe',
  'gouvernail',
  'pavillon',
  'barreSanteFond',
  'barreSante',
  'auraBlessure',
  'sillage',
];

type NomGabaritBateauPirate =
  | 'coque'
  | 'pont'
  | 'mat'
  | 'voile'
  | 'proue'
  | 'poupe'
  | 'gouvernail'
  | 'pavillon'
  | 'barreSanteFond'
  | 'barreSante'
  | 'auraBlessure'
  | 'sillage';

interface PartiePoseBateauPirate {
  readonly position: VecteurBateauPirate;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly echelle: VecteurBateauPirate;
}

export interface PoseBateauPirate {
  readonly active: boolean;
  readonly parties: Readonly<Record<PartieBateauPirate, PartiePoseBateauPirate>>;
  readonly voileVisible: boolean;
  readonly pavillonVisible: boolean;
}

export interface EtatVisuelBateauPirate extends DonneesBateauPirate {
  readonly retourDegatsActif: boolean;
  readonly pose: PoseBateauPirate;
}

export const DUREE_INTERPOLATION_BATEAU_PIRATE = 0.2;
export const DELTA_MAXIMUM_INTERPOLATION_BATEAU_PIRATE = 0.25;
export const DUREE_RETOUR_DEGATS_BATEAU_PIRATE = 0.22;

function bornerNombre(valeur: number, minimum: number, maximum: number, défaut: number): number {
  if (!Number.isFinite(valeur)) {
    return défaut;
  }

  return Math.max(minimum, Math.min(maximum, valeur));
}

export function bornerRatioSanteBateauPirate(ratioSante: number): number {
  return bornerNombre(ratioSante, 0, 1, 1);
}

export function bornerAlphaInterpolationBateauPirate(alpha: number): number {
  return bornerNombre(alpha, 0, 1, 0);
}

export function interpolerNombreBorneBateauPirate(
  actuel: number,
  cible: number,
  alpha: number,
): number {
  const alphaSain = bornerAlphaInterpolationBateauPirate(alpha);
  const actuelSain = Number.isFinite(actuel) ? actuel : 0;
  const cibleSaine = Number.isFinite(cible) ? cible : actuelSain;
  return actuelSain + (cibleSaine - actuelSain) * alphaSain;
}

function angleLePlusCourt(angle: number): number {
  const deuxPi = Math.PI * 2;
  return ((((angle + Math.PI) % deuxPi) + deuxPi) % deuxPi) - Math.PI;
}

export function interpolerAngleBorneBateauPirate(
  actuel: number,
  cible: number,
  alpha: number,
): number {
  const actuelSain = Number.isFinite(actuel) ? actuel : 0;
  const cibleSaine = Number.isFinite(cible) ? cible : actuelSain;
  const alphaSain = bornerAlphaInterpolationBateauPirate(alpha);
  if (alphaSain >= 1) {
    return cibleSaine;
  }

  return actuelSain + angleLePlusCourt(cibleSaine - actuelSain) * alphaSain;
}

export function interpolerTransformationBateauPirate(
  actuelle: TransformationBateauPirate,
  cible: TransformationBateauPirate,
  alpha: number,
): TransformationBateauPirate {
  return {
    position: {
      x: interpolerNombreBorneBateauPirate(actuelle.position.x, cible.position.x, alpha),
      y: interpolerNombreBorneBateauPirate(actuelle.position.y, cible.position.y, alpha),
      z: interpolerNombreBorneBateauPirate(actuelle.position.z, cible.position.z, alpha),
    },
    rotationY: interpolerAngleBorneBateauPirate(actuelle.rotationY, cible.rotationY, alpha),
  };
}

function vecteur(x: number, y: number, z: number): VecteurBateauPirate {
  return { x, y, z };
}

function partie(
  position: VecteurBateauPirate,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  echelle = vecteur(1, 1, 1),
): PartiePoseBateauPirate {
  return { position, rotationX, rotationY, rotationZ, echelle };
}

function creerPoseActive(
  etat: Exclude<EtatBateauPirate, 'detruit'>,
  ratioSante: number,
): PoseBateauPirate {
  const parties: Record<PartieBateauPirate, PartiePoseBateauPirate> = {
    coque: partie(vecteur(0, 0.55, 0)),
    pont: partie(vecteur(0, 1.12, 0)),
    mat: partie(vecteur(0, 2.2, -0.35)),
    voile: partie(vecteur(0, 2.45, 0.35)),
    proue: partie(vecteur(0, 0.9, 3.2)),
    poupe: partie(vecteur(0, 0.95, -2.9)),
    gouvernail: partie(vecteur(0, 0.85, -3.35)),
    pavillon: partie(vecteur(0, 3.5, -0.35)),
    barreSanteFond: partie(vecteur(0, 4.05, 0)),
    barreSante: partie(vecteur(0, 4.05, -0.02)),
    auraBlessure: partie(vecteur(0, 0.6, 0)),
    sillage: partie(vecteur(0, 0.35, -3.8)),
  };

  if (etat === 'endommage') {
    parties.mat = partie(vecteur(0.12, 2.1, -0.35), 0, 0, 0.14);
    parties.voile = partie(vecteur(0, 2.3, 0.3), 0.1, 0, 0.05);
    parties.pavillon = partie(vecteur(0, 3.35, -0.35), 0, 0, 0.08);
    parties.coque = partie(vecteur(0, 0.52, 0), 0, 0, 0.03);
  }

  const voileVisible = ratioSante > 0.15;
  return {
    active: true,
    parties,
    voileVisible,
    pavillonVisible: true,
  };
}

function creerPoseDetruit(): PoseBateauPirate {
  return {
    active: false,
    parties: {
      coque: partie(vecteur(0, 0.25, 0), 0, 0, 0.18),
      pont: partie(vecteur(0, 0.4, 0), 0, 0, 0.22),
      mat: partie(vecteur(0.55, 0.45, -0.9), 0.5, 0, 1.35),
      voile: partie(vecteur(0.8, 0.3, -1.4), 0.3, 0, 1.2),
      proue: partie(vecteur(0, 0.32, 3.2), 0, 0, 0.18),
      poupe: partie(vecteur(0, 0.3, -2.9), 0, 0, 0.18),
      gouvernail: partie(vecteur(0.4, 0.28, -3.2), 0.4, 0, 1.1),
      pavillon: partie(vecteur(0.55, 0.42, -0.9), 0.5, 0, 1.35),
      barreSanteFond: partie(vecteur(0, 0.65, 0)),
      barreSante: partie(vecteur(0, 0.65, -0.02)),
      auraBlessure: partie(vecteur(0, 0.15, 0)),
      sillage: partie(vecteur(0, 0.1, -3.8)),
    },
    voileVisible: false,
    pavillonVisible: false,
  };
}

export function calculerPoseBateauPirate(
  etat: EtatBateauPirate,
  ratioSante: number,
): PoseBateauPirate {
  return etat === 'detruit' ? creerPoseDetruit() : creerPoseActive(etat, ratioSante);
}

function estEtatBateauPirate(valeur: unknown): valeur is EtatBateauPirate {
  return typeof valeur === 'string' && (ETATS_BATEAU_PIRATE as readonly string[]).includes(valeur);
}

function normaliserEtatBateauPirate(
  ratioSante: number,
  etat: EtatBateauPirate,
): EtatBateauPirate {
  if (etat === 'detruit' || ratioSante <= 0) {
    return 'detruit';
  }
  if (etat === 'endommage' || ratioSante < 0.65) {
    return 'endommage';
  }
  return 'intact';
}

function normaliserDonnees(
  données: DonneesBateauPirate,
  précédent: DonneesBateauPirate | undefined,
): DonneesBateauPirate {
  const transformationPrécédente = précédent?.transformation ?? {
    position: vecteur(0, 0, 0),
    rotationY: 0,
  };
  const id = données.id.trim() || précédent?.id || 'bateau-pirate-sans-id';
  const ratioSante = bornerRatioSanteBateauPirate(données.ratioSante);
  const etat = estEtatBateauPirate(données.etat)
    ? normaliserEtatBateauPirate(ratioSante, données.etat)
    : (précédent?.etat ?? 'intact');

  return {
    id,
    transformation: {
      position: {
        x: Number.isFinite(données.transformation.position.x)
          ? données.transformation.position.x
          : transformationPrécédente.position.x,
        y: Number.isFinite(données.transformation.position.y)
          ? données.transformation.position.y
          : transformationPrécédente.position.y,
        z: Number.isFinite(données.transformation.position.z)
          ? données.transformation.position.z
          : transformationPrécédente.position.z,
      },
      rotationY: Number.isFinite(données.transformation.rotationY)
        ? données.transformation.rotationY
        : transformationPrécédente.rotationY,
    },
    vitesse: bornerNombre(données.vitesse, 0, 20, 0),
    ratioSante,
    etat,
  };
}

export class ModeleVueBateauPirate {
  private readonly id: string;
  private cible: DonneesBateauPirate;
  private affichage: DonneesBateauPirate;
  private tempsRetourDegats = 0;
  private detruitVerrouille = false;
  private derniereIntensiteSillage = 0;

  public constructor(initial: DonneesBateauPirate) {
    const données = normaliserDonnees(initial, undefined);
    this.id = données.id;
    this.cible = données;
    this.affichage = données;
    this.detruitVerrouille = données.etat === 'detruit';
  }

  public recevoirEtat(nouvelEtat: DonneesBateauPirate): void {
    if (this.detruitVerrouille && nouvelEtat.etat !== 'detruit') {
      return;
    }

    const données = { ...normaliserDonnees(nouvelEtat, this.cible), id: this.id };
    if (données.ratioSante < this.cible.ratioSante - 0.001) {
      this.tempsRetourDegats = DUREE_RETOUR_DEGATS_BATEAU_PIRATE;
    }

    this.cible = données;
    this.affichage = { ...this.affichage, etat: données.etat };
    if (données.etat === 'detruit') {
      this.detruitVerrouille = true;
      this.derniereIntensiteSillage = 0;
    }
  }

  public mettreAJour(deltaSecondes: number): void {
    const delta = bornerNombre(
      deltaSecondes,
      0,
      DELTA_MAXIMUM_INTERPOLATION_BATEAU_PIRATE,
      0,
    );
    const alpha = bornerAlphaInterpolationBateauPirate(delta / DUREE_INTERPOLATION_BATEAU_PIRATE);
    this.affichage = {
      ...this.affichage,
      transformation: interpolerTransformationBateauPirate(
        this.affichage.transformation,
        this.cible.transformation,
        alpha,
      ),
      vitesse: interpolerNombreBorneBateauPirate(this.affichage.vitesse, this.cible.vitesse, alpha),
      ratioSante: interpolerNombreBorneBateauPirate(
        this.affichage.ratioSante,
        this.cible.ratioSante,
        alpha,
      ),
    };
    this.tempsRetourDegats = Math.max(0, this.tempsRetourDegats - delta);
    if (this.detruitVerrouille) {
      this.derniereIntensiteSillage = 0;
    } else {
      this.derniereIntensiteSillage = this.affichage.vitesse / 12;
    }
  }

  public obtenirEtat(): EtatVisuelBateauPirate {
    return {
      ...this.affichage,
      ratioSante: bornerRatioSanteBateauPirate(this.affichage.ratioSante),
      etat: this.affichage.etat,
      retourDegatsActif: this.tempsRetourDegats > 0,
      pose: calculerPoseBateauPirate(this.affichage.etat, this.affichage.ratioSante),
    };
  }

  public obtenirIntensiteSillage(): number {
    return this.derniereIntensiteSillage;
  }
}

interface RessourcesBateauPirate {
  readonly gabarits: Readonly<Record<NomGabaritBateauPirate, Mesh>>;
  readonly materiaux: readonly StandardMaterial[];
  references: number;
}

const ressourcesParScene = new WeakMap<Scene, RessourcesBateauPirate>();

function créerMatériau(
  scene: Scene,
  nom: string,
  couleur: Color3,
  speculaire = new Color3(0.06, 0.08, 0.09),
  emissive = new Color3(0, 0, 0),
): StandardMaterial {
  const matériau = new StandardMaterial(nom, scene);
  matériau.diffuseColor = couleur;
  matériau.specularColor = speculaire;
  matériau.emissiveColor = emissive;
  return matériau;
}

function configurerGabarit(mesh: Mesh, matériau: StandardMaterial, nom: string): Mesh {
  mesh.material = matériau;
  mesh.position.y = -1000;
  mesh.isVisible = false;
  mesh.isPickable = false;
  mesh.metadata = { type: 'gabarit-bateau-pirate', partie: nom };
  return mesh;
}

function créerRessourcesBateauPirate(scene: Scene): RessourcesBateauPirate {
  const coque = créerMatériau(scene, 'matériau-bateau-pirate-coque', new Color3(0.11, 0.05, 0.05));
  const pont = créerMatériau(scene, 'matériau-bateau-pirate-pont', new Color3(0.28, 0.16, 0.07));
  const mat = créerMatériau(scene, 'matériau-bateau-pirate-mat', new Color3(0.16, 0.08, 0.04));
  const voile = créerMatériau(
    scene,
    'matériau-bateau-pirate-voile',
    new Color3(0.055, 0.055, 0.07),
    new Color3(0.05, 0.05, 0.06),
  );
  const proue = créerMatériau(scene, 'matériau-bateau-pirate-proue', new Color3(0.07, 0.04, 0.035));
  const pavillon = créerMatériau(
    scene,
    'matériau-bateau-pirate-pavillon',
    new Color3(0.3, 0.04, 0.04),
    new Color3(0.1, 0.02, 0.02),
    new Color3(0.05, 0.005, 0.005),
  );
  const métal = créerMatériau(
    scene,
    'matériau-bateau-pirate-metal',
    new Color3(0.4, 0.26, 0.08),
    new Color3(0.35, 0.25, 0.08),
  );
  const vert = créerMatériau(scene, 'matériau-bateau-pirate-sante', new Color3(0.26, 0.8, 0.35));
  const fondSante = créerMatériau(
    scene,
    'matériau-bateau-pirate-fond-sante',
    new Color3(0.12, 0.035, 0.035),
  );
  const blessure = créerMatériau(
    scene,
    'matériau-bateau-pirate-blessure',
    new Color3(0.85, 0.06, 0.035),
    new Color3(0.4, 0.02, 0.01),
    new Color3(0.18, 0.008, 0.004),
  );
  const sillage = créerMatériau(
    scene,
    'matériau-bateau-pirate-sillage',
    new Color3(0.85, 0.92, 0.95),
    new Color3(0.12, 0.16, 0.18),
  );
  sillage.alpha = 0.0;

  const gabarits: Record<NomGabaritBateauPirate, Mesh> = {
    coque: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-bateau-pirate-coque',
        { width: 2.0, height: 0.9, depth: 7.2 },
        scene,
      ),
      coque,
      'coque',
    ),
    pont: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-bateau-pirate-pont',
        { width: 1.7, height: 0.12, depth: 6.4 },
        scene,
      ),
      pont,
      'pont',
    ),
    mat: configurerGabarit(
      MeshBuilder.CreateCylinder(
        'gabarit-bateau-pirate-mat',
        { diameter: 0.14, height: 3.2, tessellation: 10 },
        scene,
      ),
      mat,
      'mat',
    ),
    voile: configurerGabarit(
      MeshBuilder.CreateCylinder(
        'gabarit-bateau-pirate-voile',
        { diameterTop: 0.1, diameterBottom: 1.5, height: 2.2, tessellation: 8 },
        scene,
      ),
      voile,
      'voile',
    ),
    proue: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-bateau-pirate-proue',
        { width: 0.36, height: 0.8, depth: 1.2 },
        scene,
      ),
      proue,
      'proue',
    ),
    poupe: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-bateau-pirate-poupe',
        { width: 1.9, height: 0.7, depth: 0.5 },
        scene,
      ),
      coque,
      'poupe',
    ),
    gouvernail: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-bateau-pirate-gouvernail',
        { width: 0.16, height: 1.0, depth: 0.16 },
        scene,
      ),
      mat,
      'gouvernail',
    ),
    pavillon: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-bateau-pirate-pavillon',
        { width: 0.9, height: 0.4, depth: 0.04 },
        scene,
      ),
      pavillon,
      'pavillon',
    ),
    barreSanteFond: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-bateau-pirate-barre-sante-fond',
        { width: 1.8, height: 0.1, depth: 0.04 },
        scene,
      ),
      fondSante,
      'barre-sante-fond',
    ),
    barreSante: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-bateau-pirate-barre-sante',
        { width: 1.7, height: 0.06, depth: 0.05 },
        scene,
      ),
      vert,
      'barre-sante',
    ),
    auraBlessure: configurerGabarit(
      MeshBuilder.CreateTorus(
        'gabarit-bateau-pirate-aura-blessure',
        { diameter: 4.4, thickness: 0.06, tessellation: 24 },
        scene,
      ),
      blessure,
      'aura-blessure',
    ),
    sillage: configurerGabarit(
      MeshBuilder.CreateGround(
        'gabarit-bateau-pirate-sillage',
        { width: 1.6, height: 3.2, subdivisions: 1 },
        scene,
      ),
      sillage,
      'sillage',
    ),
  };

  return {
    gabarits,
    materiaux: [
      coque,
      pont,
      mat,
      voile,
      proue,
      pavillon,
      métal,
      vert,
      fondSante,
      blessure,
      sillage,
    ],
    references: 1,
  };
}

function obtenirRessourcesBateauPirate(scene: Scene): RessourcesBateauPirate {
  const existantes = ressourcesParScene.get(scene);
  if (existantes) {
    existantes.references += 1;
    return existantes;
  }

  const ressources = créerRessourcesBateauPirate(scene);
  ressourcesParScene.set(scene, ressources);
  return ressources;
}

function libérerRessourcesBateauPirate(scene: Scene, ressources: RessourcesBateauPirate): void {
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

export interface BateauPirate {
  readonly id: string;
  readonly racine: TransformNode;
  readonly parties: Readonly<Record<PartieBateauPirate, InstancedMesh>>;
  readonly objets: readonly AbstractMesh[];
  obtenirAncres: () => Readonly<Record<AncreBateauPirate, VecteurBateauPirate>>;
  obtenirLimites: () => LimitesCollisionBateauPirate;
  recevoirEtat: (etat: DonneesBateauPirate) => void;
  mettreAJour: (deltaSecondes: number) => void;
  obtenirEtat: () => EtatVisuelBateauPirate;
  obtenirIntensiteSillage: () => number;
  liberer: () => void;
}

function créerInstance(
  ressources: RessourcesBateauPirate,
  nom: NomGabaritBateauPirate,
  id: string,
  racine: TransformNode,
): InstancedMesh {
  const instance = ressources.gabarits[nom].createInstance('bateau-pirate-' + id + '-' + nom);
  instance.parent = racine;
  instance.isVisible = true;
  instance.isPickable = false;
  instance.metadata = { type: 'bateau-pirate', bateauId: id, partie: nom };
  return instance;
}

function appliquerPartie(instance: InstancedMesh, pose: PartiePoseBateauPirate): void {
  instance.position.set(pose.position.x, pose.position.y, pose.position.z);
  instance.rotation.set(pose.rotationX, pose.rotationY, pose.rotationZ);
  instance.scaling.set(pose.echelle.x, pose.echelle.y, pose.echelle.z);
}

function appliquerPose(
  instances: Record<PartieBateauPirate, InstancedMesh> & {
    readonly barreSanteFond: InstancedMesh;
    readonly barreSante: InstancedMesh;
    readonly auraBlessure: InstancedMesh;
  },
  etat: EtatVisuelBateauPirate,
  intensiteSillage: number,
): void {
  for (const nom of PARTIES_BATEAU_PIRATE) {
    appliquerPartie(instances[nom], etat.pose.parties[nom]);
  }

  const ratio = bornerRatioSanteBateauPirate(etat.ratioSante);
  instances.voile.isVisible = etat.pose.voileVisible;
  instances.pavillon.isVisible = etat.pose.pavillonVisible;
  instances.mat.isVisible = etat.pose.active;
  instances.barreSanteFond.position.set(0, 4.05, 0);
  instances.barreSante.position.set(-0.85 * (1 - ratio), 4.05, -0.03);
  instances.barreSante.scaling.set(ratio, 1, 1);
  instances.barreSanteFond.isVisible = etat.pose.active;
  instances.barreSante.isVisible = etat.pose.active && ratio > 0;
  instances.auraBlessure.position.set(0, 0.62, 0);
  instances.auraBlessure.scaling.set(1, 0.65, 1);
  instances.auraBlessure.isVisible = etat.pose.active && (ratio < 0.75 || etat.retourDegatsActif);
  const sillageVisible = etat.pose.active && intensiteSillage > 0.01;
  instances.sillage.isVisible = sillageVisible;
  instances.sillage.position.z = -4.2 - intensiteSillage * 1.1;
  instances.sillage.scaling.set(1 + intensiteSillage * 0.25, 1, Math.max(0.35, intensiteSillage));
}

type InstancesBateauPirate = Record<PartieBateauPirate, InstancedMesh> & {
  readonly barreSanteFond: InstancedMesh;
  readonly barreSante: InstancedMesh;
  readonly auraBlessure: InstancedMesh;
};

export function construireBateauPirate(
  scene: Scene,
  etatInitial: DonneesBateauPirate,
): BateauPirate {
  const modèle = new ModeleVueBateauPirate(etatInitial);
  const etatNormalise = modèle.obtenirEtat();
  const racine = new TransformNode('bateau-pirate-' + etatNormalise.id, scene);
  racine.metadata = { type: 'bateau-pirate', bateauId: etatNormalise.id };
  const ressources = obtenirRessourcesBateauPirate(scene);
  const instances = {
    coque: créerInstance(ressources, 'coque', etatNormalise.id, racine),
    pont: créerInstance(ressources, 'pont', etatNormalise.id, racine),
    mat: créerInstance(ressources, 'mat', etatNormalise.id, racine),
    voile: créerInstance(ressources, 'voile', etatNormalise.id, racine),
    proue: créerInstance(ressources, 'proue', etatNormalise.id, racine),
    poupe: créerInstance(ressources, 'poupe', etatNormalise.id, racine),
    gouvernail: créerInstance(ressources, 'gouvernail', etatNormalise.id, racine),
    pavillon: créerInstance(ressources, 'pavillon', etatNormalise.id, racine),
    barreSanteFond: créerInstance(ressources, 'barreSanteFond', etatNormalise.id, racine),
    barreSante: créerInstance(ressources, 'barreSante', etatNormalise.id, racine),
    auraBlessure: créerInstance(ressources, 'auraBlessure', etatNormalise.id, racine),
    sillage: créerInstance(ressources, 'sillage', etatNormalise.id, racine),
  } as InstancesBateauPirate;
  const objets = Object.values(instances);
  let libéré = false;

  const appliquer = (): void => {
    const etat = modèle.obtenirEtat();
    const intensiteSillage = modèle.obtenirIntensiteSillage();
    racine.position.set(
      etat.transformation.position.x,
      etat.transformation.position.y,
      etat.transformation.position.z,
    );
    racine.rotation.y = etat.transformation.rotationY;
    racine.metadata = {
      type: 'bateau-pirate',
      bateauId: etat.id,
      etat: etat.etat,
      intensiteSillage,
    };
    appliquerPose(instances, etat, intensiteSillage);
  };

  appliquer();

  return {
    id: etatNormalise.id,
    racine,
    parties: instances,
    objets,
    obtenirAncres: () => {
      const ancres = {} as Record<AncreBateauPirate, VecteurBateauPirate>;
      for (const ancre of Object.values(ANCRES_BATEAU_PIRATE_DETAIL)) {
        ancres[ancre.nom] = { ...ancre.position };
      }
      return ancres;
    },
    obtenirLimites: () => ({ ...LIMITES_BATEAU_PIRATE }),
    recevoirEtat: (nouvelEtat) => {
      if (!libéré) {
        modèle.recevoirEtat(nouvelEtat);
        appliquer();
      }
    },
    mettreAJour: (deltaSecondes) => {
      if (!libéré) {
        modèle.mettreAJour(deltaSecondes);
        appliquer();
      }
    },
    obtenirEtat: () => modèle.obtenirEtat(),
    obtenirIntensiteSillage: () => modèle.obtenirIntensiteSillage(),
    liberer: () => {
      if (libéré) {
        return;
      }

      libéré = true;
      racine.dispose(false, false);
      libérerRessourcesBateauPirate(scene, ressources);
    },
  };
}

export const creerBateauPirate = construireBateauPirate;
export const créerVueBateauPirate = construireBateauPirate;

export const FIXTURES_BATEAUX_PIRATES = [
  { etat: 'intact', ratioSante: 1, vitesse: 9.2, label: 'Intact' },
  { etat: 'intact', ratioSante: 1, vitesse: 12, label: 'En mouvement' },
  { etat: 'endommage', ratioSante: 0.55, vitesse: 7, label: 'Endommagé' },
  { etat: 'detruit', ratioSante: 0, vitesse: 0, label: 'Détruit' },
] as const satisfies ReadonlyArray<{
  readonly etat: EtatBateauPirate;
  readonly ratioSante: number;
  readonly vitesse: number;
  readonly label: string;
}>;

export interface OptionsGalerieBateauxPiratesE2E {
  readonly animerInterpolation?: boolean;
  readonly afficherEtiquettes?: boolean;
  readonly afficherPlanche?: boolean;
  /** Phase initiale (secondes) de l'animation, pour figer une pose déterministe en E2E. */
  readonly phaseInitiale?: number;
  /** Lorsque vrai, fige le temps accumulé sur la phase initiale (capture déterministe). */
  readonly figerPose?: boolean;
}

export interface GalerieBateauxPiratesE2E {
  readonly acteurs: readonly BateauPirate[];
  readonly objets: readonly AbstractMesh[];
  mettreAJour: (deltaSecondes: number) => void;
  liberer: () => void;
}

function créerSolGalerie(scene: Scene): Mesh {
  const sol = MeshBuilder.CreateGround(
    'sol-galerie-bateaux-pirates',
    { width: 22, height: 12, subdivisions: 2 },
    scene,
  );
  sol.position.y = -0.05;
  sol.material = créerMatériau(
    scene,
    'matériau-sol-galerie-bateaux-pirates',
    new Color3(0.035, 0.16, 0.2),
    new Color3(0.18, 0.25, 0.28),
  );
  sol.isPickable = false;
  sol.metadata = { type: 'galerie-bateaux-pirates-e2e' };
  return sol;
}

type AttributsSvg = Readonly<Record<string, string | number>>;

const ESPACE_NOMS_SVG = 'http://www.w3.org/2000/svg';

function ajouterElementSvg(parent: SVGElement, nom: string, attributs: AttributsSvg): SVGElement {
  const élément = document.createElementNS(ESPACE_NOMS_SVG, nom);
  for (const [attribut, valeur] of Object.entries(attributs)) {
    élément.setAttribute(attribut, String(valeur));
  }
  parent.append(élément);
  return élément;
}

function ajouterSilhouetteBateauPirateSvg(
  svg: SVGSVGElement,
  centreX: number,
  fixture: (typeof FIXTURES_BATEAUX_PIRATES)[number],
): void {
  const état = fixture.etat;
  const détruit = état === 'detruit';
  const couleurCarte = détruit
    ? '#241d21'
    : état === 'endommage'
      ? '#3a1516'
      : '#102a33';
  const couleurBordure = détruit
    ? '#8b7f84'
    : état === 'endommage'
      ? '#ff7a54'
      : '#e0b45c';
  const carte = ajouterElementSvg(svg, 'g', {
    transform: 'translate(' + centreX + ' 0)',
  });
  carte.setAttribute('data-testid', 'bateau-pirate-planche-carte');
  carte.setAttribute('data-etat', état);

  ajouterElementSvg(carte, 'rect', {
    x: -118,
    y: 8,
    width: 236,
    height: 219,
    rx: 16,
    fill: couleurCarte,
    'fill-opacity': 0.96,
    stroke: couleurBordure,
    'stroke-opacity': 0.9,
    'stroke-width': 2,
  });

  // Barre de santé.
  ajouterElementSvg(carte, 'rect', {
    x: -78,
    y: 23,
    width: 156,
    height: 8,
    rx: 4,
    fill: '#2a0f18',
    'data-role': 'barre-sante-fond',
  });
  if (fixture.ratioSante > 0) {
    ajouterElementSvg(carte, 'rect', {
      x: -78,
      y: 23,
      width: 156 * fixture.ratioSante,
      height: 8,
      rx: 4,
      fill: détruit ? '#7d3a3a' : fixture.ratioSante < 0.65 ? '#ff9a63' : '#72dfa5',
      'data-role': 'barre-sante',
    });
  }

  const indicateur = ajouterElementSvg(carte, 'g', {
    transform: 'translate(84 52)',
    'data-role': 'marqueur-etat',
  });
  if (détruit) {
    ajouterElementSvg(indicateur, 'path', { d: 'M-6-6L6 6M6-6L-6 6', stroke: '#cfc7cb', 'stroke-width': 3 });
  } else {
    ajouterElementSvg(indicateur, 'circle', { cx: 0, cy: 0, r: 7, fill: couleurBordure });
    ajouterElementSvg(indicateur, 'circle', { cx: 0, cy: 0, r: 3, fill: couleurCarte });
  }

  // Silhouette du sloop : coque, voile, mât, pavillon, sillage.
  const silhouette = ajouterElementSvg(carte, 'g', {
    transform: 'translate(0 ' + (détruit ? 76 : 44) + ')',
    'data-role': 'silhouette',
  });
  ajouterElementSvg(silhouette, 'path', {
    d: 'M-84 42L-30 18H30L84 42L50 58H-50Z',
    fill: détruit ? '#4a3038' : '#171313',
    stroke: couleurBordure,
    'stroke-opacity': 0.55,
    'stroke-width': 2,
  });
  if (détruit) {
    ajouterElementSvg(silhouette, 'path', {
      d: 'M-62 18L-18 78M70 14L40 82',
      stroke: '#6b5158',
      'stroke-width': 6,
    });
    ajouterElementSvg(silhouette, 'rect', {
      x: -70,
      y: 66,
      width: 140,
      height: 6,
      rx: 3,
      fill: '#5f3f45',
    });
  } else {
    ajouterElementSvg(silhouette, 'rect', {
      x: -36,
      y: -26,
      width: 8,
      height: 66,
      fill: '#3a2417',
      'data-role': 'mat',
    });
    ajouterElementSvg(silhouette, 'path', {
      d: 'M-26-26Q20-38 40 24L6 18Z',
      fill: '#0a0a0f',
      'data-role': 'voile',
    });
    ajouterElementSvg(silhouette, 'path', {
      d: 'M-36-26L-52-34H30L-12-26Z',
      fill: '#6e1018',
      'data-role': 'pavillon',
    });
    ajouterElementSvg(silhouette, 'path', {
      d: 'M-70 40Q-110 30 -150 44L-70 50Z',
      fill: '#b4d3d8',
      'fill-opacity': 0.4,
      'data-role': 'sillage',
    });
  }
}

function créerPlancheBateauxPiratesE2E(): SVGSVGElement {
  const svg = document.createElementNS(ESPACE_NOMS_SVG, 'svg');
  svg.classList.add('bateaux-pirates-e2e__planche');
  svg.setAttribute('data-testid', 'bateaux-pirates-planche');
  svg.setAttribute('data-role', 'planche-etats-bateaux-pirates');
  svg.setAttribute('viewBox', '0 0 1180 235');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  ajouterElementSvg(svg, 'rect', {
    x: 0,
    y: 0,
    width: 1180,
    height: 235,
    rx: 20,
    fill: '#061922',
    'fill-opacity': 0.78,
    stroke: '#7b9a9f',
    'stroke-opacity': 0.38,
    'stroke-width': 2,
  });
  const centres = [118, 354, 590, 826, 1062];
  FIXTURES_BATEAUX_PIRATES.forEach((fixture, index) => {
    const centre = centres[index];
    if (centre !== undefined) {
      ajouterSilhouetteBateauPirateSvg(svg, centre, fixture);
    }
  });
  return svg;
}

function installerEtiquettesBateauxPiratesE2E(
  afficher: boolean,
  afficherPlanche: boolean,
): { readonly retirer: () => void } {
  if (!afficher || typeof document === 'undefined') {
    return { retirer: () => undefined };
  }

  document.querySelector('.bateaux-pirates-e2e')?.remove();
  document.querySelector('.bateaux-pirates-e2e-legende')?.remove();
  const conteneur = document.createElement('div');
  conteneur.className = 'bateaux-pirates-e2e';
  conteneur.dataset.testid = 'bateaux-pirates-e2e';
  conteneur.setAttribute('aria-label', 'États de présentation des bateaux pirates');
  if (afficherPlanche) {
    conteneur.append(créerPlancheBateauxPiratesE2E());
  }

  const légende = document.createElement('div');
  légende.className = 'bateaux-pirates-e2e-legende';
  légende.setAttribute('aria-label', 'Légende des états de bateaux pirates');

  for (const [index, fixture] of FIXTURES_BATEAUX_PIRATES.entries()) {
    const étiquette = document.createElement('span');
    étiquette.className = 'bateau-pirate-fixture';
    étiquette.dataset.testid = 'bateau-pirate-fixture';
    étiquette.dataset.etat = fixture.etat;
    étiquette.dataset.index = String(index);
    étiquette.textContent = fixture.label;
    légende.append(étiquette);
  }

  document.querySelector('#app')?.append(conteneur, légende);
  return {
    retirer: () => {
      conteneur.remove();
      légende.remove();
    },
  };
}

export function construireGalerieBateauxPiratesE2E(
  scene: Scene,
  options: OptionsGalerieBateauxPiratesE2E = {},
): GalerieBateauxPiratesE2E {
  const sol = créerSolGalerie(scene);

  const acteurs = FIXTURES_BATEAUX_PIRATES.map((fixture, index) =>
    construireBateauPirate(scene, {
      id: 'fixture-bateau-pirate-' + (index + 1),
      transformation: {
        position: { x: (index - 1.5) * 4.4, y: 0, z: 0 },
        rotationY: 0,
      },
      vitesse: fixture.vitesse,
      ratioSante: fixture.ratioSante,
      etat: fixture.etat,
    }),
  );
  const étiquettes = installerEtiquettesBateauxPiratesE2E(
    options.afficherEtiquettes === true,
    options.afficherPlanche === true,
  );

  let temps = Math.max(0, options.phaseInitiale ?? 0);
  let libéré = false;

  return {
    acteurs,
    objets: [sol, ...acteurs.flatMap((acteur) => acteur.objets)],
    mettreAJour: (deltaSecondes) => {
      if (libéré) {
        return;
      }

      const delta = bornerNombre(
        deltaSecondes,
        0,
        DELTA_MAXIMUM_INTERPOLATION_BATEAU_PIRATE,
        0,
      );
      if (options.figerPose !== true) {
        temps += delta;
      }
      if (options.animerInterpolation) {
        const acteur = acteurs[1];
        if (acteur) {
          const etat = acteur.obtenirEtat();
          acteur.recevoirEtat({
            id: etat.id,
            transformation: {
              ...etat.transformation,
              position: {
                ...etat.transformation.position,
                x: Math.sin(temps * 0.8) * 1.2,
              },
            },
            vitesse: etat.vitesse,
            ratioSante: etat.ratioSante,
            etat: etat.etat,
          });
        }
      }

      // Quand la pose est figée (capture E2E déterministe), on force
      // l'interpolation à converger immédiatement vers la cible : alpha = 1
      // dès la première frame. La pose affichée ne dépend donc ni du nombre de
      // frames rendues ni de l'horloge réelle, ce qui rend la capture
      // identique quelle que soit la machine.
      const deltaEffectif =
        options.figerPose === true ? DUREE_INTERPOLATION_BATEAU_PIRATE : delta;
      for (const acteur of acteurs) {
        acteur.mettreAJour(deltaEffectif);
      }
    },
    liberer: () => {
      if (libéré) {
        return;
      }

      libéré = true;
      étiquettes.retirer();
      for (const acteur of acteurs) {
        acteur.liberer();
      }
      sol.dispose(false, true);
    },
  };
}

export const creerGalerieBateauxPiratesE2E = construireGalerieBateauxPiratesE2E;
