import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene, Vector3 } from 'babylonjs';

import {
  construireBateauBabylon,
  type PointBateau,
  type VolumeBateau,
} from '../apps/client/src/jeu/bateau';

function centreLocal(volume: VolumeBateau): PointBateau {
  return {
    x: (volume.minX + volume.maxX) / 2,
    y: (volume.minY + volume.maxY) / 2,
    z: (volume.minZ + volume.maxZ) / 2,
  };
}

// Convention Babylon pour une rotation autour de +Y : x' = x·cos + z·sin,
// z' = -x·sin + z·cos. Cette fonction isole la transformation attendue pour
// la comparer au placement réel des meshes enfants de la racine tournée.
function centreMondeAttendu(
  volume: VolumeBateau,
  position: PointBateau,
  rotationY: number,
): PointBateau {
  const local = centreLocal(volume);
  const cosinus = Math.cos(rotationY);
  const sinus = Math.sin(rotationY);
  return {
    x: position.x + local.x * cosinus + local.z * sinus,
    y: position.y + local.y,
    z: position.z - local.x * sinus + local.z * cosinus,
  };
}

describe('cycle Babylon du bateau', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;

  afterEach(() => {
    scène?.dispose();
    moteur?.dispose();
    scène = undefined;
    moteur = undefined;
  });

  it('crée et libère deux fois sans doublon ni observateur oublié', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);

    const premier = construireBateauBabylon(scène, {
      id: 'bateau-test',
    });
    expect(premier.hublots).toHaveLength(2);
    expect(premier.surfaces).toHaveLength(11);
    expect(premier.collisions).toHaveLength(20);
    expect(premier.observateurs).toHaveLength(0);
    expect(new Set(premier.objets.map((objet) => objet.name)).size).toBe(premier.objets.length);
    expect(premier.surfaces.every((surface) => !surface.isVisible && surface.checkCollisions)).toBe(
      true,
    );
    expect(
      premier.collisions.every((collision) => !collision.isVisible && collision.checkCollisions),
    ).toBe(true);

    premier.liberer();
    premier.liberer();
    expect(scène.getNodeByName('bateau-test')).toBeNull();
    expect(scène.meshes.some((mesh) => mesh.name.startsWith('bateau-test'))).toBe(false);

    const second = construireBateauBabylon(scène, {
      id: 'bateau-test',
    });
    expect(second.racine.name).toBe('bateau-test');
    expect(second.objets.some((objet) => objet.name === 'bateau-test-2')).toBe(false);
    expect(second.observateurs).toHaveLength(0);
    second.liberer();
    expect(scène.meshes.some((mesh) => mesh.name.startsWith('bateau-test'))).toBe(false);
  });

  it('aligne les surfaces sur le modèle visible avec une rotation non nulle', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);

    const position = { x: 12, y: 0.04, z: -8 };
    const rotationY = Math.PI / 5;
    const bateau = construireBateauBabylon(scène, {
      id: 'bateau-alignement',
      position: new Vector3(position.x, position.y, position.z),
      rotationY,
    });

    expect(bateau.surfaces).toHaveLength(bateau.descripteur.surfaces.length);
    for (let index = 0; index < bateau.surfaces.length; index += 1) {
      const mesh = bateau.surfaces[index];
      const volume = bateau.descripteur.surfaces[index];
      if (!mesh || !volume) {
        throw new Error('Chaque surface doit être associée à son volume.');
      }
      const attendu = centreMondeAttendu(volume, position, rotationY);
      const positionReelle = mesh.getAbsolutePosition();
      expect(Math.abs(positionReelle.x - attendu.x)).toBeLessThan(0.001);
      expect(Math.abs(positionReelle.y - attendu.y)).toBeLessThan(0.001);
      expect(Math.abs(positionReelle.z - attendu.z)).toBeLessThan(0.001);
    }

    bateau.liberer();
  });
});
