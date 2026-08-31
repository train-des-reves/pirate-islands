import { describe, expect, it } from 'vitest';

import { genererMonde, type ZonePeche } from '@pirate/coeur-jeu';

import {
  construireAdaptateurPecheCoeurJeu,
  GestionnaireCanne,
} from '../apps/client/src/jeu/canne';
import { GestionnaireTirLocal, type IntentionTir } from '../apps/client/src/jeu/tir';

function zoneDeMonde(): ZonePeche {
  const monde = genererMonde('peche-mvp-v1');
  const zone = monde.zonesPeche[0];
  if (!zone) {
    throw new Error('Le monde doit exposer au moins une zone de pêche.');
  }
  return zone;
}

describe('routage exclusif des actions tirer', () => {
  it('en mode pêche, tirer ne produit aucune intention de pistolet', () => {
    const zone = zoneDeMonde();
    const intentions: IntentionTir[] = [];
    const monde = genererMonde('peche-mvp-v1');
    const gestionnaireTir = new GestionnaireTirLocal({
      obtenirVisee: () => ({ origine: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }),
      emetteur: { émettre: (intention) => intentions.push(intention) },
      lireHorodatage: () => 500,
    });
    const gestionnaireCanne = new GestionnaireCanne({
      lireZone: () => zone,
      lirePosition: () => ({ x: zone.centre.x, y: 0, z: zone.centre.z }),
      lireHorodatage: () => 500,
      graine: 'peche-mvp-v1',
      interfacePeche: {
        afficherInvite: () => undefined,
        afficherStatut: () => undefined,
        afficherResultat: () => undefined,
      },
      adaptateur: construireAdaptateurPecheCoeurJeu(monde),
    });

    gestionnaireCanne.actualiser({ tirer: false, interagir: true });
    expect(gestionnaireCanne.lireEtat().vue).toBe('prete');
    expect(gestionnaireTir.lireCompteur()).toBe(0);

    const consommé = gestionnaireCanne.actualiser({ tirer: true, interagir: false });
    expect(consommé).toBe(true);
    expect(intentions).toHaveLength(0);
    expect(gestionnaireTir.lireCompteur()).toBe(0);
  });

  it('hors mode pêche, tirer émet uniquement une intention de pistolet', () => {
    const intentions: IntentionTir[] = [];
    const gestionnaireTir = new GestionnaireTirLocal({
      obtenirVisee: () => ({ origine: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }),
      emetteur: { émettre: (intention) => intentions.push(intention) },
      lireHorodatage: () => 500,
    });
    const zone = zoneDeMonde();
    const monde = genererMonde('peche-mvp-v1');
    const gestionnaireCanne = new GestionnaireCanne({
      lireZone: () => zone,
      lirePosition: () => ({ x: 0, y: 0, z: 0 }),
      lireHorodatage: () => 500,
      graine: 'peche-mvp-v1',
      interfacePeche: {
        afficherInvite: () => undefined,
        afficherStatut: () => undefined,
        afficherResultat: () => undefined,
      },
      adaptateur: construireAdaptateurPecheCoeurJeu(monde),
    });

    const consommé = gestionnaireCanne.actualiser({ tirer: true, interagir: false });
    expect(consommé).toBe(false);
    expect(gestionnaireCanne.lireEtat().vue).toBe('rangee');

    gestionnaireTir.actualiser(true, 500);
    expect(intentions).toHaveLength(1);
  });
});
