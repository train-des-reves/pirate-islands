import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene } from 'babylonjs';

import {
  construirePecheur,
  DUREE_INTERPOLATION_PECHEUR,
  SEUIL_TELEPORTATION_PECHEUR,
  type EtatPecheur,
} from '../apps/client/src/jeu/pecheur';

function etatPecheur(modifications: Partial<EtatPecheur> = {}): EtatPecheur {
  return {
    sessionId: 'pecheur-test',
    nom: 'Pêcheur-Aube-0001',
    transformation: {
      position: { x: 0, y: 0, z: 0 },
      lacet: 0,
      tangage: 0,
      roulis: 0,
    },
    ...modifications,
  };
}

describe('avatar Babylon du pêcheur distant', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;

  afterEach(() => {
    scène?.dispose();
    moteur?.dispose();
    scène = undefined;
    moteur = undefined;
  });

  function initialiserScène(): Scene {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);
    return scène;
  }

  it('construit un avatar avec les parties attendues et partage les gabarits', () => {
    const scène = initialiserScène();
    const premier = construirePecheur(scène, etatPecheur());
    const second = construirePecheur(
      scène,
      etatPecheur({ sessionId: 'pecheur-deux', nom: 'Pêcheur-Brume-0002' }),
    );

    expect(premier.objets).toHaveLength(9);
    expect(second.objets).toHaveLength(9);
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-pecheur'),
    ).toHaveLength(7);

    premier.liberer();
    expect(() => premier.liberer()).not.toThrow();
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-pecheur'),
    ).toHaveLength(7);

    second.liberer();
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-pecheur'),
    ).toHaveLength(0);
  });

  it('normalise les valeurs non finies et téléporte au-delà du seuil', () => {
    const scène = initialiserScène();
    const pecheur = construirePecheur(scène, etatPecheur());

    pecheur.recevoirEtat(
      etatPecheur({
        transformation: {
          position: { x: Number.NaN, y: 0, z: 0 },
          lacet: Number.POSITIVE_INFINITY,
          tangage: 0,
          roulis: 0,
        },
      }),
    );
    expect(pecheur.obtenirEtat().transformation.position.x).toBe(0);
    expect(pecheur.obtenirEtat().transformation.lacet).toBe(0);

    pecheur.recevoirEtat(
      etatPecheur({
        transformation: {
          position: { x: SEUIL_TELEPORTATION_PECHEUR + 1, y: 0, z: 0 },
          lacet: 0,
          tangage: 0,
          roulis: 0,
        },
      }),
    );
    const etatTeleporte = pecheur.obtenirEtat();
    expect(etatTeleporte.transformation.position.x).toBe(SEUIL_TELEPORTATION_PECHEUR + 1);
    pecheur.liberer();
  });

  it('interpole vers la cible puis converge après plusieurs mises à jour', () => {
    const scène = initialiserScène();
    const pecheur = construirePecheur(scène, etatPecheur());
    pecheur.recevoirEtat(
      etatPecheur({
        transformation: {
          position: { x: 4, y: 0, z: 0 },
          lacet: 0,
          tangage: 0,
          roulis: 0,
        },
      }),
    );

    pecheur.mettreAJour(DUREE_INTERPOLATION_PECHEUR / 2);
    const intermédiaire = pecheur.obtenirEtat().transformation.position.x;
    expect(intermédiaire).toBeGreaterThan(0);
    expect(intermédiaire).toBeLessThan(4);

    pecheur.mettreAJour(10);
    expect(pecheur.obtenirEtat().transformation.position.x).toBe(4);
    pecheur.liberer();
  });
});
