import { describe, expect, it } from 'vitest';

import {
  bornerAlpha,
  distanceEntre,
  interpolerAngle,
  interpolerNombre,
  interpolerTransformation,
  type TransformationInterpolable,
} from '../apps/client/src/jeu/interpolation';

function transformation(
  modifications: Partial<TransformationInterpolable> = {},
): TransformationInterpolable {
  return {
    position: { x: 0, y: 0, z: 0 },
    lacet: 0,
    tangage: 0,
    roulis: 0,
    ...modifications,
  };
}

describe('interpolation géométrique des pêcheurs distants', () => {
  it('borne l’alpha entre 0 et 1 et traite les valeurs non finies', () => {
    expect(bornerAlpha(-4)).toBe(0);
    expect(bornerAlpha(4)).toBe(1);
    expect(bornerAlpha(Number.NaN)).toBe(0);
    expect(bornerAlpha(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('interpole un nombre sans dépasser la cible', () => {
    expect(interpolerNombre(0, 10, -1)).toBe(0);
    expect(interpolerNombre(0, 10, 2)).toBe(10);
    expect(interpolerNombre(0, 10, 0.5)).toBe(5);
    expect(interpolerNombre(Number.NaN, 10, 0.5)).toBe(5);
    expect(interpolerNombre(0, Number.NaN, 0.5)).toBe(0);
  });

  it('interpole un angle par le chemin le plus court', () => {
    expect(interpolerAngle(Math.PI * 0.9, -Math.PI * 0.9, 0.5)).toBeCloseTo(Math.PI);
    expect(interpolerAngle(0, 2 * Math.PI + 0.2, 1)).toBeCloseTo(2 * Math.PI + 0.2);
    expect(interpolerAngle(0, Math.PI, 0)).toBe(0);
  });

  it('interpole une transformation complète', () => {
    const actuelle = transformation();
    const cible = transformation({
      position: { x: 8, y: 2, z: -4 },
      lacet: Math.PI,
      tangage: -Math.PI / 2,
      roulis: Math.PI / 4,
    });

    const intermédiaire = interpolerTransformation(actuelle, cible, 0.5);
    expect(intermédiaire.position.x).toBe(4);
    expect(intermédiaire.position.y).toBe(1);
    expect(intermédiaire.position.z).toBe(-2);
    expect(intermédiaire.lacet).toBeCloseTo(Math.PI / 2);
    expect(intermédiaire.tangage).toBeCloseTo(-Math.PI / 4);
    expect(intermédiaire.roulis).toBeCloseTo(Math.PI / 8);
  });

  it('calcule une distance euclidienne', () => {
    expect(distanceEntre({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
  });
});
