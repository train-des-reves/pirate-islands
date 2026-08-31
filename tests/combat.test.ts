import { describe, expect, it } from 'vitest';

import {
  CADENCE_TIR_SERVEUR_MS,
  DEGATS_PAR_TIR_PIRATE,
  DELAI_REAPPARITION_JOUEUR_MS,
  DISTANCE_ORIGINE_ADMISE,
  PORTEE_TIR,
  SANTE_JOUEUR_MAXIMALE,
  SANTE_PIRATE_MAXIMALE,
  appliquerDegatsJoueur,
  appliquerDegatsPirate,
  choisirReapparition,
  neutraliserPirate,
  reapparitionDue,
  reinitialiserJoueurReapparu,
  resoudreCibleTiree,
  validerIntentionServeur,
  type EtatPirateCombat,
  type IntentionTir,
} from '@pirate/coeur-jeu';

function créerTireur(prérequis: Partial<Parameters<typeof validerIntentionServeur>[0]> = {}) {
  return {
    sessionId: 'session-1',
    vivant: true,
    position: { x: 0, y: 0, z: 0 },
    dernierTirMs: 0,
    derniereSequence: 0,
    ...prérequis,
  };
}

function créerIntention(prérequis: Partial<IntentionTir> = {}): IntentionTir {
  return {
    sequence: 1,
    origine: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: 1 },
    horodatageClient: 1_000,
    ...prérequis,
  };
}

describe("validation serveur d'une intention de tir", () => {
  it('accepte une intention valide sur un tireur vivant', () => {
    const résultat = validerIntentionServeur(
      créerTireur(),
      créerIntention(),
      10_000,
    );
    expect(résultat.valide).toBe(true);
    if (résultat.valide) {
      expect(résultat.intention.direction).toEqual({ x: 0, y: 0, z: 1 });
    }
  });

  it('rejette un tireur mort', () => {
    const résultat = validerIntentionServeur(
      créerTireur({ vivant: false }),
      créerIntention(),
      10_000,
    );
    expect(résultat).toMatchObject({ valide: false, raison: expect.stringContaining('vivant') });
  });

  it('rejette une séquence non entière, consommée ou trop grande', () => {
    expect(
      validerIntentionServeur(
        créerTireur(),
        créerIntention({ sequence: Number.NaN }),
        10_000,
      ).valide,
    ).toBe(false);
    expect(
      validerIntentionServeur(
        créerTireur({ derniereSequence: 5 }),
        créerIntention({ sequence: 5 }),
        10_000,
      ).valide,
    ).toBe(false);
    expect(
      validerIntentionServeur(
        créerTireur(),
        créerIntention({ sequence: 1_000_001 }),
        10_000,
      ).valide,
    ).toBe(false);
  });

  it('rejette une origine non finie ou trop éloignée du tireur', () => {
    expect(
      validerIntentionServeur(
        créerTireur(),
        créerIntention({ origine: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 } }),
        10_000,
      ).valide,
    ).toBe(false);
    expect(
      validerIntentionServeur(
        créerTireur(),
        créerIntention({ origine: { x: DISTANCE_ORIGINE_ADMISE + 1, y: 0, z: 0 } }),
        10_000,
      ).valide,
    ).toBe(false);
  });

  it('rejette une direction nulle ou non finie', () => {
    expect(
      validerIntentionServeur(
        créerTireur(),
        créerIntention({ direction: { x: 0, y: 0, z: 0 } }),
        10_000,
      ).valide,
    ).toBe(false);
    expect(
      validerIntentionServeur(
        créerTireur(),
        créerIntention({ direction: { x: Number.NaN, y: 0, z: 1 } }),
        10_000,
      ).valide,
    ).toBe(false);
  });

  it('rejette un horodatage client invalide ou négatif', () => {
    expect(
      validerIntentionServeur(
        créerTireur(),
        créerIntention({ horodatageClient: -1 }),
        10_000,
      ).valide,
    ).toBe(false);
    expect(
      validerIntentionServeur(
        créerTireur(),
        créerIntention({ horodatageClient: Number.NaN }),
        10_000,
      ).valide,
    ).toBe(false);
  });

  it('respecte la cadence serveur après le premier tir', () => {
    const tireur = créerTireur({
      dernierTirMs: 10_000,
      derniereSequence: 1,
    });

    expect(
      validerIntentionServeur(tireur, créerIntention({ sequence: 2 }), 10_000 + 149).valide,
    ).toBe(false);
    expect(
      validerIntentionServeur(tireur, créerIntention({ sequence: 2 }), 10_000 + CADENCE_TIR_SERVEUR_MS)
        .valide,
    ).toBe(true);
  });
});

