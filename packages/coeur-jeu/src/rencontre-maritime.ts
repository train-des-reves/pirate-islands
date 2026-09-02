import type { Point3D } from './index.js';
import type { DescripteurMonde } from './monde.js';
import { creerAleatoire } from './aleatoire.js';
import {
  MachineEtatPirate,
  PROFIL_MER,
  type CiblePerçue,
  type Coordonnees,
  type EtatIaPirate,
  type ProfilIaPirate,
  type SortieIaPirate,
} from './ia-pirate.js';

/** Marge ajoutée au volume horizontal des îles pour les routes maritimes. */
export const MARGE_SECURITE_ROUTE_MARITIME = 4;
/** Pas fixe partagé par la simulation serveur et ses tests. */
export const PAS_SIMULATION_MARITIME_SEC = 0.05;
/** Nombre maximal de sloops créés par une rencontre. */
export const NOMBRE_BATEAUX_PIRATES_MAX = 2;
/** Dégâts d'une attaque pirate validée par le serveur. */
export const DEGATS_ATTAQUE_PIRATE = 20;
/** Fenêtre déterministe de patrouille avant une nouvelle acquisition. */
export const DELAI_ACQUISITION_CIBLE_MARITIME_SEC = 3;

export type PointRouteMaritime = Coordonnees;

export interface RouteMaritime {
  readonly id: string;
  readonly points: readonly PointRouteMaritime[];
}

export interface AttaqueMaritime {
  readonly bateauId: string;
  readonly identifiantSequence: number;
  readonly cible: string;
  readonly degats: number;
}

export interface EtatBateauMaritimeSimulation {
  readonly id: string;
  readonly routeId: string;
  readonly position: Point3D;
  readonly cap: number;
  readonly vitesse: number;
  readonly etat: EtatIaPirate;
  readonly sortie: SortieIaPirate;
}

export interface SortieRencontreMaritime {
  readonly bateaux: readonly EtatBateauMaritimeSimulation[];
  readonly attaques: readonly AttaqueMaritime[];
}

const ROUTES_DE_BASE: readonly (readonly PointRouteMaritime[])[] = [
  [
    { x: 0, z: -18 },
    { x: 14, z: -18 },
    { x: 14, z: -7 },
    { x: -14, z: -7 },
    { x: -14, z: -18 },
  ],
  [
    { x: -76, z: -62 },
    { x: -46, z: -62 },
    { x: -46, z: -88 },
    { x: -76, z: -88 },
  ],
] as const;

function distance(premier: Coordonnees, second: Coordonnees): number {
  return Math.hypot(premier.x - second.x, premier.z - second.z);
}

function pointDansEllipseIle(
  point: Coordonnees,
  ile: DescripteurMonde['iles'][number],
  marge: number,
): boolean {
  const cosinus = Math.cos(ile.collision.rotationY);
  const sinus = Math.sin(ile.collision.rotationY);
  const dx = point.x - ile.collision.centre.x;
  const dz = point.z - ile.collision.centre.z;
  const localX = dx * cosinus + dz * sinus;
  const localZ = -dx * sinus + dz * cosinus;
  const rayonX = ile.collision.rayonX + marge;
  const rayonZ = ile.collision.rayonZ + marge;
  return (localX * localX) / (rayonX * rayonX) + (localZ * localZ) / (rayonZ * rayonZ) <= 1;
}

function pointDansLimites(point: Coordonnees, monde: DescripteurMonde): boolean {
  return (
    Math.abs(point.x) <= monde.ocean.largeur / 2 && Math.abs(point.z) <= monde.ocean.profondeur / 2
  );
}

/** Indique si un point de route est dans une zone sûre de l'océan. */
export function pointRouteMaritimeSûr(
  point: Coordonnees,
  monde: DescripteurMonde,
  marge = MARGE_SECURITE_ROUTE_MARITIME,
): boolean {
  return (
    pointDansLimites(point, monde) &&
    monde.iles.every((ile) => !pointDansEllipseIle(point, ile, marge))
  );
}

/** Vérifie points et segments, pas seulement les sommets, d'une route. */
export function routeMaritimeÉviteIles(
  route: RouteMaritime,
  monde: DescripteurMonde,
  marge = MARGE_SECURITE_ROUTE_MARITIME,
): boolean {
  if (route.points.length < 2) {
    return false;
  }

  for (let index = 0; index < route.points.length; index += 1) {
    const départ = route.points[index];
    const arrivée = route.points[(index + 1) % route.points.length];
    if (!départ || !arrivée || !pointRouteMaritimeSûr(départ, monde, marge)) {
      return false;
    }

    const longueur = distance(départ, arrivée);
    const pas = Math.max(1, Math.ceil(longueur / 1.5));
    for (let étape = 1; étape <= pas; étape += 1) {
      const ratio = étape / pas;
      const point = {
        x: départ.x + (arrivée.x - départ.x) * ratio,
        z: départ.z + (arrivée.z - départ.z) * ratio,
      };
      if (!pointRouteMaritimeSûr(point, monde, marge)) {
        return false;
      }
    }
  }

  return true;
}

function déplacerRoute(
  base: readonly PointRouteMaritime[],
  aleatoire: () => number,
): readonly PointRouteMaritime[] {
  const variationX = (aleatoire() * 2 - 1) * 1.5;
  const variationZ = (aleatoire() * 2 - 1) * 1.5;
  const inversée = aleatoire() >= 0.5;
  const points = base.map((point) => ({
    x: point.x + variationX,
    z: point.z + variationZ,
  }));
  return inversée ? [...points].reverse() : points;
}

