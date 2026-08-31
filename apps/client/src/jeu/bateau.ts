import {
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexData,
  type AbstractMesh,
  type Material,
  type Scene,
} from 'babylonjs';

export const DIMENSIONS_BATEAU_MVP = {
  longueur: 12,
  largeur: 5,
  hauteurCoque: 1.4,
  hauteurPont: 1.5,
  hauteurCale: 0.18,
  hauteurToit: 4.15,
} as const;

export type NiveauBateau = 'coque' | 'pont' | 'cabine' | 'cale' | 'escalier' | 'toit';
export type TypeAncrageBateau = 'apparition' | 'barre' | 'embarquement' | 'cale';

export interface PointBateau {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LimitesBateau {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface VolumeBateau extends LimitesBateau {
  readonly id: string;
  readonly niveau: NiveauBateau;
}

export interface AncrageBateau {
  readonly id: string;
  readonly type: TypeAncrageBateau;
  readonly position: PointBateau;
}

export interface DescripteurBateau {
  readonly id: string;
  readonly position: PointBateau;
  readonly rotationY: number;
  readonly dimensions: typeof DIMENSIONS_BATEAU_MVP;
  readonly limitesLocal: LimitesBateau;
  readonly limitesMonde: LimitesBateau;
  readonly ancrages: readonly AncrageBateau[];
  readonly surfaces: readonly VolumeBateau[];
  readonly collisions: readonly VolumeBateau[];
}

export interface OptionsBateauBabylon {
  readonly id?: string;
  readonly position?: Vector3;
  readonly rotationY?: number;
}

export interface BateauBabylon {
  readonly descripteur: DescripteurBateau;
  readonly racine: TransformNode;
  readonly objets: readonly AbstractMesh[];
  readonly surfaces: readonly Mesh[];
  readonly collisions: readonly Mesh[];
  readonly hublots: readonly Mesh[];
  readonly observateurs: readonly unknown[];
  readonly liberer: () => void;
}

export type ModePresentationBateau = 'bateau-exterieur' | 'bateau-cabine' | 'bateau-cale';

const SURFACES_BATEAU: readonly VolumeBateau[] = [
  volume('pont-babord', 'pont', -2.28, -0.83, 1.45, 1.58, -5.45, 5.3),
  volume('pont-tribord', 'pont', 0.83, 2.28, 1.45, 1.58, -5.45, 5.3),
  volume('pont-avant', 'pont', -0.83, 0.83, 1.45, 1.58, 2.42, 5.3),
  volume('pont-arriere', 'pont', -0.83, 0.83, 1.45, 1.58, -5.45, -4.38),
  volume('plancher-cabine', 'cabine', -1.63, 1.63, 1.45, 1.58, -1.35, 2.42),
  volume('cale-sol', 'cale', -1.92, 1.92, 0.12, 0.25, -4.28, 2.35),
  volume('cale-marche-1', 'escalier', -0.68, 0.68, 0.28, 0.42, -3.92, -3.48),
  volume('cale-marche-2', 'escalier', -0.68, 0.68, 0.48, 0.62, -3.62, -3.18),
  volume('cale-marche-3', 'escalier', -0.68, 0.68, 0.68, 0.82, -3.32, -2.88),
  volume('cale-marche-4', 'escalier', -0.68, 0.68, 0.88, 1.02, -3.02, -2.58),
  volume('cale-marche-5', 'escalier', -0.68, 0.68, 1.08, 1.22, -2.72, -2.28),
] as const;

const COLLISIONS_BATEAU: readonly VolumeBateau[] = [
  volume('coque-babord', 'coque', -2.55, -2.12, 0, 1.5, -5.15, 4.65),
  volume('coque-tribord', 'coque', 2.12, 2.55, 0, 1.5, -5.15, 4.65),
  volume('coque-poupe', 'coque', -2.2, 2.2, 0, 1.5, -5.55, -5.1),
  volume('coque-proue', 'coque', -2.35, 2.35, 0.1, 1.45, 4.65, 5.55),
  volume('cale-paroi-babord', 'cale', -2.12, -1.88, 0.12, 1.45, -4.5, 2.45),
  volume('cale-paroi-tribord', 'cale', 1.88, 2.12, 0.12, 1.45, -4.5, 2.45),
  volume('cale-cloison-avant', 'cale', -1.9, 1.9, 0.12, 1.45, 2.35, 2.58),
  volume('cabine-babord-arriere', 'cabine', -1.82, -1.62, 1.48, 3.95, -1.48, -0.86),
  volume('cabine-babord-avant', 'cabine', -1.82, -1.62, 1.48, 3.95, 0.06, 2.75),
  volume('cabine-babord-bas', 'cabine', -1.82, -1.62, 1.48, 2.43, -0.86, 0.06),
  volume('cabine-babord-haut', 'cabine', -1.82, -1.62, 3.15, 3.95, -0.86, 0.06),
  volume('cabine-tribord-arriere', 'cabine', 1.62, 1.82, 1.48, 3.95, -1.48, -0.86),
  volume('cabine-tribord-avant', 'cabine', 1.62, 1.82, 1.48, 3.95, 0.06, 2.75),
  volume('cabine-tribord-bas', 'cabine', 1.62, 1.82, 1.48, 2.43, -0.86, 0.06),
  volume('cabine-tribord-haut', 'cabine', 1.62, 1.82, 3.15, 3.95, -0.86, 0.06),
  volume('cabine-proue-bas', 'cabine', -1.62, 1.62, 1.48, 2.42, 2.58, 2.8),
  volume('cabine-proue-haut', 'cabine', -1.62, 1.62, 3.3, 3.95, 2.58, 2.8),
  volume('cabine-proue-babord', 'cabine', -1.62, -1.28, 2.42, 3.3, 2.58, 2.8),
  volume('cabine-proue-tribord', 'cabine', 1.28, 1.62, 2.42, 3.3, 2.58, 2.8),
  volume('toit', 'toit', -2.2, 2.2, 3.92, 4.28, -1.75, 3.02),
] as const;

function volume(
  id: string,
  niveau: NiveauBateau,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): VolumeBateau {
  return { id, niveau, minX, maxX, minY, maxY, minZ, maxZ };
}

function tournerPoint(point: PointBateau, rotationY: number): PointBateau {
  const cosinus = Math.cos(rotationY);
  const sinus = Math.sin(rotationY);
  return {
    x: point.x * cosinus + point.z * sinus,
    y: point.y,
    z: -point.x * sinus + point.z * cosinus,
  };
}

function pointMondeDepuisLocal(
  point: PointBateau,
  position: PointBateau,
  rotationY: number,
): PointBateau {
  const tourné = tournerPoint(point, rotationY);
  return {
    x: position.x + tourné.x,
    y: position.y + tourné.y,
    z: position.z + tourné.z,
  };
}

function pointLocalDepuisMonde(
  point: PointBateau,
  position: PointBateau,
  rotationY: number,
): PointBateau {
  return tournerPoint(
    {
      x: point.x - position.x,
      y: point.y - position.y,
      z: point.z - position.z,
    },
    -rotationY,
  );
}

function limitesDepuisCoins(coins: readonly PointBateau[]): LimitesBateau {
  const premier = coins[0];
  if (!premier) {
    throw new Error('Un bateau doit posséder des coins de limites.');
  }

  let minX = premier.x;
  let maxX = premier.x;
  let minY = premier.y;
  let maxY = premier.y;
  let minZ = premier.z;
  let maxZ = premier.z;

  for (const coin of coins.slice(1)) {
    minX = Math.min(minX, coin.x);
    maxX = Math.max(maxX, coin.x);
    minY = Math.min(minY, coin.y);
    maxY = Math.max(maxY, coin.y);
    minZ = Math.min(minZ, coin.z);
    maxZ = Math.max(maxZ, coin.z);
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function coinsDesLimites(limites: LimitesBateau): readonly PointBateau[] {
  return [
    { x: limites.minX, y: limites.minY, z: limites.minZ },
    { x: limites.minX, y: limites.minY, z: limites.maxZ },
    { x: limites.minX, y: limites.maxY, z: limites.minZ },
    { x: limites.minX, y: limites.maxY, z: limites.maxZ },
    { x: limites.maxX, y: limites.minY, z: limites.minZ },
    { x: limites.maxX, y: limites.minY, z: limites.maxZ },
    { x: limites.maxX, y: limites.maxY, z: limites.minZ },
    { x: limites.maxX, y: limites.maxY, z: limites.maxZ },
  ];
}

function créerAncrages(
  id: string,
  position: PointBateau,
  rotationY: number,
): readonly AncrageBateau[] {
  const ancrages: readonly { type: TypeAncrageBateau; position: PointBateau }[] = [
    { type: 'apparition', position: { x: -1.2, y: 1.62, z: -3.55 } },
    { type: 'barre', position: { x: 0, y: 2.68, z: 1.65 } },
    { type: 'embarquement', position: { x: 0, y: 1.62, z: -5.68 } },
    { type: 'cale', position: { x: 0, y: 0.95, z: -3.05 } },
  ];

  return ancrages.map(({ type, position: positionLocale }) => ({
    id: id + '-' + type,
    type,
    position: pointMondeDepuisLocal(positionLocale, position, rotationY),
  }));
}

export function créerDescripteurBateau(
  position: PointBateau = { x: 0, y: 0, z: 0 },
  rotationY = 0,
  id = 'bateau-quai',
): DescripteurBateau {
  const limitesLocal: LimitesBateau = {
    minX: -2.6,
    maxX: 2.6,
    minY: 0,
    maxY: 4.35,
    minZ: -6,
    maxZ: 6,
  };
  const coinsMonde = coinsDesLimites(limitesLocal).map((coin) =>
    pointMondeDepuisLocal(coin, position, rotationY),
  );

  return {
    id,
    position: { ...position },
    rotationY,
    dimensions: DIMENSIONS_BATEAU_MVP,
    limitesLocal,
    limitesMonde: limitesDepuisCoins(coinsMonde),
    ancrages: créerAncrages(id, position, rotationY),
    surfaces: SURFACES_BATEAU,
    collisions: COLLISIONS_BATEAU,
  };
}

function créerMatériau(
  scene: Scene,
  nom: string,
  couleur: Color3,
  options: { readonly émissif?: Color3; readonly spéculaire?: Color3 } = {},
): StandardMaterial {
  const matériau = new StandardMaterial(nom, scene);
  matériau.diffuseColor = couleur;
  matériau.specularColor = options.spéculaire ?? new Color3(0.15, 0.18, 0.17);
  matériau.emissiveColor = options.émissif ?? new Color3(0, 0, 0);
  return matériau;
}

function nomUnique(scene: Scene, base: string): string {
  let nom = base;
  let index = 2;
  while (scene.getNodeByName(nom)) {
    nom = base + '-' + index;
    index += 1;
  }
  return nom;
}

function appliquerGéométrie(mesh: Mesh, positions: number[], indices: number[]): void {
  const normales: number[] = [];
  VertexData.ComputeNormals(positions, indices, normales);
  const données = new VertexData();
  données.positions = positions;
  données.indices = indices;
  données.normals = normales;
  données.applyToMesh(mesh);
}

function créerBoite(
  scene: Scene,
  racine: TransformNode,
  nom: string,
  largeur: number,
  hauteur: number,
  profondeur: number,
  position: Vector3,
  matériau: Material,
  metadata: Record<string, unknown>,
): Mesh {
  const mesh = MeshBuilder.CreateBox(
    nom,
    { width: largeur, height: hauteur, depth: profondeur },
    scene,
  );
  mesh.position.copyFrom(position);
  mesh.material = matériau;
  mesh.parent = racine;
  mesh.isPickable = false;
  mesh.metadata = metadata;
  return mesh;
}

function créerCoque(scene: Scene, racine: TransformNode, matériau: Material, id: string): Mesh {
  const sections = [
    { z: -6, demiLargeur: 1.95, bas: 0.15, haut: 1.22 },
    { z: -5.15, demiLargeur: 2.48, bas: 0, haut: 1.4 },
    { z: 4.45, demiLargeur: 2.25, bas: 0.1, haut: 1.35 },
    { z: 6, demiLargeur: 0.28, bas: 0.43, haut: 1.12 },
  ] as const;
  const positions: number[] = [];
  const indices: number[] = [];

  for (const section of sections) {
    positions.push(
      -section.demiLargeur,
      section.bas,
      section.z,
      section.demiLargeur,
      section.bas,
      section.z,
      -section.demiLargeur,
      section.haut,
      section.z,
      section.demiLargeur,
      section.haut,
      section.z,
    );
  }

  const ajouterFace = (
    premier: number,
    second: number,
    troisième: number,
    quatrième: number,
  ): void => {
    indices.push(premier, second, troisième, premier, troisième, quatrième);
  };

  for (let index = 0; index < sections.length - 1; index += 1) {
    const départ = index * 4;
    const suivant = (index + 1) * 4;
    ajouterFace(départ, suivant, suivant + 2, départ + 2);
    ajouterFace(départ + 1, départ + 3, suivant + 3, suivant + 1);
    ajouterFace(départ, départ + 1, suivant + 1, suivant);
    ajouterFace(départ + 2, suivant + 2, suivant + 3, départ + 3);
  }

  ajouterFace(0, 2, 3, 1);
  const dernier = (sections.length - 1) * 4;
  ajouterFace(dernier, dernier + 1, dernier + 3, dernier + 2);

  const coque = new Mesh(id + '-coque', scene);
  appliquerGéométrie(coque, positions, indices);
  coque.material = matériau;
  coque.parent = racine;
  coque.isPickable = false;
  coque.metadata = { type: 'bateau-coque', niveau: 'coque' };
  return coque;
}

function créerCylindre(
  scene: Scene,
  racine: TransformNode,
  nom: string,
  diamètre: number,
  hauteur: number,
  position: Vector3,
  rotation: Vector3,
  matériau: Material,
  metadata: Record<string, unknown>,
): Mesh {
  const mesh = MeshBuilder.CreateCylinder(
    nom,
    { diameter: diamètre, height: hauteur, tessellation: 16 },
    scene,
  );
  mesh.position.copyFrom(position);
  mesh.rotation.copyFrom(rotation);
  mesh.material = matériau;
  mesh.parent = racine;
  mesh.isPickable = false;
  mesh.metadata = metadata;
  return mesh;
}

function créerHublot(
  scene: Scene,
  racine: TransformNode,
  id: string,
  côté: -1 | 1,
  matériaux: { readonly verre: Material; readonly métal: Material },
): readonly Mesh[] {
  const x = côté * 1.84;
  const verre = créerCylindre(
    scene,
    racine,
    id + '-verre',
    0.82,
    0.08,
    new Vector3(x, 2.8, -0.4),
    new Vector3(0, 0, Math.PI / 2),
    matériaux.verre,
    { type: 'bateau-hublot', côté: côté < 0 ? 'babord' : 'tribord' },
  );
  const anneau = MeshBuilder.CreateTorus(
    id + '-anneau',
    { diameter: 0.94, thickness: 0.1, tessellation: 16 },
    scene,
  );
  anneau.position.set(x, 2.8, -0.4);
  anneau.rotation.z = Math.PI / 2;
  anneau.material = matériaux.métal;
  anneau.parent = racine;
  anneau.isPickable = false;
  anneau.metadata = { type: 'bateau-hublot-cadre', côté: côté < 0 ? 'babord' : 'tribord' };
  return [verre, anneau];
}

function créerBateauVisible(
  scene: Scene,
  racine: TransformNode,
  id: string,
  objets: AbstractMesh[],
  hublots: Mesh[],
  matériaux: {
    readonly coque: Material;
    readonly bande: Material;
    readonly pont: Material;
    readonly cabine: Material;
    readonly toit: Material;
    readonly verre: Material;
    readonly métal: Material;
    readonly cale: Material;
    readonly lampe: Material;
  },
): void {
  objets.push(créerCoque(scene, racine, matériaux.coque, id));
  objets.push(
    créerBoite(
      scene,
      racine,
      id + '-bande-flottaison',
      4.85,
      0.18,
      9.9,
      new Vector3(0, 0.94, -0.15),
      matériaux.bande,
      {
        type: 'bateau-bande-flottaison',
      },
    ),
  );

  objets.push(
    créerBoite(
      scene,
      racine,
      id + '-pont-babord-visible',
      1.45,
      0.16,
      10.75,
      new Vector3(-1.55, 1.5, -0.075),
      matériaux.pont,
      {
        type: 'bateau-pont',
        côté: 'babord',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-pont-tribord-visible',
      1.45,
      0.16,
      10.75,
      new Vector3(1.55, 1.5, -0.075),
      matériaux.pont,
      {
        type: 'bateau-pont',
        côté: 'tribord',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-pont-avant-visible',
      1.65,
      0.16,
      2.5,
      new Vector3(0, 1.5, 4.05),
      matériaux.pont,
      {
        type: 'bateau-pont',
        zone: 'avant',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-pont-arriere-visible',
      1.65,
      0.16,
      1.07,
      new Vector3(0, 1.5, -4.915),
      matériaux.pont,
      {
        type: 'bateau-pont',
        zone: 'arriere',
      },
    ),
  );

  for (const côté of [-1, 1] as const) {
    const nomCôté = côté < 0 ? 'babord' : 'tribord';
    objets.push(
      créerBoite(
        scene,
        racine,
        id + '-cabine-' + nomCôté + '-arriere',
        0.18,
        2.45,
        0.62,
        new Vector3(côté * 1.72, 2.7, -1.17),
        matériaux.cabine,
        {
          type: 'bateau-cabine',
          côté: nomCôté,
          zone: 'arriere',
        },
      ),
      créerBoite(
        scene,
        racine,
        id + '-cabine-' + nomCôté + '-avant',
        0.18,
        2.45,
        2.69,
        new Vector3(côté * 1.72, 2.7, 1.38),
        matériaux.cabine,
        {
          type: 'bateau-cabine',
          côté: nomCôté,
          zone: 'avant',
        },
      ),
      créerBoite(
        scene,
        racine,
        id + '-cabine-' + nomCôté + '-bas',
        0.18,
        0.95,
        0.92,
        new Vector3(côté * 1.72, 1.95, -0.4),
        matériaux.cabine,
        {
          type: 'bateau-cabine',
          côté: nomCôté,
          zone: 'sous-hublot',
        },
      ),
      créerBoite(
        scene,
        racine,
        id + '-cabine-' + nomCôté + '-haut',
        0.18,
        0.8,
        0.92,
        new Vector3(côté * 1.72, 3.55, -0.4),
        matériaux.cabine,
        {
          type: 'bateau-cabine',
          côté: nomCôté,
          zone: 'au-dessus-hublot',
        },
      ),
    );
  }

  objets.push(
    créerBoite(
      scene,
      racine,
      id + '-cabine-proue-bas',
      3.45,
      1.1,
      0.18,
      new Vector3(0, 2.0, 2.7),
      matériaux.cabine,
      {
        type: 'bateau-cabine',
        zone: 'proue-basse',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-cabine-proue-haut',
      3.45,
      0.65,
      0.18,
      new Vector3(0, 3.63, 2.7),
      matériaux.cabine,
      {
        type: 'bateau-cabine',
        zone: 'proue-haute',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-cabine-proue-babord',
      0.34,
      0.88,
      0.18,
      new Vector3(-1.45, 2.86, 2.7),
      matériaux.cabine,
      {
        type: 'bateau-cabine',
        zone: 'pare-brise',
        côté: 'babord',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-cabine-proue-tribord',
      0.34,
      0.88,
      0.18,
      new Vector3(1.45, 2.86, 2.7),
      matériaux.cabine,
      {
        type: 'bateau-cabine',
        zone: 'pare-brise',
        côté: 'tribord',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-toit',
      4.35,
      0.24,
      4.75,
      new Vector3(0, 4.04, 0.63),
      matériaux.toit,
      {
        type: 'bateau-toit',
        surfacePraticable: false,
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-plancher-cabine',
      3.25,
      0.16,
      3.78,
      new Vector3(0, 1.5, 0.535),
      matériaux.pont,
      {
        type: 'bateau-plancher-cabine',
      },
    ),
  );

  const hublotBabord = créerHublot(scene, racine, id + '-hublot-babord', -1, {
    verre: matériaux.verre,
    métal: matériaux.métal,
  });
  const hublotTribord = créerHublot(scene, racine, id + '-hublot-tribord', 1, {
    verre: matériaux.verre,
    métal: matériaux.métal,
  });
  hublots.push(hublotBabord[0] as Mesh, hublotTribord[0] as Mesh);
  objets.push(...hublotBabord, ...hublotTribord);

  objets.push(
    créerBoite(
      scene,
      racine,
      id + '-poste-pilotage',
      1.55,
      0.78,
      0.65,
      new Vector3(0, 2.05, 1.72),
      matériaux.métal,
      {
        type: 'bateau-poste-pilotage',
        ancrage: 'barre',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-tableau-bord',
      1.25,
      0.08,
      0.42,
      new Vector3(0, 2.46, 1.86),
      matériaux.bande,
      {
        type: 'bateau-tableau-bord',
      },
    ),
  );

  const roue = MeshBuilder.CreateTorus(
    id + '-barre',
    { diameter: 0.86, thickness: 0.1, tessellation: 20 },
    scene,
  );
  roue.position.set(0, 2.68, 1.65);
  roue.rotation.x = Math.PI / 2;
  roue.material = matériaux.bande;
  roue.parent = racine;
  roue.isPickable = false;
  roue.metadata = { type: 'bateau-barre', ancrage: 'barre' };
  objets.push(roue);

  objets.push(
    créerBoite(
      scene,
      racine,
      id + '-siege-pilotage',
      1.1,
      0.42,
      0.9,
      new Vector3(0, 1.88, 0.62),
      matériaux.pont,
      {
        type: 'bateau-siege',
      },
    ),
  );

  objets.push(
    créerBoite(
      scene,
      racine,
      id + '-trappe-cadre-avant',
      1.85,
      0.18,
      0.18,
      new Vector3(0, 1.62, -2.25),
      matériaux.métal,
      {
        type: 'bateau-entree-cale',
        bord: 'avant',
        ancrage: 'cale',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-trappe-cadre-arriere',
      1.85,
      0.18,
      0.18,
      new Vector3(0, 1.62, -4.35),
      matériaux.métal,
      {
        type: 'bateau-entree-cale',
        bord: 'arriere',
        ancrage: 'cale',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-trappe-cadre-babord',
      0.18,
      0.18,
      2.2,
      new Vector3(-0.84, 1.62, -3.3),
      matériaux.métal,
      {
        type: 'bateau-entree-cale',
        bord: 'babord',
        ancrage: 'cale',
      },
    ),
    créerBoite(
      scene,
      racine,
      id + '-trappe-cadre-tribord',
      0.18,
      0.18,
      2.2,
      new Vector3(0.84, 1.62, -3.3),
      matériaux.métal,
      {
        type: 'bateau-entree-cale',
        bord: 'tribord',
        ancrage: 'cale',
      },
    ),
  );

  for (let index = 0; index < 5; index += 1) {
    const marche = SURFACES_BATEAU[6 + index];
    if (!marche) {
      continue;
    }
    objets.push(
      créerBoite(
        scene,
        racine,
        id + '-' + marche.id,
        marche.maxX - marche.minX,
        marche.maxY - marche.minY,
        marche.maxZ - marche.minZ,
        new Vector3(
          (marche.minX + marche.maxX) / 2,
          (marche.minY + marche.maxY) / 2,
          (marche.minZ + marche.maxZ) / 2,
        ),
        matériaux.pont,
        { type: 'bateau-escalier-cale', niveau: 'escalier' },
      ),
    );
  }

  objets.push(
    créerBoite(
      scene,
      racine,
      id + '-plancher-cale-visible',
      3.78,
      0.12,
      6.5,
      new Vector3(0, 0.18, -0.965),
      matériaux.cale,
      {
        type: 'bateau-cale',
        niveau: 'cale',
        ancrage: 'cale',
      },
    ),
  );

  for (const [index, z] of [-4.95, -3.1, -1.25, 0.6, 2.25].entries()) {
    for (const côté of [-1, 1] as const) {
      objets.push(
        créerBoite(
          scene,
          racine,
          id + '-cale-couple-' + (côté < 0 ? 'babord' : 'tribord') + '-' + (index + 1),
          0.18,
          0.68,
          0.16,
          new Vector3(côté * 1.6, 0.62, z),
          matériaux.métal,
          {
            type: 'bateau-cale-couple',
            côté: côté < 0 ? 'babord' : 'tribord',
          },
        ),
      );
    }
  }

  const lampe = MeshBuilder.CreateSphere(
    id + '-lampe-cale',
    { diameter: 0.28, segments: 12 },
    scene,
  );
  lampe.position.set(0, 1.12, -0.75);
  lampe.material = matériaux.lampe;
  lampe.parent = racine;
  lampe.isPickable = false;
  lampe.metadata = { type: 'bateau-lampe-cale' };
  objets.push(lampe);

  for (const côté of [-1, 1] as const) {
    const nomCôté = côté < 0 ? 'babord' : 'tribord';
    for (const [index, z] of [-5.15, -3.1, -1.05, 1, 3].entries()) {
      const poteau = créerCylindre(
        scene,
        racine,
        id + '-garde-corps-' + nomCôté + '-poteau-' + (index + 1),
        0.11,
        0.72,
        new Vector3(côté * 2.28, 1.94, z),
        Vector3.Zero(),
        matériaux.métal,
        {
          type: 'bateau-garde-corps',
          côté: nomCôté,
        },
      );
      objets.push(poteau);
    }
    objets.push(
      créerBoite(
        scene,
        racine,
        id + '-garde-corps-' + nomCôté + '-lisse',
        0.12,
        0.12,
        9.2,
        new Vector3(côté * 2.28, 2.28, -0.9),
        matériaux.métal,
        {
          type: 'bateau-garde-corps',
          côté: nomCôté,
        },
      ),
    );
  }
}

function créerCollisions(
  scene: Scene,
  racine: TransformNode,
  descripteur: DescripteurBateau,
  objets: AbstractMesh[],
  surfaces: Mesh[],
  collisions: Mesh[],
): void {
  const créer = (boite: VolumeBateau, type: 'surface' | 'collision'): Mesh => {
    const mesh = MeshBuilder.CreateBox(
      descripteur.id + '-' + type + '-' + boite.id,
      {
        width: boite.maxX - boite.minX,
        height: boite.maxY - boite.minY,
        depth: boite.maxZ - boite.minZ,
      },
      scene,
    );
    mesh.position.set(
      (boite.minX + boite.maxX) / 2,
      (boite.minY + boite.maxY) / 2,
      (boite.minZ + boite.maxZ) / 2,
    );
    mesh.parent = racine;
    mesh.isVisible = false;
    mesh.visibility = 0;
    mesh.isPickable = false;
    mesh.checkCollisions = true;
    mesh.metadata = { type: 'bateau-' + type, id: boite.id, niveau: boite.niveau, volume: boite };
    objets.push(mesh);
    return mesh;
  };

  for (const surface of descripteur.surfaces) {
    surfaces.push(créer(surface, 'surface'));
  }
  for (const collision of descripteur.collisions) {
    collisions.push(créer(collision, 'collision'));
  }
}

export function construireBateauBabylon(
  scene: Scene,
  options: OptionsBateauBabylon = {},
): BateauBabylon {
  const id = nomUnique(scene, options.id ?? 'bateau-quai');
  const position = options.position?.clone() ?? Vector3.Zero();
  const rotationY = options.rotationY ?? 0;
  const descripteur = créerDescripteurBateau(
    { x: position.x, y: position.y, z: position.z },
    rotationY,
    id,
  );
  const racine = new TransformNode(id, scene);
  racine.position.copyFrom(position);
  racine.rotation.y = rotationY;
  racine.metadata = {
    type: 'bateau',
    id,
    ancrages: descripteur.ancrages,
    dimensions: descripteur.dimensions,
  };

  const matériaux = {
    coque: créerMatériau(scene, id + '-matériau-coque', new Color3(0.08, 0.22, 0.28), {
      spéculaire: new Color3(0.32, 0.42, 0.42),
    }),
    bande: créerMatériau(scene, id + '-matériau-bande', new Color3(0.82, 0.48, 0.17), {
      émissif: new Color3(0.06, 0.025, 0.005),
    }),
    pont: créerMatériau(scene, id + '-matériau-pont', new Color3(0.45, 0.27, 0.13)),
    cabine: créerMatériau(scene, id + '-matériau-cabine', new Color3(0.84, 0.86, 0.76)),
    toit: créerMatériau(scene, id + '-matériau-toit', new Color3(0.12, 0.34, 0.38)),
    verre: créerMatériau(scene, id + '-matériau-vitre', new Color3(0.04, 0.18, 0.24), {
      émissif: new Color3(0.015, 0.08, 0.12),
      spéculaire: new Color3(0.7, 0.85, 0.9),
    }),
    métal: créerMatériau(scene, id + '-matériau-metal', new Color3(0.55, 0.59, 0.55)),
    cale: créerMatériau(scene, id + '-matériau-cale', new Color3(0.24, 0.15, 0.1)),
    lampe: créerMatériau(scene, id + '-matériau-lampe', new Color3(1, 0.64, 0.18), {
      émissif: new Color3(0.9, 0.3, 0.04),
    }),
  };
  const objets: AbstractMesh[] = [];
  const surfaces: Mesh[] = [];
  const collisions: Mesh[] = [];
  const hublots: Mesh[] = [];

  créerBateauVisible(scene, racine, id, objets, hublots, matériaux);
  créerCollisions(scene, racine, descripteur, objets, surfaces, collisions);

  let libéré = false;
  const liberer = (): void => {
    if (libéré) {
      return;
    }
    libéré = true;
    racine.dispose(false, false);
    for (const matériau of Object.values(matériaux)) {
      matériau.dispose();
    }
  };

  return {
    descripteur,
    racine,
    objets,
    surfaces,
    collisions,
    hublots,
    observateurs: [],
    liberer,
  };
}

export function pointDansBoiteBateau(point: PointBateau, boite: LimitesBateau): boolean {
  return (
    point.x >= boite.minX &&
    point.x <= boite.maxX &&
    point.y >= boite.minY &&
    point.y <= boite.maxY &&
    point.z >= boite.minZ &&
    point.z <= boite.maxZ
  );
}

export function pointDansSurfaceBateau(
  pointMonde: PointBateau,
  descripteur: DescripteurBateau,
): VolumeBateau | undefined {
  const pointLocal = pointLocalDepuisMonde(pointMonde, descripteur.position, descripteur.rotationY);
  return descripteur.surfaces.find((surface) => pointDansBoiteBateau(pointLocal, surface));
}

export function cameraBateau(
  camera: { readonly position: Vector3; setTarget(cible: Vector3): void },
  descripteur: DescripteurBateau,
  mode: ModePresentationBateau,
): void {
  const configurations: Record<
    ModePresentationBateau,
    { readonly position: PointBateau; readonly cible: PointBateau }
  > = {
    'bateau-exterieur': {
      position: { x: 10.5, y: 6.4, z: -12.5 },
      cible: { x: 0, y: 1.9, z: 0.2 },
    },
    'bateau-cabine': {
      position: { x: 0, y: 2.75, z: 1.95 },
      cible: { x: 0, y: 2.8, z: -0.85 },
    },
    'bateau-cale': {
      position: { x: 0.0, y: 1.85, z: -2.42 },
      cible: { x: 0.0, y: 0.35, z: -3.95 },
    },
  };
  const configuration = configurations[mode];
  const position = pointMondeDepuisLocal(
    configuration.position,
    descripteur.position,
    descripteur.rotationY,
  );
  const cible = pointMondeDepuisLocal(
    configuration.cible,
    descripteur.position,
    descripteur.rotationY,
  );
  camera.position.copyFrom(new Vector3(position.x, position.y, position.z));
  camera.setTarget(new Vector3(cible.x, cible.y, cible.z));
}
