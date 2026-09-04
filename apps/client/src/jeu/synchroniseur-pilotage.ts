import {
  NOMS_MESSAGES,
  type EtatSalle,
  type MessageEtatBarre,
  type MessageRefusBarre,
} from '@pirate/protocole';
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

export interface RefusBarreReseau {
  readonly bateauId: string;
  readonly motif: MessageRefusBarre['motif'];
  readonly message: string;
}

export interface PoseBateauReseau {
  readonly bateauId: string;
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly rotationY: number;
  readonly vitesse: number;
  readonly vitesseAngulaire: number;
  readonly piloteSessionId: string;
  readonly piloteNom: string;
  readonly statut: 'libre' | 'occupee';
  readonly sequence: number;
}

export interface SynchroniseurPilotageOptions {
  readonly obtenirSalle: () => Room<unknown, EtatSalle> | undefined;
  readonly sessionIdLocale: () => string;
  readonly surEtatBarre: (etat: EtatBarreReseau) => void;
  readonly surRefusBarre?: (refus: RefusBarreReseau) => void;
}

/**
 * Reçoit l'état autoritaire du bateau, interpole uniquement sa présentation et
 * envoie des intentions sémantiques au serveur.
 */
export class SynchroniseurPilotage {
  private readonly obtenirSalle: () => Room<unknown, EtatSalle> | undefined;
  private readonly sessionIdLocale: () => string;
  private readonly surEtatBarre: (etat: EtatBarreReseau) => void;
  private readonly surRefusBarre: (refus: RefusBarreReseau) => void;
  private sequence = 1;
  private etatBarre: EtatBarreReseau | undefined;
  private refusBarre: RefusBarreReseau | undefined;
  private cible: PoseBateauReseau | undefined;
  private pose: PoseBateauReseau | undefined;
  private salleAbonnee: Room<unknown, EtatSalle> | undefined;
  private poseRecueParMessage = false;

  public constructor(options: SynchroniseurPilotageOptions) {
    this.obtenirSalle = options.obtenirSalle;
    this.sessionIdLocale = options.sessionIdLocale;
    this.surEtatBarre = options.surEtatBarre;
    this.surRefusBarre = options.surRefusBarre ?? (() => undefined);
  }

  public demarrer(): void {
    this.attacherSalle(this.obtenirSalle());
  }

  /** Lit le schéma courant et prépare la cible d'interpolation. */
  public mettreAJour(): void {
    const salle = this.obtenirSalle();
    if (!salle) {
      this.salleAbonnee = undefined;
      this.cible = undefined;
      this.pose = undefined;
      this.poseRecueParMessage = false;
      return;
    }

    this.attacherSalle(salle);
    const bateauId = this.trouverBateauPartage(salle);
    if (!bateauId) {
      return;
    }
    const bateau = salle.state.bateaux.get(bateauId);
    if (!bateau) {
      return;
    }

    if (this.poseRecueParMessage && this.etatBarre?.bateauId === bateauId) {
      return;
    }
    this.poseRecueParMessage = false;

    const piloteSessionId = bateau.piloteSessionId;
    const pilote = piloteSessionId ? salle.state.joueurs.get(piloteSessionId) : undefined;
    const prochain: PoseBateauReseau = {
      bateauId,
      positionX: bateau.transformation.x,
      positionY: bateau.transformation.y,
      positionZ: bateau.transformation.z,
      rotationY: bateau.transformation.lacet,
      vitesse: bateau.vitesse,
      vitesseAngulaire: bateau.vitesseAngulaire,
      piloteSessionId,
      piloteNom: pilote?.nom ?? '',
      statut: piloteSessionId ? 'occupee' : 'libre',
      sequence: this.etatBarre?.sequence ?? 0,
    };
    this.cible = prochain;
    this.etatBarre = this.etatDepuisPose(prochain);
    if (!this.pose) {
      this.pose = { ...prochain };
    }
  }

  /** Rapproche progressivement la présentation de la cible serveur. */
  public mettreAJourInterpolation(deltaSecondes: number): void {
    if (!this.cible) {
      return;
    }
    if (!this.pose) {
      this.pose = { ...this.cible };
      return;
    }

    const delta = Number.isFinite(deltaSecondes) ? Math.max(0, Math.min(0.25, deltaSecondes)) : 0;
    const facteur = delta === 0 ? 0 : 1 - Math.exp(-12 * delta);
    this.pose = {
      ...this.pose,
      bateauId: this.cible.bateauId,
      positionX: interpoler(this.pose.positionX, this.cible.positionX, facteur),
      positionY: interpoler(this.pose.positionY, this.cible.positionY, facteur),
      positionZ: interpoler(this.pose.positionZ, this.cible.positionZ, facteur),
      rotationY: interpolerAngle(this.pose.rotationY, this.cible.rotationY, facteur),
      vitesse: interpoler(this.pose.vitesse, this.cible.vitesse, facteur),
      vitesseAngulaire: interpoler(
        this.pose.vitesseAngulaire,
        this.cible.vitesseAngulaire,
        facteur,
      ),
      piloteSessionId: this.cible.piloteSessionId,
      piloteNom: this.cible.piloteNom,
      statut: this.cible.statut,
      sequence: this.cible.sequence,
    };
    this.etatBarre = this.etatDepuisPose(this.pose);
    this.surEtatBarre(this.etatBarre);
  }

