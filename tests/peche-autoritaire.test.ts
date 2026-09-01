import { afterEach, describe, expect, it } from 'vitest';

import { Client, type Room } from '@colyseus/sdk';

import {
  calculerPrevisionPeche,
  DUREE_FENETRE_MORSURE_MS,
  genererMonde,
  normaliserDirection,
} from '@pirate/coeur-jeu';
import {
  EtatSalleSchema,
  NOMS_MESSAGES,
  NOM_SALLE_JEU,
  type EtatSalle,
  type MessageResultatPeche,
} from '@pirate/protocole';
import { démarrerServeur, type ServeurDemarre } from '../apps/serveur/src/server.js';
import {
  creerHorlogeSimulation,
  type HorlogeSimulation,
} from '../apps/serveur/src/salles/salle-jeu.js';

let serveur: ServeurDemarre | undefined;
const sallesOuvertes: Room<unknown, EtatSalle>[] = [];

afterEach(async () => {
  await Promise.all(sallesOuvertes.splice(0).map((salle) => salle.leave()));
  await serveur?.arreter();
  serveur = undefined;
});

async function rejoindre(
  horloge: HorlogeSimulation,
): Promise<{ readonly salle: Room<unknown, EtatSalle>; readonly horloge: HorlogeSimulation }> {
  serveur ??= await démarrerServeur({
    host: '127.0.0.1',
    port: 0,
    modeE2E: true,
    horloge,
  });
  const client = new Client(serveur.url);
  const salle = (await client.joinOrCreate(
    NOM_SALLE_JEU,
    { graine: 'peche-mvp-v1' },
    EtatSalleSchema,
  )) as Room<unknown, EtatSalle>;
  sallesOuvertes.push(salle);
  return { salle, horloge };
}

async function rejoindreMemeSalle(
  salle: Room<unknown, EtatSalle>,
): Promise<Room<unknown, EtatSalle>> {
  const client = new Client(serveur!.url);
  const seconde = (await client.joinById(
    salle.roomId,
    { graine: 'peche-mvp-v1' },
    EtatSalleSchema,
  )) as Room<unknown, EtatSalle>;
  sallesOuvertes.push(seconde);
  return seconde;
}

async function attendreCondition(
  salle: Room<unknown, EtatSalle>,
  condition: () => boolean,
  description: string,
): Promise<void> {
  if (condition()) {
    return;
  }
  await new Promise<void>((résoudre, rejeter) => {
    let termine = false;
    const observer = (): void => {
      if (!condition()) {
        return;
      }
      termine = true;
      clearTimeout(délai);
      clearInterval(polling);
      salle.onStateChange.remove(observer);
      résoudre();
    };
    const délai = setTimeout(() => {
      termine = true;
      clearInterval(polling);
      salle.onStateChange.remove(observer);
      rejeter(new Error('Délai dépassé : ' + description));
    }, 5_000);
    const polling = setInterval(() => {
      if (!termine) {
        observer();
      }
    }, 20);
    salle.onStateChange(observer);
    observer();
  });
}

function attendreRésultat(salle: Room<unknown, EtatSalle>): Promise<MessageResultatPeche> {
  return new Promise((résoudre, rejeter) => {
    let détacher = (): void => undefined;
    const délai = setTimeout(() => {
      détacher();
      rejeter(new Error('Délai dépassé : résultat de pêche absent.'));
    }, 5_000);
    détacher = salle.onMessage(NOMS_MESSAGES.resultatPeche, (message: unknown) => {
      clearTimeout(délai);
      détacher();
      résoudre(message as MessageResultatPeche);
    });
  });
}

function préparerJoueur(salle: Room<unknown, EtatSalle>): Promise<void> {
  salle.send(NOMS_MESSAGES.preparerPecheE2E, { preparation: true });
  const zone = genererMonde('peche-mvp-v1').zonesPeche[0]!;
  return attendreCondition(
    salle,
    () =>
      Math.abs(
        (salle.state.joueurs.get(salle.sessionId)?.transformation.x ?? Number.POSITIVE_INFINITY) -
          zone.centre.x,
      ) < 0.001,
    'joueur préparé dans la zone de pêche',
  );
}

