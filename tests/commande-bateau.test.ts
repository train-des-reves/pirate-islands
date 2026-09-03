import { describe, expect, it } from 'vitest';

import { créerDescripteurBateau } from '../apps/client/src/jeu/bateau';
import { creerMondeCollision } from '../apps/client/src/jeu/mouvement';
import {
  creerEtatPilotageComplet,
  debarquer,
  embarquer,
  extraireAncres,
  interagir,
  majInvite,
  prendreBarre,
  quitterBarre,
  simulerPilotage,
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

    etat = embarquer(etat, ancres);
    expect(etat.mode).toBe('bord');

    etat = prendreBarre(etat, ancres);
    expect(etat.mode).toBe('pilote');
    expect(etat.invite).toBe('prendre_barre');
    // La barre est à z=1.65 dans le repère local.
    expect(etat.positionLocale.z).toBeCloseTo(1.65, 2);

    etat = quitterBarre(etat, ancres);
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
    expect(interagir(loin, ancres)).toBe(loin);

    // Proche de l'embarquement : embarque.
    const proche = creerEtatPilotageComplet(ancres.embarquement, descripteur);
    const embarque = interagir(proche, ancres);
    expect(embarque.mode).toBe('bord');

    // Proche de la barre en mode bord : prend la barre.
    const aBarre = embarquer(embarque, ancres);
    const barre = prendreBarre(aBarre, ancres);
    expect(barre.mode).toBe('pilote');

    // En mode pilote, interagir quitte la barre.
    const sorti = interagir(barre, ancres);
    expect(sorti.mode).toBe('bord');
  });

  it('débarque à un point sûr hors de la coque', () => {
    const descripteur = créerDescripteurBateau({ x: 0, y: 0, z: 0 }, 0, 'bateau-test');
    const ancres = extraireAncres(descripteur);
    let etat = creerEtatPilotageComplet(ancres.embarquement, descripteur);
    etat = embarquer(etat, ancres);

    const apresDebarquement = debarquer(etat, ancres);
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
    etat = embarquer(etat, ancres);
    etat = prendreBarre(etat, ancres);

    // Le mode pilote simule le bateau et maintient le passager rattaché à la
    // barre, même lorsque la simulation fait avancer le bateau.
    const actions = { avancer: true, reculer: false, gauche: false, droite: false };
    const monde = { mondePied: creerMondeCollision(), collisionsBateau: [] };
    const contraintes = {
      surfaces: descripteur.surfaces,
      collisions: descripteur.collisions,
      limites: descripteur.limitesLocal,
    };

    // Un delta nul ne doit pas déplacer la barre hors du bateau.
    const immobile = simulerPilotage(etat, actions, 0, 0, monde, contraintes);
    expect(immobile.positionLocale.z).toBeCloseTo(1.65, 2);
    expect(immobile.mode).toBe('pilote');

    // Avec un delta non nul, le bateau avance et le passager reste à la barre :
    // sa position locale ne change pas, tandis que sa position monde suit la
    // nouvelle position du bateau.
    const avance = simulerPilotage(etat, actions, 0, 0.2, monde, contraintes);
    expect(avance.bateau.position.z).toBeGreaterThan(etat.bateau.position.z);
    expect(avance.positionLocale.z).toBeCloseTo(etat.positionLocale.z, 2);
    expect(avance.passager.position.z).toBeGreaterThan(etat.passager.position.z);

    // Le passager reste en mode pilote, rattaché à la barre du bateau.
    expect(etat.mode).toBe('pilote');
  });
});
