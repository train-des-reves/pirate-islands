import { afterEach, describe, expect, it } from 'vitest';

import { Client, type Room } from '@colyseus/sdk';

import {
  CAPACITE_SALLE,
  EtatSalleSchema,
  NOMS_MESSAGES,
  NOM_SALLE_JEU,
  SANTE_JOUEUR_MAXIMALE,
  type EtatSalle,
  type MessageResultatTir,
} from '@pirate/protocole';
import { resoudreCibleTiree } from '@pirate/coeur-jeu';
import { démarrerServeur, type ServeurDemarre } from '../apps/serveur/src/server.js';

let serveur: ServeurDemarre | undefined;
let serveurModeE2E = false;
const sallesOuvertes: Room<unknown, EtatSalle>[] = [];

afterEach(async () => {
  await Promise.all(sallesOuvertes.splice(0).map((salle) => salle.leave()));
  await serveur?.arreter();
  serveur = undefined;
  serveurModeE2E = false;
});

async function ouvrirClient(): Promise<ReturnType<typeof creerClient>> {
  serveur ??= await démarrerServeur({
    host: '127.0.0.1',
    port: 0,
    ...(serveurModeE2E ? { modeE2E: true } : {}),
  });
  return creerClient(serveur.url);
}

function creerClient(urlServeur: string): Client {
  return new Client(urlServeur);
}

async function rejoindreSalle(
  client: Client,
  roomId?: string,
  options: Record<string, unknown> = {},
): Promise<Room<unknown, EtatSalle>> {
  const salle = roomId
    ? await client.joinById(roomId, options, EtatSalleSchema)
    : await client.joinOrCreate(NOM_SALLE_JEU, options, EtatSalleSchema);
  const salleTypée = salle as Room<unknown, EtatSalle>;
  sallesOuvertes.push(salleTypée);
  return salleTypée;
}

async function attendreNombreJoueurs(
  salle: Room<unknown, EtatSalle>,
  nombre: number,
): Promise<void> {
  if (salle.state.joueurs.size === nombre) {
    return;
  }

  await new Promise<void>((résoudre, rejeter) => {
    const délai = setTimeout(() => {
      salle.onStateChange.remove(observer);
      rejeter(new Error('Délai dépassé en attendant ' + nombre + ' joueurs.'));
    }, 5_000);
    const observer = (): void => {
      if (salle.state.joueurs.size !== nombre) {
        return;
      }

      clearTimeout(délai);
      salle.onStateChange.remove(observer);
      résoudre();
    };
    salle.onStateChange(observer);
  });
}

async function attendrePirates(
  salle: Room<unknown, EtatSalle>,
  nombre: number,
): Promise<void> {
  if (salle.state.pirates.size >= nombre) {
    return;
  }

  await new Promise<void>((résoudre, rejeter) => {
    const délai = setTimeout(() => {
      salle.onStateChange.remove(observer);
      rejeter(new Error('Délai dépassé en attendant ' + nombre + ' pirates.'));
    }, 5_000);
    const observer = (): void => {
      if (salle.state.pirates.size < nombre) {
        return;
      }

      clearTimeout(délai);
      salle.onStateChange.remove(observer);
      résoudre();
    };
    salle.onStateChange(observer);
  });
}

function attendreResultatTir(
  salle: Room<unknown, EtatSalle>,
): Promise<MessageResultatTir> {
  return new Promise((résoudre, rejeter) => {
    let détacher = (): void => undefined;
    const délai = setTimeout(() => {
      détacher();
      rejeter(new Error('Délai dépassé en attendant le résultat du tir.'));
    }, 5_000);
    détacher = salle.onMessage(NOMS_MESSAGES.resultatTir, (message: unknown) => {
      clearTimeout(délai);
      détacher();
      résoudre(message as MessageResultatTir);
    });
  });
}

function attendreDeconnexion(salle: Room<unknown, EtatSalle>): Promise<number> {
  return new Promise((résoudre) => salle.onLeave.once(résoudre));
}

function creerIntentionDeTir(
  origine: { readonly x: number; readonly y: number; readonly z: number },
  direction: { readonly x: number; readonly y: number; readonly z: number },
  sequence = 1,
  horodatageClient = 0,
): Record<string, unknown> {
  return {
    sequence,
    origineX: origine.x,
    origineY: origine.y,
    origineZ: origine.z,
    directionX: direction.x,
    directionY: direction.y,
    directionZ: direction.z,
    horodatageClient,
  };
}

