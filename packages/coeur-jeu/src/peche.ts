import type { Point3D } from './index.js';
import { hauteurSurfaceIle, type DescripteurIle } from './monde.js';
import { figerProfondément } from './immuable.js';

export const DELAI_MORSURE_MIN_MS = 500;
export const DELAI_MORSURE_MAX_MS = 5000;
export const DUREE_FENETRE_MORSURE_MS = 800;

export type EspecePeche = 'sardine' | 'maquereau' | 'thon';
export type TypeZonePeche = 'rivage' | 'quai';
export type PhasePeche = 'inactive' | 'attente' | 'morsure' | 'terminee';
export type ResultatPeche = 'prise' | 'trop_tot' | 'trop_tard' | 'hors_zone' | 'annulee';
export type CommandePeche = 'lancer' | 'relever' | 'annuler';

export interface EspecePecheDefinie {
  readonly id: EspecePeche;
  readonly nom: string;
  readonly tailleMin: number;
  readonly tailleMax: number;
}

export interface ZonePeche {
  readonly id: string;
  readonly ileId: string;
  readonly type: TypeZonePeche;
  readonly centre: Point3D;
  readonly rayon: number;
  readonly nom: string;
}

export interface PrevisionPeche {
  readonly delaiMorsureMs: number;
  readonly espece: EspecePeche;
  readonly taille: number;
}

export interface EtatPeche {
  readonly phase: PhasePeche;
  readonly resultat?: ResultatPeche;
  readonly zoneId?: string;
  readonly sequence: number;
  readonly lanceAuMs: number;
  readonly tempsCourantMs: number;
  readonly delaiMorsureMs?: number;
  readonly fenetreMorsureMs?: number;
  readonly espece?: EspecePeche;
  readonly taille?: number;
}

export const ESPECES_POISSON: readonly EspecePecheDefinie[] = figerProfondément([
  { id: 'sardine', nom: 'Sardine', tailleMin: 12, tailleMax: 24 },
  { id: 'maquereau', nom: 'Maquereau', tailleMin: 30, tailleMax: 60 },
  { id: 'thon', nom: 'Thon', tailleMin: 90, tailleMax: 220 },
]);

export const ETAT_PECHE_INACTIF: EtatPeche = figerProfondément({
  phase: 'inactive',
  sequence: 0,
  lanceAuMs: 0,
  tempsCourantMs: 0,
});

