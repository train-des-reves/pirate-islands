import {
  CAPACITE_SALLE,
  creerBateau,
  creerEtatSalle,
  creerJoueur,
  NOMS_MESSAGES,
  type EtatSalle,
  type MessagePing,
  type MessagePong,
  type MessageTransformationJoueur,
  type MetadonneesSalleMatchmaking,
  validerMessagePing,
  validerOptionsConnexion,
  validerMessageTransformationJoueur,
  VITESSE_MAXIMALE_JOUEUR,
} from '@pirate/protocole';
import { Room, type AuthContext, type Client } from '@colyseus/core';

interface MessagesSalle {
  [NOMS_MESSAGES.ping]: MessagePing;
  [NOMS_MESSAGES.pong]: MessagePong;
}

interface DonneesClientSalle {
  readonly indexApparition: number;
}

interface DerniereTransformation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly horodatage: number;
}

type ClientSalle = Client<{
  messages: MessagesSalle;
  userData: DonneesClientSalle;
}>;

export interface OptionsSalleJeu {
  readonly graine?: string;
}

const CODE_MESSAGE_INVALIDE = 4003;
const CODE_MESSAGE_INCONNU = 4004;

function deltaTempsHorodatages(précédent: number, actuel: number): number {
  return Math.max(0, (actuel - précédent) / 1000);
}

function vitesseManifestementImpossible(
  précédente: DerniereTransformation,
  actuelle: MessageTransformationJoueur,
): boolean {
  const deltaTemps = deltaTempsHorodatages(précédente.horodatage, actuelle.horodatage);
  if (deltaTemps <= 0) {
    return false;
  }

  const distance = Math.hypot(
    actuelle.position.x - précédente.x,
    actuelle.position.y - précédente.y,
    actuelle.position.z - précédente.z,
  );
  const vitesse = distance / deltaTemps;
  return vitesse > VITESSE_MAXIMALE_JOUEUR;
}

export class SalleJeu extends Room<{
  state: EtatSalle;
  metadata: MetadonneesSalleMatchmaking;
  client: ClientSalle;
}> {
  override maxClients = CAPACITE_SALLE;

  private prochainIndexApparition = 0;
  private readonly dernièresTransformations = new Map<string, DerniereTransformation>();

  override onCreate(options: unknown): void {
    const validation = validerOptionsConnexion(options);
    if (!validation.valide) {
      throw new Error(validation.erreurs.join(' '));
    }

    const graine = validation.valeur.graine;
    this.state = creerEtatSalle({
      identifiantSalle: this.roomId,
      ...(graine === undefined ? {} : { graine }),
    });
    this.metadata = {
      identifiantSalle: this.roomId,
      versionProtocole: this.state.metadonnees.versionProtocole,
      graine: this.state.metadonnees.graine,
      capaciteMaximale: CAPACITE_SALLE,
    };

    this.onMessage('*', (client, type, message) => {
      this.traiterMessage(client, type, message);
    });
  }

  override onAuth(client: ClientSalle, options: unknown, context: AuthContext): true {
    void client;
    void context;
    const validation = validerOptionsConnexion(options);
    if (!validation.valide) {
      throw new Error(validation.erreurs.join(' '));
    }

    return true;
  }

  override onJoin(client: ClientSalle, options?: unknown): void {
    const validation = validerOptionsConnexion(options);
    if (!validation.valide) {
      throw new Error(validation.erreurs.join(' '));
    }

    if (this.state.joueurs.size >= CAPACITE_SALLE) {
      throw new Error('La salle de jeu est complète.');
    }

    const indexApparition = this.prochainIndexApparition++;
    client.userData = { indexApparition };

    const joueur = creerJoueur(client.sessionId, indexApparition, validation.valeur.nom);
    const bateau = creerBateau(client.sessionId, indexApparition);

    this.state.joueurs.set(client.sessionId, joueur);
    this.state.bateaux.set(bateau.identifiant, bateau);
    this.state.phase = 'partie';
  }

  override onLeave(client: ClientSalle): void {
    this.state.joueurs.delete(client.sessionId);
    this.state.bateaux.delete('bateau-' + client.sessionId);
    this.dernièresTransformations.delete(client.sessionId);

    if (this.state.joueurs.size === 0) {
      this.state.phase = 'attente';
    }
  }

  private traiterMessage(client: ClientSalle, type: string | number, message: unknown): void {
    if (type === NOMS_MESSAGES.ping) {
      const validation = validerMessagePing(message);
      if (!validation.valide) {
        this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
        return;
      }

      client.send(NOMS_MESSAGES.pong, { horodatage: validation.valeur.horodatage });
      return;
    }

    if (type === NOMS_MESSAGES.transformationJoueur) {
      this.traiterTransformation(client, message);
      return;
    }

    this.rejeterMessage(client, CODE_MESSAGE_INCONNU, 'Le message demandé est inconnu.');
  }

  private traiterTransformation(client: ClientSalle, message: unknown): void {
    const validation = validerMessageTransformationJoueur(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }

    const joueur = this.state.joueurs.get(client.sessionId);
    if (!joueur) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, 'La session n’est pas dans la salle.');
      return;
    }

    const actuelle = validation.valeur;
    const précédente = this.dernièresTransformations.get(client.sessionId);
    if (précédente && vitesseManifestementImpossible(précédente, actuelle)) {
      // Valeur invalide (vitesse manifestement impossible) : ignorée sans sanction,
      // conformément au contrat autoritaire et sans déconnecter un client honnête.
      return;
    }

    joueur.transformation.x = actuelle.position.x;
    joueur.transformation.y = actuelle.position.y;
    joueur.transformation.z = actuelle.position.z;
    joueur.transformation.lacet = actuelle.lacet;
    joueur.transformation.tangage = actuelle.tangage;
    joueur.transformation.roulis = actuelle.roulis;

    this.dernièresTransformations.set(client.sessionId, {
      x: actuelle.position.x,
      y: actuelle.position.y,
      z: actuelle.position.z,
      horodatage: actuelle.horodatage,
    });
  }

  private rejeterMessage(client: ClientSalle, code: number, raison: string): void {
    client.error(code, raison);
    client.leave(code, raison);
  }
}
