import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine, Scene } from 'babylonjs';

import { NOMS_MESSAGES, type EtatSalle, type Joueur } from '@pirate/protocole';
import type { Room } from '@colyseus/sdk';

import {
  creerEmetteurTransformation,
  INTERVALLE_ENVOI_TRANSFORMATION_MS,
  SynchroniseurPecheursDistants,
} from '../apps/client/src/jeu/synchroniseur-pecheurs';

interface SalleFactice extends Omit<Room<unknown, EtatSalle>, 'state' | 'send'> {
  readonly state: EtatSalle;
  readonly envois: ReadonlyArray<{ readonly type: string; readonly message: unknown }>;
  readonly send: (type: string, message: unknown) => void;
}

function joueur(sessionId: string, nom: string): Joueur {
  return {
    identifiant: sessionId,
    sessionId,
    nom,
    transformation: { x: 1, y: 0, z: 2, lacet: 0, tangage: 0, roulis: 0 },
    sante: 100,
    vivant: true,
    statut: 'actif',
    bateauId: 'bateau-' + sessionId,
  } as unknown as Joueur;
}

function créerSalle(sessionLocale: string, joueurs: ReadonlyArray<[string, Joueur]>): SalleFactice {
  const envois: Array<{ readonly type: string; readonly message: unknown }> = [];
  const state = { joueurs: new Map(joueurs as [string, Joueur][]) } as unknown as EtatSalle;
  return {
    sessionId: sessionLocale,
    state,
    envois,
    send: (type: string, message: unknown) => envois.push({ type, message }),
  } as unknown as SalleFactice;
}

describe('synchroniseur des pêcheurs distants', () => {
  let moteur: NullEngine | undefined;
  let scène: Scene | undefined;

  afterEach(() => {
    scène?.dispose();
    moteur?.dispose();
    scène = undefined;
    moteur = undefined;
  });

  function initialiserScène(): Scene {
    moteur = new NullEngine({
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
      renderWidth: 1280,
      renderHeight: 720,
      textureSize: 512,
    });
    scène = new Scene(moteur);
    return scène;
  }

  it('ignore la session locale et crée un avatar pour chaque autre joueur', () => {
    const scène = initialiserScène();
    const salle = créerSalle('session-local', [
      ['session-local', joueur('session-local', 'Pêcheur-Local')],
      ['session-distante', joueur('session-distante', 'Pêcheur-Distant')],
    ]);
    const synchroniseur = new SynchroniseurPecheursDistants(
      () => salle as unknown as Room<unknown, EtatSalle>,
      () => 'session-local',
      scène,
    );
    synchroniseur.mettreAJour();

    const pêcheurs = synchroniseur.obtenirPecheurs();
    expect(pêcheurs).toHaveLength(1);
    expect(pêcheurs[0]?.sessionId).toBe('session-distante');
    expect(pêcheurs[0]?.nom).toBe('Pêcheur-Distant');
    synchroniseur.liberer();
  });

  it('supprime l’avatar du joueur disparu', () => {
    const scène = initialiserScène();
    const salle = créerSalle('session-local', [
      ['session-local', joueur('session-local', 'Pêcheur-Local')],
      ['session-distante', joueur('session-distante', 'Pêcheur-Distant')],
    ]);
    const synchroniseur = new SynchroniseurPecheursDistants(
      () => salle as unknown as Room<unknown, EtatSalle>,
      () => 'session-local',
      scène,
    );
    synchroniseur.mettreAJour();
    expect(synchroniseur.obtenirPecheurs()).toHaveLength(1);

    salle.state.joueurs.delete('session-distante');
    synchroniseur.mettreAJour();
    expect(synchroniseur.obtenirPecheurs()).toHaveLength(0);
    synchroniseur.liberer();
  });

  it('libère tous les avatars lorsque la salle devient indisponible', () => {
    const scène = initialiserScène();
    let salle: Room<unknown, EtatSalle> | undefined = créerSalle('session-local', [
      ['session-local', joueur('session-local', 'Pêcheur-Local')],
      ['session-distante', joueur('session-distante', 'Pêcheur-Distant')],
    ]) as unknown as Room<unknown, EtatSalle>;
    const synchroniseur = new SynchroniseurPecheursDistants(
      () => salle,
      () => 'session-local',
      scène,
    );
    synchroniseur.mettreAJour();
    expect(synchroniseur.obtenirPecheurs()).toHaveLength(1);

    salle = undefined;
    synchroniseur.mettreAJour();
    expect(synchroniseur.obtenirPecheurs()).toHaveLength(0);
    synchroniseur.liberer();
  });

  it('borne l’émission à l’intervalle réseau', () => {
    let maintenant = 0;
    const salle = créerSalle('session-local', []);
    const émetteur = creerEmetteurTransformation(
      () => salle as unknown as Room<unknown, EtatSalle>,
      () => maintenant,
    );

    émetteur.envoyer({ position: { x: 1, y: 0, z: 0 }, lacet: 0, tangage: 0, roulis: 0 });
    émetteur.envoyer({ position: { x: 2, y: 0, z: 0 }, lacet: 0, tangage: 0, roulis: 0 });
    expect(salle.envois).toHaveLength(1);

    maintenant += INTERVALLE_ENVOI_TRANSFORMATION_MS;
    émetteur.envoyer({ position: { x: 3, y: 0, z: 0 }, lacet: 0, tangage: 0, roulis: 0 });
    expect(salle.envois).toHaveLength(2);
    expect(salle.envois[1]?.type).toBe(NOMS_MESSAGES.transformationJoueur);
  });
});
