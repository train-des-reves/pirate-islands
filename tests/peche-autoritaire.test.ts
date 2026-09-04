import { afterEach, describe, expect, it } from 'vitest';

import { Client, type Room } from '@colyseus/sdk';

import {
  calculerPrevisionPeche,
  DUREE_FENETRE_MORSURE_MS,
  genererMonde,
  normaliserDirection,
  PORTEE_PECHE,
} from '@pirate/coeur-jeu';
import {
  EtatSalleSchema,
  NOMS_MESSAGES,
  NOM_SALLE_JEU,
  SANTE_JOUEUR_MAXIMALE,
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

function attendreErreur(salle: Room<unknown, EtatSalle>): Promise<{ code: number; message?: string | undefined }> {
  return new Promise((résoudre, rejeter) => {
    let detacher = () => {};
    const délai = setTimeout(() => {
      detacher();
      rejeter(new Error('Délai dépassé : aucune erreur serveur reçue.'));
    }, 5_000);
    const cb = (code: number, message?: string) => {
      clearTimeout(délai);
      detacher();
      résoudre({ code, message });
    };
    detacher = () => salle.onError.remove(cb);
    salle.onError.once(cb);
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

function lancer(
  salle: Room<unknown, EtatSalle>,
  sequence: number,
  options: {
    flotteur?: { x: number; y: number; z: number };
    zoneId?: string;
    origine?: { x: number; y: number; z: number };
  } = {},
): void {
  const zone = genererMonde('peche-mvp-v1').zonesPeche[0]!;
  const joueur = salle.state.joueurs.get(salle.sessionId);
  const origine = options.origine ?? (joueur ? {
    x: joueur.transformation.x,
    y: joueur.transformation.y + 1.62,
    z: joueur.transformation.z,
  } : { x: 0, y: 1.62, z: 0 });
  const cible = options.flotteur ?? zone.centre;
  const direction = normaliserDirection({
    x: cible.x - origine.x,
    y: cible.y - origine.y,
    z: cible.z - origine.z,
  });
  salle.send(NOMS_MESSAGES.lancerPeche, {
    sequence,
    zoneId: options.zoneId ?? zone.id,
    origineX: origine.x,
    origineY: origine.y,
    origineZ: origine.z,
    directionX: direction.x,
    directionY: direction.y,
    directionZ: direction.z,
    flotteurX: cible.x,
    flotteurY: cible.y,
    flotteurZ: cible.z,
  });
}

describe('pêche autoritaire en salle Colyseus', () => {
  it('synchronise une ligne, refuse l’action d’un tiers sans déconnecter et ne mute pas la ligne existante', async () => {
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

    // B tente de relever la ligne de A sans déconnexion
    const erreurB = attendreErreur(seconde);
    seconde.send(NOMS_MESSAGES.releverPeche, { sequence: 1 });
    const erreur = await erreurB;
    expect(erreur.code).toBe(4003);
    expect(erreur.message).toContain('Aucune ligne active');

    // La ligne de A reste intacte et non mutée
    expect(première.salle.state.lignesPeche.has(première.salle.sessionId)).toBe(true);
    expect(première.salle.state.lignesPeche.get(première.salle.sessionId)?.phase).toBe('attente');
    expect(seconde.state.joueurs.size).toBe(2);
  });

  it('reflète le même résultat de prise aux deux clients et nettoie la ligne au départ de A', async () => {
    const horloge = creerHorlogeSimulation(0, false);
    const première = await rejoindre(horloge);
    const seconde = await rejoindreMemeSalle(première.salle);
    await attendreCondition(
      première.salle,
      () => première.salle.state.joueurs.size === 2,
      'deux joueurs',
    );
    await préparerJoueur(première.salle);

    const prévision = calculerPrevisionPeche('peche-mvp-v1', 1);
    lancer(première.salle, 1);
    await attendreCondition(
      première.salle,
      () => première.salle.state.lignesPeche.size === 1,
      'ligne lancée',
    );

    horloge.avancerMs(prévision.delaiMorsureMs);
    const résultatA = attendreRésultat(première.salle);
    const résultatB = attendreRésultat(seconde);

    première.salle.send(NOMS_MESSAGES.releverPeche, { sequence: 1 });

    const [resA, resB] = await Promise.all([résultatA, résultatB]);
    expect(resA.resultat).toBe('prise');
    expect(resB.resultat).toBe('prise');
    expect(resA.sequence).toBe(1);
    expect(resB.sequence).toBe(1);
    expect(resA.espece).toBe(resB.espece);

    // Déconnexion de A : la ligne est retirée et B observe compteur à zéro
    await première.salle.leave();
    sallesOuvertes.splice(sallesOuvertes.indexOf(première.salle), 1);
    await attendreCondition(
      seconde,
      () => seconde.state.lignesPeche.size === 0 && seconde.state.joueurs.size === 1,
      'compteur à zéro après départ de A',
    );
  });

  it('refuse le double lancer, la cadence trop rapide et les séquences dupliquées', async () => {
    const horloge = creerHorlogeSimulation(0, false);
    const { salle } = await rejoindre(horloge);
    await préparerJoueur(salle);

    lancer(salle, 1);
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.size === 1,
      'première ligne active',
    );

    // Double lancer refusé
    const errDouble = attendreErreur(salle);
    lancer(salle, 2);
    expect((await errDouble).message).toContain('Une ligne de pêche est déjà active');
    expect(salle.state.lignesPeche.size).toBe(1);

    // Annulation de la ligne 1
    salle.send(NOMS_MESSAGES.annulerPeche, { sequence: 1 });
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.size === 0,
      'ligne annulée',
    );

    // Cadence trop rapide (< 250 ms)
    const errCadence = attendreErreur(salle);
    lancer(salle, 2);
    expect((await errCadence).message).toContain('La cadence de pêche n’est pas respectée');

    // Avance au-delà de la cadence
    horloge.avancerMs(300);

    // Séquence déjà consommée (sequence <= derniereSequencePeche)
    const errSeq = attendreErreur(salle);
    lancer(salle, 1);
    expect((await errSeq).message).toContain('La séquence de pêche a déjà été consommée');

    // Séquence valide acceptée
    lancer(salle, 2);
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.size === 1,
      'deuxième ligne acceptée',
    );
  });

  it('refuse un lancer par un joueur mort, hors zone ou avec flotteur hors de portée', async () => {
    const horloge = creerHorlogeSimulation(0, false);
    const { salle } = await rejoindre(horloge);
    await attendreCondition(
      salle,
      () => salle.state.joueurs.has(salle.sessionId),
      'joueur local connecté',
    );

    // Joueur à l'apparition (hors zone de pêche de l'île)
    const errHorsZone = attendreErreur(salle);
    lancer(salle, 1);
    expect((await errHorsZone).message).toContain('Le joueur est hors de la zone de pêche');

    await préparerJoueur(salle);

    // Flotteur hors de portée (> 40 m)
    const errPortee = attendreErreur(salle);
    const zone = genererMonde('peche-mvp-v1').zonesPeche[0]!;
    lancer(salle, 1, { flotteur: { x: zone.centre.x + PORTEE_PECHE + 10, y: zone.centre.y, z: zone.centre.z } });
    expect((await errPortee).message).toContain('Le flotteur est hors de portée');

    // Mort du joueur
    salle.send(NOMS_MESSAGES.degatsE2E, { degats: SANTE_JOUEUR_MAXIMALE });
    await attendreCondition(
      salle,
      () => !(salle.state.joueurs.get(salle.sessionId)?.vivant),
      'joueur mort',
    );

    const errMort = attendreErreur(salle);
    lancer(salle, 1);
    expect((await errMort).message).toContain('Un joueur mort ne peut pas pêcher');
  });

  it('valide les 4 bornes temporelles exactes de morsure avec l’horloge injectée', async () => {
    const horloge = creerHorlogeSimulation(0, false);
    const { salle } = await rejoindre(horloge);
    await préparerJoueur(salle);

    // 1 ms avant morsure -> trop tôt
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

    // Début exact de morsure -> prise
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

    // Fin exacte de fenêtre de morsure -> prise
    horloge.avancerMs(250);
    lancer(salle, 3);
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.get(salle.sessionId)?.sequence === 3,
      'lancer de la troisième ligne',
    );
    const priseFin = attendreRésultat(salle);
    horloge.avancerMs(
      calculerPrevisionPeche('peche-mvp-v1', 3).delaiMorsureMs + DUREE_FENETRE_MORSURE_MS,
    );
    salle.send(NOMS_MESSAGES.releverPeche, { sequence: 3 });
    await expect(priseFin).resolves.toMatchObject({ resultat: 'prise', sequence: 3 });

    // 1 ms après fin de fenêtre de morsure -> trop tard
    horloge.avancerMs(250);
    lancer(salle, 4);
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.get(salle.sessionId)?.sequence === 4,
      'lancer de la quatrième ligne',
    );
    const tropTard = attendreRésultat(salle);
    horloge.avancerMs(
      calculerPrevisionPeche('peche-mvp-v1', 4).delaiMorsureMs + DUREE_FENETRE_MORSURE_MS + 1,
    );
    await expect(tropTard).resolves.toMatchObject({ resultat: 'trop_tard', sequence: 4 });
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.size === 0,
      'nettoyage après trop tard',
    );
  });

  it('annule et nettoie immédiatement la ligne à la mort du pêcheur', async () => {
    const horloge = creerHorlogeSimulation(0, false);
    const { salle } = await rejoindre(horloge);
    await préparerJoueur(salle);

    lancer(salle, 1);
    await attendreCondition(salle, () => salle.state.lignesPeche.size === 1, 'ligne active');

    // Mort pendant la pêche : annule et nettoie la ligne
    salle.send(NOMS_MESSAGES.degatsE2E, { degats: SANTE_JOUEUR_MAXIMALE });
    await attendreCondition(
      salle,
      () => salle.state.lignesPeche.size === 0,
      'ligne retirée suite à la mort',
    );
  });

  it('garantit qu’une prise réussie ne modifie ni la santé ni la position du joueur', async () => {
    const horloge = creerHorlogeSimulation(0, false);
    const { salle } = await rejoindre(horloge);
    await préparerJoueur(salle);

    const joueurAvant = salle.state.joueurs.get(salle.sessionId)!;
    const positionInitiale = { x: joueurAvant.transformation.x, y: joueurAvant.transformation.y, z: joueurAvant.transformation.z };
    const santeInitiale = joueurAvant.sante;

    const prévision = calculerPrevisionPeche('peche-mvp-v1', 1);
    lancer(salle, 1);
    await attendreCondition(salle, () => salle.state.lignesPeche.size === 1, 'ligne active');
    horloge.avancerMs(prévision.delaiMorsureMs);
    const résultat = attendreRésultat(salle);
    salle.send(NOMS_MESSAGES.releverPeche, { sequence: 1 });
    await expect(résultat).resolves.toMatchObject({ resultat: 'prise' });

    const joueurApres = salle.state.joueurs.get(salle.sessionId)!;
    expect(joueurApres.sante).toBe(santeInitiale);
    expect(joueurApres.transformation.x).toBeCloseTo(positionInitiale.x, 3);
    expect(joueurApres.transformation.z).toBeCloseTo(positionInitiale.z, 3);
  });
});
