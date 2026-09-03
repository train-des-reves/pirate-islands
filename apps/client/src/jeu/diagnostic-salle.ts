import { Client, type Room } from '@colyseus/sdk';

import {
  EtatSalleSchema,
  NOM_SALLE_JEU,
  NOMS_MESSAGES,
  type EtatSalle,
  type Joueur,
  type MessageDegatsE2E,
  type MessageIntentionTir,
  type MessageResultatPeche,
  type MessageResultatTir,
  type OptionsConnexion,
} from '@pirate/protocole';
import { calculerPrevisionPeche, genererMonde, normaliserDirection } from '@pirate/coeur-jeu';
import {
  afficherAthCombat,
  construireEtatAthCombat,
  type ElementsAthCombat,
} from '../interface/ath-combat';

export interface ElementsDiagnosticSalle {
  readonly conteneur: HTMLElement;
  readonly identifiantSalle: HTMLElement;
  readonly sessionId: HTMLElement;
  readonly nombreJoueurs: HTMLElement;
  readonly erreur: HTMLElement;
  readonly cible: HTMLElement;
  readonly santeJoueur: HTMLElement;
  readonly santePirate: HTMLElement;
  readonly reapparition: HTMLElement;
  readonly resultat: HTMLElement;
  readonly deconnexion: HTMLElement;
  readonly pecheJoueur: HTMLElement;
  readonly pecheSequence: HTMLElement;
  readonly pecheZone: HTMLElement;
  readonly pechePhase: HTMLElement;
  readonly pecheLignesActives: HTMLElement;
  readonly pecheResultat: HTMLElement;
  readonly athCombat?: ElementsAthCombat;
}

/** État de combat exposé au harnais E2E, jamais fourni au serveur. */
export interface EtatCombatDiagnostic {
  readonly cibleId: string | null;
  readonly santeJoueur: number;
  readonly santePirate: number;
  readonly pirateNeutralise: boolean;
  readonly enAttenteReapparition: boolean;
  readonly dernierResultat: MessageResultatTir | undefined;
  readonly codeDeconnexion: number | undefined;
}

export interface EtatPecheDiagnostic {
  readonly lignesActives: number;
  readonly ligneLocale:
    | {
        readonly joueurId: string;
        readonly sequence: number;
        readonly zoneId: string;
        readonly phase: string;
      }
    | undefined;
  readonly dernierResultat: MessageResultatPeche | undefined;
}

export interface DiagnosticSalleConnecte {
  readonly salle: Room<unknown, EtatSalle>;
  /** Émet une intention de tir réseau vers le serveur, sans résultat local. */
  readonly tirer: (cibleId?: string) => void;
  /** Émet une intention de tir volontairement dans le vide (raté sans effet). */
  readonly tirerDansLeVide: () => void;
  /** Rejoue la dernière intention avec la même séquence : le serveur la rejette. */
  readonly rejouerDernierTir: () => void;
  /** Appelle le mannequin E2E serveur réservé aux tests. */
  readonly infligerDegatsE2E: (degats: number) => void;
  /** Lit l'état de combat réel observé après la dernière synchronisation réseau. */
  readonly lireCombat: () => EtatCombatDiagnostic;
  /** Lit le dernier code de rejet/déconnexion observé depuis la salle. */
  readonly lireDeconnexion: () => number | undefined;
  readonly preparerPecheE2E: () => void;
  readonly avancerPecheE2E: () => void;
  readonly lancerPeche: () => void;
  readonly releverPeche: () => void;
  readonly annulerPeche: () => void;
  readonly lirePeche: () => EtatPecheDiagnostic;
  readonly quitterSalleE2E: () => void;
  readonly detruire: () => void;
}

const HAUTEUR_YEUX_DIAGNOSTIC = 1.62;

interface EtatCombatInterne {
  cibleId: string | null;
  santeJoueur: number;
  santePirate: number;
  degats: number;
  pirateNeutralise: boolean;
  enAttenteReapparition: boolean;
  dernierResultat: MessageResultatTir | undefined;
  codeDeconnexion: number | undefined;
  raisonDeconnexion: string;
}

