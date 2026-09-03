import { afterEach, describe, expect, it } from 'vitest';

import { Client, type Room } from '@colyseus/sdk';

import {
  CAPACITE_SALLE,
  EtatSalleSchema,
  NOMS_MESSAGES,
  NOM_SALLE_JEU,
  SANTE_JOUEUR_MAXIMALE,
  SANTE_PIRATE_MAXIMALE,
  type EtatSalle,
  type MessageResultatTir,
} from '@pirate/protocole';
import { genererMonde, resoudreCibleTiree } from '@pirate/coeur-jeu';
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

async function attendreCondition(
  salle: Room<unknown, EtatSalle>,
  prédicat: () => boolean,
  message: string,
): Promise<void> {
  if (prédicat()) {
    return;
  }
  await new Promise<void>((résoudre, rejeter) => {
    const délai = setTimeout(() => {
      salle.onStateChange.remove(observer);
      rejeter(new Error('Délai dépassé : ' + message));
    }, 5_000);
    const observer = (): void => {
      if (!prédicat()) {
        return;
      }
      clearTimeout(délai);
      salle.onStateChange.remove(observer);
      résoudre();
    };
    salle.onStateChange(observer);
  });
}

async function attendrePirates(salle: Room<unknown, EtatSalle>, nombre: number): Promise<void> {
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

function attendreResultatTir(salle: Room<unknown, EtatSalle>): Promise<MessageResultatTir> {
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
      return {
        identifiant: pirate.identifiant,
        intention: creerIntentionDeTir(origine, direction),
      };
    }
  }

  throw new Error('Aucun pirate joignable depuis l’apparition.');
}

