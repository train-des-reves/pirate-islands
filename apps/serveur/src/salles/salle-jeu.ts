import {
  APPARITIONS_JOUEURS,
  CAPACITE_SALLE,
  NOMS_MESSAGES,
  PHASE_SALLE_ATTENTE,
  PHASE_SALLE_PARTIE,
  creerBateau,
  creerEtatSalle,
  creerJoueur,
  creerPirate,
  LignePecheSchema,
  obtenirPointApparition,
  type MessageAnnulerPeche,
  type MessageAvancerPecheE2E,
  type EtatSalle,
  type Joueur,
  type MessageDegatsE2E,
  type MessageIntentionTir,
  type MessageLancerPeche,
  type MessagePreparerPecheE2E,
  type MessagePing,
  type MessageReleverPeche,
  type MessageResultatPeche,
  type MessagePong,
  type MessageResultatTir,
  type MessageTransformationJoueur,
  type MetadonneesSalleMatchmaking,
  validerMessageAnnulerPeche,
  validerMessageAvancerPecheE2E,
  validerMessageDegatsE2E,
  validerMessageIntentionTir,
  validerMessageLancerPeche,
  validerMessagePreparerPecheE2E,
  validerMessagePing,
  validerMessageReleverPeche,
  validerMessageTransformationJoueur,
  validerOptionsConnexion,
  VITESSE_MAXIMALE_JOUEUR,
} from '@pirate/protocole';
import {
  CADENCE_LANCER_PECHE_MS,
  DELAI_REAPPARITION_JOUEUR_MS,
  DISTANCE_ORIGINE_PECHE_ADMISE,
  DEGATS_PAR_TIR_PIRATE,
  appliquerDegatsJoueur,
  appliquerDegatsPirate,
  annulerPeche,
  avancerPeche,
  choisirReapparition,
  ETAT_PECHE_INACTIF,
  genererMonde,
  lancerPeche,
  pointDansZonePeche,
  PORTEE_PECHE,
  reinitialiserJoueurReapparu,
  reapparitionDue,
  releverPeche,
  resoudreCibleTiree,
  type EtatPeche,
  validerIntentionServeur,
} from '@pirate/coeur-jeu';
import { Room, type AuthContext, type Client } from '@colyseus/core';

interface MessagesSalle {
  [NOMS_MESSAGES.ping]: MessagePing;
  [NOMS_MESSAGES.pong]: MessagePong;
  [NOMS_MESSAGES.transformationJoueur]: MessageTransformationJoueur;
  [NOMS_MESSAGES.intentionTir]: MessageIntentionTir;
  [NOMS_MESSAGES.resultatTir]: MessageResultatTir;
  [NOMS_MESSAGES.lancerPeche]: MessageLancerPeche;
  [NOMS_MESSAGES.releverPeche]: MessageReleverPeche;
  [NOMS_MESSAGES.annulerPeche]: MessageAnnulerPeche;
  [NOMS_MESSAGES.resultatPeche]: MessageResultatPeche;
  [NOMS_MESSAGES.preparerPecheE2E]: MessagePreparerPecheE2E;
  [NOMS_MESSAGES.avancerPecheE2E]: MessageAvancerPecheE2E;
  [NOMS_MESSAGES.degatsE2E]: MessageDegatsE2E;
}

/** Données joueur privées conservées côté serveur, jamais dévoilées au client. */
interface DonneesClientSalle {
  readonly indexApparition: number;
  readonly dernierTirMs: number;
  readonly derniereSequence: number;
  readonly dernierLancerPecheMs: number;
  readonly derniereSequencePeche: number;
  readonly prochaineReapparitionMs: number;
}

export interface HorlogeSimulation {
  readonly automatique: boolean;
  lireMs(): number;
  avancerMs(deltaMs: number): void;
}

export function creerHorlogeSimulation(initialMs = 0, automatique = true): HorlogeSimulation {
  let tempsMs = Number.isFinite(initialMs) && initialMs >= 0 ? initialMs : 0;
  return {
    automatique,
    lireMs: () => tempsMs,
    avancerMs: (deltaMs) => {
      if (Number.isFinite(deltaMs) && deltaMs >= 0) {
        tempsMs += deltaMs;
      }
    },
  };
}

