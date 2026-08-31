import { describe, expect, it } from 'vitest';

import {
  PROFIL_TERRE,
  creerAleatoire,
  creerScenario,
  simulerIaPirate,
  type CiblePerçue,
  type Coordonnees,
} from '@pirate/coeur-jeu';

function cible(identifiant: string, x: number, z: number): CiblePerçue {
  return { id: identifiant, position: { x, z } };
}

describe('simulation d’IA pirate', () => {
  it('reproduit exactement la même chronologie pour une même graine', () => {
    const scenario = creerScenario({
      graine: 'chronologie-fixe',
      profil: PROFIL_TERRE,
      dureeSec: 25,
      deltaSec: 0.05,
      entreesCibles: [
        { instant: 3, cible: cible('cible-1', 5, 0) },
        { instant: 12, cible: undefined },
      ],
    });

    const première = simulerIaPirate(scenario);
    const seconde = simulerIaPirate(scenario);

    expect(première.etapes).toEqual(seconde.etapes);
    expect(première.etatFinal).toBe(seconde.etatFinal);
    expect(première.transitions).toEqual(seconde.transitions);
  });

  it('produit une chronologie des états attendus', () => {
    const scenario = creerScenario({
      graine: 'chronologie-etats',
      profil: PROFIL_TERRE,
      dureeSec: 30,
      deltaSec: 0.05,
      entreesCibles: [
        { instant: 2, cible: cible('cible-1', 4, 0) },
        { instant: 15, cible: undefined },
      ],
    });

    const résultat = simulerIaPirate(scenario);
    const états = new Set(résultat.etapes.map((étape) => étape.etat));
    expect(états.has('inactif')).toBe(true);
    expect(états.has('poursuite')).toBe(true);
    expect(états.has('attaque')).toBe(true);
    expect(états.has('retour') || états.has('patrouille')).toBe(true);
    expect(résultat.transitions.length).toBeGreaterThan(1);
  });

  it('les sorties générées restent finies et le déplacement borné', () => {
    const scénarios = ['graine-a', 'graine-b', 'graine-c'].map((graine) =>
      creerScenario({
        graine,
        profil: PROFIL_TERRE,
        dureeSec: 20,
        deltaSec: 0.05,
        entreesCibles: [
          { instant: 2, cible: cible('cible-1', 6, -3) },
          { instant: 10, cible: undefined },
        ],
      }),
    );

    for (const scénario of scénarios) {
      const résultat = simulerIaPirate(scénario);
      for (const étape of résultat.etapes) {
        expect(Number.isFinite(étape.sortie.position.x)).toBe(true);
        expect(Number.isFinite(étape.sortie.position.z)).toBe(true);
        expect(Number.isFinite(étape.sortie.cap)).toBe(true);
        expect(Math.abs(étape.sortie.position.x)).toBeLessThanOrEqual(110);
        expect(Math.abs(étape.sortie.position.z)).toBeLessThanOrEqual(110);
        if (étape.sortie.intentionDeplacement) {
          const norme = Math.hypot(
            étape.sortie.intentionDeplacement.x,
            étape.sortie.intentionDeplacement.z,
          );
          expect(Number.isFinite(norme)).toBe(true);
          expect(norme).toBeLessThanOrEqual(PROFIL_TERRE.vitessePoursuite + 0.001);
        }
        if (étape.sortie.intentionAttaque) {
          expect(Number.isFinite(étape.sortie.intentionAttaque.portee)).toBe(true);
          expect(étape.sortie.intentionAttaque.portee).toBe(PROFIL_TERRE.porteeAttaque);
        }
      }
    }
  });

  it('le générateur ensemencé reste stable et couvre un intervalle paramétré', () => {
    const aleatoire = creerAleatoire('stabilité');
    const valeurs: number[] = [];
    for (let index = 0; index < 200; index += 1) {
      const valeur = aleatoire();
      valeurs.push(valeur);
      expect(valeur).toBeGreaterThanOrEqual(0);
      expect(valeur).toBeLessThan(1);
      expect(Number.isFinite(valeur)).toBe(true);
    }

    const nouvelAleatoire = creerAleatoire('stabilité');
    for (let index = 0; index < 200; index += 1) {
      expect(nouvelAleatoire()).toBe(valeurs[index]);
    }
  });

  it('applique une limite terre/mer aux déplacements le long du temps', () => {
    const scénario = creerScenario({
      graine: 'limite-zone',
      profil: PROFIL_TERRE,
      positionDepart: { x: 108, z: -108 } as Coordonnees,
      dureeSec: 40,
      deltaSec: 0.05,
      entreesCibles: [{ instant: 1, cible: cible('cible-1', -108, 108) }],
    });

    const résultat = simulerIaPirate(scénario);
    for (const étape of résultat.etapes) {
      expect(Math.abs(étape.sortie.position.x)).toBeLessThanOrEqual(110);
      expect(Math.abs(étape.sortie.position.z)).toBeLessThanOrEqual(110);
    }
  });
});
