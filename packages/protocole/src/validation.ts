import type {
  MessageAnnulerPeche,
  MessageAvancerPecheE2E,
  MessageDegatsE2E,
  MessageIntentionTir,
  MessageLancerPeche,
  MessagePing,
  MessagePositionE2E,
  MessagePreparerPecheE2E,
  MessageReleverPeche,
  MessageTransformationJoueur,
} from './messages.js';
import { SANTE_JOUEUR_MAXIMALE } from './schemas.js';

export const TAILLE_MAX_GRAINE = 64;
export const TAILLE_MAX_IDENTIFIANT = 128;
export const TAILLE_MAX_NOM = 32;
export const LIMITE_HORODATAGE = 4_102_444_800_000;
export const POSITION_MAXIMALE = 10_000;
export const VITESSE_MAXIMALE_JOUEUR = 20;
export const LIMITE_ORIGINE_ABS = 1_000_000;
export const LIMITE_SEQUENCE_TIR = 1_000_000;
export const LIMITE_SEQUENCE_PECHE = 1_000_000;
export const TAILLE_MAX_ZONE_PECHE = 128;
export const LIMITE_FLOTTEUR_ABS = 10_000;
export const TOLERANCE_DIRECTION_NORMALISEE = 0.001;

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
    typeof valeur === 'number' && Number.isFinite(valeur) && Math.abs(valeur) <= Math.PI * 2 + 0.001
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

  if (
    !estAngleBorné(valeur.lacet) ||
    !estAngleBorné(valeur.tangage) ||
    !estAngleBorné(valeur.roulis)
  ) {
    return resultatErreur('Les angles de la transformation de joueur sont invalides.');
  }

  if (
    typeof valeur.horodatage !== 'number' ||
    !Number.isFinite(valeur.horodatage) ||
    !Number.isSafeInteger(valeur.horodatage) ||
    valeur.horodatage < 0 ||
    valeur.horodatage > LIMITE_HORODATAGE
  ) {
    return resultatErreur(
      'L’horodatage de la transformation de joueur est invalide ou trop grand.',
    );
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

function estNombreFiniBorne(valeur: unknown, borneAbsolue: number): valeur is number {
  return typeof valeur === 'number' && Number.isFinite(valeur) && Math.abs(valeur) <= borneAbsolue;
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

  const longueurDirection = Math.hypot(valeur.directionX, valeur.directionY, valeur.directionZ);
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

export function estMessageIntentionTirValide(valeur: unknown): valeur is MessageIntentionTir {
  return validerMessageIntentionTir(valeur).valide;
}

function estSequencePeche(valeur: unknown): valeur is number {
  return (
    typeof valeur === 'number' &&
    Number.isSafeInteger(valeur) &&
    valeur >= 1 &&
    valeur <= LIMITE_SEQUENCE_PECHE
  );
}

function estVecteurNormalise(x: unknown, y: unknown, z: unknown): boolean {
  if (
    !estNombreFiniBorne(x, LIMITE_ORIGINE_ABS) ||
    !estNombreFiniBorne(y, LIMITE_ORIGINE_ABS) ||
    !estNombreFiniBorne(z, LIMITE_ORIGINE_ABS)
  ) {
    return false;
  }
  const longueur = Math.hypot(x, y, z);
  return longueur > Number.EPSILON && Math.abs(longueur - 1) <= TOLERANCE_DIRECTION_NORMALISEE;
}

function estZonePeche(valeur: unknown): valeur is string {
  return estChaineBorne(valeur, TAILLE_MAX_ZONE_PECHE);
}

function estPointFlotteur(valeur: unknown): valeur is number {
  return estNombreFiniBorne(valeur, LIMITE_FLOTTEUR_ABS);
}

export function validerMessageLancerPeche(valeur: unknown): ResultatValidation<MessageLancerPeche> {
  const clefs = [
    'sequence',
    'zoneId',
    'origineX',
    'origineY',
    'origineZ',
    'directionX',
    'directionY',
    'directionZ',
    'flotteurX',
    'flotteurY',
    'flotteurZ',
  ] as const;
  if (!estObjetSimple(valeur) || !possedeUniquement(valeur, clefs)) {
    return resultatErreur('Le lancer de pêche contient des champs invalides ou inconnus.');
  }
  for (const clef of clefs) {
    if (!(clef in valeur)) {
      return resultatErreur('Le lancer de pêche doit contenir ' + clef + '.');
    }
  }
  if (!estSequencePeche(valeur.sequence)) {
    return resultatErreur('La séquence de pêche est invalide.');
  }
  if (!estZonePeche(valeur.zoneId)) {
    return resultatErreur('La zone de pêche est invalide ou trop longue.');
  }
  if (
    !estNombreFiniBorne(valeur.origineX, LIMITE_ORIGINE_ABS) ||
    !estNombreFiniBorne(valeur.origineY, LIMITE_ORIGINE_ABS) ||
    !estNombreFiniBorne(valeur.origineZ, LIMITE_ORIGINE_ABS)
  ) {
    return resultatErreur('L’origine de pêche est invalide.');
  }
  if (!estVecteurNormalise(valeur.directionX, valeur.directionY, valeur.directionZ)) {
    return resultatErreur('La direction de pêche doit être normalisée et finie.');
  }
  if (
    !estPointFlotteur(valeur.flotteurX) ||
    !estPointFlotteur(valeur.flotteurY) ||
    !estPointFlotteur(valeur.flotteurZ)
  ) {
    return resultatErreur('La position du flotteur est invalide.');
  }
  return {
    valide: true,
    valeur: {
      sequence: valeur.sequence,
      zoneId: valeur.zoneId,
      origineX: valeur.origineX,
      origineY: valeur.origineY,
      origineZ: valeur.origineZ,
      directionX: valeur.directionX as number,
      directionY: valeur.directionY as number,
      directionZ: valeur.directionZ as number,
      flotteurX: valeur.flotteurX,
      flotteurY: valeur.flotteurY,
      flotteurZ: valeur.flotteurZ,
    },
  };
}

export function estMessageLancerPecheValide(valeur: unknown): valeur is MessageLancerPeche {
  return validerMessageLancerPeche(valeur).valide;
}

function validerCommandePeche(
  valeur: unknown,
  nom: string,
): ResultatValidation<{ readonly sequence: number }> {
  if (
    !estObjetSimple(valeur) ||
    !possedeUniquement(valeur, ['sequence']) ||
    !('sequence' in valeur)
  ) {
    return resultatErreur(`La commande ${nom} doit contenir uniquement sequence.`);
  }
  if (!estSequencePeche(valeur.sequence)) {
    return resultatErreur(`La séquence de la commande ${nom} est invalide.`);
  }
  return { valide: true, valeur: { sequence: valeur.sequence } };
}

export function validerMessageReleverPeche(
  valeur: unknown,
): ResultatValidation<MessageReleverPeche> {
  return validerCommandePeche(valeur, 'relevé');
}

export function estMessageReleverPecheValide(valeur: unknown): valeur is MessageReleverPeche {
  return validerMessageReleverPeche(valeur).valide;
}

export function validerMessageAnnulerPeche(
  valeur: unknown,
): ResultatValidation<MessageAnnulerPeche> {
  return validerCommandePeche(valeur, 'annulation');
}

export function estMessageAnnulerPecheValide(valeur: unknown): valeur is MessageAnnulerPeche {
  return validerMessageAnnulerPeche(valeur).valide;
}

export function validerMessagePreparerPecheE2E(
  valeur: unknown,
): ResultatValidation<MessagePreparerPecheE2E> {
  if (
    !estObjetSimple(valeur) ||
    !possedeUniquement(valeur, ['preparation']) ||
    valeur.preparation !== true
  ) {
    return resultatErreur('La préparation E2E de pêche est invalide.');
  }
  return { valide: true, valeur: { preparation: true } };
}

export function estMessagePreparerPecheE2EValide(
  valeur: unknown,
): valeur is MessagePreparerPecheE2E {
  return validerMessagePreparerPecheE2E(valeur).valide;
}

/** Valide l’avance d’horloge réservée au harnais E2E. */
export function validerMessageAvancerPecheE2E(
  valeur: unknown,
): ResultatValidation<MessageAvancerPecheE2E> {
  if (!estObjetSimple(valeur) || !possedeUniquement(valeur, ['deltaMs'])) {
    return resultatErreur('Le message E2E d’avance doit contenir uniquement deltaMs.');
  }
  if (
    typeof valeur.deltaMs !== 'number' ||
    !Number.isFinite(valeur.deltaMs) ||
    valeur.deltaMs < 0 ||
    valeur.deltaMs > 60_000
  ) {
    return resultatErreur('L’avance d’horloge E2E est invalide.');
  }
  return { valide: true, valeur: { deltaMs: valeur.deltaMs } };
}

export function estMessageAvancerPecheE2EValide(
  valeur: unknown,
): valeur is MessageAvancerPecheE2E {
  return validerMessageAvancerPecheE2E(valeur).valide;
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

/** Valide la position du harnais E2E, sans l’ouvrir aux clients de production. */
export function validerMessagePositionE2E(valeur: unknown): ResultatValidation<MessagePositionE2E> {
  if (
    !estObjetSimple(valeur) ||
    !possedeUniquement(valeur, ['position']) ||
    !('position' in valeur)
  ) {
    return resultatErreur('Le message E2E de position doit contenir uniquement position.');
  }

  if (!estPositionValide(valeur.position)) {
    return resultatErreur('La position E2E est invalide.');
  }

  const position = valeur.position;
  return {
    valide: true,
    valeur: { position: { x: position.x, y: position.y, z: position.z } },
  };
}

export function estMessagePositionE2EValide(valeur: unknown): valeur is MessagePositionE2E {
  return validerMessagePositionE2E(valeur).valide;
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
