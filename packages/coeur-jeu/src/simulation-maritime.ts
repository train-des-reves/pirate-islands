import type { Coordonnees } from './ia-pirate.js';
import { PROFIL_MER } from './ia-pirate.js';
import {
  genererRoutesMaritimes,
  positionMerValide,
  type RouteMaritime,
} from './routes-maritimes.js';
import { genererMonde, type DescripteurMonde } from './monde.js';

export const PAS_SIMULATION_MARITIME = 0.05;
export const NOMBRE_BATEAUX_PIRATES_MARITIMES = 2;
export const SANTE_BATEAU_PIRATE_MARITIME = 100;
export const DEGATS_ATTAQUE_PIRATE_MARITIME = 20;
export const PAS_SIMULATION_MARITIME_SEC = PAS_SIMULATION_MARITIME;
export const NOMBRE_BATEAUX_PIRATES_MAX = NOMBRE_BATEAUX_PIRATES_MARITIMES;
export const DEGATS_ATTAQUE_PIRATE = DEGATS_ATTAQUE_PIRATE_MARITIME;

export type EtatMaritime = 'patrouille' | 'poursuite' | 'attaque' | 'retour' | 'detruit';

export interface CibleMaritime {
  readonly id: string;
  readonly position: Coordonnees;
  readonly vivant?: boolean;
}

export interface AttaqueMaritime {
  readonly bateauId: string;
  readonly cibleId: string;
  readonly degats: number;
}

export interface EtatBateauPirateMaritime {
  readonly id: string;
  readonly position: Coordonnees;
  readonly cap: number;
  readonly vitesse: number;
  readonly sante: number;
  readonly etat: EtatMaritime;
  readonly cibleId: string;
  readonly routeId: string;
}

export interface SortieSimulationMaritime {
  readonly bateaux: readonly EtatBateauPirateMaritime[];
  readonly attaques: readonly AttaqueMaritime[];
}

interface BateauInterne {
  readonly id: string;
  position: Coordonnees;
  cap: number;
  vitesse: number;
  sante: number;
  etat: EtatMaritime;
  cibleId: string;
  readonly routeId: string;
  route: RouteMaritime;
  indexPoint: number;
  temporisateurAttaque: number;
}

export interface OptionsSimulationMaritime {
  readonly graine?: string;
  readonly monde?: DescripteurMonde;
  readonly nombreBateaux?: number;
}

/** Simulation serveur déterministe des rencontres de bateaux pirates en mer. */
export class SimulationPiratesMaritimes {
  public readonly monde: DescripteurMonde;
  public readonly routes: readonly RouteMaritime[];
  private readonly bateaux = new Map<string, BateauInterne>();

  public constructor(options: OptionsSimulationMaritime) {
    const graine = options.graine ?? options.monde?.graine ?? 'mvp-defaut';
    this.monde = options.monde ?? genererMonde(graine);
    this.routes = genererRoutesMaritimes(graine, this.monde);
    const nombre = Math.max(
      0,
      Math.min(options.nombreBateaux ?? NOMBRE_BATEAUX_PIRATES_MARITIMES, this.routes.length),
    );
    for (let index = 0; index < nombre; index += 1) {
      const route = this.routes[index]!;
      const point = route.points[0]!;
      const suivant = route.points[1]!;
      this.bateaux.set('bateau-pirate-' + (index + 1), {
        id: 'bateau-pirate-' + (index + 1),
        position: { ...point },
        cap: angleVers(point, suivant),
        vitesse: 0,
        sante: SANTE_BATEAU_PIRATE_MARITIME,
        etat: 'patrouille',
        cibleId: '',
        routeId: route.id,
        route,
        indexPoint: 1,
        temporisateurAttaque: 0,
      });
    }
  }

  public lireEtats(): readonly EtatBateauPirateMaritime[] {
    return [...this.bateaux.values()].map((bateau) => étatPublic(bateau));
  }

