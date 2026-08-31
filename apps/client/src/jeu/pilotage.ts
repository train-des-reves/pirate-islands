import type { DescripteurBateau, PointBateau, TypeAncrageBateau } from './bateau';
import type { Vecteur3 } from './mouvement';

/**
 * Modes de déplacement du joueur autour du bateau de pêche.
 * - `pied` : le joueur marche dans le monde, hors bateau.
 * - `bord` : le joueur est rattaché au référentiel du bateau et s'y déplace.
 * - `pilote` : le joueur tient la barre et injecte les intentions de pilotage.
 */
export type ModePilotage = 'pied' | 'bord' | 'pilote';

/** Invites en français affichées selon la proximité d'un point d'intérêt. */
export type InviteAction = 'prendre_barre' | 'embarquer' | 'debarcher' | 'aucune';

/** Intentions de pilotage, indépendantes du réseau et réutilisables. */
export interface IntentionsPilotage {
  /** Poussée normalisée, entre -1 (reculer) et 1 (avancer). */
  readonly poussee: number;
  /** Gouvernail normalisé, entre -1 (babord) et 1 (tribord). */
  readonly gouvernail: number;
}

export const INTENTIONS_AUCUNE: IntentionsPilotage = Object.freeze({
  poussee: 0,
  gouvernail: 0,
});

export interface EtatPilotage {
  readonly mode: ModePilotage;
  readonly invite: InviteAction;
}

export interface EtatBateauNavigation {
  readonly position: Vecteur3;
  readonly rotationY: number;
  /** Vitesse longitudinale du bateau en mètres par seconde. */
  readonly vitesse: number;
  /** Accélération longitudinale courante, mètres par seconde au carré. */
  readonly acceleration: number;
  /** Vitesse angulaire de rotation en radians par seconde. */
  readonly vitesseAngulaire: number;
  readonly collision: 'aucune' | 'rivage' | 'quai';
  readonly intensiteSillage: number;
}

export const VITESSE_MAXIMALE_BATEAU = 12;
export const VITESSE_MAXIMALE_RECUL_BATEAU = 3;
export const ACCELERATION_BATEAU = 4.5;
export const TRAINEE_BATEAU = 1.6;
export const VITESSE_ANGULAIRE_MAXIMALE_BATEAU = 1.1;
export const DELTA_MAXIMUM_SIMULATION_BATEAU = 0.25;

const EPSILON_POUSSEE = 0.01;
const EPSILON_DELTA = 0.0001;

export function bornerPoussee(poussee: number): number {
  if (!Number.isFinite(poussee)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, poussee));
}

export function bornerGouvernail(gouvernail: number): number {
  if (!Number.isFinite(gouvernail)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, gouvernail));
}

/** Calcule les intentions de poussée et de gouvernail depuis les actions sémantiques. */
export function calculerIntentionsDepuisActions(actions: {
  readonly avancer: boolean;
  readonly reculer: boolean;
  readonly gauche: boolean;
  readonly droite: boolean;
}): IntentionsPilotage {
  const avance = Number(actions.avancer) - Number(actions.reculer);
  const virement = Number(actions.droite) - Number(actions.gauche);
  return {
    poussee: bornerPoussee(avance),
    gouvernail: bornerGouvernail(virement),
  };
}

/** Applique accélération, traînée et borne la vitesse longitudinale. */
export function simulerVitesseBateau(
  vitesse: number,
  poussee: number,
  deltaSecondes: number,
  acceleration: number = ACCELERATION_BATEAU,
  trainee: number = TRAINEE_BATEAU,
): number {
  const delta = deltaSecondesSain(deltaSecondes);
  const pousseeSaine = bornerPoussee(poussee);
  const accel = Math.max(0, acceleration);
  const traine = Math.max(0, trainee);

  let prochaine = vitesse;
  if (Math.abs(pousseeSaine) > EPSILON_POUSSEE) {
    prochaine += pousseeSaine * accel * delta;
  }
  prochaine -= prochaine * traine * delta;

  const maximale = pousseeSaine >= 0 ? VITESSE_MAXIMALE_BATEAU : VITESSE_MAXIMALE_RECUL_BATEAU;
  return bornerNombre(prochaine, -maximale, maximale, 0);
}