function distance3D(
  première: { readonly x: number; readonly y: number; readonly z: number },
  seconde: { readonly x: number; readonly y: number; readonly z: number },
): number {
  return Math.hypot(première.x - seconde.x, première.y - seconde.y, première.z - seconde.z);
}

interface DerniereTransformation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Temps serveur (Date.now()) de réception, jamais fourni par le client. */
  readonly horodatage: number;
}

type ClientSalle = Client<{
  messages: MessagesSalle;
  userData: DonneesClientSalle;
}>;

const CODE_MESSAGE_INVALIDE = 4003;
const CODE_MESSAGE_INCONNU = 4004;

function vitesseManifestementImpossible(
  précédente: DerniereTransformation,
  actuelle: MessageTransformationJoueur,
): boolean {
  const distance = Math.hypot(
    actuelle.position.x - précédente.x,
    actuelle.position.y - précédente.y,
    actuelle.position.z - précédente.z,
  );
  // Un déplacement sans temps écoulé (delta nul, ou horodatage futur) est
  // manifestement impossible dès que la position change. Sinon le client
  // pourrait téléporter son joueur en envoyant deux messages dans la même
  // milliseconde.
  const deltaTemps = (Date.now() - précédente.horodatage) / 1000;
  if (deltaTemps <= 0) {
    return distance > 0;
  }

  const vitesse = distance / deltaTemps;
  return vitesse > VITESSE_MAXIMALE_JOUEUR;
}

let modeE2EServeurActif = false;

/** Active le mannequin E2E depuis le démarrage serveur, hors de portée du client. */
export function définirModeE2EServeur(actif: boolean): void {
  modeE2EServeurActif = actif;
}

