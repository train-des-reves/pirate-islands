import { Client, ServerError, type Room } from '@colyseus/sdk';

import {
  EtatSalleSchema,
  NOM_SALLE_JEU,
  type EtatSalle,
  type OptionsConnexion,
} from '@pirate/protocole';

export type EtatConnexion =
  | 'attente'
  | 'connexion'
  | 'connecte'
  | 'salle-pleine'
  | 'deconnecte'
  | 'reconnexion'
  | 'echec';

export type EvenementConnexion =
  | { readonly type: 'demarrer' }
  | { readonly type: 'connecter' }
  | { readonly type: 'connecte' }
  | { readonly type: 'salle-pleine' }
  | { readonly type: 'deconnecter' }
  | { readonly type: 'deconnecte' }
  | { readonly type: 'reconnexion' }
  | { readonly type: 'echec' };

export function reduireEtatConnexion(
  _etat: EtatConnexion,
  evenement: EvenementConnexion,
): EtatConnexion {
  switch (evenement.type) {
    case 'demarrer':
      return 'attente';
    case 'connecter':
      return 'connexion';
    case 'connecte':
      return 'connecte';
    case 'salle-pleine':
      return 'salle-pleine';
    case 'deconnecter':
    case 'deconnecte':
      return 'deconnecte';
    case 'reconnexion':
      return 'reconnexion';
    case 'echec':
      return 'echec';
  }
}

export interface EtatAffichageConnexion {
  readonly etat: EtatConnexion;
  readonly message?: string;
  readonly identifiantSalle?: string;
  readonly sessionId?: string;
  readonly nom?: string;
  readonly nombreJoueurs?: number;
}

export interface ClassificationConnexion {
  readonly etat: EtatConnexion;
  readonly message: string;
}

