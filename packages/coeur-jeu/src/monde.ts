import type { Point3D } from './index.js';
import type { ZonePeche } from './peche.js';
import { figerProfondément } from './immuable.js';

export const GRAINE_MVP_PAR_DEFAUT = 'mvp-defaut';
export const NOMBRE_ILES_MVP = 3;
export const GRAINE_MVP = GRAINE_MVP_PAR_DEFAUT;

export const FACTEUR_DISTANCE_ZONE_RIVAGE = 1.12;
export const RAYON_ZONE_RIVAGE = 3.2;
export const FACTEUR_CENTRE_ZONE_QUAI = 0.35;
export const RAYON_ZONE_QUAI = 2.4;

export type FormeIle = 'anse' | 'falaise' | 'cratere';

export interface TransformationMonde {
  readonly position: Point3D;
  readonly rotationY: number;
  readonly echelle: Point3D;
}

export interface ProfilTerrainIle {
  readonly segments: number;
  readonly relief: readonly number[];
  readonly rayonEpaule: number;
  readonly rayonCouronne: number;
  readonly hauteurRivage: number;
  readonly hauteurCouronne: number;
  readonly hauteurSommet: number;
}

export interface CollisionIle {
  readonly forme: 'ellipse';
  readonly centre: Point3D;
  readonly rotationY: number;
  readonly rayonX: number;
  readonly rayonZ: number;
  readonly hauteurSurface: number;
  readonly hauteurBase: number;
  readonly profil: ProfilTerrainIle;
}

export interface RivageIle {
  readonly centre: Point3D;
  readonly rotationY: number;
  readonly rayonX: number;
  readonly rayonZ: number;
  readonly hauteur: number;
}

export interface QuaiIle {
  readonly position: Point3D;
  readonly rotationY: number;
  readonly longueur: number;
  readonly largeur: number;
  readonly hauteur: number;
}

export interface ApprocheIle {
  readonly position: Point3D;
  readonly direction: Point3D;
  readonly quai: QuaiIle;
}

export interface Apparition {
  readonly id: string;
  readonly position: Point3D;
}

export interface MarqueurIle {
  readonly id: string;
  readonly ileId: string;
  readonly type: 'ile';
  readonly label: string;
  readonly position: Point3D;
}

export interface DescripteurIle {
  readonly id: string;
  readonly nom: string;
  readonly forme: FormeIle;
  readonly transformation: TransformationMonde;
  readonly rayonX: number;
  readonly rayonZ: number;
  readonly hauteurTerrain: number;
  readonly relief: readonly number[];
  readonly couleurTerrain: readonly [number, number, number];
  readonly couleurRivage: readonly [number, number, number];
  readonly collision: CollisionIle;
  readonly rivage: RivageIle;
  readonly approche: ApprocheIle;
  readonly apparitionJoueur: Apparition;
  readonly apparitionsPirates: readonly Apparition[];
  readonly marqueur: MarqueurIle;
  readonly marqueurs: readonly [MarqueurIle];
}

export interface DescripteurOcean {
  readonly largeur: number;
  readonly profondeur: number;
  readonly hauteur: number;
}

export interface DescripteurMonde {
  readonly graine: string;
  readonly ocean: DescripteurOcean;
  readonly iles: readonly DescripteurIle[];
  readonly marqueurs: readonly MarqueurIle[];
  readonly zonesPeche: readonly ZonePeche[];
}

interface AncrageIle {
  readonly id: string;
  readonly nom: string;
  readonly forme: FormeIle;
  readonly x: number;
  readonly z: number;
  readonly rayonX: number;
  readonly rayonZ: number;
  readonly hauteur: number;
  readonly angleApproche: number;
  readonly couleurTerrain: readonly [number, number, number];
  readonly couleurRivage: readonly [number, number, number];
}

