import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene } from 'babylonjs';

import {
  PARTIES_BATEAU_PIRATE,
  construireBateauPirate,
  construireGalerieBateauxPiratesE2E,
  type DonneesBateauPirate,
} from '../apps/client/src/jeu/bateau-pirate';

function donneesBateau(
  id: string,
  x: number,
  etat: DonneesBateauPirate['etat'],
  vitesse = 8,
): DonneesBateauPirate {
  return {
    id,
    transformation: { position: { x, y: 0, z: 0 }, rotationY: 0 },
    vitesse,
    ratioSante: etat === 'detruit' ? 0 : 1,
    etat,
  };
}

describe('rendu Babylon du sloop pirate', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;

  afterEach(() => {
    scène?.dispose();
    moteur?.dispose();
    scène = undefined;
    moteur = undefined;
  });

  it('construit plusieurs bateaux sans dupliquer les gabarits et libère proprement', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);

    const bateaux = [
      construireBateauPirate(scène, donneesBateau('bateau-1', -2, 'intact', 9)),
      construireBateauPirate(scène, donneesBateau('bateau-2', 2, 'detruit', 0)),
    ];

    expect(PARTIES_BATEAU_PIRATE).toHaveLength(12);
    expect(bateaux.every((bateau) => bateau.objets)).toBe(true);
    expect(bateaux[0]?.objets).toHaveLength(12);
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-bateau-pirate'),
    ).toHaveLength(12);
    expect(
      new Set(bateaux.flatMap((bateau) => bateau.objets.map((objet) => objet.name))).size,
    ).toBe(24);

    bateaux[0]?.mettreAJour(0.1);
    expect(bateaux[0]?.obtenirIntensiteSillage()).toBeGreaterThan(0);
    bateaux[1]?.mettreAJour(0.1);
    expect(bateaux[1]?.obtenirIntensiteSillage()).toBe(0);

    const ancres = bateaux[0]?.obtenirAncres();
    expect(ancres).toBeDefined();
    expect(Object.keys(ancres ?? {}).sort()).toEqual(['equipage', 'origine', 'pilote', 'sillage']);
    expect(bateaux[0]?.obtenirLimites().minX).toBeLessThan(bateaux[0]?.obtenirLimites().maxX ?? 0);

    bateaux[0]?.liberer();
    expect(() => bateaux[0]?.liberer()).not.toThrow();
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-bateau-pirate'),
    ).toHaveLength(12);

    bateaux[1]?.liberer();
    expect(
      scène.meshes.filter((mesh) => mesh.metadata?.type === 'gabarit-bateau-pirate'),
    ).toHaveLength(0);
  });

  it('libère la galerie de fixtures et ses ressources partagées de façon idempotente', () => {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);

    const galerie = construireGalerieBateauxPiratesE2E(scène);
    expect(galerie.acteurs).toHaveLength(4);
    expect(galerie.objets.length).toBeGreaterThan(4 * 10);
    expect(() => {
      galerie.mettreAJour(0.1);
      galerie.liberer();
      galerie.liberer();
    }).not.toThrow();
    expect(scène.meshes).toHaveLength(0);
  });
});
