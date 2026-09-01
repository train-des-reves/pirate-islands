import type { DescripteurBateau, PointBateau, VolumeBateau } from './bateau';
import type { EtatActions } from './entrees';
import type { MondeCollision } from './mouvement';
import {
  RAYON_JOUEUR_PAR_DEFAUT,
  VITESSE_JOUEUR_PAR_DEFAUT,
  creerEtatJoueur,
  simulerMouvementJoueur,
  type EtatJoueur,
} from './mouvement';
import {
  calculerIntentionsDepuisActions,
  creerEtatNavigationBateau,
  determinerInvite,
  positionLocaleVersMonde,
  positionMondeVersLocale,
  simulerNavigationBateau,
  type EtatBateauNavigation,
  type IntentionsPilotage,
  type InviteAction,
  type ModePilotage,
  type ObstacleNavigation,
} from './pilotage';
import type { Vecteur3 } from './mouvement';

export interface AncragesPilotage {
  readonly embarquement: PointBateau;
  readonly barre: PointBateau;
}

export interface EtatPilotageComplet {
  readonly mode: ModePilotage;
  readonly invite: InviteAction;
  readonly passager: EtatJoueur;
  readonly positionLocale: Vecteur3;
  readonly bateau: EtatBateauNavigation;
}

export interface MondePilotage {
  readonly mondePied: MondeCollision;
  readonly collisionsBateau: readonly ObstacleNavigation[];
}

export interface ContraintesPassagerBateau {
  readonly surfaces: readonly VolumeBateau[];
  readonly collisions: readonly VolumeBateau[];
  readonly limites: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
    readonly minZ: number;
    readonly maxZ: number;
  };
}

const HAUTEUR_JOUEUR = 1.8;

export function extraireAncres(descripteur: DescripteurBateau): AncragesPilotage {
  const embarquement = descripteur.ancrages.find((ancre) => ancre.type === 'embarquement');
  const barre = descripteur.ancrages.find((ancre) => ancre.type === 'barre');
  if (!embarquement || !barre) {
    throw new Error('Le bateau doit exposer les ancres d’embarquement et de barre.');
  }
  return { embarquement: { ...embarquement.position }, barre: { ...barre.position } };
}

export function creerEtatPilotageComplet(
  positionMonde: PointBateau,
  descripteur: DescripteurBateau,
  positionBateau?: { readonly x: number; readonly y: number; readonly z: number },
): EtatPilotageComplet {
  const positionLocale = positionMondeVersLocale(
    { x: positionMonde.x, y: positionMonde.y, z: positionMonde.z },
    descripteur.position,
    descripteur.rotationY,
  );
  return {
    mode: 'pied',
    invite: 'aucune',
    passager: creerEtatJoueur({ x: positionMonde.x, y: positionMonde.y, z: positionMonde.z }),
    positionLocale,
    bateau: creerEtatNavigationBateau(
      positionBateau
        ? { x: positionBateau.x, y: positionBateau.y, z: positionBateau.z }
        : { x: descripteur.position.x, y: descripteur.position.y, z: descripteur.position.z },
      descripteur.rotationY,
    ),
  };
}

/** Met à jour l'invite affichée selon le mode et la proximité des ancres. */
export function majInvite(
  etat: EtatPilotageComplet,
  ancres: AncragesPilotage,
): EtatPilotageComplet {
  const liste = ancresPourInvite(ancres);
  const invite = determinerInvite(etat.mode, etat.passager.position, liste);
  return { ...etat, invite };
}

/**
 * Applique l'action sémantique « interagir » selon le mode et la proximité
 * réelle des ancres. Ne force jamais une transition hors de portée.
 */
