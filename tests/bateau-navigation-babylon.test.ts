import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene, TransformNode, Vector3 } from 'babylonjs';

import { construireBateauBabylon } from '../apps/client/src/jeu/bateau';
import {
  construireControleBateauMouvement,
  type ControleBateauMouvement,
} from '../apps/client/src/jeu/bateau-mouvement';
import {
  creerEtatNavigationBateau,
  positionLocaleVersMonde,
  simulerNavigationBateau,
  type ObstacleNavigation,
} from '../apps/client/src/jeu/pilotage';

describe('rendu Babylon de la navigation du bateau', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;
  let controle: ControleBateauMouvement | undefined;

  afterEach(() => {
    controle?.liberer();
    scène?.dispose();
    moteur?.dispose();
    controle = undefined;
    scène = undefined;
    moteur = undefined;
  });

  it('applique la navigation à la racine et anime le sillage sans erreur', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);
    const racine = new TransformNode('bateau-navigation-test', scène);
    controle = construireControleBateauMouvement(scène, racine);

    const etat = creerEtatNavigationBateau({ x: 4, y: 0.04, z: -6 }, 0.2);
    controle.appliquerNavigation(etat);
    expect(racine.position.x).toBeCloseTo(4, 5);
    expect(racine.position.z).toBeCloseTo(-6, 5);
    expect(racine.rotation.y).toBeCloseTo(0.2, 5);

    controle.appliquerMode('pilote');
    expect(controle.sillage.mesh.isVisible).toBe(true);
    controle.sillage.mettreAJour(0.8);
    expect(controle.sillage.mesh.scaling.z).toBeGreaterThan(0.4);
    expect(Number.isFinite(controle.sillage.mesh.position.z)).toBe(true);

    controle.appliquerMode('pied');
    expect(controle.sillage.mesh.isVisible).toBe(false);
  });

  it('maintient la position du passager rattachée au référentiel du bateau', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);
    const bateau = construireBateauBabylon(scène, {
      id: 'bateau-referentiel',
      position: new Vector3(0, 0, 0),
      rotationY: 0.35,
    });
    const racine = bateau.racine;
    controle = construireControleBateauMouvement(scène, racine);

    const positionBateau = { x: 2, y: 0.04, z: 3 };
    const rotation = 0.9;
    const etat = creerEtatNavigationBateau(positionBateau, rotation);
    controle.appliquerNavigation(etat);
    racine.computeWorldMatrix(true);

    // Le passager est défini dans le référentiel local du bateau.
    const localeBarre = { x: 0, y: 1.7, z: 1.65 };
    const mondeBarre = positionLocaleVersMonde(localeBarre, positionBateau, rotation);
    expect(racine.position.x).toBeCloseTo(positionBateau.x, 5);
    expect(racine.position.z).toBeCloseTo(positionBateau.z, 5);
    expect(
      Math.hypot(mondeBarre.x - positionBateau.x, mondeBarre.z - positionBateau.z),
    ).toBeGreaterThan(0);

    bateau.liberer();
  });

  it('bloque une navigation devant un rivage de façon déterministe', () => {
    const obstacles: readonly ObstacleNavigation[] = [
      {
        id: 'rivage-babylon',
        type: 'rivage',
        centre: { x: 0, y: 0, z: 12 },
        rayonX: 4,
        rayonZ: 4,
        rotationY: 0,
      },
    ];
    let etat = creerEtatNavigationBateau({ x: 0, y: 0, z: 0 }, 0);
    let collision = 'aucune' as 'aucune' | 'rivage' | 'quai';
    for (let index = 0; index < 300; index += 1) {
      etat = simulerNavigationBateau(etat, { poussee: 1, gouvernail: 0 }, 0.05, obstacles);
      if (etat.collision !== 'aucune') {
        collision = etat.collision;
      }
      expect(Number.isFinite(etat.position.z)).toBe(true);
      expect(Number.isNaN(etat.position.x)).toBe(false);
    }
    expect(collision).toBe('rivage');
    expect(etat.position.z).toBeLessThan(8.1);
  });
});
