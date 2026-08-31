import type { MessageDegatsE2E, MessageIntentionTir, MessagePing } from './messages.js';
import { SANTE_JOUEUR_MAXIMALE } from './schemas.js';

export const TAILLE_MAX_GRAINE = 64;
export const TAILLE_MAX_IDENTIFIANT = 128;
export const LIMITE_HORODATAGE = 4_102_444_800_000;
export const LIMITE_ORIGINE_ABS = 1_000_000;
export const LIMITE_SEQUENCE_TIR = 1_000_000;

export interface OptionsConnexion {
  readonly graine?: string;
}

export type ResultatValidation<T> =
  | { readonly valide: true; readonly valeur: T }
  | { readonly valide: false; readonly erreurs: readonly string[] };

function estObjetSimple(valeur: unknown): valeur is Record<string, unknown> {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(valeur);
  return prototype === Object.prototype || prototype === null;
}

function possedeUniquement(objet: Record<string, unknown>, clefs: readonly string[]): boolean {
  const autorisees = new Set(clefs);
  return Object.keys(objet).every((clef) => autorisees.has(clef));
}

function estChaineBorne(valeur: unknown, tailleMaximale: number): valeur is string {
  return (
    typeof valeur === 'string' &&
    valeur.length > 0 &&
    valeur.length <= tailleMaximale &&
    valeur.trim() === valeur
  );
}

function resultatErreur<T>(...erreurs: string[]): ResultatValidation<T> {
  return { valide: false, erreurs };
}

export function validerOptionsConnexion(valeur: unknown): ResultatValidation<OptionsConnexion> {
  if (valeur === undefined) {
    return { valide: true, valeur: {} };
  }

  if (!estObjetSimple(valeur)) {
    return resultatErreur('Les options de connexion doivent être un objet.');
  }

  if (!possedeUniquement(valeur, ['graine'])) {
    return resultatErreur('Les options de connexion contiennent un champ inconnu.');
  }

  if (valeur.graine !== undefined && !estChaineBorne(valeur.graine, TAILLE_MAX_GRAINE)) {
    return resultatErreur('La graine de connexion est invalide ou trop longue.');
  }

  return {
    valide: true,
    valeur: valeur.graine === undefined ? {} : { graine: valeur.graine },
  };
}

export function estOptionsConnexionValides(valeur: unknown): valeur is OptionsConnexion {
  return validerOptionsConnexion(valeur).valide;
}

export function validerMessagePing(valeur: unknown): ResultatValidation<MessagePing> {
  if (!estObjetSimple(valeur)) {
    return resultatErreur('Le ping doit être un objet.');
  }

  if (!possedeUniquement(valeur, ['horodatage']) || !('horodatage' in valeur)) {
    return resultatErreur('Le ping doit contenir uniquement horodatage.');
  }

  if (
    typeof valeur.horodatage !== 'number' ||
    !Number.isFinite(valeur.horodatage) ||
    !Number.isSafeInteger(valeur.horodatage) ||
    valeur.horodatage < 0 ||
    valeur.horodatage > LIMITE_HORODATAGE
  ) {
    return resultatErreur('L’horodatage du ping est invalide ou trop grand.');
  }

  return { valide: true, valeur: { horodatage: valeur.horodatage } };
}

export function estMessagePingValide(valeur: unknown): valeur is MessagePing {
  return validerMessagePing(valeur).valide;
}

function estNombreFiniBorne(valeur: unknown, borneAbsolue: number): valeur is number {
  return (
    typeof valeur === 'number' &&
    Number.isFinite(valeur) &&
    Math.abs(valeur) <= borneAbsolue
  );
}

