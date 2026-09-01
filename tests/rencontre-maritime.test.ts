import { describe, expect, it } from 'vitest';

import {
  MARGE_SECURITE_ROUTE_MARITIME,
  genererMonde,
  genererRoutesMaritimes,
  pointRouteMaritimeSûr,
  routeMaritimeÉviteIles,
} from '@pirate/coeur-jeu';

describe('routes maritimes ensemencées', () => {
  it('reste déterministe et produit des routes bornées hors des îles', () => {
    const monde = genererMonde('rencontre-maritime-test');
    const première = genererRoutesMaritimes(monde, 'graine-maritime');
    const seconde = genererRoutesMaritimes(monde, 'graine-maritime');

    expect(première).toEqual(seconde);
    expect(première.length).toBe(2);
    for (const route of première) {
      expect(routeMaritimeÉviteIles(route, monde)).toBe(true);
      for (const point of route.points) {
        expect(pointRouteMaritimeSûr(point, monde, MARGE_SECURITE_ROUTE_MARITIME)).toBe(true);
        expect(Math.abs(point.x)).toBeLessThanOrEqual(monde.ocean.largeur / 2);
        expect(Math.abs(point.z)).toBeLessThanOrEqual(monde.ocean.profondeur / 2);
      }
    }
  });

  it('varie le sens ou la translation avec une autre graine sans quitter les limites', () => {
    const monde = genererMonde();
    const première = genererRoutesMaritimes(monde, 'graine-a');
    const seconde = genererRoutesMaritimes(monde, 'graine-b');
    expect(seconde).not.toEqual(première);
    expect(seconde.every((route) => routeMaritimeÉviteIles(route, monde))).toBe(true);
  });
});