function écrireDiagnosticCombat(
  elements: ElementsDiagnosticSalle,
  etat: EtatCombatInterne,
  salle: Room<unknown, EtatSalle>,
): void {
  elements.cible.textContent = 'Cible : ' + (etat.cibleId ?? 'aucune');
  elements.santeJoueur.textContent = 'Santé joueur : ' + etat.santeJoueur;
  elements.santePirate.textContent = 'Santé pirate : ' + etat.santePirate;
  elements.reapparition.textContent =
    'En attente : ' + (etat.enAttenteReapparition ? 'oui' : 'non');
  elements.deconnexion.textContent =
    etat.codeDeconnexion === undefined
      ? 'Rejet serveur : aucun'
      : 'Rejet serveur : ' + etat.codeDeconnexion + ' · ' + etat.raisonDeconnexion;
  const dernier = etat.dernierResultat;
  if (dernier === undefined) {
    elements.resultat.textContent = 'Dernier tir : —';
  } else {
    const cible = dernier.cibleId ?? 'aucun';
    const neutralise = dernier.pirateNeutralise ? ' · neutralisé' : '';
    elements.resultat.textContent =
      'Dernier tir : cible ' + cible + ' · dégâts ' + dernier.degats + neutralise;
  }

  if (elements.athCombat !== undefined) {
    const joueur = lireJoueurLocal(salle);
    if (joueur !== undefined) {
      const cible = etat.cibleId ? salle.state.pirates.get(etat.cibleId) : undefined;
      afficherAthCombat(
        elements.athCombat,
        construireEtatAthCombat(joueur, cible, etat.dernierResultat),
      );
    }
  }
}

function écrireDiagnosticPeche(
  salle: Room<unknown, EtatSalle>,
  elements: ElementsDiagnosticSalle,
  dernierResultat: MessageResultatPeche | undefined,
): void {
  const ligne =
    salle.state.lignesPeche.get(salle.sessionId) ?? [...salle.state.lignesPeche.values()][0];
  elements.pecheJoueur.textContent = 'Pêcheur ligne : ' + (ligne?.joueurId ?? 'aucun');
  elements.pecheSequence.textContent = 'Séquence pêche : ' + (ligne?.sequence ?? '—');
  elements.pecheZone.textContent = 'Zone pêche : ' + (ligne?.zoneId ?? '—');
  elements.pechePhase.textContent = 'Phase pêche : ' + (ligne?.phase ?? 'inactive');
  elements.pecheLignesActives.textContent = 'Lignes actives : ' + salle.state.lignesPeche.size;
  elements.pecheResultat.textContent =
    dernierResultat === undefined
      ? 'Résultat pêche : —'
      : 'Résultat pêche : ' + dernierResultat.resultat + ' · joueur ' + dernierResultat.joueurId;
}

function actualiserDiagnostic(
  salle: Room<unknown, EtatSalle>,
  elements: ElementsDiagnosticSalle,
): void {
  elements.identifiantSalle.textContent = 'Salle : ' + salle.roomId;
  elements.sessionId.textContent = 'Session locale : ' + salle.sessionId;
  elements.nombreJoueurs.textContent = 'Joueurs connectés : ' + salle.state.joueurs.size;
}

function lireJoueurLocal(salle: Room<unknown, EtatSalle>): Joueur | undefined {
  return salle.state.joueurs.get(salle.sessionId);
}

function calculerViseeDeterministe(
  salle: Room<unknown, EtatSalle>,
  cibleId?: string,
): {
  readonly origine: { readonly x: number; readonly y: number; readonly z: number };
  readonly direction: { readonly x: number; readonly y: number; readonly z: number };
} {
  const joueur = lireJoueurLocal(salle);
  const position = {
    x: joueur?.transformation.x ?? 0,
    y: (joueur?.transformation.y ?? 0) + HAUTEUR_YEUX_DIAGNOSTIC,
    z: joueur?.transformation.z ?? 0,
  };

  const pirates = [...salle.state.pirates.values()];
  const cible = cibleId
    ? pirates.find((pirate) => pirate.identifiant === cibleId && pirate.vivant)
    : undefined;

  let centre: { readonly x: number; readonly y: number; readonly z: number };
  if (cible !== undefined) {
    centre = {
      x: cible.transformation.x,
      y: cible.transformation.y + 1,
      z: cible.transformation.z,
    };
  } else {
    const candidate = pirates.find((pirate) => pirate.vivant);
    if (candidate === undefined) {
      return {
        origine: position,
        direction: { x: 0, y: 0, z: 1 },
      };
    }
    centre = {
      x: candidate.transformation.x,
      y: candidate.transformation.y + 1,
      z: candidate.transformation.z,
    };
  }

  const vers = {
    x: centre.x - position.x,
    y: centre.y - position.y,
    z: centre.z - position.z,
  };
  const direction = normaliserDirection(vers);
  return { origine: position, direction };
}

