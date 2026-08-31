import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene } from 'babylonjs';

import { construireBateauBabylon } from '../apps/client/src/jeu/bateau';

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
});

