import type { Point3D } from './index.js';

/** Santé maximale d'un pirate sur le serveur. */
export const SANTE_PIRATE_MAXIMALE = 100;
/** Santé maximale d'un joueur sur le serveur. */
export const SANTE_JOUEUR_MAXIMALE = 100;
/** Dégâts infligés par tir à un pirate. */
export const DEGATS_PAR_TIR_PIRATE = 25;
/** Cadence minimale entre deux tirs acceptés, en millisecondes, côté serveur. */
export const CADENCE_TIR_SERVEUR_MS = 150;
/** Portée maximale d'un tir exprimée en unités monde. */
export const PORTEE_TIR = 60;
/** Délai de réapparition d'un joueur mort, en millisecondes. */
export const DELAI_REAPPARITION_JOUEUR_MS = 3_000;
/** Hauteur du torse d'un pirate au-dessus de ses pieds pour la résolution. */
export const HAUTEUR_TORSE_PIRATE = 1.0;
/** Distance maximale admise entre l'origine déclarée et la position du tireur. */
export const DISTANCE_ORIGINE_ADMISE = 5;
/** Rayon de la sphère de collision d'un pirate pour la résolution d'intersection. */
export const RAYON_COLLISION_PIRATE = 0.9;
/** Borne haute des séquences d'intention pour empêcher un rejeu infini. */
export const SEQUENCE_MAX_INTENTION = 1_000_000;

/** Direction d'un tir, normalisée sur le serveur avant usage. */
export type DirectionTir = Readonly<Point3D>;

/** Intention de tir soumise par un client, au sens réseau. */
export interface IntentionTir {
  readonly sequence: number;
  readonly origine: Readonly<Point3D>;
  readonly direction: Readonly<Point3D>;
  readonly horodatageClient: number;
}

/** État d'un tireur nécessaire à la validation serveur. */
export interface EtatTireurServeur {
  readonly sessionId: string;
  readonly vivant: boolean;
  readonly position: Readonly<Point3D>;
  /** Position de référence alternative admise pour valider une origine. */
  readonly positionAdmise?: Readonly<Point3D>;
  /** Horodatage serveur du dernier tir accepté, en millisecondes. */
  readonly dernierTirMs: number;
  /** Dernière séquence acceptée. */
  readonly derniereSequence: number;
}

/** État d'un pirate participant à la résolution de combat. */
export interface EtatPirateCombat {
  readonly identifiant: string;
  readonly position: Readonly<Point3D>;
  readonly sante: number;
  readonly vivant: boolean;
}

/** État de santé d'un joueur tel que le serveur le possède. */
export interface EtatJoueurCombat {
  readonly sessionId: string;
  readonly sante: number;
  readonly vivant: boolean;
}

/** Résultat de la validation d'une intention de tir côté serveur. */
export type ResultatValidationTir =
  | { readonly valide: true; readonly intention: IntentionTir }
  | { readonly valide: false; readonly raison: string };

function estNombreFini(valeur: number): boolean {
  return Number.isFinite(valeur);
}

function estPointFini(point: Readonly<Point3D>): boolean {
  return estNombreFini(point.x) && estNombreFini(point.y) && estNombreFini(point.z);
}

export function normaliserDirection(direction: Readonly<Point3D>): DirectionTir {
  const longueur = Math.hypot(direction.x, direction.y, direction.z);
  if (longueur <= Number.EPSILON) {
    return { x: 0, y: 0, z: 1 };
  }

  return { x: direction.x / longueur, y: direction.y / longueur, z: direction.z / longueur };
}

function distanceEntre(origine: Readonly<Point3D>, cible: Readonly<Point3D>): number {
  return Math.hypot(cible.x - origine.x, cible.y - origine.y, cible.z - origine.z);
}

/**
 * Valide la forme et l'état d'une intention de tir côté serveur. Le serveur est
 * seule autorité : aucun résultat de dégâts, santé ou transformation n'est
 * accepté du client.
 */
export function validerIntentionServeur(
  tireur: EtatTireurServeur,
  intention: IntentionTir,
  maintenantServeurMs: number,
): ResultatValidationTir {
  if (!tireur.vivant) {
    return { valide: false, raison: 'Le tireur n’est plus vivant.' };
  }

  if (!estNombreFini(intention.sequence) || !Number.isSafeInteger(intention.sequence)) {
    return { valide: false, raison: 'La séquence d’intention est invalide.' };
  }

  if (intention.sequence <= tireur.derniereSequence) {
    return { valide: false, raison: 'La séquence d’intention est déjà consommée.' };
  }

  if (intention.sequence > SEQUENCE_MAX_INTENTION) {
    return { valide: false, raison: 'La séquence d’intention est trop grande.' };
  }

  if (!estPointFini(intention.origine)) {
    return { valide: false, raison: 'L’origine du tir est invalide.' };
  }

  const origineAdmise =
    distanceEntre(tireur.position, intention.origine) <= DISTANCE_ORIGINE_ADMISE ||
    (tireur.positionAdmise !== undefined &&
      distanceEntre(tireur.positionAdmise, intention.origine) <= DISTANCE_ORIGINE_ADMISE);
  if (!origineAdmise) {
    return { valide: false, raison: 'L’origine du tir est trop éloignée du tireur.' };
  }

  if (!estPointFini(intention.direction)) {
    return { valide: false, raison: 'La direction du tir est invalide.' };
  }

  if (Math.hypot(intention.direction.x, intention.direction.y, intention.direction.z) <= Number.EPSILON) {
    return { valide: false, raison: 'La direction du tir est nulle.' };
  }

  const direction = normaliserDirection(intention.direction);

  if (!estNombreFini(intention.horodatageClient) || intention.horodatageClient < 0) {
    return { valide: false, raison: 'L’horodatage client du tir est invalide.' };
  }

  const cadenceRespectee =
    tireur.dernierTirMs <= 0 ||
    maintenantServeurMs - tireur.dernierTirMs >= CADENCE_TIR_SERVEUR_MS;
  if (!cadenceRespectee) {
    return { valide: false, raison: 'La cadence de tir n’est pas respectée.' };
  }

  return {
    valide: true,
    intention: {
      sequence: intention.sequence,
      origine: intention.origine,
      direction,
      horodatageClient: intention.horodatageClient,
    },
  };
}

