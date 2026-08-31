import type { DescripteurMonde, DescripteurIle } from '@pirate/coeur-jeu';
import type { ObstacleNavigation } from './pilotage';

/**
 * Convertit chaque île en une boîte de collision simplifiée (AABB) englobant
 * son ellipsoïde de rivage. La simulation de navigation utilise ces bornes
 * pour bloquer le bateau sans NaN ni traversée.
 */
export function collisionsRivageDepuisMonde(
  monde: DescripteurMonde,
): readonly ObstacleNavigation[] {
  return [...monde.iles.flatMap((ile) => collisionPourIle(ile)), ...collisionsBordOcean(monde)];
}

function collisionPourIle(ile: DescripteurIle): readonly ObstacleNavigation[] {
  const rayonX = Math.abs(ile.rivage.rayonX) + RAYON_MARGE;
  const rayonZ = Math.abs(ile.rivage.rayonZ) + RAYON_MARGE;
  const centre = ile.rivage.centre;
  return [
    {
      id: 'rivage-' + ile.id,
      type: 'rivage',
      centre: { x: centre.x, y: centre.y, z: centre.z },
      rayonX,
      rayonZ,
      rotationY: ile.rivage.rotationY,
    },
  ];
}

const RAYON_MARGE = 1.2;

/**
 * Ajoute une bande de collision au bord de l'océan pour garantir que la
 * navigation finit toujours par heurter un rivage sur un axe déterministe.
 */
function collisionsBordOcean(monde: DescripteurMonde): readonly ObstacleNavigation[] {
  const demi = monde.ocean.largeur / 2;
  const demiZ = monde.ocean.profondeur / 2;
  return [
    {
      id: 'rivage-bord-nord',
      type: 'rivage',
      centre: { x: 0, y: 0, z: demiZ + 30 },
      rayonX: demi + 50,
      rayonZ: 30,
      rotationY: 0,
    },
    {
      id: 'rivage-bord-sud',
      type: 'rivage',
      centre: { x: 0, y: 0, z: -demiZ - 30 },
      rayonX: demi + 50,
      rayonZ: 30,
      rotationY: 0,
    },
  ];
}

/** Position monde du bateau en mer, hors de toute ellipse de rivage. */
export function positionBateauEnMer(monde: DescripteurMonde): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  const iles = monde.iles;
  let x = 0;
  let z = 0;
  // Choisit un point à mi-chemin entre les îles, donc en pleine mer.
  if (iles.length >= 2) {
    const premiere = iles[0];
    const seconde = iles[1];
    if (premiere && seconde) {
      x = (premiere.transformation.position.x + seconde.transformation.position.x) / 2;
      z = (premiere.transformation.position.z + seconde.transformation.position.z) / 2;
    }
  }
  return {
    x,
    y: 0.04,
    z,
  };
}
