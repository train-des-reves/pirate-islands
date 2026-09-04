import { NOMS_MESSAGES, type EtatSalle, type MessageEtatBarre } from '@pirate/protocole';
import type { Room } from '@colyseus/sdk';

export interface EtatBarreReseau {
  readonly bateauId: string;
  readonly piloteSessionId: string;
  readonly piloteNom: string;
  readonly statut: 'libre' | 'occupee';
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly rotationY: number;
  readonly vitesse: number;
  readonly vitesseAngulaire: number;
  readonly sequence: number;
}

export interface SynchroniseurPilotageOptions {
  readonly obtenirSalle: () => Room<unknown, EtatSalle> | undefined;
  readonly sessionIdLocale: () => string;
  readonly surEtatBarre: (etat: EtatBarreReseau) => void;
}

export class SynchroniseurPilotage {
  private readonly obtenirSalle: () => Room<unknown, EtatSalle> | undefined;
  private readonly sessionIdLocale: () => string;
  private readonly surEtatBarre: (etat: EtatBarreReseau) => void;
  private sequence = 1;
  private etatBarre: EtatBarreReseau | undefined;

  public constructor(options: SynchroniseurPilotageOptions) {
    this.obtenirSalle = options.obtenirSalle;
    this.sessionIdLocale = options.sessionIdLocale;
    this.surEtatBarre = options.surEtatBarre;
  }

  public demarrer(): void {
    const salle = this.obtenirSalle();
    if (!salle) {
      return;
    }

    salle.onMessage(NOMS_MESSAGES.etatBarre, (message: MessageEtatBarre) => {
      this.etatBarre = {
        bateauId: message.bateauId,
        piloteSessionId: message.piloteSessionId,
        piloteNom: message.piloteNom,
        statut: message.statut,
        positionX: message.positionX,
        positionY: message.positionY,
        positionZ: message.positionZ,
        rotationY: message.rotationY,
        vitesse: message.vitesse,
        vitesseAngulaire: message.vitesseAngulaire,
        sequence: message.sequence,
      };
      this.surEtatBarre(this.etatBarre);
    });
  }

  public demanderBarre(bateauId: string): void {
    const salle = this.obtenirSalle();
    if (!salle) {
      return;
    }

    salle.send(NOMS_MESSAGES.demandeBarre, { bateauId });
  }

  public libererBarre(bateauId: string): void {
    const salle = this.obtenirSalle();
    if (!salle) {
      return;
    }

    salle.send(NOMS_MESSAGES.liberationBarre, { bateauId });
  }

  public envoyerIntention(bateauId: string, poussee: number, gouvernail: number): void {
    const salle = this.obtenirSalle();
    if (!salle) {
      return;
    }

    const intention = {
      bateauId,
      sequence: this.sequence,
      poussee: Math.max(-1, Math.min(1, poussee)),
      gouvernail: Math.max(-1, Math.min(1, gouvernail)),
      horodatageClient: Date.now(),
    };

    this.sequence += 1;
    salle.send(NOMS_MESSAGES.intentionPilotage, intention);
  }

  public lireEtatBarre(): EtatBarreReseau | undefined {
    return this.etatBarre;
  }

  public estPilote(): boolean {
    return this.etatBarre?.piloteSessionId === this.sessionIdLocale();
  }

  public detruire(): void {
    // Nettoyage si nécessaire
  }
}

export function creerSynchroniseurPilotage(
  options: SynchroniseurPilotageOptions,
): SynchroniseurPilotage {
  const synchroniseur = new SynchroniseurPilotage(options);
  synchroniseur.demarrer();
  return synchroniseur;
}
