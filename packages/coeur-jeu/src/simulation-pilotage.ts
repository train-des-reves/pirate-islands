/** Simulation serveur du pilotage autoritaire du bateau de pêche. */

/** Constantes de simulation du bateau, partagées par le serveur et les tests. */
export const VITESSE_MAXIMALE_BATEAU = 12;
export const VITESSE_MAXIMALE_RECUL_BATEAU = 3;
export const ACCELERATION_BATEAU = 4.5;
export const TRAINEE_BATEAU = 1.6;
export const VITESSE_ANGULAIRE_MAXIMALE_BATEAU = 1.1;
export const DELTA_SIMULATION_BATEAU = 0.05;

/** Intentions normalisées conservées par le serveur entre deux pas fixes. */
export interface IntentionsPilotageServeur {
  readonly poussee: number;
  readonly gouvernail: number;
}

/** État serveur complet d'un bateau de pêche. */
export interface EtatBateauPilotage {
  readonly id: string;
  proprietaireSessionId: string;
  piloteSessionId: string | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  vitesse: number;
  vitesseAngulaire: number;
  dernierSequence: number;
  dernierEnvoiMs: number;
}

/** Crée un état initial pour un bateau. */
export function creerEtatBateauPilotage(
  id: string,
  proprietaireSessionId: string,
  positionX = 0,
  positionY = 0.04,
  positionZ = 0,
  rotationY = 0,
): EtatBateauPilotage {
  return {
    id,
    proprietaireSessionId,
    piloteSessionId: null,
    positionX,
    positionY,
    positionZ,
    rotationY,
    vitesse: 0,
    vitesseAngulaire: 0,
    dernierSequence: 0,
    dernierEnvoiMs: 0,
  };
}

/** Simule exactement un pas fixe avec l'intention actuellement retenue. */
export function simulerPasPilotage(
  bateau: EtatBateauPilotage,
  intentions: IntentionsPilotageServeur,
): void {
  const poussee = bornerCommande(intentions.poussee);
  const gouvernail = bornerCommande(intentions.gouvernail);
  const delta = DELTA_SIMULATION_BATEAU;

  let nouvelleVitesse = Number.isFinite(bateau.vitesse) ? bateau.vitesse : 0;
  if (Math.abs(poussee) > 0.01) {
    nouvelleVitesse += poussee * ACCELERATION_BATEAU * delta;
  }
  nouvelleVitesse -= nouvelleVitesse * TRAINEE_BATEAU * delta;

  const vitesseMax = poussee >= 0 ? VITESSE_MAXIMALE_BATEAU : VITESSE_MAXIMALE_RECUL_BATEAU;
  nouvelleVitesse = Math.max(-vitesseMax, Math.min(vitesseMax, nouvelleVitesse));

  const effetVitesse =
    Math.abs(nouvelleVitesse) > 0.01 ? Math.min(1, Math.abs(nouvelleVitesse) / 2) : 0;
  const sens = nouvelleVitesse < -0.01 ? -1 : 1;
  const vitesseAngulaire = Math.max(
    -VITESSE_ANGULAIRE_MAXIMALE_BATEAU,
    Math.min(
      VITESSE_ANGULAIRE_MAXIMALE_BATEAU,
      gouvernail * sens * VITESSE_ANGULAIRE_MAXIMALE_BATEAU * effetVitesse,
    ),
  );

  const rotation = Number.isFinite(bateau.rotationY) ? bateau.rotationY : 0;
  const deplacement = nouvelleVitesse * delta;
  bateau.positionX += Math.sin(rotation) * deplacement;
  bateau.positionZ += Math.cos(rotation) * deplacement;
  bateau.rotationY = normaliserAngle(rotation + vitesseAngulaire * delta);
  bateau.vitesse = nouvelleVitesse;
  bateau.vitesseAngulaire = vitesseAngulaire;
}

/** Applique une intention de pilotage au bateau. Retourne true si acceptée. */
export function appliquerIntentionPilotage(
  bateau: EtatBateauPilotage,
  sessionIdPilote: string,
  sequence: number,
  poussee: number,
  gouvernail: number,
  maintenantMs: number,
): boolean {
  if (bateau.piloteSessionId !== sessionIdPilote) {
    return false;
  }
  if (!Number.isSafeInteger(sequence) || sequence <= bateau.dernierSequence) {
    return false;
  }
  if (
    !Number.isFinite(poussee) ||
    !Number.isFinite(gouvernail) ||
    poussee < -1 ||
    poussee > 1 ||
    gouvernail < -1 ||
    gouvernail > 1
  ) {
    return false;
  }
  if (!Number.isFinite(maintenantMs)) {
    return false;
  }
  if (bateau.dernierEnvoiMs > 0 && maintenantMs - bateau.dernierEnvoiMs < 50) {
    return false;
  }

  simulerPasPilotage(bateau, { poussee, gouvernail });
  bateau.dernierSequence = sequence;
  bateau.dernierEnvoiMs = maintenantMs;
  return true;
}

/** Applique la traînée au bateau lorsqu'aucun pilote ne tient la barre. */
export function appliquerTraînéeBateau(bateau: EtatBateauPilotage, deltaSecondes: number): void {
  if (bateau.piloteSessionId !== null) {
    return;
  }

  const delta = Number.isFinite(deltaSecondes) ? Math.max(0, deltaSecondes) : 0;
  const nouvelleVitesse =
    (Number.isFinite(bateau.vitesse) ? bateau.vitesse : 0) * Math.exp(-TRAINEE_BATEAU * delta * 2);
  bateau.vitesse = Math.abs(nouvelleVitesse) < 0.01 ? 0 : nouvelleVitesse;
  bateau.vitesseAngulaire =
    (Number.isFinite(bateau.vitesseAngulaire) ? bateau.vitesseAngulaire : 0) *
    Math.exp(-TRAINEE_BATEAU * delta * 3);
}

/** Avance un accumulateur en nombre de pas fixes et retourne le reliquat. */
export function avancerPilotageParPasFixes(
  bateau: EtatBateauPilotage,
  intentions: IntentionsPilotageServeur,
  deltaMs: number,
  accumulationMs = 0,
): number {
  let accumulation = Number.isFinite(accumulationMs) ? Math.max(0, accumulationMs) : 0;
  accumulation += Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  accumulation = Math.min(1_000, accumulation);

  while (accumulation >= DELTA_SIMULATION_BATEAU * 1_000) {
    simulerPasPilotage(bateau, intentions);
    accumulation -= DELTA_SIMULATION_BATEAU * 1_000;
  }

  return accumulation;
}

function bornerCommande(valeur: number): number {
  if (!Number.isFinite(valeur)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, valeur));
}

function normaliserAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
