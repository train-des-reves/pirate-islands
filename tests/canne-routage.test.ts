import { describe, expect, it } from 'vitest';

import { genererMonde, type ZonePeche } from '@pirate/coeur-jeu';

import {
  construireAdaptateurPecheCoeurJeu,
  GestionnaireCanne,
  type AdaptateurPeche,
} from '../apps/client/src/jeu/canne';
import { pistoletPeutTirer } from '../apps/client/src/jeu/mode-peche';
import { GestionnaireTirLocal, type IntentionTir } from '../apps/client/src/jeu/tir';

function zoneDeMonde(): ZonePeche {
  const monde = genererMonde('peche-mvp-v1');
  const zone = monde.zonesPeche[0];
  if (!zone) {
    throw new Error('Le monde doit exposer au moins une zone de pêche.');
  }
  return zone;
}

/** Adaptateur espion qui compte les appels de pêche pour prouver que la canne
 * consomme bien `tirer` sans jamais le laisser atteindre le pistolet. */
function adaptateurCompteur(): {
  readonly adaptateur: AdaptateurPeche;
  readonly lancers: unknown[];
  readonly releves: unknown[];
} {
  const lancers: unknown[] = [];
  const releves: unknown[] = [];
  const neutre = {
    lancer: (etat: Parameters<AdaptateurPeche['lancer']>[0], zoneId: string, _graine: string, sequence: number, temps: number) => {
      lancers.push({ zoneId, sequence, temps });
      return { ...etat, phase: 'attente' as const, zoneId, sequence, lanceAuMs: temps, tempsCourantMs: temps };
    },
    avancer: (etat: Parameters<AdaptateurPeche['avancer']>[0]) => etat,
    relever: (etat: Parameters<AdaptateurPeche['relever']>[0], temps: number) => {
      releves.push(temps);
      return { ...etat, phase: 'terminee' as const, resultat: 'prise' as const, tempsCourantMs: temps };
    },
    annuler: (etat: Parameters<AdaptateurPeche['annuler']>[0], temps: number) => ({
      ...etat,
      phase: 'terminee' as const,
      resultat: 'annulee' as const,
      tempsCourantMs: temps,
    }),
  };
  return { adaptateur: neutre, lancers, releves };
}

describe('routage exclusif des actions tirer', () => {
  it('en mode pêche, tirer ne produit aucune intention de pistolet', () => {
    const zone = zoneDeMonde();
    const intentions: IntentionTir[] = [];
    const { adaptateur, lancers } = adaptateurCompteur();
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
      adaptateur,
    });

    gestionnaireCanne.actualiser({ tirer: false, interagir: true });
    expect(gestionnaireCanne.lireEtat().vue).toBe('prete');
    expect(gestionnaireTir.lireCompteur()).toBe(0);
    expect(lancers).toHaveLength(0);

    const consommé = gestionnaireCanne.actualiser({ tirer: true, interagir: false });
    expect(consommé).toBe(true);
    // La canne a bien consommé `tirer` via son adaptateur de lancer.
    expect(lancers).toHaveLength(1);
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

  it('bloque le pistolet quand interagir et tirer sont pressés ensemble depuis la rangée', () => {
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

    // Simule la décision de main.ts : on consomme les actions puis on
    // n'arme le pistolet que si le mode n'est PAS actif.
    gestionnaireCanne.actualiser({ tirer: true, interagir: true });
    const modeActif = gestionnaireCanne.estModeActif();
    expect(modeActif).toBe(true);
    // Le routage réel de production passe par `pistoletPeutTirer`.
    const pistoletAutorisé = pistoletPeutTirer(modeActif);
    if (pistoletAutorisé) {
      gestionnaireTir.actualiser(true, 500);
    }
    expect(intentions).toHaveLength(0);
    expect(gestionnaireTir.lireCompteur()).toBe(0);

    // Hors mode, le même routage autorise le pistolet.
    const autreCanne = new GestionnaireCanne({
      lireZone: () => undefined,
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
    autreCanne.actualiser({ tirer: true, interagir: false });
    expect(autreCanne.estModeActif()).toBe(false);
    if (pistoletPeutTirer(autreCanne.estModeActif())) {
      gestionnaireTir.actualiser(true, 500);
    }
    expect(intentions).toHaveLength(1);
  });
});
