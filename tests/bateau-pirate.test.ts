import { describe, expect, it } from 'vitest';

import {
  ANCRES_BATEAU_PIRATE,
  ANCRES_BATEAU_PIRATE_DETAIL,
  DUREE_RETOUR_DEGATS_BATEAU_PIRATE,
  ETATS_BATEAU_PIRATE,
  FIXTURES_BATEAUX_PIRATES,
  LIMITES_BATEAU_PIRATE,
  ModeleVueBateauPirate,
  PARTIES_BATEAU_PIRATE,
  bornerAlphaInterpolationBateauPirate,
  bornerRatioSanteBateauPirate,
  calculerPoseBateauPirate,
  interpolerAngleBorneBateauPirate,
  interpolerNombreBorneBateauPirate,
  type DonneesBateauPirate,
} from '../apps/client/src/jeu/bateau-pirate';

function donneesBateau(
  modifications: Partial<DonneesBateauPirate> = {},
): DonneesBateauPirate {
  return {
    id: 'bateau-pirate-test',
    transformation: {
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
    },
    vitesse: 8,
    ratioSante: 1,
    etat: 'intact',
    ...modifications,
  };
}

describe('modèle de vue du sloop pirate', () => {
  it('expose des identifiants, ancres, limites et fixtures finies', () => {
    expect(ETATS_BATEAU_PIRATE).toEqual(['intact', 'endommage', 'detruit']);
    expect(ANCRES_BATEAU_PIRATE).toEqual(['pilote', 'equipage', 'origine', 'sillage']);
    expect(PARTIES_BATEAU_PIRATE).toHaveLength(12);

    const ancres = valeursAncres();
    expect(ancres.pilote).toEqual({ x: 0, y: 2.0, z: 2.4 });
    expect(ancres.origine).toEqual({ x: 0, y: 1.15, z: 0 });
    expect(ancres.sillage).toEqual({ x: 0, y: 0.55, z: -3.4 });
    expect(limitesFinies(LIMITES_BATEAU_PIRATE)).toBe(true);

    expect(FIXTURES_BATEAUX_PIRATES).toHaveLength(4);
    expect(FIXTURES_BATEAUX_PIRATES[1]?.vitesse).toBeGreaterThan(0);
    expect(FIXTURES_BATEAUX_PIRATES[3]?.etat).toBe('detruit');
  });

  it('borne les ratios, coefficients et calculs d’interpolation', () => {
    expect(bornerRatioSanteBateauPirate(-1)).toBe(0);
    expect(bornerRatioSanteBateauPirate(2)).toBe(1);
    expect(bornerRatioSanteBateauPirate(Number.NaN)).toBe(1);
    expect(bornerAlphaInterpolationBateauPirate(-1)).toBe(0);
    expect(bornerAlphaInterpolationBateauPirate(2)).toBe(1);
    expect(interpolerNombreBorneBateauPirate(0, 10, -4)).toBe(0);
    expect(interpolerNombreBorneBateauPirate(0, 10, 4)).toBe(10);
    expect(interpolerAngleBorneBateauPirate(Math.PI * 0.9, -Math.PI * 0.9, 0.5)).toBeCloseTo(Math.PI);
  });

  it('interpole une transformation, une vitesse et une rotation sans dépasser la cible', () => {
    const modèle = new ModeleVueBateauPirate(donneesBateau());
    modèle.recevoirEtat(
      donneesBateau({
        transformation: { position: { x: 10, y: 2, z: -4 }, rotationY: Math.PI },
        vitesse: 15,
        etat: 'intact',
      }),
    );

    modèle.mettreAJour(0.09);
    const intermédiaire = modèle.obtenirEtat();
    expect(intermédiaire.transformation.position.x).toBeGreaterThan(0);
    expect(intermédiaire.transformation.position.x).toBeLessThan(10);
    expect(intermédiaire.vitesse).toBeGreaterThan(8);
    expect(intermédiaire.vitesse).toBeLessThan(15);

    modèle.mettreAJour(10);
    const final = modèle.obtenirEtat();
    expect(final.transformation).toEqual({ position: { x: 10, y: 2, z: -4 }, rotationY: Math.PI });
    expect(final.vitesse).toBe(15);
    expect(final.pose.active).toBe(true);
  });

  it('signale un retour de dégâts pendant une durée bornée', () => {
    const modèle = new ModeleVueBateauPirate(donneesBateau());
    modèle.recevoirEtat(donneesBateau({ ratioSante: 0.4, etat: 'endommage' }));
    expect(modèle.obtenirEtat().retourDegatsActif).toBe(true);

    modèle.mettreAJour(DUREE_RETOUR_DEGATS_BATEAU_PIRATE);
    expect(modèle.obtenirEtat().retourDegatsActif).toBe(false);
    expect(modèle.obtenirEtat().ratioSante).toBeLessThan(1);
  });

  it('verrouille l’état détruit, arrête le sillage et ignore une réactivation tardive', () => {
    const modèle = new ModeleVueBateauPirate(donneesBateau({ vitesse: 12 }));
    modèle.recevoirEtat(donneesBateau({ ratioSante: 0, vitesse: 0, etat: 'detruit' }));
    expect(modèle.obtenirEtat().etat).toBe('detruit');
    expect(modèle.obtenirEtat().pose.active).toBe(false);
    expect(modèle.obtenirEtat().pose.voileVisible).toBe(false);

    modèle.mettreAJour(0.1);
    expect(modèle.obtenirIntensiteSillage()).toBe(0);

    modèle.recevoirEtat(donneesBateau({ ratioSante: 1, vitesse: 14, etat: 'intact' }));
    expect(modèle.obtenirEtat().etat).toBe('detruit');
    expect(modèle.obtenirEtat().pose.voileVisible).toBe(false);
    expect(modèle.obtenirIntensiteSillage()).toBe(0);
  });

  it('normalise les états invalides et les transformations non finies', () => {
    const modèle = new ModeleVueBateauPirate(
      donneesBateau({
        transformation: {
          position: { x: Number.NaN, y: Number.POSITIVE_INFINITY, z: 0 },
          rotationY: Number.NaN,
        },
        etat: 'mystere' as DonneesBateauPirate['etat'],
      }),
    );
    expect(modèle.obtenirEtat().transformation.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(modèle.obtenirEtat().transformation.rotationY).toBe(0);
    expect(modèle.obtenirEtat().etat).toBe('intact');
  });

  it('expose une pose détruite nettement inactive et sans voile', () => {
    const pose = calculerPoseBateauPirate('detruit', 0);
    expect(pose.active).toBe(false);
    expect(pose.voileVisible).toBe(false);
    expect(pose.pavillonVisible).toBe(false);
    const poseActive = calculerPoseBateauPirate('intact', 1);
    expect(poseActive.active).toBe(true);
    expect(poseActive.voileVisible).toBe(true);
  });
});

function valeursAncres(): Record<string, { x: number; y: number; z: number }> {
  const résultat: Record<string, { x: number; y: number; z: number }> = {};
  for (const ancre of Object.values(ANCRES_BATEAU_PIRATE_DETAIL)) {
    résultat[ancre.nom] = { ...ancre.position };
  }
  return résultat;
}

function limitesFinies(limites: {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}): boolean {
  return Object.values(limites).every((valeur) => Number.isFinite(valeur));
}
