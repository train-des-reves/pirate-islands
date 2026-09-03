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
import { estReponseSante, type OptionsConnexion } from '@pirate/protocole';

import { CameraPremierePersonne, type EtatRegard } from './jeu/camera';
import { construireGalerieBateauxPiratesE2E } from './jeu/bateau-pirate';
import { ACTIONS_JEU, creerEtatActions, GestionnaireEntrees, type ActionJeu } from './jeu/entrees';
import { installerEtiquettesPecheurs } from './jeu/etiquette-pecheur';
import { construireBacASable } from './jeu/monde-test';
import { creerEtatJoueur, simulerMouvementParPasFixes, type EtatJoueur } from './jeu/mouvement';
import { construireGaleriePiratesE2E } from './jeu/pirate';
import { PistoletPremierePersonne } from './jeu/pistolet';
import {
  creerEmetteurTransformation,
  SynchroniseurPecheursDistants,
  type EmetteurTransformation,
} from './jeu/synchroniseur-pecheurs';
import { SynchroniseurPiratesMaritimes } from './jeu/synchroniseur-pirates-maritimes';
import {
  construireMondeBabylon,
  estModePresentationBateau,
  installerMarqueursE2E,
  type ModeCameraMonde,
} from './jeu/scene';
import {
  CADENCE_TIR_MS,
  GestionnaireTirLocal,
  type EmetteurIntentionTir,
  type IntentionTir,
} from './jeu/tir';
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
import {
  afficherErreurDiagnosticSalle,
  connecterDiagnosticSalle,
  type DiagnosticSalleConnecte,
  type ElementsDiagnosticSalle,
} from './jeu/diagnostic-salle';
import { construireHarnaisPeche } from './interface/harnais-peche.js';
import { monterPresentationPeche } from './interface/presenter-peche.js';
import { construireHarnaisCanne } from './interface/harnais-canne.js';
import { monterPresentationCanne } from './interface/presenter-canne.js';
import { construireModePeche, pistoletPeutTirer, type ModePeche } from './jeu/mode-peche.js';
import { construirePresentationCanne } from './jeu/presentation-canne.js';
import {
  connecterSalleJeu,
  genererNomPecheur,
  type ConnecteurConnexion,
  type EtatAffichageConnexion,
  type EtatConnexion,
  validerNomSaisi,
} from './jeu/connexion-salle';
import { construireVisualiseurIa, type EtatVisualiseurIa } from './jeu/visualiseur-ia';

import './style.css';

const LARGEUR_REFERENCE = 1280;
const HAUTEUR_REFERENCE = 720;
const HAUTEUR_YEUX = 1.62;
const POSITION_DEPART = { x: 0, y: 0, z: -6.5 } as const;

function normaliserAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 0;
  }
  const deuxPi = Math.PI * 2;
  const normalisé = ((((angle + Math.PI) % deuxPi) + deuxPi) % deuxPi) - Math.PI;
  return normalisé === -Math.PI ? Math.PI : normalisé;
}

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
const pecheInvite = document.querySelector<HTMLElement>('[data-testid="peche-invite"]');
const pecheStatut = document.querySelector<HTMLElement>('[data-testid="peche-statut"]');
const pecheInviteTexte = document.querySelector<HTMLElement>('[data-testid="peche-invite-texte"]');
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
const diagnosticSalle = document.querySelector<HTMLElement>('[data-testid="diagnostic-salle"]');
const diagnosticSalleId = document.querySelector<HTMLElement>(
  '[data-testid="diagnostic-salle-id"]',
);
const diagnosticSessionId = document.querySelector<HTMLElement>(
  '[data-testid="diagnostic-session-id"]',
);
const diagnosticNombreJoueurs = document.querySelector<HTMLElement>(
  '[data-testid="diagnostic-nombre-joueurs"]',
);
const diagnosticSalleErreur = document.querySelector<HTMLElement>(
  '[data-testid="diagnostic-salle-erreur"]',
);
const combatCible = document.querySelector<HTMLElement>('[data-testid="combat-cible"]');
const combatSanteJoueur = document.querySelector<HTMLElement>(
  '[data-testid="combat-sante-joueur"]',
);
const combatSantePirate = document.querySelector<HTMLElement>(
  '[data-testid="combat-sante-pirate"]',
);
const combatReapparition = document.querySelector<HTMLElement>(
  '[data-testid="combat-reapparition"]',
);
const combatResultat = document.querySelector<HTMLElement>('[data-testid="combat-resultat"]');
const combatDeconnexion = document.querySelector<HTMLElement>('[data-testid="combat-deconnexion"]');
const diagnosticTir = document.querySelector<HTMLElement>('[data-testid="tir-diagnostic"]');
const panneauAccueil = document.querySelector<HTMLElement>('[data-testid="panneau-accueil"]');
const formulaireConnexion = document.querySelector<HTMLFormElement>(
  '[data-testid="formulaire-connexion"]',
);
const champNom = document.querySelector<HTMLInputElement>('[data-testid="champ-nom"]');
const champSalle = document.querySelector<HTMLInputElement>('[data-testid="champ-salle"]');
const boutonRejoindre = document.querySelector<HTMLButtonElement>(
  '[data-testid="bouton-rejoindre"]',
);
const statutConnexion = document.querySelector<HTMLElement>('[data-testid="connexion-statut"]');
const messageConnexion = document.querySelector<HTMLElement>('[data-testid="connexion-message"]');
const actionsConnexion = document.querySelector<HTMLElement>('[data-testid="connexion-actions"]');
const boutonReessayer = document.querySelector<HTMLButtonElement>(
  '[data-testid="bouton-reessayer"]',
);
const boutonRetour = document.querySelector<HTMLButtonElement>('[data-testid="bouton-retour"]');
const infosConnexion = document.querySelector<HTMLElement>('[data-testid="connexion-infos"]');
const connexionSalle = document.querySelector<HTMLElement>('[data-testid="connexion-salle"]');
const connexionNom = document.querySelector<HTMLElement>('[data-testid="connexion-nom"]');
const connexionJoueurs = document.querySelector<HTMLElement>('[data-testid="connexion-joueurs"]');

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
  !pecheInvite ||
  !pecheStatut ||
  !pecheInviteTexte ||
  !boutonReprendre ||
  !boutonOuvrirReglages ||
  !boutonAnnulerReglages ||
  !boutonAppliquerReglages ||
  !boutonReinitialiserReglages ||
  boutonsTouches.size !== ACTIONS_JEU.length ||
  !diagnosticSalle ||
  !diagnosticSalleId ||
  !diagnosticSessionId ||
  !diagnosticNombreJoueurs ||
  !diagnosticSalleErreur ||
  !combatCible ||
  !combatSanteJoueur ||
  !combatSantePirate ||
  !combatReapparition ||
  !combatResultat ||
  !combatDeconnexion ||
  !diagnosticTir ||
  !panneauAccueil ||
  !formulaireConnexion ||
  !champNom ||
  !champSalle ||
  !boutonRejoindre ||
  !statutConnexion ||
  !messageConnexion ||
  !actionsConnexion ||
  !boutonReessayer ||
  !boutonRetour ||
  !infosConnexion ||
  !connexionSalle ||
  !connexionNom ||
  !connexionJoueurs
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
const invitePeche = pecheInvite;
const statutPeche = pecheStatut;
const texteInvitePeche = pecheInviteTexte;
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
const diagnosticSalleJeu = diagnosticSalle;
const elementsDiagnosticSalle: ElementsDiagnosticSalle = {
  conteneur: diagnosticSalleJeu,
  identifiantSalle: diagnosticSalleId,
  sessionId: diagnosticSessionId,
  nombreJoueurs: diagnosticNombreJoueurs,
  erreur: diagnosticSalleErreur,
  cible: combatCible,
  santeJoueur: combatSanteJoueur,
  santePirate: combatSantePirate,
  reapparition: combatReapparition,
  resultat: combatResultat,
  deconnexion: combatDeconnexion,
};
const indicateurTir = diagnosticTir;
const panneauAccueilElement = panneauAccueil;
const formulaireConnexionElement = formulaireConnexion;
const champNomElement = champNom;
const champSalleElement = champSalle;
const boutonRejoindreElement = boutonRejoindre;
const statutConnexionElement = statutConnexion;
const messageConnexionElement = messageConnexion;
const actionsConnexionElement = actionsConnexion;
const boutonReessayerElement = boutonReessayer;
const boutonRetourElement = boutonRetour;
const infosConnexionElement = infosConnexion;
const connexionSalleElement = connexionSalle;
const connexionNomElement = connexionNom;
const connexionJoueursElement = connexionJoueurs;

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
  readonly peche: {
    readonly modeActif: boolean;
    readonly vue: string;
    readonly sequence: number;
    readonly invite: string | null;
    readonly statut: string;
  };
}

interface EtatPecheurE2E {
  readonly sessionId: string;
  readonly nom: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
}

interface EtatHarnessPecheurs {
  readonly salleId: string | undefined;
  readonly sessionId: string | undefined;
  readonly pêcheursDistants: readonly EtatPecheurE2E[];
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
      lireEtatViseurIa?: () => EtatVisualiseurIa;
      afficherInstantViseurIa?: (instant: number) => void;
      forcerEtatCanne?: (vue: string) => void;
      lireEtatCanne?: () => { readonly modeActif: boolean; readonly vue: string };
      lireEtatPecheurs?: () => EtatHarnessPecheurs;
      /** Émet une intention de tir réseau vers le serveur (mode salle). */
      tirerReseau?: (cibleId?: string) => void;
      /** Émet une intention de tir volontairement dans le vide (mode salle). */
      tirerDansLeVide?: () => void;
      /** Rejoue la dernière intention avec la même séquence pour vérifier le rejet serveur. */
      rejouerTir?: () => void;
      /** Inflige des dégâts au joueur via le mannequin E2E serveur. */
      infligerDegatsE2E?: (degats: number) => void;
      /** Lit l'état de combat observé après synchronisation serveur. */
      lireCombat?: () => {
        readonly cibleId: string | null;
        readonly santeJoueur: number;
        readonly santePirate: number;
        readonly pirateNeutralise: boolean;
        readonly enAttenteReapparition: boolean;
        readonly dernierResultat: unknown;
        readonly codeDeconnexion: number | undefined;
      };
      /** Lit le dernier code de rejet/déconnexion observé depuis la salle. */
      lireDeconnexion?: () => number | undefined;
      /** Lit les bateaux et équipages maritimes synchronisés. */
      lireEtatMaritime?: () => {
        readonly salleId: string | undefined;
        readonly graine: string | undefined;
        readonly nombreJoueurs: number;
        readonly statutsObserves: readonly string[];
        readonly bateaux: readonly {
          readonly id: string;
          readonly routeId: string;
          readonly statut: string;
          readonly vitesse: number;
          readonly position: { readonly x: number; readonly y: number; readonly z: number };
          readonly equipage: number;
          readonly attaqueActive: boolean;
        }[];
      };
    };
  }
}

