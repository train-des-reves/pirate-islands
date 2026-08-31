import { afterEach, describe, expect, it } from 'vitest';
import { FreeCamera, NullEngine, Scene, Vector3 } from 'babylonjs';

import { construireCanneBabylon } from '../apps/client/src/jeu/canne-babylon';

describe('canne procédurale Babylon', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;

  afterEach(() => {
    scène?.dispose();
    moteur?.dispose();
    scène = undefined;
    moteur = undefined;
  });

  function creerScène(): { scene: Scene; camera: FreeCamera } {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);
    const camera = new FreeCamera('camera-canne-test', new Vector3(0, 1.62, 0), scène);
    scène.activeCamera = camera;
    return { scene: scène, camera };
  }

  it('crée et libère deux fois sans doublon, avec noms uniques et fil non vide', () => {
    const { scene, camera } = creerScène();
    const premiere = construireCanneBabylon(camera, scene);

    expect(scene.getMeshByName('canne-corps')?.parent?.name).toBe('canne-premiere-personne');
    expect(scene.getMeshByName('canne-fil')).toBeDefined();
    expect(scene.getMeshByName('canne-fil')?.isVisible).toBe(false);
    expect(scene.getMeshByName('canne-flotteur')).toBeDefined();
    expect(premiere.meshes.length).toBeGreaterThan(0);
    expect(new Set(premiere.meshes.map((mesh) => mesh.name)).size).toBe(premiere.meshes.length);

    premiere.afficherEtat({ vue: 'lancee', sequence: 1, peche: { phase: 'attente', sequence: 1, lanceAuMs: 0, tempsCourantMs: 0 } });
    expect(scene.getMeshByName('canne-fil')?.isVisible).toBe(true);
    expect(scene.getMeshByName('canne-flotteur')?.isVisible).toBe(true);

    premiere.liberer();
    premiere.liberer();
    expect(scene.getMeshByName('canne-corps')).toBeNull();

    const seconde = construireCanneBabylon(camera, scene);
    expect(seconde.meshes.some((mesh) => mesh.name === 'canne-corps-2')).toBe(false);
    expect(seconde.racine.name).toBe('canne-premiere-personne');
    seconde.liberer();
    expect(scene.meshes.some((mesh) => mesh.name.startsWith('canne-'))).toBe(false);
  });

  it('masque totalement la canne quand elle est rangée', () => {
    const { scene, camera } = creerScène();
    const canne = construireCanneBabylon(camera, scene);
    expect(scene.getMeshByName('canne-corps')?.isEnabled()).toBe(false);
    canne.afficherEtat({ vue: 'prete', sequence: 0, peche: { phase: 'inactive', sequence: 0, lanceAuMs: 0, tempsCourantMs: 0 } });
    expect(scene.getMeshByName('canne-corps')?.isEnabled()).toBe(true);
    canne.liberer();
  });
});
