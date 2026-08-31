import { describe, expect, it } from 'vitest';

import {
  DIMENSIONS_BATEAU_MVP,
  créerDescripteurBateau,
  pointDansSurfaceBateau,
  type PointBateau,
  type VolumeBateau,
} from '../apps/client/src/jeu/bateau';
import {
  HAUTEUR_JOUEUR_PAR_DEFAUT,
  RAYON_JOUEUR_PAR_DEFAUT,
} from '../apps/client/src/jeu/mouvement';

interface CapsuleTest {
  readonly centre: Pick<PointBateau, 'x' | 'z'>;
  readonly baseY: number;
  readonly rayon: number;
  readonly hauteur: number;
}

interface PassageCapsule {
  readonly niveau: 'pont' | 'cabine' | 'escalier' | 'cale';
  readonly point: PointBateau;
}

function capsuleChevaucheVolume(capsule: CapsuleTest, volume: VolumeBateau): boolean {
  const chevaucheHorizontalement =
    capsule.centre.x + capsule.rayon > volume.minX &&
    capsule.centre.x - capsule.rayon < volume.maxX &&
    capsule.centre.z + capsule.rayon > volume.minZ &&
    capsule.centre.z - capsule.rayon < volume.maxZ;
  const chevaucheVerticalement =
    capsule.baseY < volume.maxY && capsule.baseY + capsule.hauteur > volume.minY;

  return chevaucheHorizontalement && chevaucheVerticalement;
}

function interpolerPassage(
  précédent: CapsuleTest,
  suivant: CapsuleTest,
  proportion: number,
): CapsuleTest {
  return {
    centre: {
      x: précédent.centre.x + (suivant.centre.x - précédent.centre.x) * proportion,
      z: précédent.centre.z + (suivant.centre.z - précédent.centre.z) * proportion,
    },
    baseY: précédent.baseY + (suivant.baseY - précédent.baseY) * proportion,
    rayon: précédent.rayon,
    hauteur: précédent.hauteur,
  };
}

describe('contrat du bateau de pêche', () => {
  it('expose quatre ancrages stables et des volumes cohérents', () => {
    const bateau = créerDescripteurBateau({ x: 12, y: 0.04, z: -8 }, Math.PI / 5, 'bateau-test');

    expect(bateau.id).toBe('bateau-test');
    expect(bateau.ancrages.map((ancrage) => ancrage.type)).toEqual([
      'apparition',
      'barre',
      'embarquement',
      'cale',
    ]);
    expect(new Set(bateau.ancrages.map((ancrage) => ancrage.id)).size).toBe(4);
    expect(bateau.surfaces.map((surface) => surface.niveau)).toEqual(
      expect.arrayContaining(['pont', 'cabine', 'cale', 'escalier']),
    );
    expect(bateau.collisions.length).toBeGreaterThan(bateau.surfaces.length);

    const volumes = [...bateau.surfaces, ...bateau.collisions];
    expect(new Set(volumes.map((volume) => volume.id)).size).toBe(volumes.length);
    for (const volume of volumes) {
      expect(volume.maxX).toBeGreaterThan(volume.minX);
      expect(volume.maxY).toBeGreaterThan(volume.minY);
      expect(volume.maxZ).toBeGreaterThan(volume.minZ);
      expect(
        [volume.minX, volume.maxX, volume.minY, volume.maxY, volume.minZ, volume.maxZ].every(
          Number.isFinite,
        ),
      ).toBe(true);
    }

    expect(bateau.dimensions).toEqual(DIMENSIONS_BATEAU_MVP);
    expect(bateau.limitesMonde.maxX).toBeGreaterThan(bateau.limitesMonde.minX);
    expect(bateau.limitesMonde.maxY).toBeGreaterThan(bateau.limitesMonde.minY);
    expect(bateau.limitesMonde.maxZ).toBeGreaterThan(bateau.limitesMonde.minZ);
    expect(
      bateau.ancrages
        .flatMap((ancrage) => [ancrage.position.x, ancrage.position.y, ancrage.position.z])
        .every(Number.isFinite),
    ).toBe(true);
  });

  it('reconnaît le pont, la cabine et la cale dans le même repère local', () => {
    const bateau = créerDescripteurBateau();

    expect(pointDansSurfaceBateau({ x: 0, y: 1.5, z: 4 }, bateau)?.niveau).toBe('pont');
    expect(pointDansSurfaceBateau({ x: 0, y: 1.5, z: 0 }, bateau)?.niveau).toBe('cabine');
    expect(pointDansSurfaceBateau({ x: 0, y: 0.2, z: -1 }, bateau)?.niveau).toBe('cale');
    expect(pointDansSurfaceBateau({ x: 0, y: 0.2, z: 6.5 }, bateau)).toBeUndefined();
  });

  it('laisse une capsule de taille joueur traverser le pont, la cabine et la cale', () => {
    const bateau = créerDescripteurBateau();
    const passages: readonly PassageCapsule[] = [
      { niveau: 'pont', point: { x: -1.1, y: 1.5, z: 0 } as const },
      { niveau: 'cabine', point: { x: 0, y: 1.5, z: 0 } as const },
      { niveau: 'escalier', point: { x: 0, y: 1.15, z: -2.5 } as const },
      { niveau: 'cale', point: { x: 0, y: 0.2, z: -1 } as const },
    ] as const;

    const capsules = passages.map((passage) => {
      const surface = pointDansSurfaceBateau(passage.point, bateau);
      expect(surface?.niveau).toBe(passage.niveau);
      if (!surface) {
        return undefined;
      }

      return {
        centre: passage.point,
        baseY: surface.maxY,
        rayon: RAYON_JOUEUR_PAR_DEFAUT,
        hauteur: HAUTEUR_JOUEUR_PAR_DEFAUT,
      };
    });

    expect(capsules.every((capsule) => capsule !== undefined)).toBe(true);
    if (capsules.some((capsule) => capsule === undefined)) {
      return;
    }

    for (let index = 0; index < capsules.length - 1; index += 1) {
      const précédent = capsules[index];
      const suivant = capsules[index + 1];
      if (!précédent || !suivant) {
        continue;
      }

      for (let étape = 0; étape <= 10; étape += 1) {
        const capsule = interpolerPassage(précédent, suivant, étape / 10);
        expect(
          bateau.collisions.some((collision) => capsuleChevaucheVolume(capsule, collision)),
        ).toBe(false);
      }
    }
  });
});
