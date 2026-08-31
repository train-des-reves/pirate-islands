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

export const ETATS_PIRATE = ['inactif', 'patrouille', 'poursuite', 'attaque', 'mort'] as const;

export type EtatPirate = (typeof ETATS_PIRATE)[number];

export interface VecteurPirate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TransformationPirate {
  readonly position: VecteurPirate;
  readonly rotationY: number;
}

export interface DonneesPirateTerrestre {
  readonly id: string;
  readonly transformation: TransformationPirate;
  readonly ratioSante: number;
  readonly etat: EtatPirate;
}

export type PartiePirate =
  | 'corps'
  | 'tete'
  | 'chapeauBord'
  | 'chapeau'
  | 'cacheOeil'
  | 'barbe'
  | 'ceinture'
  | 'brasGauche'
  | 'brasDroit'
  | 'jambeGauche'
  | 'jambeDroite'
  | 'arme'
  | 'gardeArme';

export const PARTIES_PIRATE: readonly PartiePirate[] = [
  'corps',
  'tete',
  'chapeauBord',
  'chapeau',
  'cacheOeil',
  'barbe',
  'ceinture',
  'brasGauche',
  'brasDroit',
  'jambeGauche',
  'jambeDroite',
  'arme',
  'gardeArme',
];

type NomGabaritPirate =
  | 'corps'
  | 'tete'
  | 'chapeauBord'
  | 'chapeau'
  | 'cacheOeil'
  | 'barbe'
  | 'ceinture'
  | 'bras'
  | 'jambe'
  | 'arme'
  | 'gardeArme'
  | 'barreSanteFond'
  | 'barreSante'
  | 'auraBlessure';

export interface PartiePosePirate {
  readonly position: VecteurPirate;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly echelle: VecteurPirate;
}

export interface PosePirate {
  readonly active: boolean;
  readonly parties: Readonly<Record<PartiePirate, PartiePosePirate>>;
  readonly armeVisible: boolean;
}

export interface EtatVisuelPirate extends DonneesPirateTerrestre {
  readonly retourDegatsActif: boolean;
  readonly pose: PosePirate;
}

export const DUREE_INTERPOLATION_PIRATE = 0.18;
export const DELTA_MAXIMUM_INTERPOLATION_PIRATE = 0.25;
export const DUREE_RETOUR_DEGATS_PIRATE = 0.2;

function bornerNombre(valeur: number, minimum: number, maximum: number, défaut: number): number {
  if (!Number.isFinite(valeur)) {
    return défaut;
  }

  return Math.max(minimum, Math.min(maximum, valeur));
}

export function bornerRatioSante(ratioSante: number): number {
  return bornerNombre(ratioSante, 0, 1, 1);
}

export function bornerAlphaInterpolation(alpha: number): number {
  return bornerNombre(alpha, 0, 1, 0);
}

export function interpolerNombreBorne(actuel: number, cible: number, alpha: number): number {
  const alphaSain = bornerAlphaInterpolation(alpha);
  const actuelSain = Number.isFinite(actuel) ? actuel : 0;
  const cibleSaine = Number.isFinite(cible) ? cible : actuelSain;
  return actuelSain + (cibleSaine - actuelSain) * alphaSain;
}

function angleLePlusCourt(angle: number): number {
  const deuxPi = Math.PI * 2;
  return ((((angle + Math.PI) % deuxPi) + deuxPi) % deuxPi) - Math.PI;
}

export function interpolerAngleBorne(actuel: number, cible: number, alpha: number): number {
  const actuelSain = Number.isFinite(actuel) ? actuel : 0;
  const cibleSaine = Number.isFinite(cible) ? cible : actuelSain;
  const alphaSain = bornerAlphaInterpolation(alpha);
  if (alphaSain >= 1) {
    return cibleSaine;
  }

  return actuelSain + angleLePlusCourt(cibleSaine - actuelSain) * alphaSain;
}

