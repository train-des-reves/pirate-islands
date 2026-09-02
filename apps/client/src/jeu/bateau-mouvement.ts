import { Color3, MeshBuilder, StandardMaterial, type TransformNode, type Scene } from 'babylonjs';

import type { EtatBateauNavigation, ModePilotage } from './pilotage';

export interface SillageBateau {
  readonly mesh: TransformNode;
  readonly materiaux: StandardMaterial;
  mettreAJour(intensite: number): void;
  liberer(): void;
}

export interface ControleBateauMouvement {
  readonly racine: TransformNode;
  readonly sillage: SillageBateau;
  appliquerNavigation(etat: EtatBateauNavigation): void;
  appliquerMode(mode: ModePilotage): void;
  liberer(): void;
}

export function construireControleBateauMouvement(
  scene: Scene,
  racine: TransformNode,
): ControleBateauMouvement {
  const sillage = creerSillage(scene, racine);

  const appliquerNavigation = (etat: EtatBateauNavigation): void => {
    racine.position.set(etat.position.x, etat.position.y, etat.position.z);
    racine.rotation.y = etat.rotationY;
    sillage.mettreAJour(etat.intensiteSillage);
  };

  const appliquerMode = (mode: ModePilotage): void => {
    sillage.mesh.isVisible = mode === 'pilote';
  };

  return {
    racine,
    sillage,
    appliquerNavigation,
    appliquerMode,
    liberer: () => sillage.liberer(),
  };
}

function creerSillage(scene: Scene, racine: TransformNode): SillageBateau {
  const materiaux = new StandardMaterial('materiau-sillage-bateau', scene);
  materiaux.diffuseColor = new Color3(0.82, 0.9, 0.93);
  materiaux.specularColor = new Color3(0.1, 0.15, 0.18);
  materiaux.emissiveColor = new Color3(0.06, 0.1, 0.12);
  materiaux.alpha = 0.0;

  const mesh = MeshBuilder.CreateGround(
    'sillage-bateau',
    { width: 1.8, height: 4.5, subdivisions: 1 },
    scene,
  );
  mesh.material = materiaux;
  mesh.isPickable = false;
  mesh.parent = racine;
  mesh.position.set(0, 0.03, -4.2);
  mesh.isVisible = false;
  mesh.metadata = { type: 'bateau-sillage' };

  return {
    mesh,
    materiaux,
    mettreAJour: (intensite) => {
      const valeur = Math.min(1, Math.max(0, intensite));
      materiaux.alpha = valeur * 0.35;
      mesh.scaling.set(1 + valeur * 0.3, 1, Math.max(0.4, valeur * 1.6));
      mesh.position.z = -4.2 - valeur * 1.2;
      mesh.isVisible = valeur > 0.02;
    },
    liberer: () => {
      mesh.dispose(false, true);
      materiaux.dispose();
    },
  };
}