/** Calcule la vitesse angulaire bornée à partir du gouvernail et de la vitesse. */
export function calculerVitesseAngulaireBateau(
  gouvernail: number,
  vitesse: number,
  vitesseAngulaireMaximale: number = VITESSE_ANGULAIRE_MAXIMALE_BATEAU,
): number {
  const gouvernailSain = bornerGouvernail(gouvernail);
  const max = Math.max(0, vitesseAngulaireMaximale);
  const effetVitesse = Math.abs(vitesse) > EPSILON_POUSSEE ? Math.min(1, Math.abs(vitesse) / 2) : 0;
  const sens = vitesse < -EPSILON_POUSSEE ? -1 : 1;
  return bornerNombre(gouvernailSain * sens * max * effetVitesse, -max, max, 0);
}

/** Fait tourner la position d'un point local autour de l'axe +Y. */
export function tournerPointLocal(point: Vecteur3, rotationY: number): Vecteur3 {
  const cosinus = Math.cos(rotationY);
  const sinus = Math.sin(rotationY);
  return {
    x: point.x * cosinus + point.z * sinus,
    y: point.y,
    z: -point.x * sinus + point.z * cosinus,
  };
}

/** Convertit une position locale au monde selon la position et la rotation du bateau. */
export function positionLocaleVersMonde(
  locale: Vecteur3,
  position: Vecteur3,
  rotationY: number,
): Vecteur3 {
  const tourne = tournerPointLocal(locale, rotationY);
  return {
    x: position.x + tourne.x,
    y: position.y + tourne.y,
    z: position.z + tourne.z,
  };
}

/** Convertit une position du monde en locale selon la position et la rotation du bateau. */
export function positionMondeVersLocale(
  monde: Vecteur3,
  position: Vecteur3,
  rotationY: number,
): Vecteur3 {
  return tournerPointLocal(
    {
      x: monde.x - position.x,
      y: monde.y - position.y,
      z: monde.z - position.z,
    },
    -rotationY,
  );
}

export const DISTANCE_INTERACTION_EMBARQUEMENT = 3;
export const DISTANCE_INTERACTION_BARRE = 2.2;
export const DISTANCE_INTERACTION_DEBARQUEMENT = 3.4;

export interface AncrageBateauChoisi {
  readonly id: string;
  readonly type: TypeAncrageBateau;
  readonly position: PointBateau;
}

export function distanceHorizontal(
  gauche: Pick<PointBateau, 'x' | 'z'>,
  droite: Pick<PointBateau, 'x' | 'z'>,
): number {
  return Math.hypot(gauche.x - droite.x, gauche.z - droite.z);
}

export function trouverAncreProche(
  ancres: readonly AncrageBateauChoisi[],
  positionJoueur: Pick<PointBateau, 'x' | 'z'>,
  typesCibles: readonly TypeAncrageBateau[],
  distanceMaximale: number,
): AncrageBateauChoisi | undefined {
  let plusProche: AncrageBateauChoisi | undefined;
  let distancePlusProche = Number.POSITIVE_INFINITY;
  for (const ancre of ancres) {
    if (!typesCibles.includes(ancre.type)) {
      continue;
    }
    const distance = distanceHorizontal(positionJoueur, ancre.position);
    if (distance <= distanceMaximale && distance < distancePlusProche) {
      plusProche = ancre;
      distancePlusProche = distance;
    }
  }
  return plusProche;
}

/** Détermine l'invite à afficher selon le mode et les ancres à proximité. */
export function determinerInvite(
  mode: ModePilotage,
  position: Pick<PointBateau, 'x' | 'z'>,
  ancres: readonly AncrageBateauChoisi[],
): InviteAction {
  if (mode === 'pilote') {
    return trouverAncreProche(ancres, position, ['barre'], DISTANCE_INTERACTION_BARRE)
      ? 'prendre_barre'
      : 'aucune';
  }
  if (mode === 'bord') {
    return trouverAncreProche(ancres, position, ['embarquement'], DISTANCE_INTERACTION_DEBARQUEMENT)
      ? 'debarcher'
      : 'aucune';
  }
  return trouverAncreProche(ancres, position, ['embarquement'], DISTANCE_INTERACTION_EMBARQUEMENT)
    ? 'embarquer'
    : 'aucune';
}

export function creerEtatPilotage(mode: ModePilotage = 'pied'): EtatPilotage {
  return { mode, invite: 'aucune' };
}

export function creerEtatNavigationBateau(
  position: Vecteur3 = { x: 0, y: 0, z: 0 },
  rotationY = 0,
): EtatBateauNavigation {
  return {
    position: { ...position },
    rotationY,
    vitesse: 0,
    acceleration: 0,
    vitesseAngulaire: 0,
    collision: 'aucune',
    intensiteSillage: 0,
  };
}

export interface ObstacleNavigation {
  readonly id: string;
  readonly type: 'rivage' | 'quai';
  readonly centre: Vecteur3;
  readonly rayonX: number;
  readonly rayonZ: number;
  readonly rotationY: number;
}