describe('SalleJeu Colyseus', () => {
  it('synchronise l’IA terrestre, ses dégâts et la mort d’un pirate entre deux observateurs', async () => {
    serveurModeE2E = true;
    const premierClient = await ouvrirClient();
    const premièreSalle = await rejoindreSalle(premierClient, undefined, {
      graine: 'rencontre-terrestre',
    });
    const secondClient = await ouvrirClient();
    const secondeSalle = await rejoindreSalle(secondClient, premièreSalle.roomId, {
      graine: 'rencontre-terrestre',
    });
    await attendreNombreJoueurs(premièreSalle, 2);

    const île = genererMonde('rencontre-terrestre').iles[0];
    if (!île) {
      throw new Error('La rencontre doit disposer d’une première île.');
    }
    const positionJoueur = île.apparitionJoueur.position;
    premièreSalle.send(NOMS_MESSAGES.positionE2E, { position: positionJoueur });

    await attendreCondition(
      secondeSalle,
      () =>
        Math.abs(
          (secondeSalle.state.joueurs.get(premièreSalle.sessionId)?.transformation.x ?? 0) -
            positionJoueur.x,
        ) < 0.001,
      'le joueur E2E n’a pas été placé sur l’île',
    );
    const pirateInitial = [...premièreSalle.state.pirates.values()].find((pirate) =>
      pirate.identifiant.startsWith(île.id + '-'),
    );
    if (!pirateInitial) {
      throw new Error('La première île doit disposer d’un pirate.');
    }
    const pirateId = pirateInitial.identifiant;

    await expect
      .poll(() => premièreSalle.state.pirates.get(pirateId)?.statut, { timeout: 2_000 })
      .toMatch(/poursuite|attaque/);
    await expect
      .poll(() => premièreSalle.state.joueurs.get(premièreSalle.sessionId)?.sante, {
        timeout: 5_000,
      })
      .toBeLessThan(SANTE_JOUEUR_MAXIMALE);

    await attendreCondition(
      secondeSalle,
      () =>
        secondeSalle.state.pirates.get(pirateId)?.sante ===
        premièreSalle.state.pirates.get(pirateId)?.sante,
      'la santé du pirate n’est pas identique chez le second observateur',
    );

    for (let index = 0; index < 4; index += 1) {
      const pirate = premièreSalle.state.pirates.get(pirateId);
      const joueur = premièreSalle.state.joueurs.get(premièreSalle.sessionId);
      if (!pirate || !joueur || !joueur.vivant) {
        break;
      }
      const origine = {
        x: joueur.transformation.x,
        y: joueur.transformation.y + 1.62,
        z: joueur.transformation.z,
      };
      const vers = {
        x: pirate.transformation.x - origine.x,
        y: pirate.transformation.y + 1 - origine.y,
        z: pirate.transformation.z - origine.z,
      };
      const longueur = Math.hypot(vers.x, vers.y, vers.z);
      const résultat = attendreResultatTir(premièreSalle);
      premièreSalle.send(NOMS_MESSAGES.intentionTir, {
        ...creerIntentionDeTir(
          origine,
          {
            x: vers.x / longueur,
            y: vers.y / longueur,
            z: vers.z / longueur,
          },
          index + 1,
        ),
      });
      await résultat;
      await new Promise((résoudre) => setTimeout(résoudre, 160));
    }

    await expect
      .poll(() => premièreSalle.state.pirates.get(pirateId)?.sante, { timeout: 3_000 })
      .toBe(0);
    await expect
      .poll(() => premièreSalle.state.pirates.get(pirateId)?.vivant, { timeout: 3_000 })
      .toBe(false);
    await expect
      .poll(() => secondeSalle.state.pirates.get(pirateId)?.vivant, { timeout: 3_000 })
      .toBe(false);
    expect(secondeSalle.state.pirates.get(pirateId)?.sante).toBe(SANTE_PIRATE_MAXIMALE - 100);
  }, 30_000);

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

  it('synchronise la transformation du joueur émetteur uniquement', async () => {
    const premierClient = await ouvrirClient();
    const premièreSalle = await rejoindreSalle(premierClient);
    const secondClient = await ouvrirClient();
    const secondeSalle = await rejoindreSalle(secondClient, premièreSalle.roomId);

    await attendreNombreJoueurs(premièreSalle, 2);
    await attendreNombreJoueurs(secondeSalle, 2);

    // Le second joueur apparaît à (3, 0, 0). On envoie une position proche de
    // son apparition après un court délai : le serveur autorise le déplacement
    // dès que la vitesse restante est plausible.
    await new Promise((résoudre) => setTimeout(résoudre, 150));
    secondeSalle.send(NOMS_MESSAGES.transformationJoueur, {
      position: { x: 3, y: 0, z: 0.4 },
      lacet: 1.5,
      tangage: -0.5,
      roulis: 0.25,
      horodatage: 0,
    });

    await attendreCondition(
      premièreSalle,
      () =>
        Math.abs(
          (premièreSalle.state.joueurs.get(secondeSalle.sessionId)?.transformation.z ?? 0) - 0.4,
        ) < 0.001,
      'la transformation du second joueur n’a pas été synchronisée',
    );

    const joueurLocal = premièreSalle.state.joueurs.get(premièreSalle.sessionId);
    const joueurSecond = premièreSalle.state.joueurs.get(secondeSalle.sessionId);
    expect(joueurSecond?.transformation.x).toBe(3);
    expect(joueurSecond?.transformation.y).toBe(0);
    expect(joueurSecond?.transformation.z).toBeCloseTo(0.4);
    expect(joueurSecond?.transformation.lacet).toBeCloseTo(1.5);
    // Le joueur local (premier) reste sur son apparition (-3, 0, 0).
    expect(joueurLocal?.transformation.x).toBe(-3);
  });

  it('rejette une transformation contenant un champ sessionId usurpé', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    const départ = new Promise<number>((résoudre) => salle.onLeave.once(résoudre));

    salle.send(NOMS_MESSAGES.transformationJoueur, {
      sessionId: 'session-usurpée',
      position: { x: 42, y: 0, z: 0 },
      lacet: 0,
      tangage: 0,
      roulis: 0,
      horodatage: 1_000,
    });

    await expect(départ).resolves.toBe(4003);
    sallesOuvertes.splice(sallesOuvertes.indexOf(salle), 1);
  });

  it('rejette une transformation à valeur non finie', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    const départ = new Promise<number>((résoudre) => salle.onLeave.once(résoudre));

    salle.send(NOMS_MESSAGES.transformationJoueur, {
      position: { x: Number.NaN, y: 0, z: 0 },
      lacet: 0,
      tangage: 0,
      roulis: 0,
      horodatage: 1_000,
    });

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

  it('ignore une transformation à vitesse manifestement impossible', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    const sessionId = salle.sessionId;

    // Le joueur apparaît à (-3, 0, 0). La référence de vitesse est initialisée
    // sur cette apparition, donc même le premier paquet est borné : une
    // téléportation très lointaine est manifestement impossible et ignorée,
    // quelle que soit la latence (la vitesse resterait colossale).
    salle.send(NOMS_MESSAGES.transformationJoueur, {
      position: { x: 1_000, y: 0, z: 0 },
      lacet: 0,
      tangage: 0,
      roulis: 0,
      horodatage: 0,
    });

    await new Promise((résoudre) => setTimeout(résoudre, 300));
    // La position reste celle de l'apparition : le téléport du premier paquet
    // a bien été rejeté, la référence de vitesse étant initialisée à l'apparition.
    expect(salle.state.joueurs.get(sessionId)?.transformation.x).toBe(-3);
  });

  it('ignore un déplacement instantané envoyé dans la même milliseconde', async () => {
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    const sessionId = salle.sessionId;

    // Position plausible proche de l'apparition (-3, 0, 0).
    salle.send(NOMS_MESSAGES.transformationJoueur, {
      position: { x: -2.9, y: 0, z: 0 },
      lacet: 0,
      tangage: 0,
      roulis: 0,
      horodatage: 0,
    });
    // Le second message repart immédiatement : le delta de temps est nul, donc
    // un déplacement non nul est manifestement impossible et doit être rejeté.
    salle.send(NOMS_MESSAGES.transformationJoueur, {
      position: { x: 1_000, y: 0, z: 0 },
      lacet: 0,
      tangage: 0,
      roulis: 0,
      horodatage: 0,
    });

    await new Promise((résoudre) => setTimeout(résoudre, 300));
    expect(salle.state.joueurs.get(sessionId)?.transformation.x).not.toBe(1_000);
  });

  it('ignore la transformation d’un joueur mort sans le déconnecter', async () => {
    serveurModeE2E = true;
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    await attendreNombreJoueurs(salle, 1);
    const sessionId = salle.sessionId;

    salle.send(NOMS_MESSAGES.degatsE2E, { degats: SANTE_JOUEUR_MAXIMALE });
    await expect
      .poll(() => salle.state.joueurs.get(sessionId)?.vivant, { timeout: 2_000 })
      .toBe(false);

    const positionAvant = salle.state.joueurs.get(sessionId)?.transformation.x;
    salle.send(NOMS_MESSAGES.transformationJoueur, {
      position: { x: 3, y: 0, z: 0 },
      lacet: 0,
      tangage: 0,
      roulis: 0,
      horodatage: 0,
    });

    await new Promise((résoudre) => setTimeout(résoudre, 300));
    // Le joueur mort ne peut pas modifier l'état autoritaire, sans être déconnecté.
    expect(salle.state.joueurs.get(sessionId)?.transformation.x).toBe(positionAvant);
    expect(salle.state.joueurs.get(sessionId)?.vivant).toBe(false);
    serveurModeE2E = false;
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

  it('rejette le rejeu d’une séquence consommée après la réapparition', async () => {
    serveurModeE2E = true;
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    await attendreNombreJoueurs(salle, 1);
    const sessionId = salle.sessionId;

    // Premier tir accepté avec la séquence 1.
    const { intention } = cibleDeterministe(salle);
    const premierRésultat = attendreResultatTir(salle);
    salle.send(NOMS_MESSAGES.intentionTir, { ...intention, sequence: 1 });
    await premierRésultat;

    // Le joueur est tué par le mannequin E2E, puis réapparaît après le délai.
    salle.send(NOMS_MESSAGES.degatsE2E, { degats: SANTE_JOUEUR_MAXIMALE });
    await expect
      .poll(() => salle.state.joueurs.get(sessionId)?.vivant, { timeout: 2_000 })
      .toBe(false);
    await new Promise((résoudre) => setTimeout(résoudre, 3_200));

    // La séquence 1 déjà consommée est rejouée juste après la réapparition :
    // le serveur doit la rejeter et déconnecter le joueur, sans dégât ajouté.
    const départ = attendreDeconnexion(salle);
    salle.send(NOMS_MESSAGES.intentionTir, { ...intention, sequence: 1 });

    await expect(départ).resolves.toBe(4003);
    sallesOuvertes.splice(sallesOuvertes.indexOf(salle), 1);
    serveurModeE2E = false;
  });

  it('refuse une intention d’un tireur mort et le déconnecte', async () => {
    serveurModeE2E = true;
    const client = await ouvrirClient();
    const salle = await rejoindreSalle(client);
    await attendreNombreJoueurs(salle, 1);
    const sessionId = salle.sessionId;

    salle.send(NOMS_MESSAGES.degatsE2E, { degats: SANTE_JOUEUR_MAXIMALE });
    await expect
      .poll(() => salle.state.joueurs.get(sessionId)?.vivant, { timeout: 2_000 })
      .toBe(false);

    const { intention } = cibleDeterministe(salle, { x: 3, y: 1.62, z: 0 });
    const départ = attendreDeconnexion(salle);
    salle.send(NOMS_MESSAGES.intentionTir, { ...intention, sequence: 1 });

    await expect(départ).resolves.toBe(4003);
    sallesOuvertes.splice(sallesOuvertes.indexOf(salle), 1);
    serveurModeE2E = false;
  });

  it('n’inflige aucun dégât à un joueur touché par un tir ami', async () => {
    serveurModeE2E = true;
    const premierClient = await ouvrirClient();
    const premièreSalle = await rejoindreSalle(premierClient, undefined, {
      graine: 'graine-test',
    });
    const secondClient = await ouvrirClient();
    const secondeSalle = await rejoindreSalle(secondClient, premièreSalle.roomId, {
      graine: 'graine-test',
    });
    await attendreNombreJoueurs(premièreSalle, 2);

    const premierSession = premièreSalle.sessionId;
    const secondSession = secondeSalle.sessionId;
    const premierJoueur = premièreSalle.state.joueurs.get(premierSession);
    const secondJoueur = premièreSalle.state.joueurs.get(secondSession);
    const positionTireur = premierJoueur?.transformation;
    const positionCible = secondJoueur?.transformation;
    expect(positionTireur && positionCible).toBeTruthy();

    const origine = {
      x: positionTireur!.x,
      y: positionTireur!.y + 1.62,
      z: positionTireur!.z,
    };
    const vers = {
      x: positionCible!.x - origine.x,
      y: positionCible!.y + 1 - origine.y,
      z: positionCible!.z - origine.z,
    };
    const longueur = Math.hypot(vers.x, vers.y, vers.z);
    const direction = {
      x: vers.x / longueur,
      y: vers.y / longueur,
      z: vers.z / longueur,
    };
    const intention = creerIntentionDeTir(origine, direction);
    const résultat = attendreResultatTir(premièreSalle);
    premièreSalle.send(NOMS_MESSAGES.intentionTir, intention);
    const message = await résultat;

    expect(message.cibleId).toBeNull();
    expect(message.degats).toBe(0);
    expect(premièreSalle.state.joueurs.get(secondSession)?.sante).toBe(SANTE_JOUEUR_MAXIMALE);
    expect(premièreSalle.state.joueurs.get(secondSession)?.vivant).toBe(true);
    serveurModeE2E = false;
  });
});
