export const NOM_SALLE_JEU = 'jeu';

export const NOMS_MESSAGES = Object.freeze({
  ping: 'salle:ping',
  pong: 'salle:pong',
  transformationJoueur: 'joueur:transformation',
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