describe("résolution d'intersection de tir", () => {
  const pirate: EtatPirateCombat = {
    identifiant: 'pirate-1',
    position: { x: 0, y: 0, z: 10 },
    sante: SANTE_PIRATE_MAXIMALE,
    vivant: true,
  };

  it('touche un pirate vivant aligné dans la portée', () => {
    const cible = resoudreCibleTiree(
      { x: 0, y: 1.5, z: 0 },
      { x: 0, y: 0, z: 1 },
      [pirate],
    );
    expect(cible).toBe('pirate-1');
  });

  it('ignore les pirates morts et les cibles hors portée', () => {
    const pirates: EtatPirateCombat[] = [
      { ...pirate, vivant: false },
      { ...pirate, identifiant: 'pirate-2', position: { x: 0, y: 0, z: PORTEE_TIR + 5 } },
    ];
    expect(resoudreCibleTiree({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, pirates)).toBe(null);
  });

  it("ignore une direction qui s'éloigne de la cible", () => {
    expect(
      resoudreCibleTiree({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, [pirate]),
    ).toBe(null);
  });
});

describe('application des dégâts côté serveur', () => {
  it("clamp la santé d'un pirate entre 0 et son maximum", () => {
    const pirate: EtatPirateCombat = {
      identifiant: 'pirate-1',
      position: { x: 0, y: 0, z: 0 },
      sante: 80,
      vivant: true,
    };
    const apres = appliquerDegatsPirate(pirate, DEGATS_PAR_TIR_PIRATE);
    expect(apres.sante).toBe(55);
    expect(apres.vivant).toBe(true);

    const neutralise = appliquerDegatsPirate(
      { ...pirate, sante: 20 },
      DEGATS_PAR_TIR_PIRATE,
    );
    expect(neutralise.sante).toBe(0);
    expect(neutralise.vivant).toBe(false);
  });

  it('neutralise explicitement un pirate', () => {
    const pirate: EtatPirateCombat = {
      identifiant: 'pirate-1',
      position: { x: 0, y: 0, z: 0 },
      sante: 30,
      vivant: true,
    };
    expect(neutraliserPirate(pirate)).toMatchObject({ sante: 0, vivant: false });
  });

  it('applique des dégâts à un joueur sans accepter de santé fournie', () => {
    expect(
      appliquerDegatsJoueur({ sessionId: 's', sante: 90, vivant: true }, 25),
    ).toEqual({ sessionId: 's', sante: 65, vivant: true });
    expect(
      appliquerDegatsJoueur({ sessionId: 's', sante: 10, vivant: true }, 25),
    ).toEqual({ sessionId: 's', sante: 0, vivant: false });
    expect(
      appliquerDegatsJoueur({ sessionId: 's', sante: SANTE_JOUEUR_MAXIMALE, vivant: true }, Number.NaN),
    ).toEqual({ sessionId: 's', sante: SANTE_JOUEUR_MAXIMALE, vivant: true });
  });

  it('réinitialise un joueur réapparu à la pleine santé', () => {
    expect(
      reinitialiserJoueurReapparu({ sessionId: 's', sante: 0, vivant: false }),
    ).toEqual({ sessionId: 's', sante: SANTE_JOUEUR_MAXIMALE, vivant: true });
  });
});

describe('réapparition déterministe', () => {
  it("avance l'index de façon cyclique", () => {
    expect(choisirReapparition(0, 8)).toBe(1);
    expect(choisirReapparition(7, 8)).toBe(0);
    expect(() => choisirReapparition(0, 0)).toThrow();
  });

  it("signale l'échéance de réapparition selon l'horloge serveur", () => {
    expect(reapparitionDue(0, DELAI_REAPPARITION_JOUEUR_MS)).toBe(false);
    expect(reapparitionDue(DELAI_REAPPARITION_JOUEUR_MS - 1, DELAI_REAPPARITION_JOUEUR_MS)).toBe(
      false,
    );
    expect(reapparitionDue(DELAI_REAPPARITION_JOUEUR_MS, DELAI_REAPPARITION_JOUEUR_MS)).toBe(true);
    expect(reapparitionDue(10_000, 0)).toBe(false);
  });
});
