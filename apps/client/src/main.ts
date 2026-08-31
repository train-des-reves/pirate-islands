import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from 'babylonjs';

import { GRAINE_MVP_PAR_DEFAUT, genererMonde } from '@pirate/coeur-jeu';
import { estReponseSante } from '@pirate/protocole';

import { CameraPremierePersonne, type EtatRegard } from './jeu/camera';
import { creerEtatActions, GestionnaireEntrees } from './jeu/entrees';
import { construireBacASable } from './jeu/monde-test';
import { creerEtatJoueur, simulerMouvementParPasFixes, type EtatJoueur } from './jeu/mouvement';
import { construireGaleriePiratesE2E } from './jeu/pirate';
import { PistoletPremierePersonne } from './jeu/pistolet';
import {
  CADENCE_TIR_MS,
  GestionnaireTirLocal,
  type EmetteurIntentionTir,
  type IntentionTir,
} from './jeu/tir';
import { construireMondeBabylon, installerMarqueursE2E, type ModeCameraMonde } from './jeu/scene';

import './style.css';

const LARGEUR_REFERENCE = 1280;
const HAUTEUR_REFERENCE = 720;
const HAUTEUR_YEUX = 1.62;
const POSITION_DEPART = { x: 0, y: 0, z: -6.5 } as const;

const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
const application = document.querySelector<HTMLElement>('#app');
const indicateurServeur = document.querySelector<HTMLElement>('[data-testid="serveur-status"]');
const calquePause = document.querySelector<HTMLElement>('[data-testid="pause-overlay"]');
const diagnostic = document.querySelector<HTMLElement>('[data-testid="diagnostic-jeu"]');
const etatPointeur = document.querySelector<HTMLElement>('[data-testid="etat-pointeur"]');
const diagnosticTir = document.querySelector<HTMLElement>('[data-testid="tir-diagnostic"]');

if (
  !canvas ||
  !application ||
  !indicateurServeur ||
  !calquePause ||
  !diagnostic ||
  !etatPointeur ||
  !diagnosticTir
) {
  throw new Error('La structure de la page Pirate Islands est incomplète.');
}

const canvasJeu = canvas;
const conteneurApplication = application;
const statutServeur = indicateurServeur;
const overlayPause = calquePause;
const diagnosticJeu = diagnostic;
const indicateurPointeur = etatPointeur;
const indicateurTir = diagnosticTir;

interface EtatJeuE2E {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly camera: EtatRegard;
  readonly pause: boolean;
  readonly pointeurVerrouille: boolean;
  readonly collision: EtatJoueur['collision'];
  readonly tir: {
    readonly compteur: number;
    readonly etat: { readonly recul: number; readonly eclairBouche: boolean };
    readonly derniereIntention: IntentionTir | undefined;
    readonly intentions: readonly IntentionTir[];
  };
}

declare global {
  interface Window {
    __pirateIslandsE2E?: {
      verrouillerPointeur: () => void;
      libererPointeur: () => void;
      lireEtat: () => EtatJeuE2E;
      reinitialiser: () => void;
      tirer: (nombre?: number) => void;
      avancerTemps: (deltaMs: number) => void;
    };
  }
}

interface JeuClient {
  readonly moteur: Engine;
  detruire: () => void;
}

const paramètres = new URLSearchParams(window.location.search);
const modeE2E = import.meta.env.DEV && paramètres.get('e2e') === '1';
const modePirates = modeE2E && paramètres.get('vue') === 'pirates';
const animationPirates = modePirates && paramètres.get('animation') === '1';
const structurePirates = modePirates && paramètres.get('structure') === '1';
const tempsE2EInitial = Number.parseFloat(paramètres.get('temps') ?? '0');
const tempsE2EParDefaut = Number.isFinite(tempsE2EInitial) ? Math.max(0, tempsE2EInitial) : 0;
const horlogeTirControlee = modeE2E && paramètres.has('temps');
const modeCamera: ModeCameraMonde = paramètres.get('camera') === 'rivage' ? 'rivage' : 'ensemble';
const modeMonde = paramètres.has('graine') || paramètres.has('camera');
const graine = paramètres.get('graine')?.trim() || GRAINE_MVP_PAR_DEFAUT;
const monde = genererMonde(graine);

conteneurApplication.dataset.mode = modePirates ? 'pirates' : modeMonde ? 'monde' : 'bac';
conteneurApplication.dataset.graine = monde.graine;
conteneurApplication.dataset.camera = modeCamera;
conteneurApplication.dataset.vue = modePirates ? 'pirates' : 'standard';
conteneurApplication.dataset.structure = structurePirates ? 'oui' : 'non';
conteneurApplication.dataset.iles = String(monde.iles.length);
conteneurApplication.dataset.diagnostics =
  modePirates || (modeMonde && modeE2E) ? 'actifs' : 'inactifs';