export class SalleJeu extends Room<{
  state: EtatSalle;
  metadata: MetadonneesSalleMatchmaking;
  client: ClientSalle;
}> {
  override maxClients = CAPACITE_SALLE;

  private prochainIndexApparition = 0;
  private readonly dernièresTransformations = new Map<string, DerniereTransformation>();
  private readonly etatsPeche = new Map<string, EtatPeche>();
  private monde: ReturnType<typeof genererMonde> = genererMonde();
  private modeE2E = false;
  private horloge: HorlogeSimulation = creerHorlogeSimulation();

  /** Injecte une horloge contrôlée avant l'initialisation de la salle. */
  configurerHorloge(horloge: HorlogeSimulation): void {
    this.horloge = horloge;
  }

  override onCreate(options: unknown): void {
    const validation = validerOptionsConnexion(options);
    if (!validation.valide) {
      throw new Error(validation.erreurs.join(' '));
    }

    this.modeE2E = modeE2EServeurActif;

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

    this.monde = genererMonde(this.state.metadonnees.graine);
    this.peuplerPirates();
    this.setSimulationInterval((deltaMs) => {
      if (this.horloge.automatique && !this.modeE2E) {
        this.horloge.avancerMs(deltaMs);
      }
      this.actualiserPeches();
    });

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
    client.userData = {
      indexApparition,
      dernierTirMs: 0,
      derniereSequence: 0,
      dernierLancerPecheMs: -Infinity,
      derniereSequencePeche: 0,
      prochaineReapparitionMs: 0,
    };

    const joueur = creerJoueur(client.sessionId, indexApparition, validation.valeur.nom);
    const bateau = creerBateau(client.sessionId, indexApparition);

    this.state.joueurs.set(client.sessionId, joueur);
    this.state.bateaux.set(bateau.identifiant, bateau);
    this.state.phase = PHASE_SALLE_PARTIE;

    // La référence de vitesse est initialisée sur la transformation d'apparition
    // serveur avec l'horodatage serveur : le premier paquet client ne peut pas
    // téléporter le joueur vers une position arbitraire.
    this.dernièresTransformations.set(client.sessionId, {
      x: joueur.transformation.x,
      y: joueur.transformation.y,
      z: joueur.transformation.z,
      horodatage: Date.now(),
    });
  }

  override onLeave(client: ClientSalle): void {
    this.state.joueurs.delete(client.sessionId);
    this.state.bateaux.delete('bateau-' + client.sessionId);
    this.dernièresTransformations.delete(client.sessionId);
    this.nettoyerLignePeche(client.sessionId);

    if (this.state.joueurs.size === 0) {
      this.state.phase = PHASE_SALLE_ATTENTE;
    }
  }

  /** Peuple les pirates du monde dans l'état de salle, un par apparition. */
  private peuplerPirates(): void {
    for (const ile of this.monde.iles) {
      for (const apparition of ile.apparitionsPirates) {
        const pirate = creerPirate(apparition.id);
        pirate.transformation.x = apparition.position.x;
        pirate.transformation.y = apparition.position.y;
        pirate.transformation.z = apparition.position.z;
        pirate.transformation.lacet = 0;
        pirate.statut = 'patrouille';
        this.state.pirates.set(pirate.identifiant, pirate);
      }
    }
  }

  private traiterMessage(client: ClientSalle, type: string | number, message: unknown): void {
    if (type === NOMS_MESSAGES.ping) {
      this.traiterPing(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.transformationJoueur) {
      this.traiterTransformation(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.intentionTir) {
      this.traiterIntentionTir(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.lancerPeche) {
      this.traiterLancerPeche(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.releverPeche) {
      this.traiterReleverPeche(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.annulerPeche) {
      this.traiterAnnulerPeche(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.preparerPecheE2E) {
      this.traiterPreparerPecheE2E(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.avancerPecheE2E) {
      this.traiterAvancerPecheE2E(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.degatsE2E) {
      this.traiterDegatsE2E(client, message);
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

    // Un joueur mort ne peut pas modifier la transformation autoritaire : la
    // référence est conservée telle quelle jusqu'à la réapparition. On ignore
    // silencieusement sans déconnecter, comme pour une vitesse impossible.
    if (!joueur.vivant) {
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
      horodatage: Date.now(),
    });
  }

  private traiterPing(client: ClientSalle, message: unknown): void {
    const validation = validerMessagePing(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }

    client.send(NOMS_MESSAGES.pong, { horodatage: validation.valeur.horodatage });
  }

  private traiterIntentionTir(client: ClientSalle, message: unknown): void {
    const validationMessage = validerMessageIntentionTir(message);
    if (!validationMessage.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validationMessage.erreurs.join(' '));
      return;
    }

    const joueur = this.state.joueurs.get(client.sessionId);
    if (!joueur) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, 'Le joueur est inconnu.');
      return;
    }

    const maintenant = Date.now();
    let données: DonneesClientSalle = client.userData ?? {
      indexApparition: 0,
      dernierTirMs: 0,
      derniereSequence: 0,
      dernierLancerPecheMs: -Infinity,
      derniereSequencePeche: 0,
      prochaineReapparitionMs: 0,
    };

    // Un joueur qui vient d'atteindre son échéance de réapparition peut tirer
    // depuis la dernière position qu'il a synchronisée avant d'être réapparu.
    // Le serveur réapparaît d'abord le joueur, puis admet l'origine de ce tir
    // par rapport à la position antérieure comme référence secondaire. Sans
    // quoi un tir simultané à l'échéance serait rejeté et déconnecterait le
    // joueur.
    const positionAvantReapparition = {
      x: joueur.transformation.x,
      y: joueur.transformation.y,
      z: joueur.transformation.z,
    };
    const reapparitionImminente = reapparitionDue(maintenant, données.prochaineReapparitionMs);

    this.appliquerReapparitionSiDue(client, joueur, maintenant, données);
    données = client.userData ?? données;

    if (!joueur.vivant) {
      this.rejeterMessage(
        client,
        CODE_MESSAGE_INVALIDE,
        'Le joueur est en attente de réapparition.',
      );
      return;
    }

    const intention = {
      sequence: validationMessage.valeur.sequence,
      origine: {
        x: validationMessage.valeur.origineX,
        y: validationMessage.valeur.origineY,
        z: validationMessage.valeur.origineZ,
      },
      direction: {
        x: validationMessage.valeur.directionX,
        y: validationMessage.valeur.directionY,
        z: validationMessage.valeur.directionZ,
      },
      horodatageClient: validationMessage.valeur.horodatageClient,
    };

    const etatTireur = {
      sessionId: client.sessionId,
      vivant: joueur.vivant,
      position: {
        x: joueur.transformation.x,
        y: joueur.transformation.y,
        z: joueur.transformation.z,
      },
      dernierTirMs: données.dernierTirMs,
      derniereSequence: données.derniereSequence,
      ...(reapparitionImminente ? { positionAdmise: positionAvantReapparition } : {}),
    };
    const validationTir = validerIntentionServeur(etatTireur, intention, maintenant);

    if (!validationTir.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validationTir.raison);
      return;
    }

    const intentionAcceptee = validationTir.intention;

    // Mise à jour de l'état de tir du joueur sans révéler de résultat client.
    client.userData = {
      indexApparition: données.indexApparition,
      dernierTirMs: maintenant,
      derniereSequence: intentionAcceptee.sequence,
      dernierLancerPecheMs: données.dernierLancerPecheMs,
      derniereSequencePeche: données.derniereSequencePeche,
      prochaineReapparitionMs: données.prochaineReapparitionMs,
    };

    const piratesCombat = [...this.state.pirates.values()].map((pirate) => ({
      identifiant: pirate.identifiant,
      position: {
        x: pirate.transformation.x,
        y: pirate.transformation.y,
        z: pirate.transformation.z,
      },
      sante: pirate.sante,
      vivant: pirate.vivant,
    }));

    const cibleId = resoudreCibleTiree(
      intentionAcceptee.origine,
      intentionAcceptee.direction,
      piratesCombat,
    );

    let degats = 0;
    let pirateNeutralise = false;
    if (cibleId !== null) {
      const pirate = this.state.pirates.get(cibleId);
      if (pirate) {
        const pirateApresDegats = appliquerDegatsPirate(
          {
            identifiant: pirate.identifiant,
            position: {
              x: pirate.transformation.x,
              y: pirate.transformation.y,
              z: pirate.transformation.z,
            },
            sante: pirate.sante,
            vivant: pirate.vivant,
          },
          DEGATS_PAR_TIR_PIRATE,
        );
        degats = DEGATS_PAR_TIR_PIRATE;
        pirate.sante = pirateApresDegats.sante;
        pirate.vivant = pirateApresDegats.vivant;
        pirate.statut = pirateApresDegats.vivant ? 'attaque' : 'mort';
        pirateNeutralise = !pirateApresDegats.vivant;
      }
    }

    const resultat: MessageResultatTir = {
      sequence: intentionAcceptee.sequence,
      cibleId,
      degats,
      pirateNeutralise,
      horodatageServeur: maintenant,
    };
    client.send(NOMS_MESSAGES.resultatTir, resultat);
  }

  /**
   * Mannequin réservé au mode E2E serveur : inflige des dégâts à un joueur
   * sans qu'il ait fourni de santé ou de résultat. Désactivé en production.
   */
  private traiterDegatsE2E(client: ClientSalle, message: unknown): void {
    if (!this.modeE2E) {
      this.rejeterMessage(
        client,
        CODE_MESSAGE_INVALIDE,
        'Le message E2E de dégâts n’est pas autorisé.',
      );
      return;
    }

    const validation = validerMessageDegatsE2E(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }

    const joueur = this.state.joueurs.get(client.sessionId);
    if (!joueur) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, 'Le joueur est inconnu.');
      return;
    }

    const maintenant = Date.now();
    const joueurApresDegats = appliquerDegatsJoueur(
      {
        sessionId: client.sessionId,
        sante: joueur.sante,
        vivant: joueur.vivant,
      },
      validation.valeur.degats,
    );
    joueur.sante = joueurApresDegats.sante;
    joueur.vivant = joueurApresDegats.vivant;
    joueur.statut = joueurApresDegats.vivant ? 'actif' : 'mort';

    if (!joueurApresDegats.vivant) {
      const donneesActuelles: DonneesClientSalle = client.userData ?? {
        indexApparition: 0,
        dernierTirMs: 0,
        derniereSequence: 0,
        dernierLancerPecheMs: -Infinity,
        derniereSequencePeche: 0,
        prochaineReapparitionMs: 0,
      };
      client.userData = {
        indexApparition: donneesActuelles.indexApparition,
        dernierTirMs: donneesActuelles.dernierTirMs,
        derniereSequence: donneesActuelles.derniereSequence,
        dernierLancerPecheMs: donneesActuelles.dernierLancerPecheMs,
        derniereSequencePeche: donneesActuelles.derniereSequencePeche,
        prochaineReapparitionMs: maintenant + DELAI_REAPPARITION_JOUEUR_MS,
      };
      this.annulerLignePeche(client.sessionId);
    }
  }

  private traiterLancerPeche(client: ClientSalle, message: unknown): void {
    const validation = validerMessageLancerPeche(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }

    const joueur = this.state.joueurs.get(client.sessionId);
    if (!joueur) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, 'Le joueur est inconnu.');
      return;
    }
    if (!joueur.vivant) {
      this.refuserActionPeche(client, CODE_MESSAGE_INVALIDE, 'Un joueur mort ne peut pas pêcher.');
      return;
    }

    const données = client.userData ?? {
      indexApparition: 0,
      dernierTirMs: 0,
      derniereSequence: 0,
      dernierLancerPecheMs: -Infinity,
      derniereSequencePeche: 0,
      prochaineReapparitionMs: 0,
    };
    const commande = validation.valeur;
    const maintenant = this.horloge.lireMs();
    if (this.etatsPeche.has(client.sessionId)) {
      this.refuserActionPeche(client, CODE_MESSAGE_INVALIDE, 'Une ligne de pêche est déjà active.');
      return;
    }
    if (commande.sequence <= données.derniereSequencePeche) {
      this.refuserActionPeche(
        client,
        CODE_MESSAGE_INVALIDE,
        'La séquence de pêche a déjà été consommée.',
      );
      return;
    }
    if (maintenant - données.dernierLancerPecheMs < CADENCE_LANCER_PECHE_MS) {
      this.refuserActionPeche(
        client,
        CODE_MESSAGE_INVALIDE,
        'La cadence de pêche n’est pas respectée.',
      );
      return;
    }

    const zone = this.monde.zonesPeche.find((candidate) => candidate.id === commande.zoneId);
    if (!zone) {
      this.refuserActionPeche(client, CODE_MESSAGE_INVALIDE, 'La zone de pêche est inconnue.');
      return;
    }
    const positionJoueur = {
      x: joueur.transformation.x,
      y: joueur.transformation.y,
      z: joueur.transformation.z,
    };
    const origine = { x: commande.origineX, y: commande.origineY, z: commande.origineZ };
    const flotteur = { x: commande.flotteurX, y: commande.flotteurY, z: commande.flotteurZ };
    if (!pointDansZonePeche(zone, positionJoueur)) {
      this.refuserActionPeche(client, CODE_MESSAGE_INVALIDE, 'Le joueur est hors de la zone de pêche.');
      return;
    }
    if (
      distance3D(origine, {
        x: joueur.transformation.x,
        y: joueur.transformation.y + 1.62,
        z: joueur.transformation.z,
      }) > DISTANCE_ORIGINE_PECHE_ADMISE
    ) {
      this.refuserActionPeche(
        client,
        CODE_MESSAGE_INVALIDE,
        'L’origine de pêche est trop éloignée du joueur.',
      );
      return;
    }
    if (distance3D(origine, flotteur) > PORTEE_PECHE) {
      this.refuserActionPeche(client, CODE_MESSAGE_INVALIDE, 'Le flotteur est hors de portée.');
      return;
    }
    if (!pointDansZonePeche(zone, flotteur)) {
      this.refuserActionPeche(
        client,
        CODE_MESSAGE_INVALIDE,
        'Le flotteur est hors de la zone de pêche.',
      );
      return;
    }

    const état = lancerPeche(
      ETAT_PECHE_INACTIF,
      this.monde,
      zone.id,
      this.state.metadonnees.graine,
      commande.sequence,
      maintenant,
    );
    this.etatsPeche.set(client.sessionId, état);
    this.synchroniserLignePeche(client.sessionId, état, flotteur);
    client.userData = {
      indexApparition: données.indexApparition,
      dernierTirMs: données.dernierTirMs,
      derniereSequence: données.derniereSequence,
      dernierLancerPecheMs: maintenant,
      derniereSequencePeche: commande.sequence,
      prochaineReapparitionMs: données.prochaineReapparitionMs,
    };
  }

  private traiterReleverPeche(client: ClientSalle, message: unknown): void {
    const validation = validerMessageReleverPeche(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }
    const état = this.etatsPeche.get(client.sessionId);
    if (!état || état.sequence !== validation.valeur.sequence) {
      this.refuserActionPeche(
        client,
        CODE_MESSAGE_INVALIDE,
        'Aucune ligne active ne correspond à cette séquence.',
      );
      return;
    }
    const résultat = releverPeche(état, this.horloge.lireMs());
    this.etatsPeche.set(client.sessionId, résultat);
    if (résultat.resultat) {
      this.publierResultatPeche(client.sessionId, résultat);
    } else {
      this.synchroniserLignePeche(client.sessionId, résultat);
    }
  }

  private traiterAnnulerPeche(client: ClientSalle, message: unknown): void {
    const validation = validerMessageAnnulerPeche(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }
    const état = this.etatsPeche.get(client.sessionId);
    if (!état || état.sequence !== validation.valeur.sequence) {
      this.refuserActionPeche(
        client,
        CODE_MESSAGE_INVALIDE,
        'Aucune ligne active ne correspond à cette séquence.',
      );
      return;
    }
    const résultat = annulerPeche(état, this.horloge.lireMs());
    this.etatsPeche.set(client.sessionId, résultat);
    this.publierResultatPeche(client.sessionId, résultat);
  }

  private traiterPreparerPecheE2E(client: ClientSalle, message: unknown): void {
    if (!this.modeE2E) {
      this.rejeterMessage(
        client,
        CODE_MESSAGE_INVALIDE,
        'La préparation E2E de pêche n’est pas autorisée.',
      );
      return;
    }
    const validation = validerMessagePreparerPecheE2E(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }
    const joueur = this.state.joueurs.get(client.sessionId);
    const zone = this.monde.zonesPeche[0];
    if (!joueur || !zone) {
      this.rejeterMessage(
        client,
        CODE_MESSAGE_INVALIDE,
        'La préparation E2E de pêche est impossible.',
      );
      return;
    }
    this.annulerLignePeche(client.sessionId);
    joueur.transformation.x = zone.centre.x;
    joueur.transformation.y = zone.centre.y;
    joueur.transformation.z = zone.centre.z;
    this.state.joueurs.set(client.sessionId, joueur);
    this.dernièresTransformations.set(client.sessionId, {
      x: zone.centre.x,
      y: zone.centre.y,
      z: zone.centre.z,
      horodatage: Date.now(),
    });
  }

  private traiterAvancerPecheE2E(client: ClientSalle, message: unknown): void {
    if (!this.modeE2E) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, 'Le message est réservé au mode E2E.');
      return;
    }
    const validation = validerMessageAvancerPecheE2E(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }
    this.horloge.avancerMs(validation.valeur.deltaMs);
    this.actualiserPeches();
  }

  private actualiserPeches(): void {
    const maintenant = this.horloge.lireMs();
    for (const [sessionId, état] of this.etatsPeche) {
      const joueur = this.state.joueurs.get(sessionId);
      const zone = état.zoneId
        ? this.monde.zonesPeche.find((candidate) => candidate.id === état.zoneId)
        : undefined;
      if (
        !joueur ||
        !joueur.vivant ||
        !zone ||
        !pointDansZonePeche(zone, {
          x: joueur.transformation.x,
          y: joueur.transformation.y,
          z: joueur.transformation.z,
        })
      ) {
        const annulé = annulerPeche(état, maintenant);
        this.etatsPeche.set(sessionId, annulé);
        this.publierResultatPeche(sessionId, annulé);
        continue;
      }
      const avancé = avancerPeche(état, maintenant);
      this.etatsPeche.set(sessionId, avancé);
      if (avancé.resultat) {
        this.publierResultatPeche(sessionId, avancé);
      } else if (avancé.phase !== état.phase || avancé.tempsCourantMs !== état.tempsCourantMs) {
        this.synchroniserLignePeche(sessionId, avancé);
      }
    }
  }

  private synchroniserLignePeche(
    sessionId: string,
    état: EtatPeche,
    flotteur?: { readonly x: number; readonly y: number; readonly z: number },
  ): void {
    const ligne = this.state.lignesPeche.get(sessionId) ?? new LignePecheSchema();
    ligne.joueurId = sessionId;
    ligne.sequence = état.sequence;
    ligne.phase = état.phase;
    ligne.zoneId = état.zoneId ?? '';
    ligne.flotteurX = flotteur?.x ?? ligne.flotteurX;
    ligne.flotteurY = flotteur?.y ?? ligne.flotteurY;
    ligne.flotteurZ = flotteur?.z ?? ligne.flotteurZ;
    ligne.lanceAuMs = état.lanceAuMs;
    ligne.morsureAuMs = état.lanceAuMs + (état.delaiMorsureMs ?? 0);
    ligne.finMorsureMs = ligne.morsureAuMs + (état.fenetreMorsureMs ?? 0);
    this.state.lignesPeche.set(sessionId, ligne);
  }

  private publierResultatPeche(sessionId: string, état: EtatPeche): void {
    const resultat = état.resultat;
    const zoneId = état.zoneId;
    if (!resultat || !zoneId) {
      this.nettoyerLignePeche(sessionId);
      return;
    }
    const message: MessageResultatPeche = {
      joueurId: sessionId,
      sequence: état.sequence,
      zoneId,
      resultat,
      horodatageServeur: this.horloge.lireMs(),
      ...(resultat === 'prise' && état.espece !== undefined ? { espece: état.espece } : {}),
      ...(resultat === 'prise' && état.taille !== undefined ? { taille: état.taille } : {}),
    };
    this.broadcast(NOMS_MESSAGES.resultatPeche, message);
    this.nettoyerLignePeche(sessionId);
  }

  private annulerLignePeche(sessionId: string): void {
    const état = this.etatsPeche.get(sessionId);
    if (!état) {
      return;
    }
    const annulé = annulerPeche(état, this.horloge.lireMs());
    this.publierResultatPeche(sessionId, annulé);
  }

  private nettoyerLignePeche(sessionId: string): void {
    this.etatsPeche.delete(sessionId);
    this.state.lignesPeche.delete(sessionId);
  }

  override onDispose(): void {
    this.etatsPeche.clear();
    this.state.lignesPeche.clear();
  }

  /**
   * Réapparaît un joueur mort dès que son délai est écoulé, puis le replace
   * sur le prochain point d'apparition cyclique. Une seule fois par échéance.
   */
  private appliquerReapparitionSiDue(
    client: ClientSalle,
    joueur: Joueur,
    maintenant: number,
    données: DonneesClientSalle,
  ): void {
    if (!reapparitionDue(maintenant, données.prochaineReapparitionMs)) {
      return;
    }

    const indexReapparition = choisirReapparition(
      données.indexApparition,
      APPARITIONS_JOUEURS.length,
    );
    const reapparu = reinitialiserJoueurReapparu({
      sessionId: client.sessionId,
      sante: joueur.sante,
      vivant: joueur.vivant,
    });
    const pointApparition = obtenirPointApparition(indexReapparition);
    joueur.sante = reapparu.sante;
    joueur.vivant = reapparu.vivant;
    joueur.statut = 'actif';
    joueur.transformation.x = pointApparition.x;
    joueur.transformation.y = pointApparition.y;
    joueur.transformation.z = pointApparition.z;
    joueur.transformation.lacet = pointApparition.lacet;
    client.userData = {
      ...données,
      indexApparition: indexReapparition,
      dernierTirMs: 0,
      prochaineReapparitionMs: 0,
    };
    // La référence de vitesse est réinitialisée sur la nouvelle apparition : le
    // joueur réapparu ne peut pas exploiter sa position antérieure.
    this.dernièresTransformations.set(client.sessionId, {
      x: pointApparition.x,
      y: pointApparition.y,
      z: pointApparition.z,
      horodatage: Date.now(),
    });
  }

  private refuserActionPeche(client: ClientSalle, code: number, raison: string): void {
    client.error(code, raison);
  }

  private rejeterMessage(client: ClientSalle, code: number, raison: string): void {
    client.error(code, raison);
    client.leave(code, raison);
  }
}