/** Interface du jeu client exposé au harnais E2E et aux tests. */
interface JeuClient {
  readonly moteur?: Engine;
  detruire: () => void;
}
const paramètres = new URLSearchParams(window.location.search);
const modeE2E =
  import.meta.env.DEV && import.meta.env.VITE_E2E === '1' && paramètres.get('e2e') === '1';
const modePirates = modeE2E && paramètres.get('vue') === 'pirates';
const animationPirates = modePirates && paramètres.get('animation') === '1';
const structurePirates = modePirates && paramètres.get('structure') === '1';
const modeBateauxPirates = modeE2E && paramètres.get('vue') === 'bateaux-pirates';
const modePiratesMaritimes = modeE2E && paramètres.get('vue') === 'pirates-maritimes';
const animationBateauxPirates = modeBateauxPirates && paramètres.get('animation') === '1';
const structureBateauxPirates = modeBateauxPirates && paramètres.get('structure') === '1';
const modeViseurIa = modeE2E && paramètres.get('vue') === 'ia';
const modePecheursDistants = modeE2E && paramètres.get('vue') === 'pecheurs';
const tempsE2EInitial = Number.parseFloat(paramètres.get('temps') ?? '0');
const tempsE2EParDefaut = Number.isFinite(tempsE2EInitial) ? Math.max(0, tempsE2EInitial) : 0;
const horlogeTirControlee = modeE2E && paramètres.has('temps');
const modeDiagnosticSalle = modeE2E && paramètres.get('diagnostic') === 'salle';
const modeCombatE2E = modeDiagnosticSalle && paramètres.get('combat') === '1';
const cameraDemandée = paramètres.get('camera');
const modeCamera: ModeCameraMonde =
  cameraDemandée === 'rivage' ||
  cameraDemandée === 'bateau-exterieur' ||
  cameraDemandée === 'bateau-cabine' ||
  cameraDemandée === 'bateau-cale'
    ? cameraDemandée
    : 'ensemble';
const présentationBateau = estModePresentationBateau(modeCamera);
const modePresentationPeche = modeE2E && paramètres.get('presentation') === 'regles-peche';
const modePresentationCanne = modeE2E && paramètres.get('presentation') === 'canne-peche';
const modePanneauE2E = modeE2E && paramètres.get('panneau') === '1';
const modeMonde =
  modeDiagnosticSalle ||
  modePresentationPeche ||
  modePresentationCanne ||
  présentationBateau ||
  paramètres.has('graine') ||
  paramètres.has('camera');
const graine = paramètres.get('graine')?.trim() || GRAINE_MVP_PAR_DEFAUT;
const monde = genererMonde(graine);

conteneurApplication.dataset.mode = modeBateauxPirates
  ? 'bateaux-pirates'
  : modePiratesMaritimes
    ? 'pirates-maritimes'
    : modeViseurIa
      ? 'ia'
      : modePecheursDistants
        ? 'pecheurs-distants'
        : modePirates
          ? 'pirates'
          : modePresentationCanne
            ? 'presentation'
            : modePresentationPeche
              ? 'presentation'
              : modeDiagnosticSalle
                ? 'diagnostic-salle'
                : modeMonde
                  ? 'monde'
                  : 'bac';
conteneurApplication.dataset.graine = monde.graine;
conteneurApplication.dataset.camera = modeCamera;
conteneurApplication.dataset.presentation = présentationBateau
  ? modeCamera
  : modePresentationPeche
    ? 'regles-peche'
    : modePresentationCanne
      ? 'canne-peche'
      : 'aucune';
conteneurApplication.dataset.vue = modeBateauxPirates
  ? 'bateaux-pirates'
  : modePiratesMaritimes
    ? 'pirates-maritimes'
    : modeViseurIa
      ? 'ia'
      : modePecheursDistants
        ? 'pecheurs'
        : modePirates
          ? 'pirates'
          : 'standard';
conteneurApplication.dataset.structure =
  structureBateauxPirates || structurePirates ? 'oui' : 'non';
conteneurApplication.dataset.iles = String(monde.iles.length);
conteneurApplication.dataset.diagnostics =
  modeBateauxPirates ||
  modePiratesMaritimes ||
  modeViseurIa ||
  modePecheursDistants ||
  modePirates ||
  (modeMonde && modeE2E)
    ? 'actifs'
    : 'inactifs';
conteneurApplication.dataset.pause = 'non';
conteneurApplication.dataset.pointeur = 'libere';
conteneurApplication.dataset.collision = 'aucune';

