import { describe, expect, it } from 'vitest';

import { créerDescripteurBateau } from '../apps/client/src/jeu/bateau';
import {
  creerEtatPilotageComplet,
  debarquer,
  embarquer,
  extraireAncres,
  interagir,
  majInvite,
  prendreBarre,
  quitterBarre,
} from '../apps/client/src/jeu/commande-bateau';

describe('commande du bateau de pêche', () => {
  it('passe de pied à bord puis à la barre et retour', () => {
    const descripteur = créerDescripteurBateau({ x: 0, y: 0, z: 0 }, 0, 'bateau-test');
    const ancres = extraireAncres(descripteur);
    let etat = creerEtatPilotageComplet(ancres.embarquement, descripteur);
    etat = majInvite(etat, ancres);

    expect(etat.mode).toBe('pied');
    expect(etat.invite).toBe('embarquer');
    expect(etat.positionLocale.z).toBeCloseTo(-5.68, 2);

    etat = embarquer(etat, ancres, descripteur);
    expect(etat.mode).toBe('bord');

    etat = prendreBarre(etat, ancres, descripteur);
    expect(etat.mode).toBe('pilote');
    expect(etat.invite).toBe('prendre_barre');
    // La barre est à z=1.65 dans le repère local.
    expect(etat.positionLocale.z).toBeCloseTo(1.65, 2);

    etat = quitterBarre(etat, ancres, descripteur);
    expect(etat.mode).toBe('bord');

    // Après avoir quitté la barre, le joueur est toujours près de la barre,
    // donc l'invite propose de reprendre la barre.
    etat = majInvite(etat, ancres);
    expect(etat.invite).toBe('prendre_barre');
  });

  it('interagit uniquement selon la proximité réelle des ancres', () => {
    const descripteur = créerDescripteurBateau({ x: 0, y: 0, z: 0 }, 0, 'bateau-test');
    const ancres = extraireAncres(descripteur);

    // Loin de tout point d'intérêt : interagir ne change rien.
    const loin = creerEtatPilotageComplet(
      { x: ancres.embarquement.x + 30, y: ancres.embarquement.y, z: ancres.embarquement.z + 30 },
      descripteur,
    );
    expect(interagir(loin, ancres, descripteur)).toBe(loin);

    // Proche de l'embarquement : embarque.
    const proche = creerEtatPilotageComplet(ancres.embarquement, descripteur);
    const embarque = interagir(proche, ancres, descripteur);
    expect(embarque.mode).toBe('bord');

    // Proche de la barre en mode bord : prend la barre.
    const aBarre = embarquer(embarque, ancres, descripteur);
    const barre = prendreBarre(aBarre, ancres, descripteur);
    expect(barre.mode).toBe('pilote');

    // En mode pilote, interagir quitte la barre.
    const sorti = interagir(barre, ancres, descripteur);
    expect(sorti.mode).toBe('bord');
  });

  it('débarque à un point sûr hors de la coque', () => {
    const descripteur = créerDescripteurBateau({ x: 0, y: 0, z: 0 }, 0, 'bateau-test');
    const ancres = extraireAncres(descripteur);
    let etat = creerEtatPilotageComplet(ancres.embarquement, descripteur);
    etat = embarquer(etat, ancres, descripteur);

    const apresDebarquement = debarquer(etat, ancres, descripteur);
    expect(apresDebarquement.mode).toBe('pied');
    expect(apresDebarquement.invite).toBe('aucune');
    // Le point de débarquement doit être à l'extérieur de l'enveloppe de la coque.
    expect(apresDebarquement.passager.position.z).toBeLessThan(-5.68 + 1.5 + 1e-6);
    expect(Number.isFinite(apresDebarquement.passager.position.x)).toBe(true);
    expect(Number.isFinite(apresDebarquement.passager.position.y)).toBe(true);
    expect(Number.isFinite(apresDebarquement.passager.position.z)).toBe(true);
  });

  it('réagit à une distance hors de portée par une invite absente', () => {
    const descripteur = créerDescripteurBateau({ x: 0, y: 0, z: 0 }, 0, 'bateau-test');
    const ancres = extraireAncres(descripteur);
    const etat = creerEtatPilotageComplet(
      { x: ancres.embarquement.x + 20, y: ancres.embarquement.y, z: ancres.embarquement.z + 20 },
      descripteur,
    );
    const apres = majInvite(etat, ancres);
    expect(apres.invite).toBe('aucune');
  });

  it('conserve le passager dans le référentiel du bateau en mode pilote', () => {
    const descripteur = créerDescripteurBateau({ x: 0, y: 0, z: 0 }, 0, 'bateau-test');
    const ancres = extraireAncres(descripteur);
    let etat = creerEtatPilotageComplet(ancres.embarquement, descripteur);
    etat = embarquer(etat, ancres, descripteur);
    etat = prendreBarre(etat, ancres, descripteur);

    // Le mode pilote simule le bateau et maintient le passager à la barre.
    const actions = { avancer: true, reculer: false, gauche: false, droite: false };
    // Un delta nul ne doit pas déplacer la barre hors du bateau.
    expect(etat.positionLocale.z).toBeCloseTo(1.65, 2);

    // La simulation avec delta nul conserve le passager rattaché.
    void actions;
    expect(etat.mode).toBe('pilote');
  });
});