  public demanderBarre(bateauId = this.bateauIdCourant()): void {
    if (!bateauId) {
      return;
    }
    this.obtenirSalle()?.send(NOMS_MESSAGES.demandeBarre, { bateauId });
  }

  public libererBarre(bateauId = this.bateauIdCourant()): void {
    if (!bateauId) {
      return;
    }
    this.obtenirSalle()?.send(NOMS_MESSAGES.liberationBarre, { bateauId });
  }

  public envoyerIntention(
    bateauId = this.bateauIdCourant(),
    poussee: number,
    gouvernail: number,
  ): void {
    const salle = this.obtenirSalle();
    if (!salle || !bateauId || !this.estPilote()) {
      return;
    }

    salle.send(NOMS_MESSAGES.intentionPilotage, {
      bateauId,
      sequence: this.sequence,
      poussee: bornerCommande(poussee),
      gouvernail: bornerCommande(gouvernail),
      horodatageClient: Date.now(),
    });
    this.sequence += 1;
  }

  public lireEtatBarre(): EtatBarreReseau | undefined {
    return this.etatBarre;
  }

  public lireRefusBarre(): RefusBarreReseau | undefined {
    return this.refusBarre;
  }

  public lirePose(): PoseBateauReseau | undefined {
    return this.pose;
  }

  public bateauIdCourant(): string | undefined {
    return this.pose?.bateauId ?? this.cible?.bateauId ?? this.bateauIdDepuisSalle();
  }

  public estPilote(): boolean {
    return this.etatBarre?.piloteSessionId === this.sessionIdLocale();
  }

  public detruire(): void {
    this.salleAbonnee = undefined;
    this.cible = undefined;
    this.pose = undefined;
    this.etatBarre = undefined;
    this.refusBarre = undefined;
    this.poseRecueParMessage = false;
  }

  private attacherSalle(salle: Room<unknown, EtatSalle> | undefined): void {
    if (!salle || salle === this.salleAbonnee) {
      return;
    }
    this.salleAbonnee = salle;
    this.poseRecueParMessage = false;
    salle.onStateChange(() => {
      this.mettreAJour();
    });
    salle.onMessage(NOMS_MESSAGES.etatBarre, (message: MessageEtatBarre) => {
      this.etatBarre = { ...message };
      this.poseRecueParMessage = true;
      this.refusBarre = undefined;
      this.cible = this.poseDepuisMessage(message);
      if (!this.pose) {
        this.pose = { ...this.cible };
      }
      this.surEtatBarre(this.etatBarre);
    });
    salle.onMessage(NOMS_MESSAGES.refusBarre, (message: MessageRefusBarre) => {
      this.refusBarre = { ...message };
      this.surRefusBarre(this.refusBarre);
    });
  }

  private bateauIdDepuisSalle(): string | undefined {
    const salle = this.obtenirSalle();
    return salle ? this.trouverBateauPartage(salle) : undefined;
  }

  private trouverBateauPartage(salle: Room<unknown, EtatSalle>): string | undefined {
    return salle.state.bateaux.keys().next().value as string | undefined;
  }

  private etatDepuisPose(pose: PoseBateauReseau): EtatBarreReseau {
    return {
      bateauId: pose.bateauId,
      piloteSessionId: pose.piloteSessionId,
      piloteNom: pose.piloteNom,
      statut: pose.statut,
      positionX: pose.positionX,
      positionY: pose.positionY,
      positionZ: pose.positionZ,
      rotationY: pose.rotationY,
      vitesse: pose.vitesse,
      vitesseAngulaire: pose.vitesseAngulaire,
      sequence: pose.sequence,
    };
  }

  private poseDepuisMessage(message: MessageEtatBarre): PoseBateauReseau {
    return {
      bateauId: message.bateauId,
      positionX: message.positionX,
      positionY: message.positionY,
      positionZ: message.positionZ,
      rotationY: message.rotationY,
      vitesse: message.vitesse,
      vitesseAngulaire: message.vitesseAngulaire,
      piloteSessionId: message.piloteSessionId,
      piloteNom: message.piloteNom,
      statut: message.statut,
      sequence: message.sequence,
    };
  }
}

export function creerSynchroniseurPilotage(
  options: SynchroniseurPilotageOptions,
): SynchroniseurPilotage {
  const synchroniseur = new SynchroniseurPilotage(options);
  synchroniseur.demarrer();
  return synchroniseur;
}

function bornerCommande(valeur: number): number {
  if (!Number.isFinite(valeur)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, valeur));
}

function interpoler(depart: number, cible: number, facteur: number): number {
  return depart + (cible - depart) * facteur;
}

function interpolerAngle(depart: number, cible: number, facteur: number): number {
  const différence = Math.atan2(Math.sin(cible - depart), Math.cos(cible - depart));
  return Math.atan2(
    Math.sin(depart + différence * facteur),
    Math.cos(depart + différence * facteur),
  );
}