if (modeViseurIa) {
  document.querySelector<HTMLElement>('.eyebrow')?.replaceChildren('Harnais visuel E2E · MVP-2G');
  document.querySelector<HTMLElement>('#titre-jeu')?.replaceChildren('IA pirate');
} else if (modePecheursDistants) {
  document.querySelector<HTMLElement>('.eyebrow')?.replaceChildren('Harnais visuel E2E · MVP-3A');
  document
    .querySelector<HTMLElement>('#titre-jeu')
    ?.replaceChildren('Pêcheurs distants synchronisés');
  document
    .querySelector<HTMLElement>('.tagline')
    ?.replaceChildren(
      'Deux fenêtres partagent la même salle : le second pêcheur apparaît et bouge chez le premier.',
    );
} else if (modePirates) {
  document.querySelector<HTMLElement>('.eyebrow')?.replaceChildren('Galerie de rendu · MVP-2F');
  document.querySelector<HTMLElement>('#titre-jeu')?.replaceChildren('Pirates terrestres');
  document
    .querySelector<HTMLElement>('.tagline')
    ?.replaceChildren('Silhouette procédurale, poses lisibles et interpolation côté client.');
} else if (modeBateauxPirates) {
  document.querySelector<HTMLElement>('.eyebrow')?.replaceChildren('Galerie de rendu · MVP-2H');
  document.querySelector<HTMLElement>('#titre-jeu')?.replaceChildren('Sloop pirate hostile');
  document
    .querySelector<HTMLElement>('.tagline')
    ?.replaceChildren('Silhouette hostile, ancres nommées, sillage et état détruit.');
} else if (!modeMonde) {
  document
    .querySelector<HTMLElement>('.eyebrow')
    ?.replaceChildren('Navigation première personne · MVP-1C');
  document
    .querySelector<HTMLElement>('.tagline')
    ?.replaceChildren('Cliquez dans la scène pour prendre la barre et explorer le bac à sable.');
}

if (présentationBateau) {
  const textesPrésentation = {
    'bateau-exterieur': {
      eyebrow: 'Bateau de pêche · vue extérieure',
      tagline: 'Coque, pont, cabine et toit au quai de l’île Aube.',
    },
    'bateau-cabine': {
      eyebrow: 'Bateau de pêche · cabine',
      tagline: 'Deux hublots, poste de pilotage et pont traversant.',
    },
    'bateau-cale': {
      eyebrow: 'Bateau de pêche · cale',
      tagline: 'Entrée à l’arrière, escalier et espace accessible sous le pont.',
    },
  } as const;
  const texte = textesPrésentation[modeCamera];
  document.querySelector<HTMLElement>('.eyebrow')?.replaceChildren(texte.eyebrow);
  document.querySelector<HTMLElement>('.tagline')?.replaceChildren(texte.tagline);
}

canvasJeu.width = LARGEUR_REFERENCE;
canvasJeu.height = HAUTEUR_REFERENCE;