const ANCRAGES_ILES: readonly AncrageIle[] = [
  {
    id: 'ile-aube',
    nom: 'Île Aube',
    forme: 'anse',
    x: -40,
    z: 18,
    rayonX: 13.5,
    rayonZ: 10.5,
    hauteur: 3.1,
    angleApproche: -0.55,
    couleurTerrain: [0.19, 0.43, 0.25],
    couleurRivage: [0.86, 0.72, 0.39],
  },
  {
    id: 'ile-brume',
    nom: 'Île Brume',
    forme: 'falaise',
    x: 0,
    z: 45,
    rayonX: 14.5,
    rayonZ: 11.5,
    hauteur: 4.25,
    angleApproche: 2.2,
    couleurTerrain: [0.28, 0.35, 0.32],
    couleurRivage: [0.73, 0.67, 0.49],
  },
  {
    id: 'ile-corail',
    nom: 'Île Corail',
    forme: 'cratere',
    x: 42,
    z: -6,
    rayonX: 16.5,
    rayonZ: 12.5,
    hauteur: 2.65,
    angleApproche: 0.9,
    couleurTerrain: [0.22, 0.46, 0.36],
    couleurRivage: [0.91, 0.73, 0.43],
  },
] as const;

const OCEAN_MVP: DescripteurOcean = {
  largeur: 220,
  profondeur: 220,
  hauteur: 0,
};

