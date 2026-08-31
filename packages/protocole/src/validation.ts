import type { MessagePing } from './messages.js';

export const TAILLE_MAX_GRAINE = 64;
export const TAILLE_MAX_IDENTIFIANT = 128;
export const LIMITE_HORODATAGE = 4_102_444_800_000;

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

export function validerIdentifiantSalle(valeur: unknown): ResultatValidation<string> {
  if (!estChaineBorne(valeur, TAILLE_MAX_IDENTIFIANT)) {
    return resultatErreur('L’identifiant de salle est invalide.');
  }

  return { valide: true, valeur };
}

export function validerOptionsSalleJeu(valeur: unknown): ResultatValidation<OptionsConnexion> {
  return validerOptionsConnexion(valeur);
}
