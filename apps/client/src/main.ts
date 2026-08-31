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

import { GRAINE_MVP_PAR_DEFAUT, genererMonde } from '@pirate/coeur-jeu';
import { estReponseSante } from '@pirate/protocole';

import { CameraPremierePersonne, type EtatRegard } from './jeu/camera';
import { ACTIONS_JEU, creerEtatActions, GestionnaireEntrees, type ActionJeu } from './jeu/entrees';
import { construireBacASable } from './jeu/monde-test';
import { creerEtatJoueur, simulerMouvementParPasFixes, type EtatJoueur } from './jeu/mouvement';
import { PistoletPremierePersonne } from './jeu/pistolet';
import {
  CADENCE_TIR_MS,
  GestionnaireTirLocal,
  type EmetteurIntentionTir,
  type IntentionTir,
} from './jeu/tir';
import { construireMondeBabylon, installerMarqueursE2E, type ModeCameraMonde } from './jeu/scene';
import {
  annulerReglages,
  appliquerReglages,
  avecMessageReglages,
  chargerReglagesDepuisCookie,
  construireLiaisonsEntrees,
  creerEtatReglages,
  enregistrerReglagesCookie,
  libelleAction,
  libelleCodeTouche,
  modifierInversionReglages,
  modifierLiaisonReglages,
  ouvrirReglages,
  reinitialiserReglages,
  validerLiaison,
  type EtatReglages,
  type ReglagesJeu,
} from './interface/reglages';

import './style.css';

const LARGEUR_REFERENCE = 1280;
const HAUTEUR_REFERENCE = 720;
const HAUTEUR_YEUX = 1.62;
const POSITION_DEPART = { x: 0, y: 0, z: -6.5 } as const;

const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
const application = document.querySelector<HTMLElement>('#app');
const indicateurServeur = document.querySelector<HTMLElement>('[data-testid="serveur-status"]');
const calquePause = document.querySelector<HTMLElement>('[data-testid="pause-overlay"]');
const calqueReglages = document.querySelector<HTMLElement>('[data-testid="reglages-overlay"]');
const diagnostic = document.querySelector<HTMLElement>('[data-testid="diagnostic-jeu"]');
const etatPointeur = document.querySelector<HTMLElement>('[data-testid="etat-pointeur"]');
const caseInversion = document.querySelector<HTMLInputElement>(
  '[data-testid="inversion-verticale"]',
);
const etatInversion = document.querySelector<HTMLElement>('[data-testid="etat-inversion"]');
const messageReglages = document.querySelector<HTMLElement>('[data-testid="reglages-message"]');
const boutonReprendre = document.querySelector<HTMLButtonElement>('[data-testid="reprendre-jeu"]');
const boutonOuvrirReglages = document.querySelector<HTMLButtonElement>(
  '[data-testid="ouvrir-reglages"]',
);
const boutonAnnulerReglages = document.querySelector<HTMLButtonElement>(
  '[data-testid="annuler-reglages"]',
);
const boutonAppliquerReglages = document.querySelector<HTMLButtonElement>(
  '[data-testid="appliquer-reglages"]',
);
const boutonReinitialiserReglages = document.querySelector<HTMLButtonElement>(
  '[data-testid="reinitialiser-reglages"]',
);
const boutonsTouches = new Map<ActionJeu, HTMLButtonElement>();
for (const ligne of document.querySelectorAll<HTMLElement>('[data-reglage-action]')) {
  const action = ligne.dataset.reglageAction;
  const bouton = ligne.querySelector<HTMLButtonElement>('.touche-reglage');
  if (bouton === null || !ACTIONS_JEU.includes(action as ActionJeu)) {
    continue;
  }
  boutonsTouches.set(action as ActionJeu, bouton);
}
const diagnosticTir = document.querySelector<HTMLElement>('[data-testid="tir-diagnostic"]');

if (
  !canvas ||
  !application ||
  !indicateurServeur ||
  !calquePause ||
  !calqueReglages ||
  !diagnostic ||
  !etatPointeur ||
  !caseInversion ||
  !etatInversion ||
  !messageReglages ||
  !boutonReprendre ||
  !boutonOuvrirReglages ||
  !boutonAnnulerReglages ||
  !boutonAppliquerReglages ||
  !boutonReinitialiserReglages ||
  boutonsTouches.size !== ACTIONS_JEU.length ||
  !diagnosticTir
) {
  throw new Error('La structure de la page Pirate Islands est incomplète.');
}

