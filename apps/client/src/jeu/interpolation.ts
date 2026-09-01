import type { Vecteur3 } from './mouvement';

export interface TransformationInterpolable {
  readonly position: Vecteur3;
  readonly lacet: number;
  readonly tangage: number;
  readonly roulis: number;
}

export interface DonneesInterpolation {
  readonly transformation: TransformationInterpolable;
  readonly horodatage: number;
}

export function bornerAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) {
    return 0;
  }
  return Math.max(0, Math.min(1, alpha));
}

export function interpolerNombre(actuel: number, cible: number, alpha: number): number {
  const alphaSain = bornerAlpha(alpha);
  const actuelSain = Number.isFinite(actuel) ? actuel : 0;
  const cibleSaine = Number.isFinite(cible) ? cible : actuelSain;
  return actuelSain + (cibleSaine - actuelSain) * alphaSain;
}

function angleLePlusCourt(angle: number): number {
  const deuxPi = Math.PI * 2;
  let normalisé = ((angle % deuxPi) + deuxPi) % deuxPi;
  if (normalisé > Math.PI) {
    normalisé -= deuxPi;
  }
  return normalisé;
}

export function interpolerAngle(actuel: number, cible: number, alpha: number): number {
  const actuelSain = Number.isFinite(actuel) ? actuel : 0;
  const cibleSaine = Number.isFinite(cible) ? cible : actuelSain;
  const alphaSain = bornerAlpha(alpha);
  if (alphaSain >= 1) {
    return cibleSaine;
  }
  return actuelSain + angleLePlusCourt(cibleSaine - actuelSain) * alphaSain;
}

export function interpolerTransformation(
  actuelle: TransformationInterpolable,
  cible: TransformationInterpolable,
  alpha: number,
): TransformationInterpolable {
  return {
    position: {
      x: interpolerNombre(actuelle.position.x, cible.position.x, alpha),
      y: interpolerNombre(actuelle.position.y, cible.position.y, alpha),
      z: interpolerNombre(actuelle.position.z, cible.position.z, alpha),
    },
    lacet: interpolerAngle(actuelle.lacet, cible.lacet, alpha),
    tangage: interpolerAngle(actuelle.tangage, cible.tangage, alpha),
    roulis: interpolerAngle(actuelle.roulis, cible.roulis, alpha),
  };
}

export function distanceEntre(a: Vecteur3, b: Vecteur3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