export function interpolerTransformationPirate(
  actuelle: TransformationPirate,
  cible: TransformationPirate,
  alpha: number,
): TransformationPirate {
  return {
    position: {
      x: interpolerNombreBorne(actuelle.position.x, cible.position.x, alpha),
      y: interpolerNombreBorne(actuelle.position.y, cible.position.y, alpha),
      z: interpolerNombreBorne(actuelle.position.z, cible.position.z, alpha),
    },
    rotationY: interpolerAngleBorne(actuelle.rotationY, cible.rotationY, alpha),
  };
}

function vecteur(x: number, y: number, z: number): VecteurPirate {
  return { x, y, z };
}

function partie(
  position: VecteurPirate,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  echelle = vecteur(1, 1, 1),
): PartiePosePirate {
  return { position, rotationX, rotationY, rotationZ, echelle };
}

function creerPoseActive(etat: Exclude<EtatPirate, 'mort'>): PosePirate {
  const parties: Record<PartiePirate, PartiePosePirate> = {
    corps: partie(vecteur(0, 1.22, 0)),
    tete: partie(vecteur(0, 2.03, 0.02)),
    chapeauBord: partie(vecteur(0, 2.35, 0.02)),
    chapeau: partie(vecteur(0, 2.49, 0.02)),
    cacheOeil: partie(vecteur(0.16, 2.04, 0.29), 0, 0, 0, vecteur(1.05, 1, 1)),
    barbe: partie(vecteur(0, 1.89, 0.24)),
    ceinture: partie(vecteur(0, 1.02, 0.22)),
    brasGauche: partie(vecteur(-0.48, 1.33, 0)),
    brasDroit: partie(vecteur(0.48, 1.33, 0)),
    jambeGauche: partie(vecteur(-0.2, 0.43, 0)),
    jambeDroite: partie(vecteur(0.2, 0.43, 0)),
    arme: partie(vecteur(0.7, 1.2, 0.08), 0, 0, -0.25),
    gardeArme: partie(vecteur(0.7, 1.42, 0.08), 0, 0, -0.25),
  };

  if (etat === 'patrouille') {
    parties.corps = partie(vecteur(0, 1.22, 0), 0, 0, 0.02);
    parties.tete = partie(vecteur(0, 2.03, 0.02), 0, 0, 0.02);
    parties.chapeauBord = partie(vecteur(0, 2.35, 0.02), 0, 0, 0.02);
    parties.chapeau = partie(vecteur(0, 2.49, 0.02), 0, 0, 0.02);
    parties.cacheOeil = partie(vecteur(0.16, 2.04, 0.29), 0, 0, 0.02, vecteur(1.05, 1, 1));
    parties.barbe = partie(vecteur(0, 1.89, 0.24), 0, 0, 0.02);
    parties.ceinture = partie(vecteur(0, 1.02, 0.22), 0, 0, 0.02);
    parties.brasGauche = partie(vecteur(-0.48, 1.35, 0), 0.16, 0, -0.13);
    parties.brasDroit = partie(vecteur(0.48, 1.31, 0), -0.18, 0, 0.13);
    parties.jambeGauche = partie(vecteur(-0.2, 0.43, 0.08), -0.35);
    parties.jambeDroite = partie(vecteur(0.2, 0.43, -0.08), 0.35);
    parties.arme = partie(vecteur(0.71, 1.18, 0.05), 0.1, 0, -0.3);
    parties.gardeArme = partie(vecteur(0.71, 1.4, 0.05), 0.1, 0, -0.3);
  } else if (etat === 'poursuite') {
    parties.corps = partie(vecteur(0, 1.2, 0.07), -0.18);
    parties.tete = partie(vecteur(0, 2, 0.17), -0.12);
    parties.chapeauBord = partie(vecteur(0, 2.31, 0.17), -0.12);
    parties.chapeau = partie(vecteur(0, 2.45, 0.17), -0.12);
    parties.cacheOeil = partie(vecteur(0.16, 2.01, 0.43), -0.12, 0, 0, vecteur(1.05, 1, 1));
    parties.barbe = partie(vecteur(0, 1.87, 0.38), -0.12);
    parties.ceinture = partie(vecteur(0, 1.01, 0.2), -0.08);
    parties.brasGauche = partie(vecteur(-0.46, 1.38, 0.12), -0.55, 0, -0.22);
    parties.brasDroit = partie(vecteur(0.49, 1.38, 0.2), -0.75, 0, 0.22);
    parties.jambeGauche = partie(vecteur(-0.2, 0.43, 0.13), -0.48);
    parties.jambeDroite = partie(vecteur(0.2, 0.43, -0.12), 0.48);
    parties.arme = partie(vecteur(0.74, 1.24, 0.29), -0.35, 0, -0.32);
    parties.gardeArme = partie(vecteur(0.74, 1.46, 0.29), -0.35, 0, -0.32);
  } else if (etat === 'attaque') {
    parties.corps = partie(vecteur(0, 1.22, 0), -0.04);
    parties.tete = partie(vecteur(0, 2.03, 0.02), 0.02);
    parties.chapeauBord = partie(vecteur(0, 2.35, 0.02), 0.02);
    parties.chapeau = partie(vecteur(0, 2.49, 0.02), 0.02);
    parties.cacheOeil = partie(vecteur(0.16, 2.04, 0.29), 0.02, 0, 0, vecteur(1.05, 1, 1));
    parties.barbe = partie(vecteur(0, 1.89, 0.24), 0.02);
    parties.brasGauche = partie(vecteur(-0.47, 1.42, 0.02), -0.72, 0, -0.2);
    parties.brasDroit = partie(vecteur(0.5, 1.45, 0.15), -1.15, 0, 0.18);
    parties.jambeGauche = partie(vecteur(-0.2, 0.43, 0.05), -0.18);
    parties.jambeDroite = partie(vecteur(0.2, 0.43, -0.05), 0.18);
    parties.arme = partie(vecteur(0.8, 1.58, 0.66), -0.95, 0, -0.2);
    parties.gardeArme = partie(vecteur(0.8, 1.8, 0.66), -0.95, 0, -0.2);
  }

  return { active: true, parties, armeVisible: true };
}