function entierGraine(graine: string): number {
  let hash = 2166136261;

  for (let index = 0; index < graine.length; index += 1) {
    hash ^= graine.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function créerAleatoire(graine: string): () => number {
  let état = entierGraine(graine) || 0x9e3779b9;

  return () => {
    état = (état + 0x6d2b79f5) >>> 0;
    let valeur = état;
    valeur = Math.imul(valeur ^ (valeur >>> 15), valeur | 1);
    valeur ^= valeur + Math.imul(valeur ^ (valeur >>> 7), valeur | 61);
    return ((valeur ^ (valeur >>> 14)) >>> 0) / 4294967296;
  };
}

function plage(aleatoire: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * aleatoire();
}

function tournerPoint(point: Point3D, rotationY: number): Point3D {
  const cosinus = Math.cos(rotationY);
  const sinus = Math.sin(rotationY);

  return {
    x: point.x * cosinus - point.z * sinus,
    y: point.y,
    z: point.x * sinus + point.z * cosinus,
  };
}

function ajouterPoint(centre: Point3D, local: Point3D): Point3D {
  return {
    x: centre.x + local.x,
    y: centre.y + local.y,
    z: centre.z + local.z,
  };
}

function créerRelief(aleatoire: () => number, forme: FormeIle): readonly number[] {
  const nombrePoints = 12;
  const relief: number[] = [];

  for (let index = 0; index < nombrePoints; index += 1) {
    const ondulation = Math.sin(
      (index / nombrePoints) * Math.PI * 2 + (forme === 'falaise' ? 0.7 : 0),
    );
    const variation = plage(aleatoire, -0.06, 0.06);
    const falaise = forme === 'falaise' && index % 3 === 0 ? 0.04 : 0;
    relief.push(Math.max(0.84, Math.min(1, 0.94 + ondulation * 0.05 + variation + falaise)));
  }

  return relief;
}

function créerApparition(
  id: string,
  centre: Point3D,
  rayonX: number,
  rayonZ: number,
  rotationY: number,
  localX: number,
  localZ: number,
  hauteur: number,
): Apparition {
  const local = tournerPoint({ x: rayonX * localX, y: hauteur, z: rayonZ * localZ }, rotationY);
  return {
    id,
    position: ajouterPoint(centre, local),
  };
}

function créerIle(ancrage: AncrageIle, aleatoire: () => number): DescripteurIle {
  const rotationY = plage(aleatoire, -0.16, 0.16);
  const centre: Point3D = {
    x: ancrage.x + plage(aleatoire, -3.4, 3.4),
    y: OCEAN_MVP.hauteur,
    z: ancrage.z + plage(aleatoire, -3.4, 3.4),
  };
  const rayonX = ancrage.rayonX + plage(aleatoire, -1.1, 1.1);
  const rayonZ = ancrage.rayonZ + plage(aleatoire, -0.9, 0.9);
  const hauteurTerrain = ancrage.hauteur + plage(aleatoire, -0.25, 0.28);
  const relief = créerRelief(aleatoire, ancrage.forme);
  const hauteurCouronne = hauteurTerrain * (ancrage.forme === 'falaise' ? 0.9 : 0.76);
  const profil: ProfilTerrainIle = {
    segments: relief.length,
    relief,
    rayonEpaule: 0.98,
    rayonCouronne: 0.6,
    hauteurRivage: OCEAN_MVP.hauteur + 0.12,
    hauteurCouronne,
    hauteurSommet: hauteurTerrain,
  };
  const collision: CollisionIle = {
    forme: 'ellipse',
    centre,
    rotationY,
    rayonX,
    rayonZ,
    hauteurSurface: hauteurTerrain,
    hauteurBase: OCEAN_MVP.hauteur - 0.15,
    profil,
  };
  const rivage: RivageIle = {
    centre,
    rotationY,
    rayonX: rayonX * 1.06,
    rayonZ: rayonZ * 1.06,
    hauteur: OCEAN_MVP.hauteur + 0.12,
  };
  const angleApproche = ancrage.angleApproche + rotationY;
  const direction: Point3D = {
    x: Math.cos(angleApproche),
    y: 0,
    z: Math.sin(angleApproche),
  };
  const pointApproche: Point3D = {
    x: centre.x + direction.x * rayonX * 1.22,
    y: OCEAN_MVP.hauteur + 0.2,
    z: centre.z + direction.z * rayonZ * 1.22,
  };
  const quai: QuaiIle = {
    position: {
      x: centre.x + direction.x * rayonX * 1.06,
      y: OCEAN_MVP.hauteur + 0.35,
      z: centre.z + direction.z * rayonZ * 1.06,
    },
    rotationY: angleApproche,
    longueur: 8,
    largeur: 2.1,
    hauteur: OCEAN_MVP.hauteur + 0.35,
  };
  const apparitionJoueur = créerApparition(
    `${ancrage.id}-joueur`,
    centre,
    rayonX,
    rayonZ,
    rotationY,
    -0.18,
    0.12,
    hauteurTerrain + 0.85,
  );
  const positionsPirates = [
    [-0.42, -0.2],
    [0.34, -0.35],
    [0.16, 0.43],
  ] as const;
  const apparitionsPirates = positionsPirates.map(([localX, localZ], index) =>
    créerApparition(
      `${ancrage.id}-pirate-${index + 1}`,
      centre,
      rayonX,
      rayonZ,
      rotationY,
      localX,
      localZ,
      hauteurTerrain + 0.45,
    ),
  );
  const marqueur: MarqueurIle = {
    id: `marqueur-${ancrage.id}`,
    ileId: ancrage.id,
    type: 'ile',
    label: ancrage.nom,
    position: {
      x: centre.x,
      y: hauteurTerrain + 0.35,
      z: centre.z,
    },
  };

  return {
    id: ancrage.id,
    nom: ancrage.nom,
    forme: ancrage.forme,
    transformation: {
      position: centre,
      rotationY,
      echelle: { x: 1, y: 1, z: 1 },
    },
    rayonX,
    rayonZ,
    hauteurTerrain,
    relief,
    couleurTerrain: ancrage.couleurTerrain,
    couleurRivage: ancrage.couleurRivage,
    collision,
    rivage,
    approche: {
      position: pointApproche,
      direction,
      quai,
    },
    apparitionJoueur,
    apparitionsPirates,
    marqueur,
    marqueurs: [marqueur],
  };
}

export function pointDansCollisionIle(ile: DescripteurIle, point: Point3D): boolean {
  const hauteurSurface = hauteurSurfaceIle(ile, point);
  if (hauteurSurface === undefined) {
    return false;
  }

  return point.y >= ile.collision.hauteurBase && point.y <= hauteurSurface + 1.5;
}

export function hauteurSurfaceIle(ile: DescripteurIle, point: Point3D): number | undefined {
  const relatif = tournerPoint(
    {
      x: point.x - ile.collision.centre.x,
      y: point.y,
      z: point.z - ile.collision.centre.z,
    },
    -ile.collision.rotationY,
  );
  const distanceX = relatif.x / ile.collision.rayonX;
  const distanceZ = relatif.z / ile.collision.rayonZ;
  const distance = Math.hypot(distanceX, distanceZ);
  if (distance > 1) {
    return undefined;
  }

  const profil = ile.collision.profil;
  const angle = (Math.atan2(distanceZ, distanceX) + Math.PI * 2) % (Math.PI * 2);
  const positionSegment = (angle / (Math.PI * 2)) * profil.segments;
  const indexSegment = Math.floor(positionSegment);
  const indexSuivant = (indexSegment + 1) % profil.segments;
  const progression = positionSegment - indexSegment;
  const reliefSegment = profil.relief[indexSegment] ?? 1;
  const reliefSuivant = profil.relief[indexSuivant] ?? reliefSegment;
  const relief = reliefSegment + (reliefSuivant - reliefSegment) * progression;
  const rayonEpaule = profil.rayonEpaule * relief;
  const rayonCouronne = profil.rayonCouronne * relief;

  if (distance >= rayonEpaule) {
    const progressionPente = (1 - distance) / (1 - rayonEpaule);
    return (
      ile.collision.hauteurBase +
      (profil.hauteurRivage - ile.collision.hauteurBase) * progressionPente
    );
  }

  if (distance >= rayonCouronne) {
    const progressionPente = (distance - rayonCouronne) / (rayonEpaule - rayonCouronne);
    return (
      profil.hauteurCouronne + (profil.hauteurRivage - profil.hauteurCouronne) * progressionPente
    );
  }

  const progressionSommet = distance / rayonCouronne;
  return profil.hauteurSommet + (profil.hauteurCouronne - profil.hauteurSommet) * progressionSommet;
}

export function apparitionValide(ile: DescripteurIle, apparition: Apparition): boolean {
  const hauteurSurface = hauteurSurfaceIle(ile, apparition.position);
  if (hauteurSurface === undefined) {
    return false;
  }

  return (
    pointDansCollisionIle(ile, apparition.position) &&
    apparition.position.y >= hauteurSurface - 0.05
  );
}

export function genererMonde(graine: string = GRAINE_MVP_PAR_DEFAUT): DescripteurMonde {
  const graineNormalisee = graine.trim() || GRAINE_MVP_PAR_DEFAUT;
  const aleatoire = créerAleatoire(graineNormalisee);
  const iles = ANCRAGES_ILES.map((ancrage) => créerIle(ancrage, aleatoire));
  const zonesPeche = créerZonesPeche(iles);
  const monde: DescripteurMonde = {
    graine: graineNormalisee,
    ocean: OCEAN_MVP,
    iles,
    marqueurs: iles.map((ile) => ile.marqueur),
    zonesPeche,
  };

  return figerProfondément(monde);
}

function créerZonesPeche(iles: readonly DescripteurIle[]): readonly ZonePeche[] {
  return iles.flatMap((ile) => {
    const zoneRivage = créerZoneRivage(ile);
    const zoneQuai = créerZoneQuai(ile);
    return [zoneRivage, zoneQuai];
  });
}

function créerZoneRivage(ile: DescripteurIle): ZonePeche {
  const direction = ile.approche.direction;
  const centre = {
    x: ile.transformation.position.x + direction.x * (ile.rayonX * FACTEUR_DISTANCE_ZONE_RIVAGE),
    y: ile.transformation.position.y,
    z: ile.transformation.position.z + direction.z * (ile.rayonZ * FACTEUR_DISTANCE_ZONE_RIVAGE),
  };
  return {
    id: `zone-rivage-${ile.id}`,
    ileId: ile.id,
    type: 'rivage',
    centre,
    rayon: RAYON_ZONE_RIVAGE,
    nom: `${ile.nom} — rivage`,
  };
}

function créerZoneQuai(ile: DescripteurIle): ZonePeche {
  const quai = ile.approche.quai;
  const direction = ile.approche.direction;
  const centre = {
    x: quai.position.x + direction.x * (quai.longueur * FACTEUR_CENTRE_ZONE_QUAI),
    y: ile.transformation.position.y,
    z: quai.position.z + direction.z * (quai.longueur * FACTEUR_CENTRE_ZONE_QUAI),
  };
  return {
    id: `zone-quai-${ile.id}`,
    ileId: ile.id,
    type: 'quai',
    centre,
    rayon: RAYON_ZONE_QUAI,
    nom: `${ile.nom} — quai`,
  };
}

export const créerMonde = genererMonde;
export const creerMondeDeterministe = genererMonde;
export const genererMondeDeterministe = genererMonde;
