import type { DescripteurBateau } from './bateau';
import type { ControleBateauMouvement } from './bateau-mouvement';
import { creerEtatJoueur, type MondeCollision } from './mouvement';
import {
  creerEtatPilotageComplet,
  debarquer,
  embarquer,
  extraireAncres,
  prendreBarre,
  quitterBarre,
  simulerPilotage,
  type EtatPilotageComplet,
  type MondePilotage,
} from './commande-bateau';
import { INTENTIONS_AUCUNE, type IntentionsPilotage, type ObstacleNavigation } from './pilotage';

export interface EtatHarnaisPilotage {
  readonly mode: EtatPilotageComplet['mode'];
  readonly invite: EtatPilotageComplet['invite'];
  readonly positionJoueur: { readonly x: number; readonly y: number; readonly z: number };
  readonly positionBateau: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotationBateau: number;
  readonly vitesse: number;
  readonly collision: EtatPilotageComplet['bateau']['collision'];
  readonly intensiteSillage: number;
  readonly intentions: IntentionsPilotage;
}

export interface HarnaisPilotage {
  lireEtat(): EtatHarnaisPilotage;
  agir(): void;
  debarquer(): void;
  deplacerBord(offset: { x: number; z: number }): void;
  piloter(intentions: IntentionsPilotage): void;
  avancerTemps(deltaSecondes: number): void;
  reinitialiser(): void;
}

export interface OptionsHarnaisPilotage {
  readonly descripteur: DescripteurBateau;
  readonly mondePied: MondeCollision;
  readonly collisionsBateau: readonly ObstacleNavigation[];
  readonly positionInitiale?: { readonly x: number; readonly y: number; readonly z: number };
  readonly positionBateauInitiale?: { readonly x: number; readonly y: number; readonly z: number };
  readonly controleBateau?: ControleBateauMouvement;
  readonly surEtat?: (etat: EtatHarnaisPilotage) => void;
}

export function construireHarnaisPilotage(options: OptionsHarnaisPilotage): HarnaisPilotage {
  const ancres = extraireAncres(options.descripteur);
  const positionInitiale = options.positionInitiale ?? {
    x: ancres.embarquement.x,
    y: ancres.embarquement.y + 0.5,
    z: ancres.embarquement.z,
  };
  let etat = creerEtatPilotageComplet(
    positionInitiale,
    options.descripteur,
    options.positionBateauInitiale,
  );
  let deltaSimuleSecondes = 0;
  let intentionsActuelles: IntentionsPilotage = INTENTIONS_AUCUNE;

  const monde: MondePilotage = {
    mondePied: options.mondePied,
    collisionsBateau: options.collisionsBateau,
  };

  const lireEtat = (): EtatHarnaisPilotage => ({
    mode: etat.mode,
    invite: etat.invite,
    positionJoueur: { ...etat.passager.position },
    positionBateau: { ...etat.bateau.position },
    rotationBateau: etat.bateau.rotationY,
    vitesse: etat.bateau.vitesse,
    collision: etat.bateau.collision,
    intensiteSillage: etat.bateau.intensiteSillage,
    intentions: { ...intentionsActuelles },
  });

  const notifier = (): void => {
    options.controleBateau?.appliquerNavigation(etat.bateau);
    options.controleBateau?.appliquerMode(etat.mode);
    options.surEtat?.(lireEtat());
  };

  const agir = (): void => {
    if (etat.mode === 'pied') {
      etat = embarquer(etat, ancres, options.descripteur);
      notifier();
      return;
    }
    if (etat.mode === 'pilote') {
      etat = quitterBarre(etat, ancres, options.descripteur);
      notifier();
      return;
    }
    // En mode bord, « interagir » amène à la barre (action principale).
    etat = prendreBarre(etat, ancres, options.descripteur);
    notifier();
  };

  const debarquerExplicite = (): void => {
    if (etat.mode === 'bord') {
      etat = debarquer(etat, ancres, options.descripteur);
      deltaSimuleSecondes = 0;
      intentionsActuelles = INTENTIONS_AUCUNE;
      notifier();
    }
  };

  const deplacerBord = (offset: { x: number; z: number }): void => {
    if (etat.mode !== 'bord') {
      return;
    }
    const deltaX = Number.isFinite(offset.x) ? offset.x : 0;
    const deltaZ = Number.isFinite(offset.z) ? offset.z : 0;
    const positionLocale = {
      x: etat.positionLocale.x + deltaX,
      y: etat.positionLocale.y,
      z: etat.positionLocale.z + deltaZ,
    };
    etat = {
      ...etat,
      positionLocale,
      passager: creerEtatJoueur({
        x: positionBateauMondeFromLocal(etat, positionLocale).x,
        y: positionBateauMondeFromLocal(etat, positionLocale).y,
        z: positionBateauMondeFromLocal(etat, positionLocale).z,
      }),
    };
    notifier();
  };

  const piloter = (intentions: IntentionsPilotage): void => {
    intentionsActuelles = {
      poussee: Number.isFinite(intentions.poussee)
        ? Math.max(-1, Math.min(1, intentions.poussee))
        : 0,
      gouvernail: Number.isFinite(intentions.gouvernail)
        ? Math.max(-1, Math.min(1, intentions.gouvernail))
        : 0,
    };
  };

  const avancerTemps = (deltaSecondes: number): void => {
    deltaSimuleSecondes = Number.isFinite(deltaSecondes)
      ? Math.max(0, Math.min(0.25, deltaSecondes))
      : 0;
    if (etat.mode !== 'pilote') {
      return;
    }
    const actions = {
      avancer: intentionsActuelles.poussee > 0,
      reculer: intentionsActuelles.poussee < 0,
      gauche: intentionsActuelles.gouvernail < 0,
      droite: intentionsActuelles.gouvernail > 0,
    };
    etat = simulerPilotage(etat, actions, 0, deltaSimuleSecondes, monde, contraintes(options));
    notifier();
  };

  notifier();

  return {
    lireEtat,
    agir,
    debarquer: debarquerExplicite,
    deplacerBord,
    piloter,
    avancerTemps,
    reinitialiser: () => {
      etat = creerEtatPilotageComplet(
        positionInitiale,
        options.descripteur,
        options.positionBateauInitiale,
      );
      deltaSimuleSecondes = 0;
      intentionsActuelles = INTENTIONS_AUCUNE;
      notifier();
    },
  };
}

function positionBateauMondeFromLocal(
  etat: EtatPilotageComplet,
  positionLocale: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const cosinus = Math.cos(etat.bateau.rotationY);
  const sinus = Math.sin(etat.bateau.rotationY);
  return {
    x: etat.bateau.position.x + positionLocale.x * cosinus + positionLocale.z * sinus,
    y: etat.bateau.position.y + positionLocale.y,
    z: etat.bateau.position.z - positionLocale.x * sinus + positionLocale.z * cosinus,
  };
}

function contraintes(options: OptionsHarnaisPilotage) {
  return {
    surfaces: options.descripteur.surfaces,
    collisions: options.descripteur.collisions,
    limites: options.descripteur.limitesLocal,
  };
}