function lancer(salle: Room<unknown, EtatSalle>, sequence: number): void {
  const zone = genererMonde('peche-mvp-v1').zonesPeche[0]!;
  const joueur = salle.state.joueurs.get(salle.sessionId)!;
  const origine = {
    x: joueur.transformation.x,
    y: joueur.transformation.y + 1.62,
    z: joueur.transformation.z,
  };
  const direction = normaliserDirection({
    x: zone.centre.x - origine.x,
    y: zone.centre.y - origine.y,
    z: zone.centre.z - origine.z,
  });
  salle.send(NOMS_MESSAGES.lancerPeche, {
    sequence,
    zoneId: zone.id,
    origineX: origine.x,
    origineY: origine.y,
    origineZ: origine.z,
    directionX: direction.x,
    directionY: direction.y,
    directionZ: direction.z,
    flotteurX: zone.centre.x,
    flotteurY: zone.centre.y,
    flotteurZ: zone.centre.z,
  });
}

describe('pêche autoritaire en salle Colyseus', () => {
  it('synchronise une ligne et refuse toute action d’un autre joueur', async () => {
    const horloge = creerHorlogeSimulation(0, false);
    const première = await rejoindre(horloge);
    const seconde = await rejoindreMemeSalle(première.salle);
    await attendreCondition(
      première.salle,
      () => première.salle.state.joueurs.size === 2,
      'deux joueurs',
    );
    await préparerJoueur(première.salle);

    lancer(première.salle, 1);
    await attendreCondition(
      première.salle,
      () => première.salle.state.lignesPeche.get(première.salle.sessionId)?.phase === 'attente',
      'phase attente côté A',
    );
    await attendreCondition(
      seconde,
      () => seconde.state.lignesPeche.get(première.salle.sessionId)?.phase === 'attente',
      'phase attente observée côté B',
    );
    expect(seconde.state.lignesPeche.size).toBe(1);

    const départB = new Promise<number>((résoudre) => seconde.onLeave.once(résoudre));
    seconde.send(NOMS_MESSAGES.releverPeche, { sequence: 1 });
    await expect(départB).resolves.toBe(4003);
    sallesOuvertes.splice(sallesOuvertes.indexOf(seconde), 1);
    expect(première.salle.state.lignesPeche.has(première.salle.sessionId)).toBe(true);
  });

  it('décide trop tôt, prise au début de morsure et trop tard avec l’horloge injectée', async () => {
    const horloge = creerHorlogeSimulation(0, false);
    const { salle } = await rejoindre(horloge);
    await préparerJoueur(salle);

    const premièrePrévision = calculerPrevisionPeche('peche-mvp-v1', 1);
    lancer(salle, 1);
    horloge.avancerMs(premièrePrévision.delaiMorsureMs - 1);
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.get(salle.sessionId)?.phase === 'attente',
      'attente avant morsure',
    );
    const tropTôt = attendreRésultat(salle);
    salle.send(NOMS_MESSAGES.releverPeche, { sequence: 1 });
    await expect(tropTôt).resolves.toMatchObject({ resultat: 'trop_tot', sequence: 1 });

    horloge.avancerMs(250);
    lancer(salle, 2);
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.get(salle.sessionId)?.sequence === 2,
      'lancer de la deuxième ligne',
    );
    const prise = attendreRésultat(salle);
    horloge.avancerMs(calculerPrevisionPeche('peche-mvp-v1', 2).delaiMorsureMs);
    salle.send(NOMS_MESSAGES.releverPeche, { sequence: 2 });
    await expect(prise).resolves.toMatchObject({ resultat: 'prise', sequence: 2 });

    horloge.avancerMs(250);
    lancer(salle, 3);
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.get(salle.sessionId)?.sequence === 3,
      'lancer de la troisième ligne',
    );
    const tropTard = attendreRésultat(salle);
    horloge.avancerMs(
      calculerPrevisionPeche('peche-mvp-v1', 3).delaiMorsureMs + DUREE_FENETRE_MORSURE_MS + 1,
    );
    await expect(tropTard).resolves.toMatchObject({ resultat: 'trop_tard', sequence: 3 });
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.size === 0,
      'nettoyage après trop tard',
    );
  });
});