function creerPoseMort(): PosePirate {
  return {
    active: false,
    parties: {
      corps: partie(vecteur(0, 0.43, 0), 0, 0, Math.PI / 2),
      tete: partie(vecteur(0.68, 0.48, 0.02), 0, 0, Math.PI / 2),
      chapeauBord: partie(vecteur(0.68, 0.78, 0.02), 0, 0, Math.PI / 2),
      chapeau: partie(vecteur(0.68, 0.91, 0.02), 0, 0, Math.PI / 2),
      cacheOeil: partie(vecteur(0.84, 0.49, 0.27), 0, 0, Math.PI / 2, vecteur(1.05, 1, 1)),
      barbe: partie(vecteur(0.68, 0.35, 0.24), 0, 0, Math.PI / 2),
      ceinture: partie(vecteur(0, 0.43, 0.22), 0, 0, Math.PI / 2),
      brasGauche: partie(vecteur(-0.08, 0.33, 0.28), 0.3, 0, -0.55),
      brasDroit: partie(vecteur(0.18, 0.29, -0.24), -0.25, 0, 0.65),
      jambeGauche: partie(vecteur(-0.28, 0.22, 0.05), 0, 0, -0.25),
      jambeDroite: partie(vecteur(0.32, 0.22, -0.05), 0, 0, 0.25),
      arme: partie(vecteur(0.42, 0.12, 0.15), 0, 0, Math.PI / 2),
      gardeArme: partie(vecteur(0.42, 0.34, 0.15), 0, 0, Math.PI / 2),
    },
    armeVisible: false,
  };
}