/** Simule la navigation bornée du bateau en tenant compte des collisions. */
export function simulerNavigationBateau(
  etat: EtatBateauNavigation,
  intentions: IntentionsPilotage,
  deltaSecondes: number,
  obstacles: readonly ObstacleNavigation[],
): EtatBateauNavigation {
  const delta = deltaSecondesSain(deltaSecondes);
  const positionDebut = { ...etat.position };
  const rotationDebut = etat.rotationY;
  const vitesse = simulerVitesseBateau(etat.vitesse, intentions.poussee, delta);
  const acceleration = delta > EPSILON_DELTA ? (vitesse - etat.vitesse) / delta : 0;
  const vitesseAngulaire = calculerVitesseAngulaireBateau(intentions.gouvernail, vitesse);
  const rotation = normaliserAngle(rotationDebut + vitesseAngulaire * delta);

  const deplacement = vitesse * delta;
  const directionAvant = {
    x: Math.sin(rotationDebut),
    y: 0,
    z: Math.cos(rotationDebut),
  };
  let position = {
    x: positionDebut.x + directionAvant.x * deplacement,
    y: positionDebut.y,
    z: positionDebut.z + directionAvant.z * deplacement,
  };

  const collision = resoudreCollisionRivage(position, rotation, obstacles);
  if (collision !== 'aucune') {
    position = { ...positionDebut };
  }

  return {
    position,
    rotationY: rotation,
    vitesse,
    acceleration,
    vitesseAngulaire,
    collision,
    intensiteSillage: Math.min(1, Math.max(0, Math.abs(vitesse) / VITESSE_MAXIMALE_BATEAU)),
  };
}

function resoudreCollisionRivage(
  position: Vecteur3,
  rotationY: number,
  obstacles: readonly ObstacleNavigation[],
): EtatBateauNavigation['collision'] {
  const points = coinsDuBateau(position, rotationY);
  for (const obstacle of obstacles) {
    const cosinus = Math.cos(-obstacle.rotationY);
    const sinus = Math.sin(-obstacle.rotationY);
    for (const point of points) {
      const relatif = {
        x: point.x - obstacle.centre.x,
        z: point.z - obstacle.centre.z,
      };
      const local = {
        x: relatif.x * cosinus - relatif.z * sinus,
        z: relatif.x * sinus + relatif.z * cosinus,
      };
      const distanceX = local.x / obstacle.rayonX;
      const distanceZ = local.z / obstacle.rayonZ;
      if (Math.hypot(distanceX, distanceZ) <= 1) {
        return obstacle.type;
      }
    }
  }
  return 'aucune';
}

function coinsDuBateau(position: Vecteur3, rotationY: number): readonly Vecteur3[] {
  // Demi-largeur et demi-longueur de la coque (unité = mètre).
  const local = [
    { x: -2.3, y: 0, z: -5.6 },
    { x: 2.3, y: 0, z: -5.6 },
    { x: -2.3, y: 0, z: 5.6 },
    { x: 2.3, y: 0, z: 5.6 },
  ] as const;
  return local.map((point) => positionLocaleVersMonde(point, position, rotationY));
}

function normaliserAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function deltaSecondesSain(delta: number): number {
  return Number.isFinite(delta) ? Math.max(0, Math.min(DELTA_MAXIMUM_SIMULATION_BATEAU, delta)) : 0;
}

function bornerNombre(valeur: number, minimum: number, maximum: number, repli: number): number {
  if (!Number.isFinite(valeur)) {
    return repli;
  }
  return Math.max(minimum, Math.min(maximum, valeur));
}

/** Position monde de l'ancre de barre d'un descripteur de bateau. */
export function positionBarre(descripteur: DescripteurBateau): Vecteur3 {
  const ancreBarre = descripteur.ancrages.find((ancre) => ancre.type === 'barre');
  if (!ancreBarre) {
    throw new Error('Le bateau doit exposer une ancre de barre.');
  }
  return { x: ancreBarre.position.x, y: ancreBarre.position.y, z: ancreBarre.position.z };
}

/** Position monde de l'ancre d'embarquement d'un descripteur de bateau. */
export function positionEmbarquement(descripteur: DescripteurBateau): Vecteur3 {
  const ancre = descripteur.ancrages.find((ancre) => ancre.type === 'embarquement');
  if (!ancre) {
    throw new Error('Le bateau doit exposer une ancre d’embarquement.');
  }
  return { x: ancre.position.x, y: ancre.position.y, z: ancre.position.z };
}
