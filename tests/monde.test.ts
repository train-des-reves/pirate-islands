import { describe, expect, it } from 'vitest';

import {
  GRAINE_MVP_PAR_DEFAUT,
  NOMBRE_ILES_MVP,
  apparitionValide,
  genererMonde,
  pointDansCollisionIle,
} from '@pirate/coeur-jeu';

function distanceHorizontale(
  première: { readonly x: number; readonly z: number },
  seconde: { readonly x: number; readonly z: number },
): number {
  return Math.hypot(première.x - seconde.x, première.z - seconde.z);
}

describe('monde déterministe', () => {
  it('reproduit exactement le monde de la graine MVP', () => {
    const premierMonde = genererMonde(GRAINE_MVP_PAR_DEFAUT);
    const secondMonde = genererMonde('mvp-defaut');

    expect(premierMonde).toEqual(secondMonde);
    expect(premierMonde.iles).toHaveLength(NOMBRE_ILES_MVP);
    expect(premierMonde.marqueurs).toHaveLength(NOMBRE_ILES_MVP);
    expect(Object.isFrozen(premierMonde)).toBe(true);
    expect(Object.isFrozen(premierMonde.iles)).toBe(true);
    expect(Object.isFrozen(premierMonde.iles[0])).toBe(true);
  });

  it('conserve des identifiants uniques, des marqueurs associés et une séparation sûre', () => {
    const monde = genererMonde();
    const identifiants = monde.iles.map((ile) => ile.id);

    expect(new Set(identifiants).size).toBe(NOMBRE_ILES_MVP);
    expect(monde.marqueurs.map((marqueur) => marqueur.ileId)).toEqual(identifiants);

    for (let premierIndex = 0; premierIndex < monde.iles.length; premierIndex += 1) {
      const première = monde.iles[premierIndex];
      if (!première) {
        continue;
      }

      for (let secondIndex = premierIndex + 1; secondIndex < monde.iles.length; secondIndex += 1) {
        const seconde = monde.iles[secondIndex];
        if (!seconde) {
          continue;
        }

        const rayonPremière = Math.max(première.rayonX, première.rayonZ);
        const rayonSeconde = Math.max(seconde.rayonX, seconde.rayonZ);
        const séparation = distanceHorizontale(
          première.transformation.position,
          seconde.transformation.position,
        );

        expect(séparation).toBeGreaterThan(rayonPremière + rayonSeconde + 8);
      }
    }
  });

  it('produit des transformations finies et des apparitions sur la terre', () => {
    const monde = genererMonde();

    for (const ile of monde.iles) {
      const nombres = [
        ile.transformation.position.x,
        ile.transformation.position.y,
        ile.transformation.position.z,
        ile.transformation.rotationY,
        ile.rayonX,
        ile.rayonZ,
        ile.hauteurTerrain,
        ...ile.relief,
        ile.approche.position.x,
        ile.approche.position.y,
        ile.approche.position.z,
        ile.apparitionJoueur.position.x,
        ile.apparitionJoueur.position.y,
        ile.apparitionJoueur.position.z,
        ...ile.apparitionsPirates.flatMap((apparition) => [
          apparition.position.x,
          apparition.position.y,
          apparition.position.z,
        ]),
      ];

      expect(nombres.every(Number.isFinite)).toBe(true);
      expect(pointDansCollisionIle(ile, ile.apparitionJoueur.position)).toBe(true);
      expect(apparitionValide(ile, ile.apparitionJoueur)).toBe(true);
      for (const apparition of ile.apparitionsPirates) {
        expect(apparitionValide(ile, apparition)).toBe(true);
      }
    }
  });

  it('change les placements avec une autre graine sans changer le nombre d’îles', () => {
    const mondeMvp = genererMonde('mvp-defaut');
    const autreMonde = genererMonde('graine-de-test');

    expect(autreMonde.iles).toHaveLength(NOMBRE_ILES_MVP);
    expect(autreMonde).not.toEqual(mondeMvp);
    expect(autreMonde.iles.map((ile) => ile.id)).toEqual(mondeMvp.iles.map((ile) => ile.id));
  });
});
