/** Messages et types réseau pour la synchronisation du pilotage autoritaire du bateau. */

/** Types de refus de prise de barre. */
export type MotifRefusBarre =
  | 'distance'
  | 'barre-occupee'
  | 'deja-pilote'
  | 'invalide';

/** Message client → serveur : demande de prise de barre. */
export interface MessageDemandeBarre {
  readonly bateauId: string;
}

/** Message client → serveur : libération de la barre. */
export interface MessageLiberationBarre {
  readonly bateauId: string;
}

/** Message client → serveur : intention de pilotage séquencée. */
export interface MessageIntentionPilotage {
  readonly bateauId: string;
  readonly sequence: number;
  readonly poussee: number;
  readonly gouvernail: number;
  readonly horodatageClient: number;
}

/** Statut de la barre d'un bateau. */
export type StatutBarre = 'libre' | 'occupee';

/** Message serveur → tous : état de la barre d'un bateau. */
export interface MessageEtatBarre {
  readonly bateauId: string;
  readonly piloteSessionId: string;
  readonly piloteNom: string;
  readonly statut: StatutBarre;
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly rotationY: number;
  readonly vitesse: number;
  readonly vitesseAngulaire: number;
  readonly sequence: number;
}

/** Constantes de validation du pilotage autoritaire. */
export const DISTANCE_MAXIMALE_BARRE = 5;
export const CADENCE_PILOTAGE_SERVEUR_MS = 50;
export const POUSSEE_MINIMALE = -1;
export const POUSSEE_MAXIMALE = 1;
export const GOUVERNAIL_MINIMALE = -1;
export const GOUVERNAIL_MAXIMALE = 1;
export const SEQUENCE_MAX_PILOTAGE = 1_000_000;

/** Résultat de validation d'une intention de pilotage côté serveur. */
export type ResultatValidationPilotage =
  | { readonly valide: true; readonly intention: MessageIntentionPilotage }
  | { readonly valide: false; readonly raison: string };

/** État serveur d'un bateau pour la validation du pilotage. */
export interface EtatBateauServeur {
  readonly sessionIdProprietaire: string;
  readonly sessionIdPilote: string | null;
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly rotationY: number;
  readonly vitesse: number;
  readonly vitesseAngulaire: number;
  readonly dernierSequencePilote: number;
  readonly dernierEnvoiMs: number;
}

/** Valide la forme d'un message de demande de barre. */
export function validerMessageDemandeBarre(
  valeur: unknown,
): valeur is MessageDemandeBarre {
  if (typeof valeur !== 'object' || valeur === null) {
    return false;
  }
  const objet = valeur as Record<string, unknown>;
  return (
    'bateauId' in objet &&
    typeof objet.bateauId === 'string' &&
    objet.bateauId.length > 0 &&
    objet.bateauId.length <= 128
  );
}

/** Valide la forme d'un message de libération de barre. */
export function validerMessageLiberationBarre(
  valeur: unknown,
): valeur is MessageLiberationBarre {
  if (typeof valeur !== 'object' || valeur === null) {
    return false;
  }
  const objet = valeur as Record<string, unknown>;
  return (
    'bateauId' in objet &&
    typeof objet.bateauId === 'string' &&
    objet.bateauId.length > 0 &&
    objet.bateauId.length <= 128
  );
}

/** Valide et normalise une intention de pilotage côté serveur. */
export function validerIntentionPilotage(
  valeur: unknown,
  etat: EtatBateauServeur,
  maintenantMs: number,
): ResultatValidationPilotage {
  if (typeof valeur !== 'object' || valeur === null) {
    return { valide: false, raison: 'L\'intention de pilotage doit être un objet.' };
  }
  const objet = valeur as Record<string, unknown>;

  if (
    !('bateauId' in objet) || typeof objet.bateauId !== 'string' ||
    !('sequence' in objet) || typeof objet.sequence !== 'number' ||
    !Number.isSafeInteger(objet.sequence) || objet.sequence < 1
  ) {
    return { valide: false, raison: 'Les champs bateauId ou sequence sont invalides.' };
  }

  if (objet.sequence > SEQUENCE_MAX_PILOTAGE) {
    return { valide: false, raison: 'La séquence de pilotage est trop grande.' };
  }

  if (objet.sequence <= etat.dernierSequencePilote) {
    return { valide: false, raison: 'La séquence de pilotage est déjà consommée.' };
  }

  const poussee = typeof objet.poussee === 'number' ? objet.poussee : NaN;
  const gouvernail = typeof objet.gouvernail === 'number' ? objet.gouvernail : NaN;

  if (!Number.isFinite(poussee) || !Number.isFinite(gouvernail)) {
    return { valide: false, raison: 'Les valeurs de poussée ou gouvernail sont invalides.' };
  }

  if (poussee < POUSSEE_MINIMALE || poussee > POUSSEE_MAXIMALE ||
      gouvernail < GOUVERNAIL_MINIMALE || gouvernail > GOUVERNAIL_MAXIMALE) {
    return { valide: false, raison: 'Les valeurs de poussée ou gouvernail sont hors limites.' };
  }

  if (etat.dernierEnvoiMs > 0 && maintenantMs - etat.dernierEnvoiMs < CADENCE_PILOTAGE_SERVEUR_MS) {
    return { valide: false, raison: 'La cadence de pilotage n\'est pas respectée.' };
  }

  return {
    valide: true,
    intention: {
      bateauId: objet.bateauId as string,
      sequence: objet.sequence as number,
      poussee: Math.max(POUSSEE_MINIMALE, Math.min(POUSSEE_MAXIMALE, poussee)),
      gouvernail: Math.max(GOUVERNAIL_MINIMALE, Math.min(GOUVERNAIL_MAXIMALE, gouvernail)),
      horodatageClient: typeof objet.horodatageClient === 'number' ? objet.horodatageClient : maintenantMs,
    },
  };
}
