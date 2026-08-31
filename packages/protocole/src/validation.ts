import type { MessagePing, MessageTransformationJoueur } from './messages.js';

export const TAILLE_MAX_GRAINE = 64;
export const TAILLE_MAX_IDENTIFIANT = 128;
export const TAILLE_MAX_NOM = 32;
export const LIMITE_HORODATAGE = 4_102_444_800_000;
export const POSITION_MAXIMALE = 10_000;
export const VITESSE_MAXIMALE_JOUEUR = 20;

export interface OptionsConnexion {
  readonly graine?: string;
  readonly nom?: string;
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

  if (!possedeUniquement(valeur, ['graine', 'nom'])) {
    return resultatErreur('Les options de connexion contiennent un champ inconnu.');
  }

  if (valeur.graine !== undefined && !estChaineBorne(valeur.graine, TAILLE_MAX_GRAINE)) {
    return resultatErreur('La graine de connexion est invalide ou trop longue.');
  }

  if (valeur.nom !== undefined && !estChaineBorne(valeur.nom, TAILLE_MAX_NOM)) {
    return resultatErreur('Le nom de connexion est invalide ou trop long.');
  }

  return {
    valide: true,
    valeur: {
      ...(valeur.graine === undefined ? {} : { graine: valeur.graine }),
      ...(valeur.nom === undefined ? {} : { nom: valeur.nom }),
    },
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

function estNombreBorné(valeur: unknown, maximum: number): valeur is number {
  return typeof valeur === 'number' && Number.isFinite(valeur) && Math.abs(valeur) <= maximum;
}

function estAngleBorné(valeur: unknown): valeur is number {
  return (
    typeof valeur === 'number' &&
    Number.isFinite(valeur) &&
    Math.abs(valeur) <= Math.PI * 2 + 0.001
  );
}

function estPositionValide(valeur: unknown): valeur is MessageTransformationJoueur['position'] {
  if (!estObjetSimple(valeur)) {
    return false;
  }

  const position = valeur as Record<string, unknown>;
  return (
    possedeUniquement(position, ['x', 'y', 'z']) &&
    estNombreBorné(position.x, POSITION_MAXIMALE) &&
    estNombreBorné(position.y, POSITION_MAXIMALE) &&
    estNombreBorné(position.z, POSITION_MAXIMALE)
  );
}

export function validerMessageTransformationJoueur(
  valeur: unknown,
): ResultatValidation<MessageTransformationJoueur> {
  if (!estObjetSimple(valeur)) {
    return resultatErreur('La transformation de joueur doit être un objet.');
  }

  if (
    !possedeUniquement(valeur, ['position', 'lacet', 'tangage', 'roulis', 'horodatage']) ||
    !('position' in valeur) ||
    !('lacet' in valeur) ||
    !('tangage' in valeur) ||
    !('roulis' in valeur) ||
    !('horodatage' in valeur)
  ) {
    return resultatErreur(
      'La transformation de joueur doit contenir uniquement position, lacet, tangage, roulis et horodatage.',
    );
  }

  if (!estPositionValide(valeur.position)) {
    return resultatErreur('La position de la transformation de joueur est invalide.');
  }

  if (!estAngleBorné(valeur.lacet) || !estAngleBorné(valeur.tangage) || !estAngleBorné(valeur.roulis)) {
    return resultatErreur('Les angles de la transformation de joueur sont invalides.');
  }

  if (
    typeof valeur.horodatage !== 'number' ||
    !Number.isFinite(valeur.horodatage) ||
    !Number.isSafeInteger(valeur.horodatage) ||
    valeur.horodatage < 0 ||
    valeur.horodatage > LIMITE_HORODATAGE
  ) {
    return resultatErreur('L’horodatage de la transformation de joueur est invalide ou trop grand.');
  }

  const position = valeur.position as MessageTransformationJoueur['position'];
  return {
    valide: true,
    valeur: {
      position: { x: position.x, y: position.y, z: position.z },
      lacet: valeur.lacet,
      tangage: valeur.tangage,
      roulis: valeur.roulis,
      horodatage: valeur.horodatage,
    },
  };
}

export function estMessageTransformationJoueurValide(
  valeur: unknown,
): valeur is MessageTransformationJoueur {
  return validerMessageTransformationJoueur(valeur).valide;
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
