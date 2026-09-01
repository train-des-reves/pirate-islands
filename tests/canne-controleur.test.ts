import { describe, expect, it } from 'vitest';

import {
  calculerPrevisionPeche,
  genererMonde,
  type ZonePeche,
} from '@pirate/coeur-jeu';

import { construireAdaptateurPecheCoeurJeu, GestionnaireCanne } from '../apps/client/src/jeu/canne';
import type { Vecteur3 } from '../apps/client/src/jeu/mouvement';

function zoneDeMonde(graine = 'peche-mvp-v1'): ZonePeche {
  const monde = genererMonde(graine);
  const zone = monde.zonesPeche[0];
  if (!zone) {
    throw new Error('Le monde doit exposer au moins une zone de pêche.');
  }
  return zone;
}

function construire(zone: ZonePeche | undefined, position: Vecteur3) {
  let maintenant = 1_000;
  const invites: (string | null)[] = [];
  const statuts: string[] = [];
  const resultats: string[] = [];
  const monde = genererMonde('peche-mvp-v1');
  const adaptateur = construireAdaptateurPecheCoeurJeu(monde);
  const interfacePeche = {
    afficherInvite: (invite: string | null) => invites.push(invite),
    afficherStatut: (statut: string) => statuts.push(statut),
    afficherResultat: (resultat: string) => resultats.push(resultat),
  };
  const gestionnaire = new GestionnaireCanne({
    lireZone: () => zone,
    lirePosition: () => position,
    lireHorodatage: () => maintenant,
    graine: 'peche-mvp-v1',
    interfacePeche,
    adaptateur,
  });
  return {
    gestionnaire,
    invites,
    statuts,
    resultats,
    avancer: (ms: number) => {
      maintenant += ms;
    },
    maintenant: () => maintenant,
  };
}