  public actualiser(
    deltaSecondes: number,
    cibles: readonly CibleMaritime[],
  ): SortieSimulationMaritime {
    const delta = Number.isFinite(deltaSecondes) ? Math.max(0, deltaSecondes) : 0;
    const attaques: AttaqueMaritime[] = [];
    for (const bateau of this.bateaux.values()) {
      if (bateau.etat === 'detruit') {
        continue;
      }
      const cible = choisirCible(bateau.position, cibles);
      if (cible && distance(bateau.position, cible.position) <= PROFIL_MER.porteePerception) {
        bateau.cibleId = cible.id;
        if (distance(bateau.position, cible.position) <= PROFIL_MER.porteeAttaque) {
          bateau.etat = 'attaque';
          bateau.vitesse = 0;
          bateau.cap = angleVers(bateau.position, cible.position);
          bateau.temporisateurAttaque = Math.max(0, bateau.temporisateurAttaque - delta);
          if (bateau.temporisateurAttaque <= 0) {
            attaques.push({
              bateauId: bateau.id,
              cibleId: cible.id,
              degats: DEGATS_ATTAQUE_PIRATE_MARITIME,
            });
            bateau.temporisateurAttaque = PROFIL_MER.cadenceAttaque;
          }
          continue;
        }
        bateau.etat = 'poursuite';
        bateau.vitesse = PROFIL_MER.vitessePoursuite;
        avancer(bateau, cible.position, delta, this.monde);
        continue;
      }

      if (bateau.cibleId !== '') {
        bateau.etat = 'retour';
        bateau.cibleId = '';
      } else {
        bateau.etat = 'patrouille';
      }
      bateau.vitesse =
        bateau.etat === 'retour' ? PROFIL_MER.vitesseRetour : PROFIL_MER.vitessePatrouille;
      const point = bateau.route.points[bateau.indexPoint]!;
      if (avancer(bateau, point, delta, this.monde)) {
        bateau.indexPoint = (bateau.indexPoint + 1) % bateau.route.points.length;
      }
    }
    return { bateaux: this.lireEtats(), attaques };
  }

  public appliquerDegats(bateauId: string, degats: number): boolean {
    const bateau = this.bateaux.get(bateauId);
    if (!bateau || bateau.etat === 'detruit' || !Number.isFinite(degats) || degats < 0) {
      return false;
    }
    bateau.sante = Math.max(0, bateau.sante - degats);
    if (bateau.sante === 0) {
      bateau.etat = 'detruit';
      bateau.vitesse = 0;
      bateau.cibleId = '';
      bateau.temporisateurAttaque = 0;
    }
    return true;
  }

  public detruire(bateauId: string): void {
    const bateau = this.bateaux.get(bateauId);
    if (!bateau) {
      return;
    }
    bateau.sante = 0;
    bateau.etat = 'detruit';
    bateau.vitesse = 0;
    bateau.cibleId = '';
    bateau.temporisateurAttaque = 0;
  }

  public lireEtatInitial(): SortieSimulationMaritime {
    return this.actualiser(0, []);
  }
}

function étatPublic(bateau: BateauInterne): EtatBateauPirateMaritime {
  return {
    id: bateau.id,
    position: { ...bateau.position },
    cap: bateau.cap,
    vitesse: bateau.vitesse,
    sante: bateau.sante,
    etat: bateau.etat,
    cibleId: bateau.cibleId,
    routeId: bateau.routeId,
  };
}

function choisirCible(
  position: Coordonnees,
  cibles: readonly CibleMaritime[],
): CibleMaritime | undefined {
  return cibles
    .filter((cible) => cible.vivant !== false)
    .sort(
      (premier, second) =>
        distance(position, premier.position) - distance(position, second.position),
    )[0];
}

function avancer(
  bateau: BateauInterne,
  cible: Coordonnees,
  delta: number,
  monde: DescripteurMonde,
): boolean {
  const distanceCible = distance(bateau.position, cible);
  if (distanceCible <= 0.001) {
    bateau.position = { ...cible };
    return true;
  }
  bateau.cap = angleVers(bateau.position, cible);
  const déplacement = Math.min(distanceCible, bateau.vitesse * delta);
  const proposition = {
    x: bateau.position.x + ((cible.x - bateau.position.x) / distanceCible) * déplacement,
    z: bateau.position.z + ((cible.z - bateau.position.z) / distanceCible) * déplacement,
  };
  if (positionMerValide(proposition, monde)) {
    bateau.position = proposition;
  }
  return déplacement >= distanceCible - 0.001;
}

function distance(premier: Coordonnees, second: Coordonnees): number {
  return Math.hypot(premier.x - second.x, premier.z - second.z);
}

function angleVers(source: Coordonnees, cible: Coordonnees): number {
  return Math.atan2(cible.z - source.z, cible.x - source.x);
}