export function calculerPosePirate(etat: EtatPirate): PosePirate {
  return etat === 'mort' ? creerPoseMort() : creerPoseActive(etat);
}

function estEtatPirate(valeur: unknown): valeur is EtatPirate {
  return typeof valeur === 'string' && (ETATS_PIRATE as readonly string[]).includes(valeur);
}

function normaliserDonnees(
  données: DonneesPirateTerrestre,
  précédent: DonneesPirateTerrestre | undefined,
): DonneesPirateTerrestre {
  const transformationPrécédente = précédent?.transformation ?? {
    position: vecteur(0, 0, 0),
    rotationY: 0,
  };
  const id = données.id.trim() || précédent?.id || 'pirate-sans-id';
  const etat = estEtatPirate(données.etat) ? données.etat : (précédent?.etat ?? 'inactif');

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
    ratioSante: bornerRatioSante(données.ratioSante),
    etat,
  };
}

export class ModeleVuePirateTerrestre {
  private readonly id: string;
  private cible: DonneesPirateTerrestre;
  private affichage: DonneesPirateTerrestre;
  private tempsRetourDegats = 0;
  private mortVerrouille = false;

  public constructor(initial: DonneesPirateTerrestre) {
    const données = normaliserDonnees(initial, undefined);
    this.id = données.id;
    this.cible = données;
    this.affichage = données;
    this.mortVerrouille = données.etat === 'mort';
  }

  public recevoirEtat(nouvelEtat: DonneesPirateTerrestre): void {
    if (this.mortVerrouille && nouvelEtat.etat !== 'mort') {
      return;
    }

    const données = { ...normaliserDonnees(nouvelEtat, this.cible), id: this.id };
    if (données.ratioSante < this.cible.ratioSante - 0.001) {
      this.tempsRetourDegats = DUREE_RETOUR_DEGATS_PIRATE;
    }

    this.cible = données;
    this.affichage = { ...this.affichage, etat: données.etat };
    if (données.etat === 'mort') {
      this.mortVerrouille = true;
    }
  }

  public mettreAJour(deltaSecondes: number): void {
    const delta = bornerNombre(deltaSecondes, 0, DELTA_MAXIMUM_INTERPOLATION_PIRATE, 0);
    const alpha = bornerAlphaInterpolation(delta / DUREE_INTERPOLATION_PIRATE);
    this.affichage = {
      ...this.affichage,
      transformation: interpolerTransformationPirate(
        this.affichage.transformation,
        this.cible.transformation,
        alpha,
      ),
      ratioSante: interpolerNombreBorne(this.affichage.ratioSante, this.cible.ratioSante, alpha),
    };
    this.tempsRetourDegats = Math.max(0, this.tempsRetourDegats - delta);
  }

  public obtenirEtat(): EtatVisuelPirate {
    return {
      ...this.affichage,
      ratioSante: bornerRatioSante(this.affichage.ratioSante),
      retourDegatsActif: this.tempsRetourDegats > 0,
      pose: calculerPosePirate(this.affichage.etat),
    };
  }
}

interface RessourcesPirateTerrestre {
  readonly gabarits: Readonly<Record<NomGabaritPirate, Mesh>>;
  readonly materiaux: readonly StandardMaterial[];
  references: number;
}

const ressourcesParScene = new WeakMap<Scene, RessourcesPirateTerrestre>();

function créerMatériau(
  scene: Scene,
  nom: string,
  couleur: Color3,
  speculaire = new Color3(0.08, 0.08, 0.08),
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
  mesh.metadata = { type: 'gabarit-pirate-terrestre', partie: nom };
  return mesh;
}

