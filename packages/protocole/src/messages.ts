export const NOM_SALLE_JEU = 'jeu';

export const NOMS_MESSAGES = Object.freeze({
  ping: 'salle:ping',
  pong: 'salle:pong',
} as const);

export type NomMessage = (typeof NOMS_MESSAGES)[keyof typeof NOMS_MESSAGES];

export interface MessagePing {
  readonly horodatage: number;
}

export interface MessagePong {
  readonly horodatage: number;
}