conteneurApplication.dataset.pause = 'non';
conteneurApplication.dataset.pointeur = 'libere';
conteneurApplication.dataset.collision = 'aucune';

if (modePirates) {
  document.querySelector<HTMLElement>('.eyebrow')?.replaceChildren('Galerie de rendu · MVP-2F');
  document.querySelector<HTMLElement>('#titre-jeu')?.replaceChildren('Pirates terrestres');
  document
    .querySelector<HTMLElement>('.tagline')
    ?.replaceChildren('Silhouette procédurale, poses lisibles et interpolation côté client.');
} else if (!modeMonde) {
  document
    .querySelector<HTMLElement>('.eyebrow')
    ?.replaceChildren('Navigation première personne · MVP-1C');
  document
    .querySelector<HTMLElement>('.tagline')
    ?.replaceChildren('Cliquez dans la scène pour prendre la barre et explorer le bac à sable.');
}

canvasJeu.width = LARGEUR_REFERENCE;
canvasJeu.height = HAUTEUR_REFERENCE;

function construireScene(): JeuClient | undefined {
  try {
    const moteur = new Engine(canvasJeu, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    const scene = new Scene(moteur);

    if (modePirates) {
      scene.clearColor = new Color4(0.035, 0.12, 0.17, 1);
      scene.fogMode = Scene.FOGMODE_EXP2;
      scene.fogColor = new Color3(0.035, 0.12, 0.17);
      scene.fogDensity = 0.018;

      const camera = new FreeCamera('camera-galerie-pirates', new Vector3(0, 3.8, -15.5), scene);
      camera.minZ = 0.1;
      camera.maxZ = 100;
      camera.fov = 0.78;
      camera.setTarget(new Vector3(0, 1.2, 0));
      scene.activeCamera = camera;

      const lumière = new HemisphericLight(
        'lumiere-galerie-pirates',
        new Vector3(-0.25, 1, -0.35),
        scene,
      );
      lumière.intensity = 1.15;
      lumière.diffuse = new Color3(0.92, 0.96, 1);
      lumière.groundColor = new Color3(0.08, 0.035, 0.025);

      const lumièreAvant = new DirectionalLight(
        'lumiere-avant-galerie-pirates',
        new Vector3(-0.25, -1, 0.55),
        scene,
      );
      lumièreAvant.intensity = 0.7;
      lumièreAvant.diffuse = new Color3(1, 0.78, 0.58);

      const galerie = construireGaleriePiratesE2E(scene, {
        afficherEtiquettes: true,
        afficherPlanche: structurePirates,
        animerInterpolation: animationPirates,
      });
      let dernierTemps = performance.now();

      scene.executeWhenReady(() => {
        conteneurApplication.dataset.scene = 'ready';
      });
      const boucle = (): void => {
        const maintenant = performance.now();
        const deltaSecondes = Math.min(0.25, Math.max(0, (maintenant - dernierTemps) / 1000));
        dernierTemps = maintenant;
        galerie.mettreAJour(deltaSecondes);
        scene.render();
      };
      moteur.runRenderLoop(boucle);
      const redimensionner = (): void => moteur.resize();
      window.addEventListener('resize', redimensionner);

      return {
        moteur,
        detruire: () => {
          window.removeEventListener('resize', redimensionner);
          moteur.stopRenderLoop(boucle);
          galerie.liberer();
          camera.dispose();
          lumière.dispose();
          lumièreAvant.dispose();
          moteur.dispose();
        },
      };
    }

    if (modeMonde) {
      const mondeBabylon = construireMondeBabylon(scene, monde, { modeCamera });
      const retirerMarqueurs = modeE2E
        ? installerMarqueursE2E(scene, monde, mondeBabylon.camera)
        : undefined;

      scene.executeWhenReady(() => {
        conteneurApplication.dataset.scene = 'ready';
      });
      const boucle = (): void => scene.render();
      moteur.runRenderLoop(boucle);
      const redimensionner = (): void => moteur.resize();
      window.addEventListener('resize', redimensionner);

      return {
        moteur,
        detruire: () => {
          retirerMarqueurs?.();
          window.removeEventListener('resize', redimensionner);
          moteur.stopRenderLoop(boucle);
          mondeBabylon.liberer();
          moteur.dispose();
        },
      };
    }

    scene.clearColor = new Color4(0.34, 0.67, 0.8, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.34, 0.67, 0.8);
    scene.fogDensity = 0.008;

    const cameraBabylon = new FreeCamera(
      'camera-premiere-personne',
      new Vector3(0, HAUTEUR_YEUX, -6.5),
      scene,
    );
    cameraBabylon.minZ = 0.08;
    cameraBabylon.maxZ = 1000;
    cameraBabylon.fov = 1.05;
    cameraBabylon.inertia = 0;
    cameraBabylon.checkCollisions = false;
    cameraBabylon.applyGravity = false;
    cameraBabylon.rotationQuaternion = null;
    cameraBabylon.rotation.set(0, 0, 0);

    const lumière = new HemisphericLight('lumiere-ciel', new Vector3(0, 1, 0), scene);
    lumière.intensity = 1.1;
    lumière.diffuse = new Color3(0.9, 0.95, 1);
    lumière.groundColor = new Color3(0.12, 0.05, 0.03);

    const ciel = MeshBuilder.CreateBox('ciel', { size: 200 }, scene);
    ciel.isPickable = false;
    ciel.infiniteDistance = true;
    const materiauCiel = new StandardMaterial('materiau-ciel', scene);
    materiauCiel.backFaceCulling = false;
    materiauCiel.disableLighting = true;
    materiauCiel.emissiveColor = new Color3(0.16, 0.42, 0.64);
    ciel.material = materiauCiel;

    const mondeBac = construireBacASable(scene);
    const pistolet = new PistoletPremierePersonne(cameraBabylon, scene);
    const intentionsTir: IntentionTir[] = [];
    let tempsTir = horlogeTirControlee ? tempsE2EParDefaut : performance.now();
    const emetteurTir: EmetteurIntentionTir = {
      émettre: (intention) => {
        if (modeE2E) {
          intentionsTir.push(intention);
        }
        pistolet.déclencher(intention);
      },
    };
    const gestionnaireTir = new GestionnaireTirLocal({
      obtenirVisee: () => pistolet.lireVisee(),
      emetteur: emetteurTir,
      cadenceMs: CADENCE_TIR_MS,
      lireHorodatage: () => tempsTir,
    });
    let joueur = creerEtatJoueur(POSITION_DEPART);
    let enPause = false;
    let verrouillageE2EForce = false;
    let tempsSimulationAccumule = 0;
    let dernierEtatEntrees = creerEtatActions();
    let derniereCollision: EtatJoueur['collision'] = 'aucune';

    const mettreEnPause = (): void => {
      verrouillageE2EForce = false;
      enPause = true;
      actualiserInterface();
    };

    const reprendreJeu = (verrouille: boolean): void => {
      if (verrouille) {
        enPause = false;
        actualiserInterface();
      }
    };

    const entrees = new GestionnaireEntrees({
      cible: window,
      document: window.document,
      elementVerrouillage: canvasJeu,
      onPause: mettreEnPause,
      onChangementVerrouillage: reprendreJeu,
    });
    const camera = new CameraPremierePersonne(cameraBabylon, {
      // Le réglage réel sera injecté par l'issue des préférences; le défaut
      // produit reste non inversé sans ajouter d'interface hors périmètre.
      inversionVerticale: () => false,
    });

    const lireEtat = (): EtatJeuE2E => ({
      position: { ...joueur.position },
      camera: camera.obtenirEtat(),
      pause: enPause,
      pointeurVerrouille: entrees.estPointeurVerrouille(),
      collision: derniereCollision,
      tir: {
        compteur: gestionnaireTir.lireCompteur(),
        etat: pistolet.lireEtat(),
        derniereIntention: gestionnaireTir.lireDerniereIntention(),
        intentions: [...intentionsTir],
      },
    });

    const actualiserInterface = (): void => {
      const etat = lireEtat();
      conteneurApplication.dataset.pause = etat.pause ? 'oui' : 'non';
      conteneurApplication.dataset.pointeur = etat.pointeurVerrouille ? 'verrouille' : 'libere';
      conteneurApplication.dataset.collision = etat.collision;
      overlayPause.hidden = !etat.pause;
      indicateurPointeur.textContent = etat.pointeurVerrouille
        ? 'Pointeur verrouillé · Échap pour la pause'
        : etat.pause
          ? 'Jeu en pause · cliquez dans la scène pour reprendre'
          : 'Cliquez dans la scène pour verrouiller le pointeur';
      diagnosticJeu.dataset.positionX = etat.position.x.toFixed(3);
      diagnosticJeu.dataset.positionY = etat.position.y.toFixed(3);
      diagnosticJeu.dataset.positionZ = etat.position.z.toFixed(3);
      diagnosticJeu.dataset.lacet = etat.camera.lacet.toFixed(3);
      diagnosticJeu.dataset.tangage = etat.camera.tangage.toFixed(3);
      diagnosticJeu.dataset.collision = etat.collision;
      indicateurTir.dataset.compteur = String(etat.tir.compteur);
      indicateurTir.dataset.recul = etat.tir.etat.recul.toFixed(3);
      indicateurTir.dataset.eclair = etat.tir.etat.eclairBouche ? 'oui' : 'non';
      indicateurTir.textContent = 'Tirs locaux · ' + etat.tir.compteur;
      diagnosticJeu.textContent = `Position ${etat.position.x.toFixed(1)} · ${etat.position.y.toFixed(1)} · ${etat.position.z.toFixed(1)}`;
    };

    const crochetE2E = (): void => {
      if (!modeE2E) {
        return;
      }

      window.__pirateIslandsE2E = {
        verrouillerPointeur: () => {
          verrouillageE2EForce = true;
          entrees.simulerVerrouillage(true);
        },
        libererPointeur: () => {
          verrouillageE2EForce = false;
          entrees.simulerVerrouillage(false);
        },
        tirer: (nombre = 1) => {
          const nombreSain = Number.isFinite(nombre) ? Math.max(0, Math.floor(nombre)) : 0;
          for (let index = 0; index < nombreSain; index += 1) {
            gestionnaireTir.actualiser(true, tempsTir);
            if (index < nombreSain - 1) {
              tempsTir += CADENCE_TIR_MS;
            }
          }
          pistolet.actualiser(tempsTir);
          actualiserInterface();
        },
        avancerTemps: (deltaMs) => {
          tempsTir += Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
          pistolet.actualiser(tempsTir);
          actualiserInterface();
        },
        lireEtat,
        reinitialiser: () => {
          verrouillageE2EForce = false;
          entrees.reinitialiserEtat();
          joueur = creerEtatJoueur(POSITION_DEPART);
          camera.reinitialiser();
          camera.synchroniserPosition({
            x: POSITION_DEPART.x,
            y: POSITION_DEPART.y + HAUTEUR_YEUX,
            z: POSITION_DEPART.z,
          });
          enPause = false;
          derniereCollision = 'aucune';
          intentionsTir.length = 0;
          gestionnaireTir.reinitialiser();
          tempsTir = horlogeTirControlee ? tempsE2EParDefaut : performance.now();
          pistolet.reinitialiser(tempsTir);
          actualiserInterface();
        },
      };
    };

    entrees.attacher();
    camera.synchroniserPosition({
      x: POSITION_DEPART.x,
      y: POSITION_DEPART.y + HAUTEUR_YEUX,
      z: POSITION_DEPART.z,
    });
    crochetE2E();
    actualiserInterface();

    let dernierTemps = performance.now();
    const boucle = (): void => {
      const maintenant = performance.now();
      const deltaSecondes = Math.min(0.25, Math.max(0, (maintenant - dernierTemps) / 1000));
      dernierTemps = maintenant;

      if (verrouillageE2EForce && !enPause && !entrees.estPointeurVerrouille()) {
        entrees.simulerVerrouillage(true);
      }

      dernierEtatEntrees = entrees.lireEtat();
      tempsTir = horlogeTirControlee ? tempsTir : maintenant;

      if (dernierEtatEntrees.pause) {
        mettreEnPause();
      }

      if (!enPause && dernierEtatEntrees.pointeurVerrouille) {
        camera.regarder(dernierEtatEntrees.regardX, dernierEtatEntrees.regardY);
        gestionnaireTir.actualiser(dernierEtatEntrees.tirer, tempsTir);
        pistolet.actualiser(tempsTir);
        const résultatSimulation = simulerMouvementParPasFixes(
          joueur,
          dernierEtatEntrees,
          camera.obtenirEtat().lacet,
          deltaSecondes,
          mondeBac,
          tempsSimulationAccumule,
        );
        joueur = résultatSimulation.etat;
        tempsSimulationAccumule = résultatSimulation.accumulation;
        if (joueur.collision !== 'aucune') {
          derniereCollision = joueur.collision;
        }
        camera.synchroniserPosition({
          x: joueur.position.x,
          y: joueur.position.y + HAUTEUR_YEUX,
          z: joueur.position.z,
        });
      } else {
        tempsSimulationAccumule = 0;
        gestionnaireTir.actualiser(false, tempsTir);
        pistolet.actualiser(tempsTir);
      }

      actualiserInterface();
      scene.render();
    };

    moteur.runRenderLoop(boucle);
    const redimensionner = (): void => moteur.resize();
    window.addEventListener('resize', redimensionner);
    scene.executeWhenReady(() => {
      conteneurApplication.dataset.scene = 'ready';
    });

    const jeu: JeuClient = {
      moteur,
      detruire: () => {
        entrees.detacher();
        window.removeEventListener('resize', redimensionner);
        moteur.stopRenderLoop(boucle);
        pistolet.liberer();
        moteur.dispose();
        delete window.__pirateIslandsE2E;
      },
    };
    window.addEventListener('pagehide', jeu.detruire, { once: true });
    return jeu;
  } catch {
    conteneurApplication.dataset.scene = 'fallback';
    return undefined;
  }
}

const jeu = construireScene();

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

void jeu;
void vérifierServeur();