const canvasJeu = canvas;
const conteneurApplication = application;
const statutServeur = indicateurServeur;
const overlayPause = calquePause;
const overlayReglages = calqueReglages;
const diagnosticJeu = diagnostic;
const indicateurPointeur = etatPointeur;
const inputInversion = caseInversion;
const texteInversion = etatInversion;
const statutReglages = messageReglages;
const boutonReprendreJeu = boutonReprendre;
const boutonOuvrir = boutonOuvrirReglages;
const boutonAnnuler = boutonAnnulerReglages;
const boutonAppliquer = boutonAppliquerReglages;
const boutonReinitialiser = boutonReinitialiserReglages;

let reglages = creerEtatReglages(chargerReglagesDepuisCookie(document.cookie));
let actionReglageEnCours: ActionJeu | undefined;
let mettreAJourEntreesActives: ((valeur: ReglagesJeu) => void) | undefined;
let reprendreJeuActif: (() => void) | undefined;
let rafraichirInterfaceJeu: (() => void) | undefined;
let elementFocusAvantReglages: HTMLElement | null = null;

function afficherReglages(etat: EtatReglages): void {
  overlayReglages.hidden = !etat.ouvert;
  inputInversion.checked = etat.brouillon.inversionVerticale;
  texteInversion.textContent = etat.brouillon.inversionVerticale ? 'Oui' : 'Non';
  statutReglages.textContent = etat.message;
  statutReglages.dataset.etat = etat.message === '' ? 'vide' : 'information';

  for (const action of ACTIONS_JEU) {
    const bouton = boutonsTouches.get(action);
    if (bouton === undefined) {
      continue;
    }
    const enCapture = actionReglageEnCours === action;
    bouton.textContent = enCapture
      ? 'Appuyez sur une touche…'
      : etat.brouillon.liaisons[action].map(libelleCodeTouche).join(' / ');
    bouton.dataset.capture = enCapture ? 'oui' : 'non';
    bouton.setAttribute(
      'aria-label',
      enCapture
        ? 'Appuyez sur une touche pour ' + libelleAction(action)
        : 'Modifier la touche de ' + libelleAction(action),
    );
  }
}

function clonerReglagesPourLecture(reglages: ReglagesJeu): ReglagesJeu {
  const liaisons = {} as Record<ActionJeu, readonly string[]>;
  for (const action of ACTIONS_JEU) {
    liaisons[action] = [...reglages.liaisons[action]];
  }
  return {
    inversionVerticale: reglages.inversionVerticale,
    liaisons,
  };
}