export async function connecterDiagnosticSalle(
  urlServeur: string,
  options: OptionsConnexion,
  elements: ElementsDiagnosticSalle,
  identifiantSalle?: string,
): Promise<DiagnosticSalleConnecte> {
  const client = new Client(urlServeur);
  const salle = identifiantSalle
    ? await client.joinById(identifiantSalle, options, EtatSalleSchema)
    : await client.joinOrCreate(NOM_SALLE_JEU, options, EtatSalleSchema);
  const salleTypée = salle as Room<unknown, EtatSalle>;

  elements.conteneur.hidden = false;
  elements.erreur.hidden = true;

  let sequence = 1;
  let dernièreIntentionEnvoyée: MessageIntentionTir | undefined;
  let dernierCodeDeconnexion: number | undefined;
  let raisonDeconnexion = '';
  let dernierResultatPeche: MessageResultatPeche | undefined;
  let etatCombat: EtatCombatInterne = {
    cibleId: null,
    santeJoueur: 100,
    santePirate: 100,
    degats: 0,
    pirateNeutralise: false,
    enAttenteReapparition: false,
    dernierResultat: undefined,
    codeDeconnexion: undefined,
    raisonDeconnexion: '',
  };

  const mettreAJourDiagnostic = (): void => {
    actualiserDiagnostic(salleTypée, elements);
    const joueur = lireJoueurLocal(salleTypée);
    etatCombat = {
      ...etatCombat,
      santeJoueur: joueur?.sante ?? etatCombat.santeJoueur,
      enAttenteReapparition: joueur !== undefined && !joueur.vivant,
    };
    const cible = etatCombat.cibleId ? salleTypée.state.pirates.get(etatCombat.cibleId) : undefined;
    etatCombat = {
      ...etatCombat,
      santePirate: cible?.sante ?? etatCombat.santePirate,
      pirateNeutralise: cible !== undefined && !cible.vivant,
    };
    écrireDiagnosticCombat(elements, etatCombat, salleTypée);
    écrireDiagnosticPeche(salleTypée, elements, dernierResultatPeche);
  };

  salleTypée.onMessage(NOMS_MESSAGES.resultatTir, (message: MessageResultatTir) => {
    etatCombat.dernierResultat = message;
    etatCombat.cibleId = message.cibleId;
    etatCombat.degats = message.degats;
    etatCombat.pirateNeutralise = message.pirateNeutralise;
    mettreAJourDiagnostic();
  });

  salleTypée.onMessage(NOMS_MESSAGES.resultatPeche, (message: MessageResultatPeche) => {
    dernierResultatPeche = message;
    mettreAJourDiagnostic();
  });

  salleTypée.onError((code, message) => {
    dernierCodeDeconnexion = code;
    raisonDeconnexion = message || 'Requête refusée par le serveur.';
    etatCombat.codeDeconnexion = code;
    etatCombat.raisonDeconnexion = raisonDeconnexion;
    mettreAJourDiagnostic();
  });
  salleTypée.onLeave((code, raison) => {
    dernierCodeDeconnexion = code;
    raisonDeconnexion = raison ?? 'Connexion fermée par le serveur.';
    etatCombat.codeDeconnexion = code;
    etatCombat.raisonDeconnexion = raisonDeconnexion;
    mettreAJourDiagnostic();
  });

  salleTypée.onStateChange(() => mettreAJourDiagnostic());
  mettreAJourDiagnostic();

  const émettreIntention = (
    origine: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    direction: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
  ): MessageIntentionTir => {
    const intention: MessageIntentionTir = {
      sequence,
      origineX: origine.x,
      origineY: origine.y,
      origineZ: origine.z,
      directionX: direction.x,
      directionY: direction.y,
      directionZ: direction.z,
      horodatageClient: Date.now(),
    };
    sequence += 1;
    salleTypée.send(NOMS_MESSAGES.intentionTir, intention);
    return intention;
  };

  let détruite = false;
  return {
    salle: salleTypée,
    tirer: (cibleId?) => {
      if (détruite) {
        return;
      }

      const visee = calculerViseeDeterministe(salleTypée, cibleId);
      const derniereIntention = émettreIntention(visee.origine, visee.direction);
      dernièreIntentionEnvoyée = derniereIntention;
    },
    tirerDansLeVide: () => {
      if (détruite) {
        return;
      }

      const joueur = lireJoueurLocal(salleTypée);
      const origine = {
        x: joueur?.transformation.x ?? 0,
        y: (joueur?.transformation.y ?? 0) + HAUTEUR_YEUX_DIAGNOSTIC,
        z: joueur?.transformation.z ?? 0,
      };
      // Direction horizontale vers l'est : les pirates sont sur des îles
      // surélevées (torse bien au-dessus de 1,62), donc ce rayon ne les touche
      // jamais et produit un raté sans effet, de façon déterministe.
      const derniereIntention = émettreIntention(origine, { x: 1, y: 0, z: 0 });
      dernièreIntentionEnvoyée = derniereIntention;
    },
    rejouerDernierTir: () => {
      if (détruite) {
        return;
      }
      if (dernièreIntentionEnvoyée === undefined) {
        return;
      }
      // Réémet la dernière intention sans consommer de nouvelle séquence : le
      // serveur doit la refuser comme déjà consommée (séquence rejouée).
      salleTypée.send(NOMS_MESSAGES.intentionTir, dernièreIntentionEnvoyée);
    },
    infligerDegatsE2E: (degats: number) => {
      if (détruite) {
        return;
      }

      const message: MessageDegatsE2E = { degats };
      salleTypée.send(NOMS_MESSAGES.degatsE2E, message);
    },
    lireCombat: () => ({
      cibleId: etatCombat.cibleId,
      santeJoueur: etatCombat.santeJoueur,
      santePirate: etatCombat.santePirate,
      pirateNeutralise: etatCombat.pirateNeutralise,
      enAttenteReapparition: etatCombat.enAttenteReapparition,
      dernierResultat: etatCombat.dernierResultat,
      codeDeconnexion: etatCombat.codeDeconnexion,
    }),
    lireDeconnexion: () => dernierCodeDeconnexion,
    preparerPecheE2E: () => {
      if (!détruite) {
        salleTypée.send(NOMS_MESSAGES.preparerPecheE2E, { preparation: true });
      }
    },
    avancerPecheE2E: () => {
      if (détruite) {
        return;
      }
      const ligne = salleTypée.state.lignesPeche.get(salleTypée.sessionId);
      const délai = ligne
        ? calculerPrevisionPeche(salleTypée.state.metadonnees.graine, ligne.sequence)
            .delaiMorsureMs
        : 0;
      salleTypée.send(NOMS_MESSAGES.avancerPecheE2E, { deltaMs: délai + 200 });
    },
    lancerPeche: () => {
      if (détruite) {
        return;
      }
      const monde = genererMonde(options.graine);
      const zone = monde.zonesPeche[0];
      if (!zone) {
        return;
      }
      const origine = {
        x: zone.centre.x,
        y: zone.centre.y + HAUTEUR_YEUX_DIAGNOSTIC,
        z: zone.centre.z,
      };
      const direction = normaliserDirection({
        x: zone.centre.x - origine.x,
        y: zone.centre.y - origine.y,
        z: zone.centre.z - origine.z,
      });
      // La séquence E2E choisit un délai de morsure suffisamment large pour
      // laisser le harnais capturer les deux fenêtres navigateur.
      const sequencePeche = Math.max(sequence, 5);
      salleTypée.send(NOMS_MESSAGES.lancerPeche, {
        sequence: sequencePeche,
        zoneId: zone.id,
        origineX: origine.x,
        origineY: origine.y,
        origineZ: origine.z,
        directionX: direction.x,
        directionY: direction.y,
        directionZ: direction.z,
        flotteurX: zone.centre.x,
        flotteurY: zone.centre.y,
        flotteurZ: zone.centre.z,
      });
      sequence = sequencePeche + 1;
    },
    releverPeche: () => {
      const ligne = salleTypée.state.lignesPeche.get(salleTypée.sessionId);
      if (!détruite) {
        salleTypée.send(NOMS_MESSAGES.releverPeche, { sequence: ligne?.sequence ?? 1 });
      }
    },
    annulerPeche: () => {
      const ligne = salleTypée.state.lignesPeche.get(salleTypée.sessionId);
      if (!détruite) {
        salleTypée.send(NOMS_MESSAGES.annulerPeche, { sequence: ligne?.sequence ?? 1 });
      }
    },
    lirePeche: () => {
      const ligne =
        salleTypée.state.lignesPeche.get(salleTypée.sessionId) ??
        [...salleTypée.state.lignesPeche.values()][0];
      return {
        lignesActives: salleTypée.state.lignesPeche.size,
        ligneLocale: ligne
          ? {
              joueurId: ligne.joueurId,
              sequence: ligne.sequence,
              zoneId: ligne.zoneId,
              phase: ligne.phase,
            }
          : undefined,
        dernierResultat: dernierResultatPeche,
      };
    },
    quitterSalleE2E: () => {
      if (!détruite) {
        détruite = true;
        void salleTypée.leave();
      }
    },
    detruire: () => {
      if (détruite) {
        return;
      }

      détruite = true;
      void salleTypée.leave();
    },
  };
}

export function afficherErreurDiagnosticSalle(
  erreur: unknown,
  elements: ElementsDiagnosticSalle,
): void {
  elements.conteneur.hidden = false;
  elements.erreur.hidden = false;
  elements.erreur.textContent =
    erreur instanceof Error ? 'Connexion refusée : ' + erreur.message : 'Connexion refusée.';
}
