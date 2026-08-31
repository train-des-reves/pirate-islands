import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene } from 'babylonjs';

import { construireMondeBabylon } from '../apps/client/src/jeu/scene';

describe('intégration Babylon du monde', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;

  afterEach(() => {
    scène?.dispose();
    moteur?.dispose();
    scène = undefined;
    moteur = undefined;
  });

  it('crée et libère une scène complète sans erreur', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);

    expect(() => {
      const mondeBabylon = construireMondeBabylon(scène as Scene);
      scène?.render();
      expect(mondeBabylon.terrains).toHaveLength(3);
      expect(mondeBabylon.rivages).toHaveLength(3);
      expect(mondeBabylon.quais).toHaveLength(3);
      expect(mondeBabylon.terrains.every((terrain) => terrain.checkCollisions)).toBe(true);
      mondeBabylon.liberer();
    }).not.toThrow();
  });
});