function lireCodeErreur(erreur: unknown): string | number | undefined {
  if (typeof erreur !== 'object' || erreur === null) {
    return undefined;
  }

  const code = (erreur as { readonly code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number' ? code : undefined;
}

function estErreurReseau(erreur: unknown, code: string | number | undefined): boolean {
  if (
    typeof code === 'string' &&
    /^(ECONN|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|UND_ERR|EPIPE|EAI_AGAIN|ERR_NETWORK|ERR_FAILED)/i.test(
      code,
    )
  ) {
    return true;
  }

  const message = erreur instanceof Error ? erreur.message : '';
  return /fetch failed|failed to fetch|network|unreachable|econnrefused|connection refused|serveur indisponible|networkerror/i.test(
    message,
  );
}

const MESSAGE_SALLE_PLEINE = 'La salle est déjà complète. Revenez plus tard.';
const MESSAGE_SERVEUR_INDISPONIBLE = 'Serveur indisponible. Vérifiez votre connexion puis réessayez.';
const MESSAGE_CONNEXION_IMPOSSIBLE = 'Connexion impossible. Réessayez.';

export function classifierErreurConnexion(erreur: unknown): ClassificationConnexion {
  const code = lireCodeErreur(erreur);
  const message = erreur instanceof Error ? erreur.message : '';

  if (message.includes('already full') || message.includes('est déjà complète') || message.includes('is full')) {
    return { etat: 'salle-pleine', message: MESSAGE_SALLE_PLEINE };
  }

  if (estErreurReseau(erreur, code)) {
    return { etat: 'echec', message: MESSAGE_SERVEUR_INDISPONIBLE };
  }

  return { etat: 'echec', message: MESSAGE_CONNEXION_IMPOSSIBLE };
}

export function estSallePleine(erreur: unknown): boolean {
  const classification = classifierErreurConnexion(erreur);
  return classification.etat === 'salle-pleine';
}

const MOTS_NOM = ['Aube', 'Brume', 'Corail', 'Flibuste', 'Lagon', 'Marée', 'Récif', 'Vague'] as const;

export function genererNomPecheur(aleatoire: () => number = Math.random): string {
  const mot = MOTS_NOM[Math.floor(aleatoire() * MOTS_NOM.length)] ?? MOTS_NOM[0]!;
  const valeur = Math.floor(aleatoire() * 10_000);
  return `Pêcheur-${mot}-${valeur.toString().padStart(4, '0')}`;
}

export interface ConnecteurConnexion {
  readonly salleId: string | undefined;
  readonly detruire: () => void;
  readonly lireSalle: () => Room<unknown, EtatSalle> | undefined;
}

interface AbonnementConnexion {
  readonly surEtat: (etat: EtatAffichageConnexion) => void;
}

export function validerNomSaisi(nom: string): string | undefined {
  const nomNormalise = nom.trim();
  if (nomNormalise.length === 0) {
    return 'Choisissez un nom de pêcheur.';
  }
  if (nomNormalise.length > 32) {
    return 'Le nom de pêcheur est trop long (32 caractères maximum).';
  }
  return undefined;
}

export async function connecterSalleJeu(
  urlServeur: string,
  options: OptionsConnexion,
  abonnement: AbonnementConnexion,
  identifiantSalle?: string,
  construitClient: (url: string) => Client = (url) => new Client(url),
): Promise<ConnecteurConnexion> {
  const client = construitClient(urlServeur);
  abonnement.surEtat({ etat: 'connexion' });

  let salle: Room<unknown, EtatSalle> | undefined;
  let dureeVie = true;

  const publierEtatConnecte = (): void => {
    if (!salle || !dureeVie) {
      return;
    }

    const joueurLocal = salle.state.joueurs.get(salle.sessionId);
    const nomJoueur = joueurLocal?.nom ?? options.nom;
    abonnement.surEtat({
      etat: 'connecte',
      identifiantSalle: salle.roomId,
      sessionId: salle.sessionId,
      ...(nomJoueur === undefined ? {} : { nom: nomJoueur }),
      nombreJoueurs: salle.state.joueurs.size,
    });
  };

  try {
    salle = identifiantSalle
      ? await client.joinById(identifiantSalle, options, EtatSalleSchema)
      : await client.joinOrCreate(NOM_SALLE_JEU, options, EtatSalleSchema);
  } catch (erreur) {
    if (!dureeVie) {
      return { salleId: undefined, detruire: () => undefined, lireSalle: () => undefined };
    }

    const classification = classifierErreurConnexion(erreur);
    abonnement.surEtat({ etat: classification.etat, message: classification.message });
    return {
      salleId: undefined,
      detruire: () => undefined,
      lireSalle: () => undefined,
    };
  }

  if (!dureeVie) {
    await salle.leave();
    return { salleId: salle.roomId, detruire: () => undefined, lireSalle: () => undefined };
  }

  const salleTypée = salle as Room<unknown, EtatSalle>;
  let détruite = false;

  const surChange: (etat: EtatSalle) => void = () => publierEtatConnecte();
  const surErreur: (code: number, message?: string) => void = (code, message) => {
    if (!dureeVie || détruite) {
      return;
    }
    const erreur = new ServerError(code, message ?? 'Erreur de connexion.');
    const classification = classifierErreurConnexion(erreur);
    abonnement.surEtat({ etat: classification.etat, message: classification.message });
  };
  const surDépart: (code: number, raison?: string) => void = (code, raison) => {
    if (!dureeVie || détruite) {
      return;
    }
    if (code === 4003 || code === 4004) {
      const classification = classifierErreurConnexion(
        new ServerError(code, raison ?? 'Connexion refusée.'),
      );
      abonnement.surEtat({ etat: classification.etat, message: classification.message });
      return;
    }
    abonnement.surEtat({
      etat: 'deconnecte',
      ...(raison === undefined ? {} : { message: raison }),
    });
  };
  const surPerte: (code: number, raison?: string) => void = (code, raison) => {
    if (!dureeVie || détruite) {
      return;
    }
    abonnement.surEtat({
      etat: 'reconnexion',
      ...(raison === undefined ? {} : { message: raison }),
    });
  };
  const surReconnexion: () => void = () => {
    if (!dureeVie || détruite) {
      return;
    }
    publierEtatConnecte();
  };

  salleTypée.onStateChange(surChange);
  salleTypée.onError(surErreur);
  salleTypée.onLeave(surDépart);
  salleTypée.onDrop(surPerte);
  salleTypée.onReconnect(surReconnexion);
  publierEtatConnecte();

  return {
    salleId: salleTypée.roomId,
    lireSalle: () => salleTypée,
    detruire: () => {
      if (détruite || !dureeVie) {
        return;
      }
      détruite = true;
      dureeVie = false;
      salleTypée.onStateChange.clear();
      salleTypée.onError.clear();
      salleTypée.onLeave.clear();
      salleTypée.onDrop.clear();
      salleTypée.onReconnect.clear();
      void salleTypée.leave();
      abonnement.surEtat({ etat: 'deconnecte' });
    },
  };
}