/** Valide une intention de tir côté serveur, indépendamment du gameplay. */
export function validerMessageIntentionTir(
  valeur: unknown,
): ResultatValidation<MessageIntentionTir> {
  if (!estObjetSimple(valeur)) {
    return resultatErreur('L’intention de tir doit être un objet.');
  }

  const clefs = [
    'sequence',
    'origineX',
    'origineY',
    'origineZ',
    'directionX',
    'directionY',
    'directionZ',
    'horodatageClient',
  ] as const;
  if (!possedeUniquement(valeur, clefs)) {
    return resultatErreur('L’intention de tir contient un champ inconnu.');
  }

  for (const clef of clefs) {
    if (!(clef in valeur)) {
      return resultatErreur('L’intention de tir doit contenir ' + clef + '.');
    }
  }

  if (
    typeof valeur.sequence !== 'number' ||
    !Number.isSafeInteger(valeur.sequence) ||
    valeur.sequence < 1 ||
    valeur.sequence > LIMITE_SEQUENCE_TIR
  ) {
    return resultatErreur('La séquence de l’intention de tir est invalide.');
  }

  if (
    typeof valeur.origineX !== 'number' ||
    typeof valeur.origineY !== 'number' ||
    typeof valeur.origineZ !== 'number' ||
    !estNombreFiniBorne(valeur.origineX, LIMITE_ORIGINE_ABS) ||
    !estNombreFiniBorne(valeur.origineY, LIMITE_ORIGINE_ABS) ||
    !estNombreFiniBorne(valeur.origineZ, LIMITE_ORIGINE_ABS)
  ) {
    return resultatErreur('L’origine de l’intention de tir est invalide.');
  }

  if (
    typeof valeur.directionX !== 'number' ||
    typeof valeur.directionY !== 'number' ||
    typeof valeur.directionZ !== 'number' ||
    !estNombreFiniBorne(valeur.directionX, LIMITE_ORIGINE_ABS) ||
    !estNombreFiniBorne(valeur.directionY, LIMITE_ORIGINE_ABS) ||
    !estNombreFiniBorne(valeur.directionZ, LIMITE_ORIGINE_ABS)
  ) {
    return resultatErreur('La direction de l’intention de tir est invalide.');
  }

  const longueurDirection = Math.hypot(
    valeur.directionX,
    valeur.directionY,
    valeur.directionZ,
  );
  if (!(longueurDirection > Number.EPSILON)) {
    return resultatErreur('La direction de l’intention de tir est nulle.');
  }

  if (
    typeof valeur.horodatageClient !== 'number' ||
    !Number.isFinite(valeur.horodatageClient) ||
    valeur.horodatageClient < 0 ||
    valeur.horodatageClient > LIMITE_HORODATAGE
  ) {
    return resultatErreur('L’horodatage client de l’intention de tir est invalide.');
  }

  return {
    valide: true,
    valeur: {
      sequence: valeur.sequence,
      origineX: valeur.origineX,
      origineY: valeur.origineY,
      origineZ: valeur.origineZ,
      directionX: valeur.directionX,
      directionY: valeur.directionY,
      directionZ: valeur.directionZ,
      horodatageClient: valeur.horodatageClient,
    },
  };
}

export function estMessageIntentionTirValide(
  valeur: unknown,
): valeur is MessageIntentionTir {
  return validerMessageIntentionTir(valeur).valide;
}

/** Valide la forme d'un message E2E de dégâts, réservé au mode de test. */
export function validerMessageDegatsE2E(valeur: unknown): ResultatValidation<MessageDegatsE2E> {
  if (!estObjetSimple(valeur) || !possedeUniquement(valeur, ['degats']) || !('degats' in valeur)) {
    return resultatErreur('Le message E2E de dégâts doit contenir uniquement degats.');
  }

  if (
    typeof valeur.degats !== 'number' ||
    !Number.isFinite(valeur.degats) ||
    valeur.degats < 0 ||
    valeur.degats > SANTE_JOUEUR_MAXIMALE
  ) {
    return resultatErreur('Les dégâts E2E sont invalides.');
  }

  return { valide: true, valeur: { degats: valeur.degats } };
}

export function estMessageDegatsE2EValide(valeur: unknown): valeur is MessageDegatsE2E {
  return validerMessageDegatsE2E(valeur).valide;
}

export function validerIdentifiantSalle(valeur: unknown): ResultatValidation<string> {
  if (!estChaineBorne(valeur, TAILLE_MAX_IDENTIFIANT)) {
    return resultatErreur('L’identifiant de salle est invalide.');
  }

  return { valide: true, valeur };
}

export function validerOptionsSalleJeu(valeur: unknown): ResultatValidation<OptionsConnexion> {
  return validerOptionsConnexion(valeur);
}
