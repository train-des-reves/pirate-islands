export const AXES = {
  x: 'est-ouest',
  y: 'vertical',
  z: 'nord-sud',
} as const;

export type Axe = keyof typeof AXES;

export const UNITES = {
  distance: 'unité monde',
  temps: 'seconde',
  vitesse: 'unité monde par seconde',
} as const;

export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function creerPoint3D(x: number, y: number, z: number): Point3D {
  return { x, y, z };
}

export * from './monde.js';