function memoriserFocus(): void {
  elementFocusAvantReglages =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function restaurerFocus(): void {
  const element = elementFocusAvantReglages;
  elementFocusAvantReglages = null;
  element?.focus();
}

function ouvrirReglagesInterface(): void {
  memoriserFocus();
  reglages = ouvrirReglages(reglages);
  actionReglageEnCours = undefined;
  afficherReglages(reglages);
  rafraichirInterfaceJeu?.();
  inputInversion.focus();
}

function fermerReglagesInterface(etat: EtatReglages): void {
  reglages = etat;
  actionReglageEnCours = undefined;
  afficherReglages(reglages);
  rafraichirInterfaceJeu?.();
  restaurerFocus();
}

function annulerReglagesInterface(): void {
  fermerReglagesInterface(annulerReglages(reglages));
}

function appliquerReglagesInterface(): void {
  const résultat = appliquerReglages(reglages);
  reglages = résultat.etat;
  if (!résultat.applique) {
    afficherReglages(reglages);
    rafraichirInterfaceJeu?.();
    return;
  }

  enregistrerReglagesCookie(reglages.applique);
  mettreAJourEntreesActives?.(reglages.applique);
  fermerReglagesInterface(reglages);
}

function réinitialiserReglagesInterface(): void {
  reglages = reinitialiserReglages(reglages);
  afficherReglages(reglages);
  rafraichirInterfaceJeu?.();
}

function capturerToucheReglage(evenement: KeyboardEvent): void {
  if (!reglages.ouvert || actionReglageEnCours === undefined) {
    if (reglages.ouvert && actionReglageEnCours === undefined && evenement.code === 'Escape') {
      evenement.preventDefault();
      evenement.stopImmediatePropagation();
      annulerReglagesInterface();
    }
    return;
  }

  evenement.preventDefault();
  evenement.stopImmediatePropagation();
  const action = actionReglageEnCours;
  const validation = validerLiaison(action, evenement.code, reglages.brouillon.liaisons);
  if (!validation.valide) {
    reglages = avecMessageReglages(
      reglages,
      validation.erreur?.message ?? 'Cette touche ne peut pas être utilisée.',
    );
    afficherReglages(reglages);
    rafraichirInterfaceJeu?.();
    return;
  }

  reglages = modifierLiaisonReglages(reglages, action, evenement.code);
  actionReglageEnCours = undefined;
  afficherReglages(reglages);
  rafraichirInterfaceJeu?.();
}

inputInversion.addEventListener('change', () => {
  reglages = modifierInversionReglages(reglages, inputInversion.checked);
  afficherReglages(reglages);
  rafraichirInterfaceJeu?.();
});

boutonReprendreJeu.addEventListener('click', () => {
  reprendreJeuActif?.();
});
boutonOuvrir.addEventListener('click', ouvrirReglagesInterface);
boutonAnnuler.addEventListener('click', annulerReglagesInterface);
boutonAppliquer.addEventListener('click', appliquerReglagesInterface);
boutonReinitialiser.addEventListener('click', réinitialiserReglagesInterface);

for (const [action, bouton] of boutonsTouches) {
  bouton.addEventListener('click', () => {
    actionReglageEnCours = action;
    reglages = avecMessageReglages(reglages, '');
    afficherReglages(reglages);
  });
}

window.addEventListener('keydown', capturerToucheReglage, true);
afficherReglages(reglages);
const indicateurTir = diagnosticTir;

interface EtatJeuE2E {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly camera: EtatRegard;
  readonly pause: boolean;
  readonly pointeurVerrouille: boolean;
  readonly collision: EtatJoueur['collision'];
  readonly reglages: ReglagesJeu;
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
      lireReglages: () => ReglagesJeu;
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
const tempsE2EInitial = Number.parseFloat(paramètres.get('temps') ?? '0');
const tempsE2EParDefaut = Number.isFinite(tempsE2EInitial) ? Math.max(0, tempsE2EInitial) : 0;
const horlogeTirControlee = modeE2E && paramètres.has('temps');
const modeCamera: ModeCameraMonde = paramètres.get('camera') === 'rivage' ? 'rivage' : 'ensemble';
const modeMonde = paramètres.has('graine') || paramètres.has('camera');
const graine = paramètres.get('graine')?.trim() || GRAINE_MVP_PAR_DEFAUT;
const monde = genererMonde(graine);

conteneurApplication.dataset.mode = modeMonde ? 'monde' : 'bac';
conteneurApplication.dataset.graine = monde.graine;
conteneurApplication.dataset.camera = modeCamera;
conteneurApplication.dataset.iles = String(monde.iles.length);
conteneurApplication.dataset.diagnostics = modeMonde && modeE2E ? 'actifs' : 'inactifs';
conteneurApplication.dataset.pause = 'non';
conteneurApplication.dataset.pointeur = 'libere';
conteneurApplication.dataset.collision = 'aucune';

if (!modeMonde) {
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
      boutonReprendreJeu.focus();
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
      liaisons: construireLiaisonsEntrees(reglages.applique),
      onPause: mettreEnPause,
      onChangementVerrouillage: reprendreJeu,
    });
    const camera = new CameraPremierePersonne(cameraBabylon, {
      inversionVerticale: () => reglages.applique.inversionVerticale,
    });

    mettreAJourEntreesActives = (valeur: ReglagesJeu): void => {
      entrees.mettreAJourLiaisons(construireLiaisonsEntrees(valeur));
    };

    reprendreJeuActif = (): void => {
      boutonReprendreJeu.blur();
      enPause = false;
      verrouillageE2EForce = modeE2E;
      try {
        void Promise.resolve(canvasJeu.requestPointerLock?.()).catch(() => {
          verrouillageE2EForce = false;
        });
      } catch {
        verrouillageE2EForce = false;
      }
      if (modeE2E) {
        entrees.simulerVerrouillage(true);
      }
      actualiserInterface();
    };

    const lireEtat = (): EtatJeuE2E => ({
      position: { ...joueur.position },
      camera: camera.obtenirEtat(),
      pause: enPause,
      pointeurVerrouille: entrees.estPointeurVerrouille(),
      collision: derniereCollision,
      reglages: clonerReglagesPourLecture(reglages.applique),
      tir: {
        compteur: gestionnaireTir.lireCompteur(),
        etat: pistolet.lireEtat(),
        derniereIntention: gestionnaireTir.lireDerniereIntention(),
        intentions: [...intentionsTir],
      },
    });

    const lireReglages = (): ReglagesJeu => clonerReglagesPourLecture(reglages.applique);

    const actualiserInterface = (): void => {
      const etat = lireEtat();
      conteneurApplication.dataset.pause = etat.pause ? 'oui' : 'non';
      conteneurApplication.dataset.pointeur = etat.pointeurVerrouille ? 'verrouille' : 'libere';
      conteneurApplication.dataset.collision = etat.collision;
      conteneurApplication.dataset.inversion = reglages.applique.inversionVerticale ? 'oui' : 'non';
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

    rafraichirInterfaceJeu = actualiserInterface;

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
        lireReglages,
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
        mettreAJourEntreesActives = undefined;
        reprendreJeuActif = undefined;
        rafraichirInterfaceJeu = undefined;
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