function créerRessourcesPirateTerrestre(scene: Scene): RessourcesPirateTerrestre {
  const peau = créerMatériau(scene, 'matériau-pirate-peau', new Color3(0.62, 0.29, 0.16));
  const chemise = créerMatériau(scene, 'matériau-pirate-chemise', new Color3(0.82, 0.72, 0.5));
  const gilet = créerMatériau(scene, 'matériau-pirate-gilet', new Color3(0.24, 0.065, 0.055));
  const barbe = créerMatériau(scene, 'matériau-pirate-barbe', new Color3(0.075, 0.035, 0.022));
  const pantalon = créerMatériau(scene, 'matériau-pirate-pantalon', new Color3(0.035, 0.12, 0.14));
  const chapeau = créerMatériau(scene, 'matériau-pirate-chapeau', new Color3(0.055, 0.045, 0.035));
  const cuir = créerMatériau(scene, 'matériau-pirate-cuir', new Color3(0.18, 0.08, 0.035));
  const métal = créerMatériau(
    scene,
    'matériau-pirate-métal',
    new Color3(0.72, 0.48, 0.12),
    new Color3(0.4, 0.28, 0.08),
  );
  const noir = créerMatériau(scene, 'matériau-pirate-cache-oeil', new Color3(0.008, 0.008, 0.012));
  const vert = créerMatériau(scene, 'matériau-pirate-sante', new Color3(0.26, 0.8, 0.35));
  const fondSante = créerMatériau(
    scene,
    'matériau-pirate-fond-sante',
    new Color3(0.12, 0.035, 0.035),
  );
  const blessure = créerMatériau(
    scene,
    'matériau-pirate-blessure',
    new Color3(0.85, 0.06, 0.035),
    new Color3(0.4, 0.02, 0.01),
    new Color3(0.18, 0.008, 0.004),
  );

  const gabarits: Record<NomGabaritPirate, Mesh> = {
    corps: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-corps',
        { width: 0.72, height: 1.15, depth: 0.42 },
        scene,
      ),
      gilet,
      'corps',
    ),
    tete: configurerGabarit(
      MeshBuilder.CreateSphere('gabarit-pirate-tete', { diameter: 0.54, segments: 10 }, scene),
      peau,
      'tete',
    ),
    chapeauBord: configurerGabarit(
      MeshBuilder.CreateCylinder(
        'gabarit-pirate-chapeau-bord',
        { diameter: 0.82, height: 0.1, tessellation: 12 },
        scene,
      ),
      chapeau,
      'chapeau-bord',
    ),
    chapeau: configurerGabarit(
      MeshBuilder.CreateCylinder(
        'gabarit-pirate-chapeau',
        { diameter: 0.52, height: 0.27, tessellation: 12 },
        scene,
      ),
      chapeau,
      'chapeau',
    ),
    cacheOeil: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-cache-oeil',
        { width: 0.13, height: 0.08, depth: 0.035 },
        scene,
      ),
      noir,
      'cache-oeil',
    ),
    barbe: configurerGabarit(
      MeshBuilder.CreateCylinder(
        'gabarit-pirate-barbe',
        { diameterTop: 0.12, diameterBottom: 0.29, height: 0.28, tessellation: 8 },
        scene,
      ),
      barbe,
      'barbe',
    ),
    ceinture: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-ceinture',
        { width: 0.82, height: 0.12, depth: 0.48 },
        scene,
      ),
      cuir,
      'ceinture',
    ),
    bras: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-bras',
        { width: 0.16, height: 0.72, depth: 0.18 },
        scene,
      ),
      chemise,
      'bras',
    ),
    jambe: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-jambe',
        { width: 0.2, height: 0.75, depth: 0.22 },
        scene,
      ),
      pantalon,
      'jambe',
    ),
    arme: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-arme',
        { width: 0.09, height: 0.78, depth: 0.06 },
        scene,
      ),
      métal,
      'arme',
    ),
    gardeArme: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-garde-arme',
        { width: 0.26, height: 0.07, depth: 0.09 },
        scene,
      ),
      cuir,
      'garde-arme',
    ),
    barreSanteFond: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-barre-sante-fond',
        { width: 0.86, height: 0.08, depth: 0.035 },
        scene,
      ),
      fondSante,
      'barre-sante-fond',
    ),
    barreSante: configurerGabarit(
      MeshBuilder.CreateBox(
        'gabarit-pirate-barre-sante',
        { width: 0.8, height: 0.05, depth: 0.045 },
        scene,
      ),
      vert,
      'barre-sante',
    ),
    auraBlessure: configurerGabarit(
      MeshBuilder.CreateTorus(
        'gabarit-pirate-aura-blessure',
        { diameter: 1.18, thickness: 0.045, tessellation: 16 },
        scene,
      ),
      blessure,
      'aura-blessure',
    ),
  };

  return {
    gabarits,
    materiaux: [
      peau,
      chemise,
      gilet,
      barbe,
      pantalon,
      chapeau,
      cuir,
      métal,
      noir,
      vert,
      fondSante,
      blessure,
    ],
    references: 1,
  };
}

