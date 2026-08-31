import { Client, type Room } from '@colyseus/sdk';

import {
  EtatSalleSchema,
  NOM_SALLE_JEU,
  type EtatSalle,
  type OptionsConnexion,
} from '@pirate/protocole';

export interface ElementsDiagnosticSalle {
  readonly conteneur: HTMLElement;
  readonly identifiantSalle: HTMLElement;
  readonly sessionId: HTMLElement;
  readonly nombreJoueurs: HTMLElement;
  readonly erreur: HTMLElement;
}

export interface DiagnosticSalleConnecte {
  readonly salle: Room<unknown, EtatSalle>;
  readonly detruire: () => void;
}

function actualiserDiagnostic(
  salle: Room<unknown, EtatSalle>,
  elements: ElementsDiagnosticSalle,
): void {
  elements.identifiantSalle.textContent = 'Salle : ' + salle.roomId;
  elements.sessionId.textContent = 'Session locale : ' + salle.sessionId;
  elements.nombreJoueurs.textContent = 'Joueurs connectés : ' + salle.state.joueurs.size;
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
  actualiserDiagnostic(salleTypée, elements);
  salleTypée.onStateChange(() => actualiserDiagnostic(salleTypée, elements));

  let détruite = false;
  return {
    salle: salleTypée,
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