function entierGraine(graine: string): number {
  let hash = 2166136261;
  for (let index = 0; index < graine.length; index += 1) {
    hash ^= graine.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function creerAleatoire(graine: string, sequence: number): () => number {
  let état = (entierGraine(graine) ^ Math.imul(sequence + 1, 0x9e3779b9)) >>> 0;
  return () => {
    état = (état + 0x6d2b79f5) >>> 0;
    let valeur = état;
    valeur = Math.imul(valeur ^ (valeur >>> 15), valeur | 1);
    valeur ^= valeur + Math.imul(valeur ^ (valeur >>> 7), valeur | 61);
    return ((valeur ^ (valeur >>> 14)) >>> 0) / 4294967296;
  };
}

function entier(aleatoire: () => number, min: number, max: number): number {
  return min + Math.floor((max - min + 1) * aleatoire());
}

function reel(aleatoire: () => number, min: number, max: number): number {
  return min + (max - min) * aleatoire();
}

export function trouverEspece(id: EspecePeche): EspecePecheDefinie | undefined {
  return ESPECES_POISSON.find((espece) => espece.id === id);
}

function validerEntierPositif(graine: string, sequence: number): void {
  if (!Number.isFinite(sequence) || !Number.isInteger(sequence) || sequence < 0) {
    throw new Error('La séquence de lancer doit être un entier positif.');
  }
  if (!graine || !graine.trim()) {
    throw new Error('La graine de pêche doit être fournie.');
  }
}

export function calculerPrevisionPeche(graine: string, sequence: number): PrevisionPeche {
  validerEntierPositif(graine, sequence);
  const aleatoire = creerAleatoire(graine, sequence);
  const delaiMorsureMs = entier(aleatoire, DELAI_MORSURE_MIN_MS, DELAI_MORSURE_MAX_MS);
  const tirageEspece = aleatoire();
  const indiceEspece = Math.min(ESPECES_POISSON.length - 1, Math.floor(tirageEspece * ESPECES_POISSON.length));
  const espece = ESPECES_POISSON[indiceEspece];
  if (!espece) {
    throw new Error('Aucune espèce tirée.');
  }
  const taille = Number(reel(aleatoire, espece.tailleMin, espece.tailleMax).toFixed(2));
  return { delaiMorsureMs, espece: espece.id, taille };
}

export function pointDansZonePeche(zone: ZonePeche, point: Point3D): boolean {
  const distance = Math.hypot(point.x - zone.centre.x, point.z - zone.centre.z);
  return distance <= zone.rayon;
}

function clonerEtat(etat: EtatPeche): EtatPeche {
  return { ...etat };
}

function terminer(etat: EtatPeche, resultat: ResultatPeche, temps: number): EtatPeche {
  return {
    ...clonerEtat(etat),
    phase: 'terminee',
    resultat,
    tempsCourantMs: temps,
  };
}

export function lancerPeche(
  etat: EtatPeche,
  monde: { readonly zonesPeche: readonly ZonePeche[] },
  zoneId: string,
  graine: string,
  sequence: number,
  temps: number,
): EtatPeche {
  if (etat.phase !== 'inactive') {
    return etat;
  }
  if (!Number.isFinite(temps) || temps < 0 || !Number.isFinite(sequence) || !Number.isInteger(sequence) || sequence < 0) {
    return etat;
  }
  const zone = monde.zonesPeche.find((candidate) => candidate.id === zoneId);
  if (!zone) {
    return { ...clonerEtat(etat), phase: 'terminee', resultat: 'hors_zone', tempsCourantMs: temps };
  }
  const prevision = calculerPrevisionPeche(graine, sequence);
  return {
    phase: 'attente',
    zoneId,
    sequence,
    lanceAuMs: temps,
    tempsCourantMs: temps,
    delaiMorsureMs: prevision.delaiMorsureMs,
    fenetreMorsureMs: DUREE_FENETRE_MORSURE_MS,
    espece: prevision.espece,
    taille: prevision.taille,
  };
}

export function avancerPeche(etat: EtatPeche, temps: number): EtatPeche {
  if (etat.phase !== 'attente' && etat.phase !== 'morsure') {
    return etat;
  }
  if (!Number.isFinite(temps) || temps < etat.tempsCourantMs) {
    return etat;
  }
  const delai = etat.delaiMorsureMs ?? 0;
  const fenetre = etat.fenetreMorsureMs ?? 0;
  const finMorsure = etat.lanceAuMs + delai + fenetre;

  if (temps > finMorsure) {
    return terminer(etat, 'trop_tard', temps);
  }
  if (temps >= etat.lanceAuMs + delai) {
    return { ...clonerEtat(etat), phase: 'morsure', tempsCourantMs: temps };
  }
  return { ...clonerEtat(etat), phase: 'attente', tempsCourantMs: temps };
}

export function releverPeche(etat: EtatPeche, temps: number): EtatPeche {
  if (etat.phase !== 'attente' && etat.phase !== 'morsure') {
    return etat;
  }
  if (!Number.isFinite(temps) || temps < etat.tempsCourantMs) {
    return etat;
  }
  const delai = etat.delaiMorsureMs ?? 0;
  const fenetre = etat.fenetreMorsureMs ?? 0;
  if (temps < etat.lanceAuMs + delai) {
    return terminer(etat, 'trop_tot', temps);
  }
  if (temps > etat.lanceAuMs + delai + fenetre) {
    return terminer(etat, 'trop_tard', temps);
  }
  return {
    ...clonerEtat(etat),
    phase: 'terminee',
    resultat: 'prise',
    tempsCourantMs: temps,
  };
}

export function annulerPeche(etat: EtatPeche, temps: number): EtatPeche {
  if (etat.phase !== 'attente' && etat.phase !== 'morsure') {
    return etat;
  }
  if (!Number.isFinite(temps) || temps < etat.tempsCourantMs) {
    return etat;
  }
  return terminer(etat, 'annulee', temps);
}

export function zonePecheValide(
  monde: {
    readonly iles: readonly DescripteurIle[];
    readonly zonesPeche: readonly ZonePeche[];
  },
  zone: ZonePeche,
): boolean {
  if (!Number.isFinite(zone.rayon) || zone.rayon <= 0) {
    return false;
  }
  if (!Number.isFinite(zone.centre.x) || !Number.isFinite(zone.centre.y) || !Number.isFinite(zone.centre.z)) {
    return false;
  }
  const ile = monde.iles.find((candidate) => candidate.id === zone.ileId);
  if (!ile) {
    return false;
  }
  return zonePecheDansEau(ile, zone.centre);
}

function zonePecheDansEau(ile: DescripteurIle, centre: Point3D): boolean {
  const surface = hauteurSurfaceIle(ile, centre);
  return surface === undefined;
}