/** Retrouve un pirate joignable depuis l'apparition, pour une visée déterministe. */
function cibleDeterministe(
  salle: Room<unknown, EtatSalle>,
  positionJoueur: { readonly x: number; readonly y: number; readonly z: number } = {
    x: -3,
    y: 1.62,
    z: 0,
  },
): { readonly identifiant: string; readonly intention: Record<string, unknown> } {
  const origine = positionJoueur;
  const pirates = [...salle.state.pirates.values()];
  for (const pirate of pirates) {
    const torse = {
      x: pirate.transformation.x,
      y: pirate.transformation.y + 1,
      z: pirate.transformation.z,
    };
    const vers = {
      x: torse.x - origine.x,
      y: torse.y - origine.y,
      z: torse.z - origine.z,
    };
    const longueur = Math.hypot(vers.x, vers.y, vers.z);
    if (longueur <= 0) {
      continue;
    }
    const direction = {
      x: vers.x / longueur,
      y: vers.y / longueur,
      z: vers.z / longueur,
    };
    const cibles = pirates.map((entrée) => ({
      identifiant: entrée.identifiant,
      position: {
        x: entrée.transformation.x,
        y: entrée.transformation.y,
        z: entrée.transformation.z,
      },
      sante: entrée.sante,
      vivant: entrée.vivant,
    }));
    if (resoudreCibleTiree(origine, direction, cibles) === pirate.identifiant) {
      return { identifiant: pirate.identifiant, intention: creerIntentionDeTir(origine, direction) };
    }
  }

  throw new Error('Aucun pirate joignable depuis l’apparition.');
}

