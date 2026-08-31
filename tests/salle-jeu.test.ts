import { afterEach, describe, expect, it } from 'vitest';

import { Client, type Room } from '@colyseus/sdk';

import {
  CAPACITE_SALLE,
  EtatSalleSchema,
  NOMS_MESSAGES,
  NOM_SALLE_JEU,
  type EtatSalle,
} from '@pirate/protocole';
import { démarrerServeur, type ServeurDemarre } from '../apps/serveur/src/server.js';

let serveur: ServeurDemarre | undefined;
const sallesOuvertes: Room<unknown, EtatSalle>[] = [];

afterEach(async () => {
  await Promise.all(sallesOuvertes.splice(0).map((salle) => salle.leave()));
  await serveur?.arreter();
  serveur = undefined;
});

async function ouvrirClient(): Promise<ReturnType<typeof creerClient>> {
  serveur ??= await démarrerServeur({ host: '127.0.0.1', port: 0 });
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
});