export function interagir(
  etat: EtatPilotageComplet,
  ancres: AncragesPilotage,
  descripteur: DescripteurBateau,
): EtatPilotageComplet {
  if (etat.mode === 'pilote') {
    return quitterBarre(etat, ancres, descripteur);
  }
  const invite = majInvite(etat, ancres).invite;
  if (invite === 'embarquer') {
    return embarquer(etat, ancres, descripteur);
  }
  if (invite === 'prendre_barre') {
    return prendreBarre(etat, ancres, descripteur);
  }
  if (invite === 'debarcher') {
    return debarquer(etat, ancres, descripteur);
  }
  return etat;
}

/** Embauche le joueur à bord du bateau depuis une position proche de l'ancre d'embarquement. */
export function embarquer(
  etat: EtatPilotageComplet,
  ancres: AncragesPilotage,
  descripteur: DescripteurBateau,
): EtatPilotageComplet {
  const positionLocale = positionMondeVersLocale(
    { x: ancres.embarquement.x, y: ancres.embarquement.y, z: ancres.embarquement.z },
    descripteur.position,
    descripteur.rotationY,
  );
  const positionMonde = positionLocaleVersMonde(
    positionLocale,
    etat.bateau.position,
    etat.bateau.rotationY,
  );
  return {
    ...etat,
    mode: 'bord',
    invite: 'aucune',
    positionLocale,
    passager: creerEtatJoueur({ x: positionMonde.x, y: positionMonde.y, z: positionMonde.z }),
  };
}

/** Place le joueur à la barre et passe en mode pilote. */
export function prendreBarre(
  etat: EtatPilotageComplet,
  ancres: AncragesPilotage,
  descripteur: DescripteurBateau,
): EtatPilotageComplet {
  const local = positionMondeVersLocale(
    { x: ancres.barre.x, y: ancres.barre.y, z: ancres.barre.z },
    descripteur.position,
    descripteur.rotationY,
  );
  const monde = positionLocaleVersMonde(
    { x: local.x, y: local.y, z: local.z },
    etat.bateau.position,
    etat.bateau.rotationY,
  );
  return {
    ...etat,
    mode: 'pilote',
    invite: 'prendre_barre',
    positionLocale: local,
    passager: creerEtatJoueur({ x: monde.x, y: monde.y, z: monde.z }),
  };
}

/** Quitte la barre tout en restant à bord. */
export function quitterBarre(
  etat: EtatPilotageComplet,
  ancres: AncragesPilotage,
  descripteur: DescripteurBateau,
): EtatPilotageComplet {
  const local = positionMondeVersLocale(
    { x: ancres.barre.x, y: ancres.barre.y, z: ancres.barre.z },
    descripteur.position,
    descripteur.rotationY,
  );
  const monde = positionLocaleVersMonde(
    { x: local.x, y: local.y, z: local.z },
    etat.bateau.position,
    etat.bateau.rotationY,
  );
  return {
    ...etat,
    mode: 'bord',
    invite: 'debarcher',
    positionLocale: local,
    passager: creerEtatJoueur({ x: monde.x, y: monde.y, z: monde.z }),
  };
}

/** Fait débarquer le joueur à un point sûr près de l'ancre d'embarquement. */
export function debarquer(
  etat: EtatPilotageComplet,
  ancres: AncragesPilotage,
  descripteur: DescripteurBateau,
): EtatPilotageComplet {
  const localEmb = positionMondeVersLocale(
    { x: ancres.embarquement.x, y: ancres.embarquement.y, z: ancres.embarquement.z },
    descripteur.position,
    descripteur.rotationY,
  );
  const directionSortie = localEmb.z < 0 ? -1 : 1;
  const localDehors = {
    x: localEmb.x,
    y: localEmb.y,
    z: localEmb.z + directionSortie * 1.5,
  };
  const monde = positionLocaleVersMonde(
    { ...localDehors },
    etat.bateau.position,
    etat.bateau.rotationY,
  );
  return {
    ...etat,
    mode: 'pied',
    invite: 'aucune',
    positionLocale: localDehors,
    passager: creerEtatJoueur({ x: monde.x, y: monde.y, z: monde.z }),
  };
}

