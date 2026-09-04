/** Simulation serveur du pilotage autoritaire du bateau de pêche. */

import { genererMonde, type DescripteurMonde } from './monde.js';

/** Constantes de simulation du bateau, identiques au client. */
export const VITESSE_MAXIMALE_BATEAU = 12;
export const VITESSE_MAXIMALE_RECUL_BATEAU = 3;
export const ACCELERATION_BATEAU = 4.5;
export const TRAINEE_BATEAU = 1.6;
export const VITESSE_ANGULAIRE_MAXIMALE_BATEAU = 1.1;
export const DELTA_SIMULATION_BATEAU = 0.05;

/** État serveur complet d'un bateau de pêche. */
export interface EtatBateauPilotage {
  readonly id: string;
  readonly proprietaireSessionId: string;
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
  if (sequence <= bateau.dernierSequence) {
    return false;
  }

  // Borner les valeurs
  const pousseeBorne = Math.max(-1, Math.min(1, poussee));
  const gouvernailBorne = Math.max(-1, Math.min(1, gouvernail));

  // Calculer la vitesse
  const delta = DELTA_SIMULATION_BATEAU;
  let nouvelleVitesse = bateau.vitesse;

  if (Math.abs(pousseeBorne) > 0.01) {
    nouvelleVitesse += pousseeBorne * ACCELERATION_BATEAU * delta;
  }
  nouvelleVitesse -= nouvelleVitesse * TRAINEE_BATEAU * delta;

  const vitesseMax = pousseeBorne >= 0 ? VITESSE_MAXIMALE_BATEAU : VITESSE_MAXIMALE_RECUL_BATEAU;
  nouvelleVitesse = Math.max(-vitesseMax, Math.min(vitesseMax, nouvelleVitesse));

  // Calculer la vitesse angulaire
  const effetVitesse = Math.abs(nouvelleVitesse) > 0.01 ? Math.min(1, Math.abs(nouvelleVitesse) / 2) : 0;
  const sens = nouvelleVitesse < -0.01 ? -1 : 1;
  let vitesseAngulaire = Math.max(-VITESSE_ANGULAIRE_MAXIMALE_BATEAU,
    Math.min(VITESSE_ANGULAIRE_MAXIMALE_BATEAU,
      gouvernailBorne * sens * VITESSE_ANGULAIRE_MAXIMALE_BATEAU * effetVitesse));

  // Appliquer le déplacement
  const deplacement = nouvelleVitesse * delta;
  const directionAvant = {
    x: Math.sin(bateau.rotationY),
    z: Math.cos(bateau.rotationY),
  };

  const nouvelleRotation = bateau.rotationY + vitesseAngulaire * delta;
  const nouveauX = bateau.positionX + directionAvant.x * deplacement;
  const nouveauZ = bateau.positionZ + directionAvant.z * deplacement;

  // Mettre à jour l'état (mutabilité contrôlée côté serveur)
  (bateau as { vitesse: number }).vitesse = nouvelleVitesse;
  (bateau as { vitesseAngulaire: number }).vitesseAngulaire = vitesseAngulaire;
  (bateau as { rotationY: number }).rotationY = normaliserAngle(nouvelleRotation);
  (bateau as { positionX: number }).positionX = nouveauX;
  (bateau as { positionZ: number }).positionZ = nouveauZ;
  (bateau as { dernierSequence: number }).dernierSequence = sequence;
  (bateau as { dernierEnvoiMs: number }).dernierEnvoiMs = maintenantMs;

  return true;
}

/** Applique la traînée au bateau (appelé à chaque tick serveur). */
export function appliquerTraînéeBateau(bateau: EtatBateauPilotage, deltaSecondes: number): void {
  if (bateau.piloteSessionId === null) {
    // Sans pilote, le bateau ralentit rapidement
    const nouvelleVitesse = bateau.vitesse * (1 - TRAINEE_BATEAU * deltaSecondes * 2);
    (bateau as { vitesse: number }).vitesse = Math.abs(nouvelleVitesse) < 0.01 ? 0 : nouvelleVitesse;
    (bateau as { vitesseAngulaire: number }).vitesseAngulaire = bateau.vitesseAngulaire * (1 - TRAINEE_BATEAU * deltaSecondes * 3);
  }
}

function normaliserAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}