import type {
  CiblePerçue,
  Coordonnees,
  EtatIaPirate,
  ProfilIaPirate,
  SortieIaPirate,
} from './ia-pirate.js';
import { MachineEtatPirate } from './ia-pirate.js';

/** Pas de simulation fixe par défaut, en secondes. */
export const PAS_SIMULATION_DEFAUT = 0.05;

/** Étape échantillonnée d'une simulation d'IA pirate. */
export interface EtapeSimulationPirate {
  readonly index: number;
  readonly temps: number;
  readonly etat: EtatIaPirate;
  readonly sortie: SortieIaPirate;
}

/** Entrée de cible pré-enregistrée pour un instant de simulation. */
export interface EntreeCibleSimulation {
  readonly instant: number;
  readonly cible: CiblePerçue | undefined;
}

/** Scénario pré-enregistré alimentant le visualiseur. */
export interface ScenarioSimulationPirate {
  readonly graine: string;
  readonly profil: ProfilIaPirate;
  readonly positionDepart: Coordonnees;
  readonly deltaSec: number;
  readonly dureeSec: number;
  readonly entreesCibles: readonly EntreeCibleSimulation[];
}

/** Résultat d'une simulation déterministe. */
export interface ResultatSimulationPirate {
  readonly graine: string;
  readonly profil: ProfilIaPirate;
  readonly pas: number;
  readonly etapes: readonly EtapeSimulationPirate[];
  readonly etatFinal: EtatIaPirate;
  readonly transitions: readonly EtatIaPirate[];
}

/** Construit un scénario d'IA à partir d'entrées fixes. */
export function creerScenario(options: {
  readonly graine: string;
  readonly profil: ProfilIaPirate;
  readonly positionDepart?: Coordonnees;
  readonly deltaSec?: number;
  readonly dureeSec?: number;
  readonly entreesCibles?: readonly EntreeCibleSimulation[];
}): ScenarioSimulationPirate {
  return {
    graine: options.graine,
    profil: options.profil,
    positionDepart: options.positionDepart ?? { x: 0, z: 0 },
    deltaSec: deltaSain(options.deltaSec ?? PAS_SIMULATION_DEFAUT),
    dureeSec: Math.max(0, deltaSain(options.dureeSec ?? 20)),
    entreesCibles: options.entreesCibles ?? [],
  };
}

/** Exécute une simulation d'IA à pas fixe et renvoie la chronologie. */
export function simulerIaPirate(scenario: ScenarioSimulationPirate): ResultatSimulationPirate {
  const delta = deltaSain(scenario.deltaSec);
  const duree = Math.max(0, deltaSain(scenario.dureeSec));
  if (delta <= 0 || duree <= 0) {
    return {
      graine: scenario.graine,
      profil: scenario.profil,
      pas: 0,
      etapes: [],
      etatFinal: 'inactif',
      transitions: [],
    };
  }

  const machine = new MachineEtatPirate({
    graine: scenario.graine,
    profil: scenario.profil,
    positionDepart: scenario.positionDepart,
  });
  const etapes: EtapeSimulationPirate[] = [];
  const transitions: EtatIaPirate[] = [];
  let etatPrecedent = machine.lireEtat();
  const nombrePas = Math.floor(duree / delta);

  for (let index = 0; index < nombrePas; index += 1) {
    const temps = index * delta;
    const entree = trouverEntreeCible(scenario.entreesCibles, temps);
    const sortie = machine.actualiser(delta, entree);
    etapes.push({ index, temps, etat: sortie.etat, sortie });

    if (sortie.etat !== etatPrecedent) {
      transitions.push(sortie.etat);
      etatPrecedent = sortie.etat;
    }
  }

  return {
    graine: scenario.graine,
    profil: scenario.profil,
    pas: nombrePas,
    etapes,
    etatFinal: machine.lireEtat(),
    transitions,
  };
}

function trouverEntreeCible(
  entrees: readonly EntreeCibleSimulation[],
  temps: number,
): CiblePerçue | undefined {
  let cible: CiblePerçue | undefined;
  for (const entree of entrees) {
    if (entree.instant <= temps) {
      cible = entree.cible;
    } else {
      break;
    }
  }
  return cible;
}

function deltaSain(valeur: number): number {
  if (!Number.isFinite(valeur)) {
    return 0;
  }
  return Math.max(0, valeur);
}