/** Projette l'origine sur le rayon et retourne la distance paramétrique. */
function distanceParametriqueCible(origine: Readonly<Point3D>, direction: DirectionTir, centre: Readonly<Point3D>): number | null {
  const versCentre = {
    x: centre.x - origine.x,
    y: centre.y - origine.y,
    z: centre.z - origine.z,
  };
  const projection = versCentre.x * direction.x + versCentre.y * direction.y + versCentre.z * direction.z;

  if (projection < 0) {
    return null;
  }

  const centreLePlusProche = {
    x: origine.x + direction.x * projection,
    y: origine.y + direction.y * projection,
    z: origine.z + direction.z * projection,
  };
  const distanceAuCentre = distanceEntre(centreLePlusProche, centre);

  if (distanceAuCentre > RAYON_COLLISION_PIRATE) {
    return null;
  }

  const demiCorde = Math.sqrt(
    Math.max(0, RAYON_COLLISION_PIRATE * RAYON_COLLISION_PIRATE - distanceAuCentre * distanceAuCentre),
  );
  return projection - demiCorde;
}

/**
 * Résout de façon déterministe le premier pirate vivant touché par un rayon,
 * dans la portée du tir. Retourne l'identifiant de la cible ou null.
 */
export function resoudreCibleTiree(
  origine: Readonly<Point3D>,
  direction: DirectionTir,
  pirates: readonly EtatPirateCombat[],
  portee = PORTEE_TIR,
): string | null {
  let cibleId: string | null = null;
  let distanceMinimale = portee;

  for (const pirate of pirates) {
    if (!pirate.vivant) {
      continue;
    }

    const centre = {
      x: pirate.position.x,
      y: pirate.position.y + HAUTEUR_TORSE_PIRATE,
      z: pirate.position.z,
    };
    const distance = distanceParametriqueCible(origine, direction, centre);
    if (distance === null || distance < 0 || distance > portee) {
      continue;
    }

    if (distance < distanceMinimale) {
      distanceMinimale = distance;
      cibleId = pirate.identifiant;
    }
  }

  return cibleId;
}

/** Applique les dégâts d'un tir à un pirate et retourne son nouvel état. */
export function appliquerDegatsPirate(
  pirate: EtatPirateCombat,
  degats = DEGATS_PAR_TIR_PIRATE,
): EtatPirateCombat {
  const sante = Math.max(0, Math.min(SANTE_PIRATE_MAXIMALE, pirate.sante - degats));
  return {
    identifiant: pirate.identifiant,
    position: pirate.position,
    sante,
    vivant: sante > 0,
  };
}

/** Retourne l'état d'un pirate neutralisé (mort). */
export function neutraliserPirate(pirate: EtatPirateCombat): EtatPirateCombat {
  return {
    identifiant: pirate.identifiant,
    position: pirate.position,
    sante: 0,
    vivant: false,
  };
}

/** Applique des dégâts serveur à un joueur et retourne son nouvel état. */
export function appliquerDegatsJoueur(
  joueur: EtatJoueurCombat,
  degats: number,
): EtatJoueurCombat {
  const degatsSains = Number.isFinite(degats) ? Math.max(0, degats) : 0;
  const sante = Math.max(0, Math.min(SANTE_JOUEUR_MAXIMALE, joueur.sante - degatsSains));
  return {
    sessionId: joueur.sessionId,
    sante,
    vivant: sante > 0,
  };
}

/** Retourne l'état d'un joueur après une réapparition complète. */
export function reinitialiserJoueurReapparu(
  joueur: EtatJoueurCombat,
): EtatJoueurCombat {
  return {
    sessionId: joueur.sessionId,
    sante: SANTE_JOUEUR_MAXIMALE,
    vivant: true,
  };
}

/** Indique si la réapparition du joueur est arrivée à échéance. */
export function reapparitionDue(
  maintenantServeurMs: number,
  prochaineReapparitionMs: number,
): boolean {
  return prochaineReapparitionMs > 0 && maintenantServeurMs >= prochaineReapparitionMs;
}

/**
 * Choisit de façon déterministe la prochaine apparition d'un joueur après
 * réapparition, en avançant un index de façon cyclique.
 */
export function choisirReapparition(
  indexActuel: number,
  nombreApparitions: number,
): number {
  if (nombreApparitions <= 0) {
    throw new Error('Aucune apparition disponible pour la réapparition.');
  }

  return (indexActuel + 1) % nombreApparitions;
}