function obtenirRessourcesPirateTerrestre(scene: Scene): RessourcesPirateTerrestre {
  const existantes = ressourcesParScene.get(scene);
  if (existantes) {
    existantes.references += 1;
    return existantes;
  }

  const ressources = créerRessourcesPirateTerrestre(scene);
  ressourcesParScene.set(scene, ressources);
  return ressources;
}

function libérerRessourcesPirateTerrestre(
  scene: Scene,
  ressources: RessourcesPirateTerrestre,
): void {
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

export interface PirateTerrestre {
  readonly id: string;
  readonly racine: TransformNode;
  readonly parties: Readonly<Record<PartiePirate, InstancedMesh>>;
  readonly objets: readonly AbstractMesh[];
  recevoirEtat: (etat: DonneesPirateTerrestre) => void;
  mettreAJour: (deltaSecondes: number) => void;
  obtenirEtat: () => EtatVisuelPirate;
  liberer: () => void;
}

function créerInstance(
  ressources: RessourcesPirateTerrestre,
  nom: NomGabaritPirate,
  id: string,
  racine: TransformNode,
): InstancedMesh {
  const instance = ressources.gabarits[nom].createInstance('pirate-' + id + '-' + nom);
  instance.parent = racine;
  instance.isVisible = true;
  instance.isPickable = false;
  instance.metadata = { type: 'pirate-terrestre', pirateId: id, partie: nom };
  return instance;
}

function appliquerPartie(instance: InstancedMesh, pose: PartiePosePirate): void {
  instance.position.set(pose.position.x, pose.position.y, pose.position.z);
  instance.rotation.set(pose.rotationX, pose.rotationY, pose.rotationZ);
  instance.scaling.set(pose.echelle.x, pose.echelle.y, pose.echelle.z);
}

function appliquerPose(
  instances: Record<PartiePirate, InstancedMesh> & {
    readonly barreSanteFond: InstancedMesh;
    readonly barreSante: InstancedMesh;
    readonly auraBlessure: InstancedMesh;
  },
  etat: EtatVisuelPirate,
): void {
  for (const nom of PARTIES_PIRATE) {
    appliquerPartie(instances[nom], etat.pose.parties[nom]);
  }

  const ratio = bornerRatioSante(etat.ratioSante);
  instances.arme.isVisible = etat.pose.armeVisible;
  instances.gardeArme.isVisible = etat.pose.armeVisible;
  instances.barreSanteFond.position.set(0, 2.82, 0);
  instances.barreSante.position.set(-0.4 * (1 - ratio), 2.82, -0.03);
  instances.barreSante.scaling.set(ratio, 1, 1);
  instances.barreSanteFond.isVisible = etat.pose.active;
  instances.barreSante.isVisible = etat.pose.active && ratio > 0;
  instances.auraBlessure.position.set(0, 0.08, 0);
  instances.auraBlessure.scaling.set(1, 0.65, 1);
  instances.auraBlessure.isVisible = etat.pose.active && (ratio < 0.75 || etat.retourDegatsActif);
}

type InstancesPirate = Record<PartiePirate, InstancedMesh> & {
  readonly barreSanteFond: InstancedMesh;
  readonly barreSante: InstancedMesh;
  readonly auraBlessure: InstancedMesh;
};

export function construirePirateTerrestre(
  scene: Scene,
  etatInitial: DonneesPirateTerrestre,
): PirateTerrestre {
  const modèle = new ModeleVuePirateTerrestre(etatInitial);
  const etatNormalise = modèle.obtenirEtat();
  const racine = new TransformNode('pirate-' + etatNormalise.id, scene);
  racine.metadata = { type: 'pirate-terrestre', pirateId: etatNormalise.id };
  const ressources = obtenirRessourcesPirateTerrestre(scene);
  const instances = {
    corps: créerInstance(ressources, 'corps', etatNormalise.id, racine),
    tete: créerInstance(ressources, 'tete', etatNormalise.id, racine),
    chapeauBord: créerInstance(ressources, 'chapeauBord', etatNormalise.id, racine),
    chapeau: créerInstance(ressources, 'chapeau', etatNormalise.id, racine),
    cacheOeil: créerInstance(ressources, 'cacheOeil', etatNormalise.id, racine),
    barbe: créerInstance(ressources, 'barbe', etatNormalise.id, racine),
    ceinture: créerInstance(ressources, 'ceinture', etatNormalise.id, racine),
    brasGauche: créerInstance(ressources, 'bras', etatNormalise.id + '-gauche', racine),
    brasDroit: créerInstance(ressources, 'bras', etatNormalise.id + '-droit', racine),
    jambeGauche: créerInstance(ressources, 'jambe', etatNormalise.id + '-gauche', racine),
    jambeDroite: créerInstance(ressources, 'jambe', etatNormalise.id + '-droit', racine),
    arme: créerInstance(ressources, 'arme', etatNormalise.id, racine),
    gardeArme: créerInstance(ressources, 'gardeArme', etatNormalise.id, racine),
    barreSanteFond: créerInstance(ressources, 'barreSanteFond', etatNormalise.id, racine),
    barreSante: créerInstance(ressources, 'barreSante', etatNormalise.id, racine),
    auraBlessure: créerInstance(ressources, 'auraBlessure', etatNormalise.id, racine),
  } as InstancesPirate;
  const objets = Object.values(instances);
  let libéré = false;

  const appliquer = (): void => {
    const etat = modèle.obtenirEtat();
    racine.position.set(
      etat.transformation.position.x,
      etat.transformation.position.y,
      etat.transformation.position.z,
    );
    racine.rotation.y = etat.transformation.rotationY;
    racine.metadata = { type: 'pirate-terrestre', pirateId: etat.id, etat: etat.etat };
    appliquerPose(instances, etat);
  };

  appliquer();

  return {
    id: etatNormalise.id,
    racine,
    parties: instances,
    objets,
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
    liberer: () => {
      if (libéré) {
        return;
      }

      libéré = true;
      racine.dispose(false, false);
      libérerRessourcesPirateTerrestre(scene, ressources);
    },
  };
}

export const creerPirateTerrestre = construirePirateTerrestre;
export const créerVuePirateTerrestre = construirePirateTerrestre;
export const creerVuePirateTerrestre = construirePirateTerrestre;

export const FIXTURES_PIRATES = [
  { etat: 'inactif', ratioSante: 1, label: 'Inactif' },
  { etat: 'patrouille', ratioSante: 1, label: 'Patrouille' },
  { etat: 'poursuite', ratioSante: 0.78, label: 'Poursuite' },
  { etat: 'attaque', ratioSante: 0.42, label: 'Attaque · blessé' },
  { etat: 'mort', ratioSante: 0, label: 'Mort' },
] as const satisfies ReadonlyArray<{
  readonly etat: EtatPirate;
  readonly ratioSante: number;
  readonly label: string;
}>;

export interface OptionsGaleriePiratesE2E {
  readonly animerInterpolation?: boolean;
  readonly afficherEtiquettes?: boolean;
}

export interface GaleriePiratesE2E {
  readonly acteurs: readonly PirateTerrestre[];
  readonly objets: readonly AbstractMesh[];
  mettreAJour: (deltaSecondes: number) => void;
  liberer: () => void;
}

function installerEtiquettesPiratesE2E(afficher: boolean): { readonly retirer: () => void } {
  if (!afficher || typeof document === 'undefined') {
    return { retirer: () => undefined };
  }

  document.querySelector('.pirates-e2e')?.remove();
  const conteneur = document.createElement('div');
  conteneur.className = 'pirates-e2e';
  conteneur.dataset.testid = 'pirates-e2e';
  conteneur.setAttribute('aria-label', 'États de présentation des pirates');

  for (const [index, fixture] of FIXTURES_PIRATES.entries()) {
    const étiquette = document.createElement('span');
    étiquette.className = 'pirate-fixture';
    étiquette.dataset.testid = 'pirate-fixture';
    étiquette.dataset.etat = fixture.etat;
    étiquette.dataset.index = String(index);
    étiquette.textContent = fixture.label;
    conteneur.append(étiquette);
  }

  document.querySelector('#app')?.append(conteneur);
  return { retirer: () => conteneur.remove() };
}

export function construireGaleriePiratesE2E(
  scene: Scene,
  options: OptionsGaleriePiratesE2E = {},
): GaleriePiratesE2E {
  const sol = MeshBuilder.CreateGround(
    'sol-galerie-pirates',
    { width: 20, height: 9, subdivisions: 2 },
    scene,
  );
  sol.position.y = -0.03;
  sol.material = créerMatériau(
    scene,
    'matériau-sol-galerie-pirates',
    new Color3(0.07, 0.16, 0.18),
    new Color3(0.18, 0.24, 0.24),
  );
  sol.isPickable = false;
  sol.metadata = { type: 'galerie-pirates-e2e' };

  const acteurs = FIXTURES_PIRATES.map((fixture, index) =>
    construirePirateTerrestre(scene, {
      id: 'fixture-pirate-' + (index + 1),
      transformation: {
        position: { x: (index - 2) * 3, y: 0, z: 0 },
        rotationY: Math.PI,
      },
      ratioSante: fixture.ratioSante,
      etat: fixture.etat,
    }),
  );
  const étiquettes = installerEtiquettesPiratesE2E(options.afficherEtiquettes === true);
  const positionCentrale = acteurs[2]?.obtenirEtat().transformation.position.x ?? 0;
  let temps = 0;
  let libéré = false;

  return {
    acteurs,
    objets: [sol, ...acteurs.flatMap((acteur) => acteur.objets)],
    mettreAJour: (deltaSecondes) => {
      if (libéré) {
        return;
      }

      const delta = bornerNombre(deltaSecondes, 0, DELTA_MAXIMUM_INTERPOLATION_PIRATE, 0);
      temps += delta;
      if (options.animerInterpolation) {
        const acteur = acteurs[2];
        if (acteur) {
          const etat = acteur.obtenirEtat();
          acteur.recevoirEtat({
            id: etat.id,
            transformation: {
              ...etat.transformation,
              position: {
                ...etat.transformation.position,
                x: positionCentrale + Math.sin(temps * Math.PI * 1.6) * 0.75,
              },
            },
            ratioSante: etat.ratioSante,
            etat: etat.etat,
          });
        }
      }

      for (const acteur of acteurs) {
        acteur.mettreAJour(delta);
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

export const creerGaleriePiratesE2E = construireGaleriePiratesE2E;
