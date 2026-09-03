export const NOM_SALLE_JEU = 'jeu';

export const NOMS_MESSAGES = Object.freeze({
  ping: 'salle:ping',
  pong: 'salle:pong',
  transformationJoueur: 'joueur:transformation',
  intentionTir: 'jeu:intention-tir',
  resultatTir: 'jeu:resultat-tir',
  lancerPeche: 'jeu:peche-lancer',
  releverPeche: 'jeu:peche-relever',
  annulerPeche: 'jeu:peche-annuler',
  resultatPeche: 'jeu:peche-resultat',
  preparerPecheE2E: 'jeu:e2e-preparer-peche',
  avancerPecheE2E: 'jeu:e2e-avancer-peche',
  degatsE2E: 'jeu:e2e-degats',
} as const);

export type NomMessage = (typeof NOMS_MESSAGES)[keyof typeof NOMS_MESSAGES];

export interface MessagePing {
  readonly horodatage: number;
}

export interface MessagePong {
  readonly horodatage: number;
}

export interface PositionJoueur {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MessageTransformationJoueur {
  readonly position: PositionJoueur;
  readonly lacet: number;
  readonly tangage: number;
  readonly roulis: number;
  readonly horodatage: number;
}

/** Intention de tir soumise au serveur par un client. */
export interface MessageIntentionTir {
  readonly sequence: number;
  readonly origineX: number;
  readonly origineY: number;
  readonly origineZ: number;
  readonly directionX: number;
  readonly directionY: number;
  readonly directionZ: number;
  readonly horodatageClient: number;
}

/** Résultat d'un tir renvoyé par le serveur au joueur qui a tiré. */
export interface MessageResultatTir {
  readonly sequence: number;
  readonly cibleId: string | null;
  readonly degats: number;
  readonly pirateNeutralise: boolean;
  readonly horodatageServeur: number;
}

export type PhasePecheReseau = 'inactive' | 'attente' | 'morsure' | 'terminee';
export type ResultatPecheReseau = 'prise' | 'trop_tot' | 'trop_tard' | 'hors_zone' | 'annulee';

/** Commande de lancer : l'identité, la phase et les temps sont ajoutés par le serveur. */
export interface MessageLancerPeche {
  readonly sequence: number;
  readonly zoneId: string;
  readonly origineX: number;
  readonly origineY: number;
  readonly origineZ: number;
  readonly directionX: number;
  readonly directionY: number;
  readonly directionZ: number;
  readonly flotteurX: number;
  readonly flotteurY: number;
  readonly flotteurZ: number;
}

export interface MessageReleverPeche {
  readonly sequence: number;
}

export interface MessageAnnulerPeche {
  readonly sequence: number;
}

/** Résultat calculé par le serveur et observé par tous les clients de la salle. */
export interface MessageResultatPeche {
  readonly joueurId: string;
  readonly sequence: number;
  readonly zoneId: string;
  readonly resultat: ResultatPecheReseau;
  readonly horodatageServeur: number;
  readonly espece?: 'sardine' | 'maquereau' | 'thon';
  readonly taille?: number;
}

/** Commande réservée au harnais E2E : le serveur choisit lui-même la zone. */
export interface MessagePreparerPecheE2E {
  readonly preparation: true;
}

/** Message E2E réservé au mode de test : avance l’horloge de pêche. */
export interface MessageAvancerPecheE2E {
  readonly deltaMs: number;
}

/** Message E2E réservé au mode de test : inflige des dégâts à un joueur. */
export interface MessageDegatsE2E {
  readonly degats: number;
}
