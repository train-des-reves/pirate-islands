export const NOM_SALLE_JEU = 'jeu';

export const NOMS_MESSAGES = Object.freeze({
  ping: 'salle:ping',
  pong: 'salle:pong',
  transformationJoueur: 'joueur:transformation',
  intentionTir: 'jeu:intention-tir',
  resultatTir: 'jeu:resultat-tir',
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

/** Message E2E réservé au mode de test : inflige des dégâts à un joueur. */
export interface MessageDegatsE2E {
  readonly degats: number;
}
