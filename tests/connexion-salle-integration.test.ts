import { afterEach, describe, expect, it } from 'vitest';

import { Client } from '@colyseus/sdk';

import { EtatSalleSchema } from '@pirate/protocole';

import { connecterSalleJeu, type EtatAffichageConnexion } from '../apps/client/src/jeu/connexion-salle';
import { démarrerServeur, type ServeurDemarre } from '../apps/serveur/src/server.js';

let serveur: ServeurDemarre | undefined;

afterEach(async () => {
  await serveur?.arreter();
  serveur = undefined;
});

async function ouvrirServeur(): Promise<string> {
  serveur ??= await démarrerServeur({ host: '127.0.0.1', port: 0 });
  return serveur.url;
}

function créerCollecteur(): {
  readonly états: EtatAffichageConnexion[];
  readonly abonnement: { readonly surEtat: (etat: EtatAffichageConnexion) => void };
} {
  const états: EtatAffichageConnexion[] = [];
  return {
    états,
    abonnement: {
      surEtat: (etat) => états.push(etat),
    },
  };
}

async function attendreEtat(
  états: EtatAffichageConnexion[],
  prédicat: (etat: EtatAffichageConnexion) => boolean,
): Promise<EtatAffichageConnexion | undefined> {
  const trouvé = états.find(prédicat);
  if (trouvé) {
    return trouvé;
  }
  for (let tentative = 0; tentative < 50; tentative += 1) {
    await new Promise((résoudre) => setTimeout(résoudre, 50));
    const résultat = états.find(prédicat);
    if (résultat) {
      return résultat;
    }
  }
  return undefined;
}

describe('connecteur de salle Colyseus', () => {
  it('rejoint et publie l’état connecté avec la salle et le nombre de joueurs', async () => {
    const urlServeur = await ouvrirServeur();
    const collecteur = créerCollecteur();
    const connexion = await connecterSalleJeu(
      urlServeur,
      { nom: 'Pêcheur-Aube-0001' },
      collecteur.abonnement,
    );

    const connecte = await attendreEtat(
      collecteur.états,
      (etat) => etat.etat === 'connecte' && etat.nombreJoueurs === 1,
    );
    expect(connecte).toBeDefined();
    expect(connecte?.identifiantSalle).toBe(connexion.salleId);
    expect(connecte?.nom).toBe('Pêcheur-Aube-0001');
    expect(connecte?.nombreJoueurs).toBe(1);

    connexion.detruire();
  });

  it('synchronise deux joueurs puis décrémente après le départ', async () => {
    const urlServeur = await ouvrirServeur();
    const collecteurPremier = créerCollecteur();
    const premier = await connecterSalleJeu(
      urlServeur,
      { nom: 'Pêcheur-Aube-0001' },
      collecteurPremier.abonnement,
    );

    const collecteurSecond = créerCollecteur();
    const second = await connecterSalleJeu(
      urlServeur,
      { nom: 'Pêcheur-Brume-0002' },
      collecteurSecond.abonnement,
      premier.salleId,
    );

    const connectePremier = await attendreEtat(
      collecteurPremier.états,
      (etat) => etat.etat === 'connecte' && etat.nombreJoueurs === 2,
    );
    const connecteSecond = await attendreEtat(
      collecteurSecond.états,
      (etat) => etat.etat === 'connecte' && etat.nombreJoueurs === 2,
    );
    expect(connectePremier?.nombreJoueurs).toBe(2);
    expect(connecteSecond?.nombreJoueurs).toBe(2);

    second.detruire();
    const aprèsDépart = await attendreEtat(
      collecteurPremier.états,
      (etat) => etat.etat === 'connecte' && etat.nombreJoueurs === 1,
    );
    expect(aprèsDépart?.nombreJoueurs).toBe(1);

    premier.detruire();
  });

  it('détecte la salle pleine lors d’un neuvième joueur', async () => {
    const urlServeur = await ouvrirServeur();
    const collecteurHôte = créerCollecteur();
    const hôte = await connecterSalleJeu(
      urlServeur,
      { nom: 'Pêcheur-Aube-0001' },
      collecteurHôte.abonnement,
    );

    const connexions: Array<Awaited<ReturnType<typeof connecterSalleJeu>>> = [hôte];
    for (let index = 1; index < 8; index += 1) {
      const collecteur = créerCollecteur();
      const connexion = await connecterSalleJeu(
        urlServeur,
        { nom: 'Pêcheur-' + index },
        collecteur.abonnement,
        hôte.salleId,
      );
      connexions.push(connexion);
    }

    await new Promise((résoudre) => setTimeout(résoudre, 300));
    const collecteurRefusé = créerCollecteur();
    const refusé = await connecterSalleJeu(
      urlServeur,
      { nom: 'Pêcheur-Refusé' },
      collecteurRefusé.abonnement,
      hôte.salleId,
    );

    const dernier = collecteurRefusé.états.at(-1);
    expect(dernier?.etat).toBe('salle-pleine');
    expect(refusé.salleId).toBeUndefined();

    for (const connexion of connexions) {
      connexion.detruire();
    }
  });

  it('passe en échec lorsque le serveur est indisponible', async () => {
    const collecteur = créerCollecteur();
    const connexion = await connecterSalleJeu(
      'http://127.0.0.1:1',
      { nom: 'Pêcheur-Aube-0001' },
      collecteur.abonnement,
    );

    const dernier = collecteur.états.at(-1);
    expect(dernier?.etat).toBe('echec');
    expect(dernier?.message).toContain('Serveur indisponible');
    expect(connexion.salleId).toBeUndefined();
  });

  it('nettoye les abonnements de manière idempotente', async () => {
    const urlServeur = await ouvrirServeur();
    const collecteur = créerCollecteur();
    const connexion = await connecterSalleJeu(
      urlServeur,
      { nom: 'Pêcheur-Aube-0001' },
      collecteur.abonnement,
    );

    const salle = connexion.lireSalle();
    expect(salle).toBeDefined();
    expect(connexion.detruire).not.toThrow();
    expect(connexion.detruire).not.toThrow();

    const dernier = collecteur.états.at(-1);
    expect(dernier?.etat).toBe('deconnecte');
  });

  it('refuse les options d’identité serveur usurpées', async () => {
    const urlServeur = await ouvrirServeur();
    const client = new Client(urlServeur);
    await expect(
      client.joinOrCreate('jeu', { sessionId: 'usurpée' }, EtatSalleSchema),
    ).rejects.toThrow();
  });
});