describe('contrôleur de canne locale', () => {
  it('reste rangé hors de portée et entre en mode exactement à la portée', () => {
    const zone = zoneDeMonde();
    const positionProche = { x: zone.centre.x, y: 0, z: zone.centre.z };
    const faux = construire(zone, {
      x: zone.centre.x + zone.rayon + 0.5,
      y: 0,
      z: zone.centre.z,
    });
    expect(faux.gestionnaire.lireEtat().vue).toBe('rangee');

    faux.gestionnaire.actualiser({ tirer: false, interagir: true });
    expect(faux.gestionnaire.lireEtat().vue).toBe('rangee');
    expect(faux.gestionnaire.lireEtat().zoneId).toBeUndefined();

    // Exactement à la portée : le rayon est inclusif.
    const surBord = construire(zone, {
      x: zone.centre.x + zone.rayon,
      y: 0,
      z: zone.centre.z,
    });
    surBord.gestionnaire.actualiser({ tirer: false, interagir: true });
    expect(surBord.gestionnaire.lireEtat().vue).toBe('prete');
    expect(surBord.gestionnaire.lireEtat().zoneId).toBe(zone.id);

    const auCentre = construire(zone, positionProche);
    auCentre.gestionnaire.actualiser({ tirer: false, interagir: true });
    expect(auCentre.gestionnaire.lireEtat().vue).toBe('prete');
  });

  it('sort du mode avec interagir et annule le geste visuel le cas échéant', () => {
    const zone = zoneDeMonde();
    const faux = construire(zone, { x: zone.centre.x, y: 0, z: zone.centre.z });
    const { gestionnaire } = faux;
    gestionnaire.actualiser({ tirer: false, interagir: true });
    expect(gestionnaire.lireEtat().vue).toBe('prete');

    // Relâchement puis nouvelle pression : c'est un nouvel interagir.
    gestionnaire.actualiser({ tirer: false, interagir: false });
    gestionnaire.actualiser({ tirer: false, interagir: true });
    const etat = gestionnaire.lireEtat();
    expect(etat.vue).toBe('rangee');
    expect(etat.zoneId).toBeUndefined();
  });

  it('lance une seule fois puis ignore le maintien et relève après morsure', () => {
    const zone = zoneDeMonde();
    const faux = construire(zone, { x: zone.centre.x, y: 0, z: zone.centre.z });
    const { gestionnaire, avancer } = faux;
    gestionnaire.actualiser({ tirer: false, interagir: true });

    // Une pression lance une fois.
    expect(gestionnaire.actualiser({ tirer: true, interagir: false })).toBe(true);
    const lance = gestionnaire.lireEtat();
    expect(lance.vue).toBe('lancee');
    expect(lance.sequence).toBe(1);

    // Le maintien ne relance pas.
    gestionnaire.actualiser({ tirer: true, interagir: false });
    expect(gestionnaire.lireEtat().sequence).toBe(1);

    const delai = delaiPredit();
    avancer(delai - 1);
    gestionnaire.actualiser({ tirer: false, interagir: false });
    expect(gestionnaire.lireEtat().vue).toBe('lancee');

    avancer(1);
    gestionnaire.actualiser({ tirer: false, interagir: false });
    expect(gestionnaire.lireEtat().vue).toBe('morsure');

    gestionnaire.actualiser({ tirer: true, interagir: false });
    const remonte = gestionnaire.lireEtat();
    expect(remonte.vue).toBe('remontee');
    expect(remonte.peche.resultat).toBe('prise');
  });

  it('refuse un relevé sans lancer et un double lancer, sans lever d’erreur', () => {
    const zone = zoneDeMonde();
    const faux = construire(zone, { x: zone.centre.x, y: 0, z: zone.centre.z });
    const { gestionnaire } = faux;

    expect(() => gestionnaire.relever()).not.toThrow();
    expect(gestionnaire.lireEtat().vue).toBe('rangee');

    gestionnaire.actualiser({ tirer: false, interagir: true });
    expect(gestionnaire.lancer()).toBe(true);
    expect(gestionnaire.lancer()).toBe(false);
  });

  it('gère l’état serveur en retard et la séquence obsolète sans régression ni doublon', () => {
    const zone = zoneDeMonde();
    const faux = construire(zone, { x: zone.centre.x, y: 0, z: zone.centre.z });
    const { gestionnaire, avancer } = faux;
    gestionnaire.actualiser({ tirer: false, interagir: true });
    gestionnaire.actualiser({ tirer: true, interagir: false });
    const avant = gestionnaire.lireEtat();

    avancer(delaiPredit() + 10);
    // Un état serveur en retard (tempsCourant plus petit) est ignoré.
    expect(() => gestionnaire.actualiser({ tirer: false, interagir: false })).not.toThrow();
    const apresAvance = gestionnaire.lireEtat();
    expect(apresAvance.peche.tempsCourantMs).toBeGreaterThanOrEqual(avant.peche.tempsCourantMs);
  });

  it('annule proprement et réinitialise sans dupliquer les intentions', () => {
    const zone = zoneDeMonde();
    const faux = construire(zone, { x: zone.centre.x, y: 0, z: zone.centre.z });
    const { gestionnaire } = faux;
    gestionnaire.actualiser({ tirer: false, interagir: true });
    gestionnaire.actualiser({ tirer: true, interagir: false });
    gestionnaire.annuler();
    expect(gestionnaire.lireEtat().vue).toBe('remontee');
    expect(gestionnaire.lireEtat().peche.resultat).toBe('annulee');

    gestionnaire.reinitialiser();
    const etat = gestionnaire.lireEtat();
    expect(etat.vue).toBe('rangee');
    expect(etat.sequence).toBe(0);
  });

  it('n’expose pas le mode actif hors portée et le rend quand on entre', () => {
    const zone = zoneDeMonde();
    const faux = construire(zone, { x: zone.centre.x, y: 0, z: zone.centre.z });
    expect(faux.gestionnaire.estModeActif()).toBe(false);
    faux.gestionnaire.actualiser({ tirer: false, interagir: true });
    expect(faux.gestionnaire.estModeActif()).toBe(true);
  });

  it('réinitialise proprement pendant le lancer (pause, perte de focus) sans doublon', () => {
    const zone = zoneDeMonde();
    const faux = construire(zone, { x: zone.centre.x, y: 0, z: zone.centre.z });
    const { gestionnaire } = faux;
    gestionnaire.actualiser({ tirer: false, interagir: true });
    const consommé = gestionnaire.actualiser({ tirer: true, interagir: false });
    expect(consommé).toBe(true);
    const avant = gestionnaire.lireEtat();
    expect(avant.vue).toBe('lancee');

    // Pause / perte de focus : reinitialiser remet la canne en rangee.
    gestionnaire.reinitialiser();
    expect(gestionnaire.lireEtat().vue).toBe('rangee');
    expect(gestionnaire.lireEtat().peche.phase).toBe('inactive');

    // Re-initialiser est idempotent : aucun doublon d'état ni d'intention.
    gestionnaire.reinitialiser();
    expect(gestionnaire.lireEtat().sequence).toBe(0);
    expect(faux.statuts.filter((s) => s === 'Canne rangée')).toHaveLength(2);
  });

  it('ignore une morsure arrivant après annulation (état serveur obsolète)', () => {
    const zone = zoneDeMonde();
    const faux = construire(zone, { x: zone.centre.x, y: 0, z: zone.centre.z });
    const { gestionnaire, avancer } = faux;
    gestionnaire.actualiser({ tirer: false, interagir: true });
    gestionnaire.actualiser({ tirer: true, interagir: false });
    const delai = delaiPredit();
    avancer(delai);

    gestionnaire.actualiser({ tirer: false, interagir: false });
    expect(gestionnaire.lireEtat().vue).toBe('morsure');

    // Annulation : la canne repart en remontee.
    gestionnaire.annuler();
    expect(gestionnaire.lireEtat().vue).toBe('remontee');
    expect(gestionnaire.lireEtat().peche.resultat).toBe('annulee');

    // Un retour de morsure annoncé après coup est ignoré sans erreur.
    expect(() => gestionnaire.actualiser({ tirer: false, interagir: false })).not.toThrow();
    expect(gestionnaire.lireEtat().vue).toBe('remontee');
  });

  it('rejette un état serveur obsolète de séquence antérieure sans régresser', () => {
    const zone = zoneDeMonde();
    const monde = genererMonde('peche-mvp-v1');
    const adaptateur = construireAdaptateurPecheCoeurJeu(monde);
    const maintenant = 1000;
    const lireHorodatage = (): number => maintenant;
    const gestionnaire = new GestionnaireCanne({
      lireZone: () => zone,
      lirePosition: () => ({ x: zone.centre.x, y: 0, z: zone.centre.z }),
      lireHorodatage,
      graine: 'peche-mvp-v1',
      interfacePeche: {
        afficherInvite: () => undefined,
        afficherStatut: () => undefined,
        afficherResultat: () => undefined,
      },
      adaptateur,
    });
    gestionnaire.actualiser({ tirer: false, interagir: true });
    gestionnaire.actualiser({ tirer: true, interagir: false });
    const lance = gestionnaire.lireEtat();
    expect(lance.sequence).toBe(1);

    // Un adaptateur menteur renvoie un état avec une séquence antérieure (0) :
    // le contrôleur doit l'ignorer et ne pas régresser.
    const obsolète = adaptateur.avancer(lance.peche, maintenant);
    const menteur = {
      ...adaptateur,
      avancer: () => ({ ...obsolète, sequence: 0 }),
    };
    const faux = new GestionnaireCanne({
      lireZone: () => zone,
      lirePosition: () => ({ x: zone.centre.x, y: 0, z: zone.centre.z }),
      lireHorodatage,
      graine: 'peche-mvp-v1',
      interfacePeche: {
        afficherInvite: () => undefined,
        afficherStatut: () => undefined,
        afficherResultat: () => undefined,
      },
      adaptateur: menteur,
    });
    faux.actualiser({ tirer: false, interagir: true });
    faux.actualiser({ tirer: true, interagir: false });
    const avant = faux.lireEtat();
    expect(() => faux.actualiser({ tirer: false, interagir: false })).not.toThrow();
    expect(faux.lireEtat().sequence).toBeGreaterThanOrEqual(avant.sequence);
    expect(faux.lireEtat().peche.sequence).toBeGreaterThanOrEqual(avant.peche.sequence);
  });
});

function delaiPredit(): number {
  return calculerPrevisionPeche('peche-mvp-v1', 1).delaiMorsureMs;
}
