import { describe, expect, it } from 'vitest';

import {
  decoderEtatSalle,
  encoderEtatSalle,
  EtatSalleSchema,
  creerBateau,
  creerEtatSalle,
  creerJoueur,
  creerPirate,
  LignePecheSchema,
  SANTE_BATEAU_MAXIMALE,
  SANTE_JOUEUR_MAXIMALE,
  SANTE_PIRATE_MAXIMALE,
} from '@pirate/protocole';

describe('schémas multijoueur', () => {
  it('effectue un aller-retour encode/decode d’un état représentatif', () => {
    const état = creerEtatSalle({
      identifiantSalle: 'salle-test',
      graine: 'graine-test',
    });
    const joueur = creerJoueur('session-a', 0);
    const bateau = creerBateau('session-a', 0);
    const pirate = creerPirate('pirate-a', 1);

    joueur.sante = 87;
    joueur.transformation.x = -12.5;
    bateau.sante = 91;
    bateau.transformation.z = 8.25;
    pirate.sante = 73;
    pirate.vivant = false;
    pirate.statut = 'neutralisé';

    état.joueurs.set(joueur.identifiant, joueur);
    état.bateaux.set(bateau.identifiant, bateau);
    état.pirates.set(pirate.identifiant, pirate);
    const ligne = new LignePecheSchema({
      joueurId: 'session-a',
      sequence: 4,
      phase: 'morsure',
      zoneId: 'zone-rivage-ile-aube',
      flotteurX: -24,
      flotteurY: 0,
      flotteurZ: 18,
      lanceAuMs: 100,
      morsureAuMs: 600,
      finMorsureMs: 1400,
    });
    état.lignesPeche.set(ligne.joueurId, ligne);

    const copie = decoderEtatSalle(encoderEtatSalle(état));

    expect(copie).toBeInstanceOf(EtatSalleSchema);
    expect(copie.metadonnees.identifiantSalle).toBe('salle-test');
    expect(copie.metadonnees.graine).toBe('graine-test');
    expect(copie.joueurs.size).toBe(1);
    expect(copie.bateaux.size).toBe(1);
    expect(copie.pirates.size).toBe(1);
    expect(copie.lignesPeche.size).toBe(1);
    expect(copie.lignesPeche.get('session-a')).toMatchObject({
      joueurId: 'session-a',
      sequence: 4,
      phase: 'morsure',
      zoneId: 'zone-rivage-ile-aube',
      morsureAuMs: 600,
    });
    expect(copie.joueurs.get('session-a')).toMatchObject({
      identifiant: 'session-a',
      sessionId: 'session-a',
      sante: 87,
      bateauId: 'bateau-session-a',
    });
    expect(copie.joueurs.get('session-a')?.transformation.x).toBe(-12.5);
    expect(copie.bateaux.get('bateau-session-a')).toMatchObject({
      proprietaireSessionId: 'session-a',
      sante: 91,
    });
    expect(copie.pirates.get('pirate-a')).toMatchObject({
      identifiant: 'pirate-a',
      sante: 73,
      vivant: false,
      statut: 'neutralisé',
    });
  });

  it('expose les valeurs de santé et les champs d’identité du contrat', () => {
    expect(creerJoueur('session-a', 0).sante).toBe(SANTE_JOUEUR_MAXIMALE);
    expect(creerBateau('session-a', 0).sante).toBe(SANTE_BATEAU_MAXIMALE);
    expect(creerPirate('pirate-a').sante).toBe(SANTE_PIRATE_MAXIMALE);
  });
});
