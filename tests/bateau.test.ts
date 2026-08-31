import { describe, expect, it } from 'vitest';

import {
  DIMENSIONS_BATEAU_MVP,
  créerDescripteurBateau,
  pointDansSurfaceBateau,
} from '../apps/client/src/jeu/bateau';

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
});

