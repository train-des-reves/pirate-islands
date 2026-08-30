import {
  Color3,
  Color4,
  Engine,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from 'babylonjs';

import { estReponseSante } from '@pirate/protocole';

import './style.css';

const LARGEUR_REFERENCE = 1280;
const HAUTEUR_REFERENCE = 720;
const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
const application = document.querySelector<HTMLElement>('#app');
const indicateurServeur = document.querySelector<HTMLElement>('[data-testid="serveur-status"]');

if (!canvas || !application || !indicateurServeur) {
  throw new Error('La structure de la page Pirate Islands est incomplète.');
}

const canvasJeu = canvas;
const conteneurApplication = application;
const statutServeur = indicateurServeur;

canvasJeu.width = LARGEUR_REFERENCE;
canvasJeu.height = HAUTEUR_REFERENCE;

function construireScene(): Engine | undefined {
  try {
    const moteur = new Engine(canvasJeu, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    const scene = new Scene(moteur);
    scene.clearColor = new Color4(0.35, 0.72, 0.86, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.35, 0.72, 0.86);
    scene.fogDensity = 0.006;

    const camera = new FreeCamera('camera-principal', new Vector3(0, 4.2, -14), scene);
    camera.setTarget(new Vector3(0, -0.8, 12));
    camera.minZ = 0.1;
    camera.maxZ = 1000;

    const lumière = new HemisphericLight('lumiere-ciel', new Vector3(0, 1, 0), scene);
    lumière.intensity = 1.1;
    lumière.diffuse = new Color3(0.82, 0.94, 1);
    lumière.groundColor = new Color3(0.03, 0.14, 0.22);

    const ciel = MeshBuilder.CreateBox('ciel', { size: 200 }, scene);
    ciel.isPickable = false;
    ciel.infiniteDistance = true;
    const materiauCiel = new StandardMaterial('materiau-ciel', scene);
    materiauCiel.backFaceCulling = false;
    materiauCiel.disableLighting = true;
    materiauCiel.emissiveColor = new Color3(0.18, 0.48, 0.72);
    ciel.material = materiauCiel;

    const mer = MeshBuilder.CreateGround(
      'mer',
      { width: 220, height: 220, subdivisions: 16 },
      scene,
    );
    mer.position.y = -1.35;
    mer.isPickable = false;
    const materiauMer = new StandardMaterial('materiau-mer', scene);
    materiauMer.diffuseColor = new Color3(0.015, 0.32, 0.48);
    materiauMer.emissiveColor = new Color3(0.005, 0.075, 0.12);
    materiauMer.specularColor = new Color3(0.35, 0.7, 0.8);
    mer.material = materiauMer;

    scene.executeWhenReady(() => {
      conteneurApplication.dataset.scene = 'ready';
    });
    moteur.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => moteur.resize());
    return moteur;
  } catch {
    conteneurApplication.dataset.scene = 'fallback';
    return undefined;
  }
}

construireScene();

async function vérifierServeur(): Promise<void> {
  const urlServeur = import.meta.env.VITE_SERVER_URL ?? 'http://127.0.0.1:2567';

  try {
    const réponse = await fetch(`${urlServeur}/health`, {
      headers: { Accept: 'application/json' },
    });
    const donnée: unknown = await réponse.json();

    if (!réponse.ok || !estReponseSante(donnée)) {
      throw new Error('Réponse de santé invalide.');
    }

    statutServeur.dataset.etat = 'connecte';
    statutServeur.innerHTML =
      '<span class="status-dot" aria-hidden="true"></span>Serveur joignable';
  } catch {
    statutServeur.dataset.etat = 'indisponible';
    statutServeur.innerHTML =
      '<span class="status-dot" aria-hidden="true"></span>Serveur indisponible';
  }
}

void vérifierServeur();