/** Avance la simulation complète joueur + bateau pour une image. */
export function simulerPilotage(
  etat: EtatPilotageComplet,
  actions: Pick<EtatActions, 'avancer' | 'reculer' | 'gauche' | 'droite'>,
  lacetCamera: number,
  deltaSecondes: number,
  monde: MondePilotage,
  contraintes: ContraintesPassagerBateau,
): EtatPilotageComplet {
  if (etat.mode === 'pilote') {
    return simulerModePilote(etat, actions, deltaSecondes, monde);
  }
  if (etat.mode === 'bord') {
    return simulerModeBord(etat, actions, lacetCamera, deltaSecondes, contraintes);
  }
  return simulerModePied(etat, actions, lacetCamera, deltaSecondes, monde);
}

function simulerModePilote(
  etat: EtatPilotageComplet,
  actions: Pick<EtatActions, 'avancer' | 'reculer' | 'gauche' | 'droite'>,
  deltaSecondes: number,
  monde: MondePilotage,
): EtatPilotageComplet {
  const intentions: IntentionsPilotage = calculerIntentionsDepuisActions(actions);
  const bateau = simulerNavigationBateau(
    etat.bateau,
    intentions,
    deltaSecondes,
    monde.collisionsBateau,
  );
  const mondePosition = positionLocaleVersMonde(
    etat.positionLocale,
    bateau.position,
    bateau.rotationY,
  );
  return {
    ...etat,
    bateau,
    passager: creerEtatJoueur({ x: mondePosition.x, y: mondePosition.y, z: mondePosition.z }),
  };
}

function simulerModeBord(
  etat: EtatPilotageComplet,
  actions: Pick<EtatActions, 'avancer' | 'reculer' | 'gauche' | 'droite'>,
  lacetCamera: number,
  deltaSecondes: number,
  contraintes: ContraintesPassagerBateau,
): EtatPilotageComplet {
  const deplacement = calculerDeplacementLocal(
    actions,
    lacetCamera,
    etat.bateau.rotationY,
    deltaSecondes,
  );
  const positionLocale = deplacerPassagerLocal(etat.positionLocale, deplacement, contraintes);
  const mondePosition = positionLocaleVersMonde(
    positionLocale,
    etat.bateau.position,
    etat.bateau.rotationY,
  );
  return {
    ...etat,
    positionLocale,
    passager: creerEtatJoueur({ x: mondePosition.x, y: mondePosition.y, z: mondePosition.z }),
  };
}

function simulerModePied(
  etat: EtatPilotageComplet,
  actions: Pick<EtatActions, 'avancer' | 'reculer' | 'gauche' | 'droite'>,
  lacetCamera: number,
  deltaSecondes: number,
  monde: MondePilotage,
): EtatPilotageComplet {
  const passager = simulerMouvementJoueur(
    etat.passager,
    actions,
    lacetCamera,
    deltaSecondes,
    monde.mondePied,
  );
  return {
    ...etat,
    passager,
    positionLocale: positionMondeVersLocale(
      passager.position,
      etat.bateau.position,
      etat.bateau.rotationY,
    ),
  };
}

