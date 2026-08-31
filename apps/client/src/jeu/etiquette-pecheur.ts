import { Matrix, Vector3, type AbstractEngine, type Camera, type Scene } from 'babylonjs';

import type { Vecteur3 } from './mouvement';

export interface PositionEtiquette {
  readonly position: Vecteur3;
  readonly nom: string;
  readonly sessionId: string;
}

function positionnerEtiquette(
  élément: HTMLElement,
  position: Vecteur3,
  scene: Scene,
  camera: Camera,
  moteur: AbstractEngine,
): void {
  const fenêtre = camera.viewport.toGlobal(moteur.getRenderWidth(), moteur.getRenderHeight());
  const projection = Vector3.Project(
    new Vector3(position.x, position.y, position.z),
    Matrix.Identity(),
    scene.getTransformMatrix(),
    fenêtre,
  );
  const visible = projection.z >= 0 && projection.z <= 1;
  élément.hidden = !visible;
  if (visible) {
    élément.style.left = `${projection.x}px`;
    élément.style.top = `${projection.y}px`;
  }
}

export function installerEtiquettesPecheurs(
  positions: () => readonly PositionEtiquette[],
  scene: Scene,
  camera: Camera,
): { readonly retirer: () => void } {
  const conteneurEtiquettes = document.createElement('div');
  conteneurEtiquettes.className = 'etiquettes-pecheurs';
  conteneurEtiquettes.dataset.testid = 'etiquettes-pecheurs';
  conteneurEtiquettes.setAttribute('aria-label', 'Noms des pêcheurs distants');
  document.querySelector('#app')?.append(conteneurEtiquettes);

  const éléments = new Map<string, HTMLElement>();

  const miseÀJour = (): void => {
    const pêcheurs = positions();
    const sessionsVues = new Set<string>();

    for (const pêcheur of pêcheurs) {
      sessionsVues.add(pêcheur.sessionId);
      let élément = éléments.get(pêcheur.sessionId);
      if (!élément) {
        élément = document.createElement('span');
        élément.className = 'etiquette-pecheur';
        élément.dataset.testid = 'etiquette-pecheur';
        élément.dataset.sessionId = pêcheur.sessionId;
        conteneurEtiquettes.append(élément);
        éléments.set(pêcheur.sessionId, élément);
      }
      élément.textContent = pêcheur.nom;
      const moteur = scene.getEngine();
      positionnerEtiquette(élément, pêcheur.position, scene, camera, moteur);
    }

    for (const [sessionId, élément] of éléments) {
      if (!sessionsVues.has(sessionId)) {
        élément.remove();
        éléments.delete(sessionId);
      }
    }
  };

  const observateur = scene.onAfterRenderObservable.add(miseÀJour);
  miseÀJour();

  return {
    retirer: () => {
      scene.onAfterRenderObservable.remove(observateur);
      conteneurEtiquettes.remove();
    },
  };
}
