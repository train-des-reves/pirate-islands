import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene } from 'babylonjs';

import {
  PARTIES_PIRATE,
  construireGaleriePiratesE2E,
  construirePirateTerrestre,
  type DonneesPirateTerrestre,
} from '../apps/client/src/jeu/pirate';

function donneesPirate(
  id: string,
  x: number,
  etat: DonneesPirateTerrestre['etat'],
): DonneesPirateTerrestre {
  return {
    id,
    transformation: { position: { x, y: 0, z: 0 }, rotationY: 0 },
    ratioSante: etat === 'mort' ? 0 : 1,
    etat,
  };
}

describe('rendu Babylon du pirate terrestre', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;

  afterEach(() => {
    scène?.dispose();
    moteur?.dispose();
    scène = undefined;
    moteur = undefined;
  });

  it('construit plusieurs fixtures sans dupliquer les gabarits', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);

    const pirates = [
      construirePirateTerrestre(scène, donneesPirate('pirate-1', -2, 'inactif')),
      construirePirateTerrestre(scène, donneesPirate('pirate-2', 2, 'attaque')),
    ];

    expect(PARTIES_PIRATE).toHaveLength(13);
    expect(pirates.every((pirate) => pirate.objets)).toBe(true);
    expect(pirates[0]?.objets).toHaveLength(16);
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-pirate-terrestre'),
    ).toHaveLength(14);
    expect(
      new Set(pirates.flatMap((pirate) => pirate.objets.map((objet) => objet.name))).size,
    ).toBe(32);

    pirates[0]?.liberer();
    expect(() => pirates[0]?.liberer()).not.toThrow();
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-pirate-terrestre'),
    ).toHaveLength(14);

    pirates[1]?.liberer();
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-pirate-terrestre'),
    ).toHaveLength(0);
  });

  it('libère la galerie de fixtures et ses ressources partagées', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);

    const galerie = construireGaleriePiratesE2E(scène);
    expect(galerie.acteurs).toHaveLength(5);
    expect(galerie.objets.length).toBeGreaterThan(5 * 10);
    expect(() => {
      galerie.liberer();
      galerie.liberer();
    }).not.toThrow();
    expect(scène.meshes).toHaveLength(0);
  });
});
