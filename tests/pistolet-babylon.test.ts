import { afterEach, describe, expect, it } from 'vitest';
import { FreeCamera, NullEngine, Scene, Vector3 } from 'babylonjs';

import { PistoletPremierePersonne } from '../apps/client/src/jeu/pistolet';

describe('pistolet procédural première personne', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;
  let pistolet: PistoletPremierePersonne | undefined;

  afterEach(() => {
    pistolet?.liberer();
    scène?.dispose();
    moteur?.dispose();
    pistolet = undefined;
    scène = undefined;
    moteur = undefined;
  });

  it('attache le modèle à la caméra et anime uniquement le rendu local', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);
    const camera = new FreeCamera('camera-test', new Vector3(0, 1.62, 0), scène);
    camera.rotation.set(0, 0, 0);
    scène.activeCamera = camera;
    pistolet = new PistoletPremierePersonne(camera, scène);

    expect(scène.getMeshByName('pistolet-corps')?.parent?.name).toBe('pistolet-premiere-personne');
    const viseeRepos = pistolet.lireVisee();

    pistolet.déclencher({
      sequence: 1,
      origine: viseeRepos.origine,
      direction: viseeRepos.direction,
      horodatageClient: 100,
    });
    const viseeTir = pistolet.lireVisee();

    expect(viseeTir.direction).toEqual(viseeRepos.direction);
    expect(viseeTir.origine).toEqual(viseeRepos.origine);
    expect(pistolet.lireEtat()).toEqual({ recul: 1, eclairBouche: true });

    pistolet.actualiser(300);
    expect(pistolet.lireEtat()).toEqual({ recul: 0, eclairBouche: false });
  });
});
