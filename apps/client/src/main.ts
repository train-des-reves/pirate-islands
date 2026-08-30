import { Engine, Scene } from 'babylonjs';

import { GRAINE_MVP_PAR_DEFAUT, genererMonde } from '@pirate/coeur-jeu';
import { estReponseSante } from '@pirate/protocole';

import { construireMondeBabylon, installerMarqueursE2E, type ModeCameraMonde } from './jeu/scene';
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

const paramètres = new URLSearchParams(window.location.search);
const modeE2E = import.meta.env.DEV && paramètres.get('e2e') === '1';
const graine = paramètres.get('graine')?.trim() || GRAINE_MVP_PAR_DEFAUT;
const modeCamera: ModeCameraMonde = paramètres.get('camera') === 'rivage' ? 'rivage' : 'ensemble';
const monde = genererMonde(graine);

conteneurApplication.dataset.graine = monde.graine;
conteneurApplication.dataset.camera = modeCamera;
conteneurApplication.dataset.iles = String(monde.iles.length);
conteneurApplication.dataset.diagnostics = modeE2E ? 'actifs' : 'inactifs';

canvasJeu.width = LARGEUR_REFERENCE;
canvasJeu.height = HAUTEUR_REFERENCE;

function construireScene(): Engine | undefined {
  try {
    const moteur = new Engine(canvasJeu, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    const scene = new Scene(moteur);
    const mondeBabylon = construireMondeBabylon(scene, monde, { modeCamera });
    if (modeE2E) {
      installerMarqueursE2E(scene, monde, mondeBabylon.camera);
    }

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
