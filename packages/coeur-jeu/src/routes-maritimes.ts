import type { Coordonnees } from './ia-pirate.js';
import { genererMonde, hauteurSurfaceIle, type DescripteurMonde } from './monde.js';

/** Une route fermée, exprimée dans le plan horizontal du monde. */
export interface RouteMaritime {
  readonly id: string;
  readonly points: readonly Coordonnees[];
  readonly vitesse: number;
}

export const MARGE_ROUTE_MARITIME = 3;
export const VITESSE_PATROUILLE_MARITIME = 2.4;

/** Construit des routes de patrouille stables et éloignées des volumes d'île. */
export function genererRoutesMaritimes(
  graine: string,
  monde?: DescripteurMonde,
): readonly RouteMaritime[];
export function genererRoutesMaritimes(
  monde: DescripteurMonde,
  graine?: string,
): readonly RouteMaritime[];
export function genererRoutesMaritimes(
  graineOuMonde: string | DescripteurMonde = 'mvp-defaut',
  mondeOuGraine?: DescripteurMonde | string,
): readonly RouteMaritime[] {
  const graine =
    typeof graineOuMonde === 'string'
      ? graineOuMonde
      : typeof mondeOuGraine === 'string'
        ? mondeOuGraine
        : graineOuMonde.graine;
  const monde =
    typeof graineOuMonde === 'string'
      ? mondeOuGraine instanceof Object && typeof mondeOuGraine !== 'string'
        ? mondeOuGraine
        : genererMonde(graine)
      : graineOuMonde;
  const décalage = (graine.length % 3) - 1;
  const routes: RouteMaritime[] = [
    {
      id: 'route-maritime-1',
      vitesse: VITESSE_PATROUILLE_MARITIME,
      points: [
        { x: -18 + décalage, z: -11 },
        { x: -9, z: -18 + décalage },
        { x: 11 - décalage, z: -17 },
        { x: 18, z: -8 - décalage },
        { x: 12, z: 10 + décalage },
        { x: -10, z: 11 },
      ],
    },
    {
      id: 'route-maritime-2',
      vitesse: VITESSE_PATROUILLE_MARITIME,
      points: [
        { x: -80, z: -72 },
        { x: -25, z: -78 },
        { x: 30, z: -74 },
        { x: 82, z: -67 },
        { x: 58, z: -92 },
        { x: -48, z: -91 },
      ],
    },
    {
      id: 'route-maritime-3',
      vitesse: VITESSE_PATROUILLE_MARITIME,
      points: [
        { x: -82, z: 78 },
        { x: -30, z: 84 },
        { x: 28, z: 82 },
        { x: 84, z: 76 },
        { x: 62, z: 98 },
        { x: -55, z: 96 },
      ],
    },
  ];

  return routes.filter((route) => routeMaritimeValide(route, monde));
}

export type PointRouteMaritime = Coordonnees;

export const MARGE_SECURITE_ROUTE_MARITIME = MARGE_ROUTE_MARITIME;
export const pointRouteMaritimeSûr = positionMerValide;
export const routeMaritimeÉviteIles = routeMaritimeValide;

/** Retourne un point interpolé sur une route fermée, avec progression [0, 1]. */
export function obtenirPointSurRouteMaritime(
  route: RouteMaritime,
  progression: number,
): Coordonnees {
  const longueurTotale = route.points.reduce(
    (total, point, index) =>
      total +
      Math.hypot(
        route.points[(index + 1) % route.points.length]!.x - point.x,
        route.points[(index + 1) % route.points.length]!.z - point.z,
      ),
    0,
  );
  let distance = (((progression % 1) + 1) % 1) * longueurTotale;
  for (let index = 0; index < route.points.length; index += 1) {
    const départ = route.points[index]!;
    const arrivée = route.points[(index + 1) % route.points.length]!;
    const longueur = Math.hypot(arrivée.x - départ.x, arrivée.z - départ.z);
    if (distance <= longueur) {
      const ratio = longueur <= Number.EPSILON ? 0 : distance / longueur;
      return {
        x: départ.x + (arrivée.x - départ.x) * ratio,
        z: départ.z + (arrivée.z - départ.z) * ratio,
      };
    }
    distance -= longueur;
  }
  return { ...route.points[0]! };
}

/** Vérifie les points et les segments d'une route avec une marge de sécurité. */
export function routeMaritimeValide(
  route: RouteMaritime,
  monde: DescripteurMonde,
  marge = MARGE_ROUTE_MARITIME,
): boolean {
  if (route.points.length < 2 || !Number.isFinite(route.vitesse) || route.vitesse <= 0) {
    return false;
  }

  for (let index = 0; index < route.points.length; index += 1) {
    const point = route.points[index]!;
    const suivant = route.points[(index + 1) % route.points.length]!;
    const distance = Math.hypot(suivant.x - point.x, suivant.z - point.z);
    const pas = Math.max(1, Math.ceil(distance / 1.5));
    for (let étape = 0; étape <= pas; étape += 1) {
      const ratio = étape / pas;
      const échantillon = {
        x: point.x + (suivant.x - point.x) * ratio,
        z: point.z + (suivant.z - point.z) * ratio,
      };
      if (!positionMerValide(échantillon, monde, marge)) {
        return false;
      }
    }
  }
  return true;
}

/** Teste une position de coque basse sans accepter une collision d'île. */
export function positionMerValide(
  position: Coordonnees,
  monde: DescripteurMonde,
  marge = MARGE_ROUTE_MARITIME,
): boolean {
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.z) ||
    Math.abs(position.x) > monde.ocean.largeur / 2 - marge ||
    Math.abs(position.z) > monde.ocean.profondeur / 2 - marge
  ) {
    return false;
  }

  return monde.iles.every((ile) => {
    const surface = hauteurSurfaceIle(ile, { x: position.x, y: 0.5, z: position.z });
    return surface === undefined;
  });
}