/** Génère deux routes ensemencées, bornées et éloignées des volumes d'île. */
export function genererRoutesMaritimes(
  monde: DescripteurMonde,
  graine = monde.graine,
): readonly RouteMaritime[] {
  const aleatoire = creerAleatoire('routes-maritimes:' + graine);
  const routes: RouteMaritime[] = [];
  for (let index = 0; index < ROUTES_DE_BASE.length; index += 1) {
    const base = ROUTES_DE_BASE[index]!;
    const candidate = déplacerRoute(base, aleatoire);
    const points = routeMaritimeÉviteIles(
      { id: 'route-maritime-' + (index + 1), points: candidate },
      monde,
    )
      ? candidate
      : base;
    routes.push({ id: 'route-maritime-' + (index + 1), points });
  }
  return Object.freeze(
    routes.map((route) => Object.freeze({ ...route, points: Object.freeze([...route.points]) })),
  );
}

/** Retourne la position normalisée d'un navire sur une route fermée. */
export function obtenirPointSurRouteMaritime(
  route: RouteMaritime,
  progression: number,
): Coordonnees {
  const points = route.points;
  const longueurTotale = points.reduce(
    (total, point, index) => total + distance(point, points[(index + 1) % points.length]!),
    0,
  );
  let distanceCible = (((progression % 1) + 1) % 1) * longueurTotale;
  for (let index = 0; index < points.length; index += 1) {
    const départ = points[index]!;
    const arrivée = points[(index + 1) % points.length]!;
    const longueur = distance(départ, arrivée);
    if (distanceCible <= longueur) {
      const ratio = longueur <= Number.EPSILON ? 0 : distanceCible / longueur;
      return {
        x: départ.x + (arrivée.x - départ.x) * ratio,
        z: départ.z + (arrivée.z - départ.z) * ratio,
      };
    }
    distanceCible -= longueur;
  }
  return { ...points[0]! };
}

interface MachineMaritime {
  readonly id: string;
  readonly route: RouteMaritime;
  readonly machine: MachineEtatPirate;
}

export class SimulationPiratesMaritimes {
  public readonly routes: readonly RouteMaritime[];
  private readonly machines: readonly MachineMaritime[];
  private signatureCibles = '';
  private tempsDepuisChangementCibles = 0;

  public constructor(options: {
    readonly monde: DescripteurMonde;
    readonly graine?: string;
    readonly nombreBateaux?: number;
  }) {
    const graine = options.graine ?? options.monde.graine;
    this.routes = genererRoutesMaritimes(options.monde, graine);
    const nombre = Math.max(
      1,
      Math.min(NOMBRE_BATEAUX_PIRATES_MAX, Math.floor(options.nombreBateaux ?? 1)),
    );
    this.machines = this.routes.slice(0, nombre).map((route, index) => {
      const départ = route.points[0]!;
      const profil: ProfilIaPirate = {
        ...PROFIL_MER,
        pointAncrage: départ,
        routePatrouille: route.points,
      };
      return {
        id: 'bateau-pirate-' + (index + 1),
        route,
        machine: new MachineEtatPirate({
          graine: graine + ':bateau:' + (index + 1),
          profil,
          positionDepart: départ,
        }),
      };
    });
  }

  public actualiser(
    deltaSecondes: number,
    cibles: readonly CiblePerçue[],
  ): SortieRencontreMaritime {
    const signature = cibles
      .map((cible) => cible.id)
      .sort()
      .join('|');
    if (signature !== this.signatureCibles) {
      this.signatureCibles = signature;
      this.tempsDepuisChangementCibles = 0;
    } else {
      this.tempsDepuisChangementCibles += Number.isFinite(deltaSecondes)
        ? Math.max(0, deltaSecondes)
        : 0;
    }
    const ciblesDisponibles =
      this.tempsDepuisChangementCibles >= DELAI_ACQUISITION_CIBLE_MARITIME_SEC ? cibles : [];
    const attaques: AttaqueMaritime[] = [];
    const bateaux = this.machines.map((entrée) => {
      const position = entrée.machine.lirePosition();
      const cible = ciblesDisponibles.find(
        (candidate) =>
          distance(position, candidate.position) <= PROFIL_MER.porteePerception ||
          entrée.machine.lireCible()?.id === candidate.id,
      );
      const sortie = entrée.machine.actualiser(deltaSecondes, cible);
      if (sortie.intentionAttaque) {
        attaques.push({
          bateauId: entrée.id,
          identifiantSequence: sortie.intentionAttaque.identifiantSequence,
          cible: sortie.intentionAttaque.cible,
          degats: DEGATS_ATTAQUE_PIRATE,
        });
      }
      return {
        id: entrée.id,
        routeId: entrée.route.id,
        position: { x: sortie.position.x, y: 0, z: sortie.position.z },
        cap: sortie.cap,
        vitesse: sortie.intentionDeplacement?.vitesse ?? 0,
        etat: sortie.etat,
        sortie,
      };
    });
    return { bateaux, attaques };
  }

  public detruire(bateauId: string): void {
    const entrée = this.machines.find((machine) => machine.id === bateauId);
    entrée?.machine.tuer();
  }

  public lireEtatInitial(): SortieRencontreMaritime {
    return this.actualiser(0, []);
  }
}