describe('SalleJeu Colyseus', () => {
  it('crée deux identités serveur distinctes et synchronise leur apparition', async () => {
    const premierClient = await ouvrirClient();
    const premièreSalle = await rejoindreSalle(premierClient, undefined, {
      graine: 'graine-test',
    });
    const secondClient = await ouvrirClient();
    const secondeSalle = await rejoindreSalle(secondClient, premièreSalle.roomId, {
      graine: 'graine-test',
    });

    await attendreNombreJoueurs(premièreSalle, 2);
    await attendreNombreJoueurs(secondeSalle, 2);

    const identifiants = [...premièreSalle.state.joueurs.keys()];
    expect(identifiants).toHaveLength(2);
    expect(new Set(identifiants).size).toBe(2);
    expect(identifiants).toContain(premièreSalle.sessionId);
    expect(identifiants).toContain(secondeSalle.sessionId);
    expect(premièreSalle.state.metadonnees.identifiantSalle).toBe(premièreSalle.roomId);
    expect(premièreSalle.state.metadonnees.graine).toBe('graine-test');
    expect(premièreSalle.state.bateaux.size).toBe(2);

    for (const identifiant of identifiants) {
      const joueur = premièreSalle.state.joueurs.get(identifiant);
      expect(joueur?.sessionId).toBe(identifiant);
      expect(joueur?.identifiant).toBe(identifiant);
      expect(joueur?.bateauId).toBe('bateau-' + identifiant);
      expect(joueur?.transformation.x).not.toBeNaN();
    }
  });

  it('retire le joueur et le bateau synchronisés après le départ', async () => {
    const premierClient = await ouvrirClient();
    const premièreSalle = await rejoindreSalle(premierClient);
    const secondClient = await ouvrirClient();
    const secondeSalle = await rejoindreSalle(secondClient, premièreSalle.roomId);

    await attendreNombreJoueurs(premièreSalle, 2);
    const sessionÀRetirer = secondeSalle.sessionId;
    await secondeSalle.leave();
    sallesOuvertes.splice(sallesOuvertes.indexOf(secondeSalle), 1);
    await attendreNombreJoueurs(premièreSalle, 1);

    expect(premièreSalle.state.joueurs.has(sessionÀRetirer)).toBe(false);
    expect(premièreSalle.state.bateaux.has('bateau-' + sessionÀRetirer)).toBe(false);
  });

  it('refuse le neuvième client lorsque la salle atteint huit clients', async () => {
    const premierClient = await ouvrirClient();
    const premièreSalle = await rejoindreSalle(premierClient);

    for (let index = 1; index < CAPACITE_SALLE; index += 1) {
      const client = await ouvrirClient();
      await rejoindreSalle(client, premièreSalle.roomId);
    }

    await attendreNombreJoueurs(premièreSalle, CAPACITE_SALLE);
    expect(premièreSalle.state.joueurs.size).toBe(CAPACITE_SALLE);

    const clientRefusé = await ouvrirClient();
    await expect(
      clientRefusé.joinById(premièreSalle.roomId, {}, EtatSalleSchema),
    ).rejects.toThrow();
  });

  it('refuse les options d’identité et les champs inconnus fournis par le client', async () => {
    const client = await ouvrirClient();

    await expect(
      client.joinOrCreate(NOM_SALLE_JEU, { sessionId: 'session-usurpée' }, EtatSalleSchema),
    ).rejects.toThrow();

    await expect(
      client.joinOrCreate(NOM_SALLE_JEU, { identifiant: 'joueur-usurpé' }, EtatSalleSchema),
    ).rejects.toThrow();
  });

  it('déconnecte un client qui envoie un message réseau malformé', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    const départ = new Promise<number>((résoudre) => salle.onLeave.once(résoudre));

    salle.send(NOMS_MESSAGES.ping, { horodatage: Number.NaN });

    await expect(départ).resolves.toBe(4003);
    sallesOuvertes.splice(sallesOuvertes.indexOf(salle), 1);
  });

  it('accepte une intention valide et réduit une seule cible pirate', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client, undefined, { graine: 'graine-test' });
    await attendrePirates(salle, 9);
    const { identifiant, intention } = cibleDeterministe(salle);
    const résultat = attendreResultatTir(salle);

    salle.send(NOMS_MESSAGES.intentionTir, intention);

    const message = await résultat;
    expect(message.sequence).toBe(1);
    expect(message.cibleId).toBe(identifiant);
    expect(message.degats).toBe(25);
    expect(message.pirateNeutralise).toBe(false);
    await expect
      .poll(() => salle.state.pirates.get(identifiant)?.sante, { timeout: 2_000 })
      .toBe(75);
  });

  it('rejette une origine de tir falsifiée et déconnecte le client', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    await attendrePirates(salle, 9);
    const { intention } = cibleDeterministe(salle);
    const départ = attendreDeconnexion(salle);

    salle.send(NOMS_MESSAGES.intentionTir, {
      ...intention,
      origineX: 1000,
      origineY: 0,
      origineZ: 0,
    });

    await expect(départ).resolves.toBe(4003);
    sallesOuvertes.splice(sallesOuvertes.indexOf(salle), 1);
  });

  it('rejette une séquence d’intention rejouée', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    await attendrePirates(salle, 9);
    const { intention } = cibleDeterministe(salle);
    const premierRésultat = attendreResultatTir(salle);
    salle.send(NOMS_MESSAGES.intentionTir, intention);
    await premierRésultat;

    const départ = attendreDeconnexion(salle);
    salle.send(NOMS_MESSAGES.intentionTir, { ...intention, sequence: 1 });

    await expect(départ).resolves.toBe(4003);
    sallesOuvertes.splice(sallesOuvertes.indexOf(salle), 1);
  });

  it('rejette deux tirs trop rapprochés (cadence abusive)', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    await attendrePirates(salle, 9);
    const { intention } = cibleDeterministe(salle);
    const premierRésultat = attendreResultatTir(salle);
    salle.send(NOMS_MESSAGES.intentionTir, intention);
    await premierRésultat;

    const départ = attendreDeconnexion(salle);
    salle.send(NOMS_MESSAGES.intentionTir, { ...intention, sequence: 2 });

    await expect(départ).resolves.toBe(4003);
    sallesOuvertes.splice(sallesOuvertes.indexOf(salle), 1);
  });

  it('neutralise un pirate après plusieurs tirs acceptés', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client, undefined, { graine: 'graine-test' });
    await attendrePirates(salle, 9);
    const { identifiant, intention } = cibleDeterministe(salle);

    for (let index = 0; index < 4; index += 1) {
      const résultat = attendreResultatTir(salle);
      salle.send(NOMS_MESSAGES.intentionTir, { ...intention, sequence: index + 1 });
      const message = await résultat;
      if (index < 3) {
        expect(message.degats).toBe(25);
        await new Promise((résoudre) => setTimeout(résoudre, 160));
      } else {
        expect(message.pirateNeutralise).toBe(true);
      }
    }

    await expect
      .poll(() => salle.state.pirates.get(identifiant)?.sante, { timeout: 2_000 })
      .toBe(0);
    await expect
      .poll(() => salle.state.pirates.get(identifiant)?.vivant, { timeout: 2_000 })
      .toBe(false);
  });

  it('réapparaît le joueur après des dégâts E2E l’ayant tué', async () => {
    serveurModeE2E = true;
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    await attendreNombreJoueurs(salle, 1);
    const sessionId = salle.sessionId;
    const joueur = salle.state.joueurs.get(sessionId);
    expect(joueur?.vivant).toBe(true);

    salle.send(NOMS_MESSAGES.degatsE2E, { degats: SANTE_JOUEUR_MAXIMALE });

    await expect
      .poll(() => salle.state.joueurs.get(sessionId)?.vivant, { timeout: 2_000 })
      .toBe(false);

    // La réapparition est déclenchée par la prochaine action réseau traitée après
    // l'échéance. On envoie une intention de tir valide après le délai.
    await new Promise((résoudre) => setTimeout(résoudre, 3_200));
    const { intention } = cibleDeterministe(salle, { x: 3, y: 1.62, z: 0 });
    salle.send(NOMS_MESSAGES.intentionTir, { ...intention, sequence: 1 });

    await expect
      .poll(
        () =>
          salle.state.joueurs.get(sessionId)?.vivant &&
          salle.state.joueurs.get(sessionId)?.sante === SANTE_JOUEUR_MAXIMALE,
        { timeout: 6_000 },
      )
      .toBe(true);
    await expect
      .poll(() => salle.state.joueurs.get(sessionId)?.statut, { timeout: 2_000 })
      .toBe('actif');
    serveurModeE2E = false;
  });
});
