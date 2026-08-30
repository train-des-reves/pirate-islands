import { afterEach, describe, expect, it } from 'vitest';

import { estReponseSante } from '@pirate/protocole';

import { démarrerServeur, type ServeurDemarre } from '../apps/serveur/src/server.js';

let serveur: ServeurDemarre | undefined;

afterEach(async () => {
  await serveur?.arreter();
  serveur = undefined;
});

describe('serveur HTTP', () => {
  it('répond avec le contrat typé sur /health et un port éphémère', async () => {
    serveur = await démarrerServeur({ host: '127.0.0.1', port: 0 });

    const réponse = await fetch(`${serveur.url}/health`);
    const donnée: unknown = await réponse.json();

    expect(réponse.status).toBe(200);
    expect(réponse.headers.get('content-type')).toContain('application/json');
    expect(estReponseSante(donnée)).toBe(true);
    expect(serveur.port).toBeGreaterThan(0);
  });
});