function construireScene(): JeuClient | undefined {
  if (modeViseurIa) {
    const visualiseur = construireVisualiseurIa(conteneurApplication, canvasJeu);
    window.__pirateIslandsE2E = {
      verrouillerPointeur: () => undefined,
      libererPointeur: () => undefined,
      lireEtat: () => ({
        position: { x: 0, y: 0, z: 0 },
        camera: { lacet: 0, tangage: 0 },
        pause: false,
        pointeurVerrouille: false,
        collision: 'aucune',
        reglages: reglages.applique,
        tir: {
          compteur: 0,
          etat: { recul: 0, eclairBouche: false },
          derniereIntention: undefined,
          intentions: [],
        },
        peche: { modeActif: false, vue: 'rangee', sequence: 0, invite: null, statut: '' },
      }),
      lireReglages: () => reglages.applique,
      reinitialiser: () => undefined,
      tirer: () => undefined,
      avancerTemps: () => undefined,
      lireEtatViseurIa: () => visualiseur.lireEtat(),
      afficherInstantViseurIa: (instant) => visualiseur.afficherInstant(instant),
    };
    conteneurApplication.dataset.scene = 'ready';
    conteneurApplication.dataset.vue = 'ia';
    return {
      moteur: undefined as unknown as Engine,
      detruire: () => {
        visualiseur.detruire();
        delete window.__pirateIslandsE2E;
      },
    };
  }

  try {
    if (modePresentationPeche) {
      const harnais = construireHarnaisPeche(graine, 1);
      const presentation = monterPresentationPeche(harnais, conteneurApplication);
      conteneurApplication.dataset.scene = 'ready';
      conteneurApplication.dataset.presentation = 'regles-peche';
      return {
        detruire: () => {
          presentation.detruire();
        },
      };
    }

    if (modePresentationCanne) {
      const moteurPresentation = new Engine(canvasJeu, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      const scenePresentation = new Scene(moteurPresentation);
      const interfacePechePresentation = {
        afficherInvite: (invite: string | null) => {
          invitePeche.hidden = invite === null;
          if (invite !== null) {
            texteInvitePeche.textContent = invite;
          }
        },
        afficherStatut: (statut: string) => {
          statutPeche.hidden = false;
          statutPeche.textContent = statut;
        },
        afficherResultat: () => undefined,
      };
      const presentationBabylon = construirePresentationCanne(
        moteurPresentation,
        scenePresentation,
        graine,
        interfacePechePresentation,
      );
      const harnais = construireHarnaisCanne(graine, 1);
      const presentation = monterPresentationCanne(harnais, conteneurApplication);
      const masquerHarness = (masque: boolean): void => {
        presentation.conteneur.hidden = masque;
      };
      conteneurApplication.dataset.scene = 'ready';
      conteneurApplication.dataset.presentation = 'canne-peche';
      conteneurApplication.dataset.mode = 'presentation';

      const bouclePresentation = (): void => {
        scenePresentation.render();
      };
      moteurPresentation.runRenderLoop(bouclePresentation);
      const redimensionnerPresentation = (): void => moteurPresentation.resize();
      window.addEventListener('resize', redimensionnerPresentation);

      window.__pirateIslandsE2E = {
        verrouillerPointeur: () => undefined,
        libererPointeur: () => undefined,
        lireEtat: () => ({
          position: { x: 0, y: 0, z: 0 },
          camera: { lacet: 0, tangage: 0 },
          pause: false,
          pointeurVerrouille: false,
          collision: 'aucune',
          reglages: reglages.applique,
          tir: {
            compteur: 0,
            etat: { recul: 0, eclairBouche: false },
            derniereIntention: undefined,
            intentions: [],
          },
          peche: {
            modeActif: presentationBabylon.lireEtat().vue !== 'rangee',
            vue: presentationBabylon.lireEtat().vue,
            sequence: presentationBabylon.lireEtat().sequence,
            invite: null,
            statut: '',
          },
        }),
        lireReglages: () => reglages.applique,
        reinitialiser: () => presentationBabylon.forcerEtat('rangee'),
        tirer: () => undefined,
        avancerTemps: () => undefined,
        forcerEtatCanne: (vue: string) => {
          masquerHarness(true);
          presentationBabylon.forcerEtat(vue as never);
        },
      };

      return {
        moteur: moteurPresentation,
        detruire: () => {
          window.removeEventListener('resize', redimensionnerPresentation);
          moteurPresentation.stopRenderLoop(bouclePresentation);
          presentationBabylon.liberer();
          moteurPresentation.dispose();
          presentation.detruire();
          delete window.__pirateIslandsE2E;
        },
      };
    }

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

    if (modeBateauxPirates) {
      scene.clearColor = new Color4(0.02, 0.1, 0.15, 1);
      scene.fogMode = Scene.FOGMODE_EXP2;
      scene.fogColor = new Color3(0.02, 0.1, 0.15);
      scene.fogDensity = 0.014;

      const camera = new FreeCamera(
        'camera-galerie-bateaux-pirates',
        new Vector3(0, 6.5, -18),
        scene,
      );
      camera.minZ = 0.1;
      camera.maxZ = 120;
      camera.fov = 0.72;
      camera.setTarget(new Vector3(0, 1.6, 0));
      scene.activeCamera = camera;

      const lumière = new HemisphericLight(
        'lumiere-galerie-bateaux-pirates',
        new Vector3(-0.3, 1, -0.25),
        scene,
      );
      lumière.intensity = 1.1;
      lumière.diffuse = new Color3(0.88, 0.94, 1);
      lumière.groundColor = new Color3(0.06, 0.04, 0.05);

      const lumièreAvant = new DirectionalLight(
        'lumiere-avant-galerie-bateaux-pirates',
        new Vector3(-0.2, -0.9, 0.5),
        scene,
      );
      lumièreAvant.intensity = 0.68;
      lumièreAvant.diffuse = new Color3(1, 0.72, 0.54);

      const galerie = construireGalerieBateauxPiratesE2E(scene, {
        afficherEtiquettes: true,
        afficherPlanche: structureBateauxPirates,
        animerInterpolation: animationBateauxPirates,
        phaseInitiale: tempsE2EParDefaut,
        figerPose: horlogeTirControlee,
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
        const etats = galerie.acteurs.map((acteur) => acteur.obtenirEtat().etat).join('|');
        const sillage = galerie.acteurs
          .map((acteur) => Number(acteur.obtenirIntensiteSillage()).toFixed(3))
          .join('|');
        conteneurApplication.dataset.etatsBateaux = etats;
        conteneurApplication.dataset.sillageBateaux = sillage;
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

    if (modePiratesMaritimes) {
      scene.clearColor = new Color4(0.015, 0.12, 0.19, 1);
      scene.fogMode = Scene.FOGMODE_EXP2;
      scene.fogColor = new Color3(0.015, 0.12, 0.19);
      scene.fogDensity = 0.008;

      const ocean = MeshBuilder.CreateGround(
        'ocean-rencontre-maritime',
        { width: 220, height: 220, subdivisions: 24 },
        scene,
      );
      const matériauOcéan = new StandardMaterial('matériau-ocean-rencontre-maritime', scene);
      matériauOcéan.diffuseColor = new Color3(0.025, 0.24, 0.34);
      matériauOcéan.specularColor = new Color3(0.16, 0.35, 0.4);
      ocean.material = matériauOcéan;
      ocean.isPickable = false;

      const camera = new FreeCamera('camera-rencontre-maritime', new Vector3(0, 55, -29), scene);
      camera.minZ = 0.1;
      camera.maxZ = 300;
      camera.fov = 0.86;
      camera.setTarget(new Vector3(0, 0, -8));
      scene.activeCamera = camera;

      const lumière = new HemisphericLight(
        'lumiere-rencontre-maritime',
        new Vector3(-0.25, 1, -0.35),
        scene,
      );
      lumière.intensity = 1.2;
      lumière.diffuse = new Color3(0.82, 0.95, 1);
      lumière.groundColor = new Color3(0.025, 0.08, 0.1);

      let connexionMaritime: DiagnosticSalleConnecte | undefined;
      let synchroniseurMaritime: SynchroniseurPiratesMaritimes | undefined;
      const statutsMaritimesObserves = new Set<string>();
      const lireEtatMaritime = () => {
        const salle = connexionMaritime?.salle;
        const bateaux = (salle ? [...salle.state.bateauxPirates.values()] : []).map((bateau) => ({
          id: bateau.identifiant,
          routeId: bateau.routeId,
          statut: bateau.statut,
          vitesse: bateau.vitesse,
          position: {
            x: bateau.transformation.x,
            y: bateau.transformation.y,
            z: bateau.transformation.z,
          },
          equipage: salle
            ? [...salle.state.pirates.values()].filter(
                (pirate) => pirate.bateauId === bateau.identifiant,
              ).length
            : 0,
          attaqueActive: salle
            ? [...salle.state.pirates.values()].some(
                (pirate) => pirate.bateauId === bateau.identifiant && pirate.statut === 'attaque',
              )
            : false,
        }));
        for (const bateau of bateaux) {
          statutsMaritimesObserves.add(bateau.statut);
        }
        return {
          salleId: salle?.roomId,
          graine: salle?.state.metadonnees.graine,
          nombreJoueurs: salle?.state.joueurs.size ?? 0,
          statutsObserves: [...statutsMaritimesObserves],
          bateaux,
        };
      };

      if (modeE2E) {
        window.__pirateIslandsE2E = {
          verrouillerPointeur: () => undefined,
          libererPointeur: () => undefined,
          lireEtat: () => ({
            position: { x: 0, y: 0, z: 0 },
            camera: { lacet: 0, tangage: 0 },
            pause: false,
            pointeurVerrouille: false,
            collision: 'aucune',
            reglages: reglages.applique,
            tir: {
              compteur: 0,
              etat: { recul: 0, eclairBouche: false },
              derniereIntention: undefined,
              intentions: [],
            },
            peche: { modeActif: false, vue: 'rangee', sequence: 0, invite: null, statut: '' },
          }),
          lireReglages: () => reglages.applique,
          reinitialiser: () => undefined,
          tirer: () => undefined,
          avancerTemps: () => undefined,
          lireEtatMaritime,
          tirerReseau: (cibleId?: string) => connexionMaritime?.tirer(cibleId),
          lireCombat: () =>
            connexionMaritime?.lireCombat() ?? {
              cibleId: null,
              santeJoueur: 100,
              santePirate: 100,
              pirateNeutralise: false,
              enAttenteReapparition: false,
              dernierResultat: undefined,
              codeDeconnexion: undefined,
            },
          lireDeconnexion: () => connexionMaritime?.lireDeconnexion(),
        };
      }

      const optionsMaritimes = { graine: monde.graine };
      void connecterDiagnosticSalle(
        import.meta.env.VITE_SERVER_URL ?? 'http://127.0.0.1:2567',
        optionsMaritimes,
        elementsDiagnosticSalle,
        paramètres.get('room')?.trim() || undefined,
      )
        .then((connexion) => {
          connexionMaritime = connexion;
          synchroniseurMaritime = new SynchroniseurPiratesMaritimes(
            () => connexionMaritime?.salle,
            scene,
          );
        })
        .catch((erreur: unknown) => afficherErreurDiagnosticSalle(erreur, elementsDiagnosticSalle));

      scene.executeWhenReady(() => {
        conteneurApplication.dataset.scene = 'ready';
      });
      let dernierTemps = performance.now();
      const boucle = (): void => {
        const maintenant = performance.now();
        const deltaSecondes = Math.min(0.25, Math.max(0, (maintenant - dernierTemps) / 1000));
        dernierTemps = maintenant;
        lireEtatMaritime();
        synchroniseurMaritime?.mettreAJour();
        synchroniseurMaritime?.mettreAJourInterpolation(deltaSecondes);
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
          synchroniseurMaritime?.liberer();
          connexionMaritime?.detruire();
          ocean.dispose(false, true);
          matériauOcéan.dispose();
          camera.dispose();
          lumière.dispose();
          moteur.dispose();
          delete window.__pirateIslandsE2E;
        },
      };
    }

    if (modeMonde && !modePecheursDistants) {
      const mondeBabylon = construireMondeBabylon(scene, monde, { modeCamera });
      const retirerMarqueurs =
        modeE2E && !présentationBateau
          ? installerMarqueursE2E(scene, monde, mondeBabylon.camera)
          : undefined;

      scene.executeWhenReady(() => {
        conteneurApplication.dataset.bateau = mondeBabylon.bateau.descripteur.id;
        conteneurApplication.dataset.bateauHublots = String(mondeBabylon.bateau.hublots.length);
        conteneurApplication.dataset.bateauSurfaces = String(mondeBabylon.bateau.surfaces.length);
        conteneurApplication.dataset.bateauCollisions = String(
          mondeBabylon.bateau.collisions.length,
        );
        conteneurApplication.dataset.bateauAncrages = String(
          mondeBabylon.bateau.descripteur.ancrages.length,
        );
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
    const interfacePeche = {
      afficherInvite: (invite: string | null) => {
        invitePeche.hidden = invite === null;
        if (invite !== null) {
          texteInvitePeche.textContent = invite;
        }
      },
      afficherStatut: (statut: string) => {
        statutPeche.hidden = false;
        statutPeche.textContent = statut;
      },
      afficherResultat: () => undefined,
    };
    const modePeche: ModePeche = construireModePeche({
      graine,
      lirePosition: () => joueur.position,
      lireHorodatage: () => tempsTir,
      camera: cameraBabylon,
      scene,
      interfacePeche,
    });
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
      if (modeE2E) {
        entrees.simulerVerrouillage(true);
      } else {
        try {
          void Promise.resolve(canvasJeu.requestPointerLock?.()).catch(() => {
            verrouillageE2EForce = false;
          });
        } catch {
          verrouillageE2EForce = false;
        }
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
      peche: {
        modeActif: modePeche?.estModeActif() ?? false,
        vue: modePeche?.lireEtat().vue ?? 'rangee',
        sequence: modePeche?.lireEtat().sequence ?? 0,
        invite: invitePeche.hidden ? null : invitePeche.textContent,
        statut: statutPeche.hidden ? '' : (statutPeche.textContent ?? ''),
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
        lireEtatPecheurs: () => {
          const salle = connecteurPanneau?.lireSalle();
          return {
            salleId: connecteurPanneau?.salleId,
            sessionId: salle?.sessionId,
            pêcheursDistants: (synchroniseurPecheurs?.obtenirPecheurs() ?? []).map((pecheur) => {
              const etat = pecheur.obtenirEtat().transformation;
              return {
                sessionId: pecheur.sessionId,
                nom: pecheur.nom,
                position: { ...etat.position },
              };
            }),
          };
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

    let synchroniseurPecheurs: SynchroniseurPecheursDistants | undefined;
    let emetteurTransformation: EmetteurTransformation | undefined;
    let retirerEtiquettesPecheurs: (() => void) | undefined;

    const assurerSynchronisationPecheurs = (): void => {
      const salle = connecteurPanneau?.lireSalle();
      if (!salle || synchroniseurPecheurs || retirerEtiquettesPecheurs) {
        return;
      }

      synchroniseurPecheurs = new SynchroniseurPecheursDistants(
        () => connecteurPanneau?.lireSalle(),
        () => connecteurPanneau?.lireSalle()?.sessionId ?? '',
        scene,
      );
      emetteurTransformation = creerEmetteurTransformation(() => connecteurPanneau?.lireSalle());
      retirerEtiquettesPecheurs = installerEtiquettesPecheurs(
        () =>
          (synchroniseurPecheurs?.obtenirPecheurs() ?? []).map((pecheur) => {
            const etat = pecheur.obtenirEtat().transformation;
            return {
              position: {
                x: etat.position.x,
                y: etat.position.y + 2.6,
                z: etat.position.z,
              },
              nom: pecheur.nom,
              sessionId: pecheur.sessionId,
            };
          }),
        scene,
        cameraBabylon,
      ).retirer;
    };

    let dernierTemps = performance.now();
    const boucle = (): void => {
      const maintenant = performance.now();
      const deltaSecondes = Math.min(0.25, Math.max(0, (maintenant - dernierTemps) / 1000));
      dernierTemps = maintenant;

      assurerSynchronisationPecheurs();

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
        modePeche?.actualiser({
          tirer: dernierEtatEntrees.tirer,
          interagir: dernierEtatEntrees.interagir,
        });
        // L'exclusivité est décidée par l'état du mode, pas par le retour de
        // `actualiser` : dès que le mode est actif, `tirer` est consommé par la
        // canne et le pistolet ne doit jamais recevoir l'action du même cadre.
        const modePecheActif = modePeche.estModeActif();
        const pistoletAutorisé = pistoletPeutTirer(modePecheActif);
        pistolet.setVisible(pistoletAutorisé);
        if (pistoletAutorisé) {
          gestionnaireTir.actualiser(dernierEtatEntrees.tirer, tempsTir);
        }
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
        if (emetteurTransformation) {
          const regard = camera.obtenirEtat();
          emetteurTransformation?.envoyer({
            position: joueur.position,
            lacet: normaliserAngle(regard.lacet),
            tangage: normaliserAngle(regard.tangage),
            roulis: 0,
          });
        }
      } else {
        tempsSimulationAccumule = 0;
        modePeche?.reinitialiser();
        gestionnaireTir.actualiser(false, tempsTir);
        pistolet.actualiser(tempsTir);
      }

      if (synchroniseurPecheurs) {
        synchroniseurPecheurs?.mettreAJour();
        for (const pecheur of synchroniseurPecheurs?.obtenirPecheurs() ?? []) {
          pecheur.mettreAJour(deltaSecondes);
        }
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
        retirerEtiquettesPecheurs?.();
        synchroniseurPecheurs?.liberer();
        entrees.detacher();
        window.removeEventListener('resize', redimensionner);
        moteur.stopRenderLoop(boucle);
        modePeche?.liberer();
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

let diagnosticSalleConnecte: DiagnosticSalleConnecte | undefined;

let connecteurPanneau: ConnecteurConnexion | undefined;

function actualiserStatutPanneau(etat: EtatConnexion, message?: string): void {
  statutConnexionElement.dataset.etat = etat;
  messageConnexionElement.textContent =
    message ??
    (etat === 'attente'
      ? 'Prêt à embarquer.'
      : etat === 'connexion'
        ? 'Connexion à la salle…'
        : etat === 'connecte'
          ? 'Vous êtes à bord.'
          : etat === 'salle-pleine'
            ? 'La salle est complète.'
            : etat === 'deconnecte'
              ? 'Vous avez quitté la salle.'
              : etat === 'reconnexion'
                ? 'Connexion instable, reconnexion…'
                : 'Connexion impossible.');

  const montreSalle = etat === 'connecte' || etat === 'reconnexion';
  const pouvoirReessayer = etat === 'echec' || etat === 'salle-pleine' || etat === 'deconnecte';
  const montrerRetour = montreSalle || pouvoirReessayer;
  const montrerFormulaire =
    etat === 'attente' || etat === 'echec' || etat === 'salle-pleine' || etat === 'deconnecte';
  formulaireConnexionElement.hidden = !montrerFormulaire;
  actionsConnexionElement.hidden = !montrerRetour;
  boutonReessayerElement.hidden = !pouvoirReessayer;
  boutonRetourElement.hidden = !montrerRetour;
  infosConnexionElement.hidden = !montreSalle;
}

function actualiserInfosConnexion(donnees: EtatAffichageConnexion): void {
  connexionSalleElement.textContent = donnees.identifiantSalle ?? '—';
  connexionNomElement.textContent = donnees.nom ?? '—';
  connexionJoueursElement.textContent =
    donnees.nombreJoueurs === undefined
      ? '—'
      : `${donnees.nombreJoueurs} joueur${donnees.nombreJoueurs > 1 ? 's' : ''}`;
}

function afficherPanneauAccueil(): void {
  panneauAccueilElement.hidden = false;
  conteneurApplication.dataset.mode = 'accueil';
}

function urlServeurPartirDe(base: string): string {
  if (!modeE2E) {
    return base;
  }
  const surdefinie = paramètres.get('serveur');
  return surdefinie?.trim() || base;
}

async function rejoindreSalle(): Promise<void> {
  const nom = champNomElement.value.trim();
  const erreurNom = validerNomSaisi(nom);
  if (erreurNom) {
    actualiserStatutPanneau('echec', erreurNom);
    champNomElement.focus();
    return;
  }

  const identifiantSalle = champSalleElement.value.trim() || undefined;
  if (connecteurPanneau) {
    connecteurPanneau.detruire();
    connecteurPanneau = undefined;
  }

  actualiserStatutPanneau('connexion');
  boutonRejoindreElement.disabled = true;
  const urlServeur = urlServeurPartirDe(import.meta.env.VITE_SERVER_URL ?? 'http://127.0.0.1:2567');
  const optionsConnexion: OptionsConnexion = {
    ...(nom ? { nom } : {}),
  };

  connecteurPanneau = await connecterSalleJeu(
    urlServeur,
    optionsConnexion,
    {
      surEtat: (donnees) => {
        actualiserStatutPanneau(donnees.etat, donnees.message);
        if (donnees.etat === 'connecte') {
          actualiserInfosConnexion(donnees);
        }
      },
    },
    identifiantSalle,
  );
  boutonRejoindreElement.disabled = false;
}

formulaireConnexionElement.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  void rejoindreSalle();
});

boutonReessayerElement.addEventListener('click', () => {
  void rejoindreSalle();
});

boutonRetourElement.addEventListener('click', () => {
  if (connecteurPanneau) {
    connecteurPanneau.detruire();
    connecteurPanneau = undefined;
  }
  actualiserStatutPanneau('attente');
  boutonRejoindreElement.disabled = false;
  champNomElement.focus();
});

const afficherPanneau =
  !modePirates &&
  !modeDiagnosticSalle &&
  !modeMonde &&
  (modePanneauE2E || modePecheursDistants || !modeE2E);

if (afficherPanneau) {
  champNomElement.value = genererNomPecheur();
  afficherPanneauAccueil();
}

if (modePecheursDistants) {
  const nomE2E = paramètres.get('nom')?.trim();
  const salleE2E = paramètres.get('room')?.trim();
  if (nomE2E) {
    champNomElement.value = nomE2E;
  }
  if (salleE2E) {
    champSalleElement.value = salleE2E;
  }
  void rejoindreSalle();
}

if (modeDiagnosticSalle) {
  conteneurApplication.dataset.diagnostics = 'actifs';
  const urlServeur = import.meta.env.VITE_SERVER_URL ?? 'http://127.0.0.1:2567';
  const graineDiagnostic = paramètres.get('graine')?.trim();
  const optionsDiagnostic = graineDiagnostic ? { graine: graineDiagnostic } : {};
  const identifiantSalle = paramètres.get('room')?.trim() || undefined;

  void connecterDiagnosticSalle(
    urlServeur,
    optionsDiagnostic,
    elementsDiagnosticSalle,
    identifiantSalle,
  )
    .then((connexion) => {
      diagnosticSalleConnecte = connexion;
      if (modeCombatE2E) {
        window.__pirateIslandsE2E = {
          verrouillerPointeur: () => undefined,
          libererPointeur: () => undefined,
          lireEtat: () => ({
            position: { x: 0, y: 0, z: 0 },
            camera: { lacet: 0, tangage: 0 },
            pause: false,
            pointeurVerrouille: false,
            collision: 'aucune',
            reglages: reglages.applique,
            tir: {
              compteur: 0,
              etat: { recul: 0, eclairBouche: false },
              derniereIntention: undefined,
              intentions: [],
            },
            peche: { modeActif: false, vue: 'rangee', sequence: 0, invite: null, statut: '' },
          }),
          lireReglages: () => reglages.applique,
          reinitialiser: () => undefined,
          tirer: () => undefined,
          avancerTemps: () => undefined,
          tirerReseau: connexion.tirer,
          tirerDansLeVide: connexion.tirerDansLeVide,
          rejouerTir: connexion.rejouerDernierTir,
          infligerDegatsE2E: connexion.infligerDegatsE2E,
          lireCombat: connexion.lireCombat,
          lireDeconnexion: connexion.lireDeconnexion,
        };
      }
    })
    .catch((erreur: unknown) => {
      afficherErreurDiagnosticSalle(erreur, elementsDiagnosticSalle);
    });
}

window.addEventListener('pagehide', () => diagnosticSalleConnecte?.detruire(), { once: true });

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