function calculerDeplacementLocal(
  actions: Pick<EtatActions, 'avancer' | 'reculer' | 'gauche' | 'droite'>,
  lacetCamera: number,
  rotationBateau: number,
  deltaSecondes: number,
): Vecteur3 {
  const avant = Number(actions.avancer) - Number(actions.reculer);
  const droite = Number(actions.droite) - Number(actions.gauche);
  const longueur = Math.hypot(avant, droite);
  const delta = Number.isFinite(deltaSecondes) ? Math.max(0, Math.min(0.25, deltaSecondes)) : 0;
  if (longueur === 0 || delta === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const avantNormalise = avant / longueur;
  const droiteNormalise = droite / longueur;
  const sinus = Math.sin(lacetCamera);
  const cosinus = Math.cos(lacetCamera);
  const directionMonde = {
    x: avantNormalise * sinus + droiteNormalise * cosinus,
    y: 0,
    z: avantNormalise * cosinus - droiteNormalise * sinus,
  } as Vecteur3;
  const local = positionMondeVersLocale(directionMonde, { x: 0, y: 0, z: 0 }, rotationBateau);
  return {
    x: local.x * VITESSE_JOUEUR_PAR_DEFAUT * delta,
    y: 0,
    z: local.z * VITESSE_JOUEUR_PAR_DEFAUT * delta,
  };
}

function deplacerPassagerLocal(
  positionLocale: Vecteur3,
  deplacement: Vecteur3,
  contraintes: ContraintesPassagerBateau,
): Vecteur3 {
  const rayon = RAYON_JOUEUR_PAR_DEFAUT;
  const candidat = {
    x: positionLocale.x + deplacement.x,
    z: positionLocale.z + deplacement.z,
  };
  let x = bornerAxe(candidat.x, contraintes.limites.minX + rayon, contraintes.limites.maxX - rayon);
  let z = bornerAxe(candidat.z, contraintes.limites.minZ + rayon, contraintes.limites.maxZ - rayon);

  const blocage = collisionPourPosition(x, z, positionLocale.y, rayon, contraintes.collisions);
  if (blocage) {
    const xSeul = bornerAxe(
      candidat.x,
      contraintes.limites.minX + rayon,
      contraintes.limites.maxX - rayon,
    );
    const zSeul = bornerAxe(
      positionLocale.z,
      contraintes.limites.minZ + rayon,
      contraintes.limites.maxZ - rayon,
    );
    if (!collisionPourPosition(xSeul, zSeul, positionLocale.y, rayon, contraintes.collisions)) {
      x = xSeul;
      z = zSeul;
    } else {
      const xInchange = bornerAxe(
        positionLocale.x,
        contraintes.limites.minX + rayon,
        contraintes.limites.maxX - rayon,
      );
      const zSeulB = bornerAxe(
        candidat.z,
        contraintes.limites.minZ + rayon,
        contraintes.limites.maxZ - rayon,
      );
      if (
        !collisionPourPosition(xInchange, zSeulB, positionLocale.y, rayon, contraintes.collisions)
      ) {
        x = xInchange;
        z = zSeulB;
      } else {
        x = positionLocale.x;
        z = positionLocale.z;
      }
    }
  }

  const y = hauteurSousLaPosition(x, z, positionLocale.y, contraintes.surfaces);
  return { x, y, z };
}

function bornerAxe(valeur: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, valeur));
}

function collisionPourPosition(
  x: number,
  z: number,
  y: number,
  rayon: number,
  collisions: readonly VolumeBateau[],
): boolean {
  return collisions.some((collision) => {
    if (collision.niveau === 'escalier') {
      return false;
    }
    const horizontal =
      x + rayon > collision.minX &&
      x - rayon < collision.maxX &&
      z + rayon > collision.minZ &&
      z - rayon < collision.maxZ;
    const vertical = y < collision.maxY && y + HAUTEUR_JOUEUR > collision.minY;
    return horizontal && vertical;
  });
}

function hauteurSousLaPosition(
  x: number,
  z: number,
  y: number,
  surfaces: readonly VolumeBateau[],
): number {
  let resultat = y;
  let plusProche = Number.POSITIVE_INFINITY;
  for (const surface of surfaces) {
    if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) {
      continue;
    }
    if (surface.maxY > y + 0.6) {
      continue;
    }
    const distance = Math.abs(y - surface.maxY);
    if (distance < plusProche) {
      plusProche = distance;
      resultat = surface.maxY;
    }
  }
  return resultat;
}

function ancresPourInvite(ancres: AncragesPilotage): readonly {
  id: string;
  type: 'barre' | 'embarquement';
  position: PointBateau;
}[] {
  return [
    { id: 'barre', type: 'barre', position: ancres.barre },
    { id: 'embarquement', type: 'embarquement', position: ancres.embarquement },
  ];
}
