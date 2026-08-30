import type { EtatActions } from './entrees';

export interface Vecteur3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface BoiteCollision {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface MondeCollision {
  readonly solY: number;
  readonly murs: readonly BoiteCollision[];
  readonly rayonJoueur: number;
  readonly hauteurJoueur: number;
  readonly gravite: number;
}

export interface EtatJoueur {
  readonly position: Vecteur3;
  readonly vitesseVerticale: number;
  readonly auSol: boolean;
  readonly collision: 'aucune' | 'mur' | 'sol';
}

export const VITESSE_JOUEUR_PAR_DEFAUT = 4;
export const GRAVITE_PAR_DEFAUT = -18;
export const RAYON_JOUEUR_PAR_DEFAUT = 0.42;
export const HAUTEUR_JOUEUR_PAR_DEFAUT = 1.8;

export function creerMondeCollision(
  murs: readonly BoiteCollision[] = [],
  options: Partial<Omit<MondeCollision, 'murs'>> = {},
): MondeCollision {
  return {
    solY: options.solY ?? 0,
    murs,
    rayonJoueur: options.rayonJoueur ?? RAYON_JOUEUR_PAR_DEFAUT,
    hauteurJoueur: options.hauteurJoueur ?? HAUTEUR_JOUEUR_PAR_DEFAUT,
    gravite: options.gravite ?? GRAVITE_PAR_DEFAUT,
  };
}

export function creerEtatJoueur(position: Vecteur3 = { x: 0, y: 0, z: 0 }): EtatJoueur {
  return {
    position: { ...position },
    vitesseVerticale: 0,
    auSol: true,
    collision: 'aucune',
  };
}

/** Direction au sol, avec +Z comme avant du monde et +X vers la droite. */
export function calculerDirectionRelativeCamera(
  actions: Pick<EtatActions, 'avancer' | 'reculer' | 'gauche' | 'droite'>,
  lacet: number,
): Vecteur3 {
  const avant = Number(actions.avancer) - Number(actions.reculer);
  const droite = Number(actions.droite) - Number(actions.gauche);
  const longueur = Math.hypot(avant, droite);

  if (longueur === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const avantNormalise = avant / longueur;
  const droiteNormalise = droite / longueur;
  const sinus = Math.sin(lacet);
  const cosinus = Math.cos(lacet);

  return {
    x: avantNormalise * sinus + droiteNormalise * cosinus,
    y: 0,
    z: avantNormalise * cosinus - droiteNormalise * sinus,
  };
}

export const calculerDirectionMouvement = calculerDirectionRelativeCamera;

export function simulerMouvementJoueur(
  etat: EtatJoueur,
  actions: Pick<EtatActions, 'avancer' | 'reculer' | 'gauche' | 'droite'>,
  lacet: number,
  deltaSecondes: number,
  monde: MondeCollision,
  vitesse = VITESSE_JOUEUR_PAR_DEFAUT,
): EtatJoueur {
  const delta = Number.isFinite(deltaSecondes) ? Math.max(0, deltaSecondes) : 0;
  const direction = calculerDirectionRelativeCamera(actions, lacet);
  const distanceX = direction.x * Math.max(0, vitesse) * delta;
  const distanceZ = direction.z * Math.max(0, vitesse) * delta;

  let x = etat.position.x;
  let z = etat.position.z;
  let collisionMur = false;
  const y = etat.position.y;
  const chevaucheVerticalement = (mur: BoiteCollision): boolean =>
    y < mur.maxY && y + monde.hauteurJoueur > mur.minY;

  if (distanceX !== 0) {
    const resultatX = resoudreAxe(
      x,
      distanceX,
      z,
      monde.rayonJoueur,
      monde.murs,
      chevaucheVerticalement,
      'x',
    );
    x = resultatX.valeur;
    collisionMur ||= resultatX.bloque;
  }

  if (distanceZ !== 0) {
    const resultatZ = resoudreAxe(
      z,
      distanceZ,
      x,
      monde.rayonJoueur,
      monde.murs,
      chevaucheVerticalement,
      'z',
    );
    z = resultatZ.valeur;
    collisionMur ||= resultatZ.bloque;
  }

  const vitesseVerticale = etat.vitesseVerticale + monde.gravite * delta;
  const hauteurProposee = y + vitesseVerticale * delta;
  const toucheSol = hauteurProposee <= monde.solY;
  const nouvelleHauteur = toucheSol ? monde.solY : hauteurProposee;

  return {
    position: { x, y: nouvelleHauteur, z },
    vitesseVerticale: toucheSol ? 0 : vitesseVerticale,
    auSol: toucheSol,
    collision: collisionMur ? 'mur' : toucheSol ? 'sol' : 'aucune',
  };
}

export const appliquerMouvementJoueur = simulerMouvementJoueur;

function resoudreAxe(
  position: number,
  distance: number,
  positionTransversale: number,
  rayon: number,
  murs: readonly BoiteCollision[],
  chevaucheVerticalement: (mur: BoiteCollision) => boolean,
  axe: 'x' | 'z',
): { readonly valeur: number; readonly bloque: boolean } {
  const direction = Math.sign(distance);
  const cible = position + distance;
  let valeur = cible;
  let bloque = false;

  for (const mur of murs) {
    if (!chevaucheVerticalement(mur)) {
      continue;
    }

    const minTransversal = axe === 'x' ? mur.minZ - rayon : mur.minX - rayon;
    const maxTransversal = axe === 'x' ? mur.maxZ + rayon : mur.maxX + rayon;
    if (positionTransversale < minTransversal || positionTransversale > maxTransversal) {
      continue;
    }

    const minAxe = axe === 'x' ? mur.minX : mur.minZ;
    const maxAxe = axe === 'x' ? mur.maxX : mur.maxZ;
    if (direction > 0 && position + rayon <= minAxe && cible + rayon >= minAxe) {
      valeur = Math.min(valeur, minAxe - rayon);
      bloque = true;
    } else if (direction < 0 && position - rayon >= maxAxe && cible - rayon <= maxAxe) {
      valeur = Math.max(valeur, maxAxe + rayon);
      bloque = true;
    } else if (position + rayon > minAxe && position - rayon < maxAxe) {
      valeur = position;
      bloque = true;
    }
  }

  return { valeur, bloque };
}
