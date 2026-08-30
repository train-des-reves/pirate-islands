import { describe, expect, it } from 'vitest';

import { AXES, UNITES, creerPoint3D } from '@pirate/coeur-jeu';
import { creerReponseSante, estReponseSante, VERSION_PROTOCOLE } from '@pirate/protocole';
import { PORT_SERVEUR_DE_TEST, reponseSanteValide } from '@pirate/support-tests';

describe('contrats partagés', () => {
  it('expose le protocole de santé versionné', () => {
    const réponse = creerReponseSante(new Date('2026-08-30T18:00:00.000Z'));

    expect(VERSION_PROTOCOLE).toBe('0.1.0');
    expect(réponse).toEqual({
      status: 'ok',
      service: 'serveur',
      protocolVersion: '0.1.0',
      timestamp: '2026-08-30T18:00:00.000Z',
    });
    expect(estReponseSante(réponse)).toBe(true);
    expect(reponseSanteValide(réponse)).toBe(true);
  });

  it('expose les axes et unités du monde', () => {
    expect(AXES).toEqual({ x: 'est-ouest', y: 'vertical', z: 'nord-sud' });
    expect(UNITES.temps).toBe('seconde');
    expect(creerPoint3D(1, 2, 3)).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('réserve le port éphémère pour les tests serveur', () => {
    expect(PORT_SERVEUR_DE_TEST).toBe(0);
  });
});
