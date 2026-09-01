import {
  APPARITIONS_JOUEURS,
  CAPACITE_SALLE,
  NOMS_MESSAGES,
  PHASE_SALLE_ATTENTE,
  PHASE_SALLE_PARTIE,
  creerBateau,
  creerBateauPirate,
  creerEtatSalle,
  creerJoueur,
  creerPirate,
  obtenirPointApparition,
  type EtatSalle,
  type BateauPirate,
  type Joueur,
  type MessageDegatsE2E,
  type MessageIntentionTir,
  type MessagePing,
  type MessagePong,
  type MessageResultatTir,
  type MessageTransformationJoueur,
  type MetadonneesSalleMatchmaking,
  validerMessageDegatsE2E,
  validerMessageIntentionTir,
  validerMessagePing,
  validerMessageTransformationJoueur,
  validerOptionsConnexion,
  VITESSE_MAXIMALE_JOUEUR,
} from '@pirate/protocole';
import {
  DELAI_REAPPARITION_JOUEUR_MS,
  DEGATS_PAR_TIR_PIRATE,
  appliquerDegatsJoueur,
  appliquerDegatsPirate,
  choisirReapparition,
  genererMonde,
  reinitialiserJoueurReapparu,
  reapparitionDue,
  resoudreCibleTiree,
  DEGATS_ATTAQUE_PIRATE_MARITIME,
  PAS_SIMULATION_MARITIME,
  SimulationPiratesMaritimes,
  type EtatBateauPirateMaritime,
  validerIntentionServeur,
} from '@pirate/coeur-jeu';
import { Room, type AuthContext, type Client } from '@colyseus/core';

interface MessagesSalle {
  [NOMS_MESSAGES.ping]: MessagePing;
  [NOMS_MESSAGES.pong]: MessagePong;
  [NOMS_MESSAGES.transformationJoueur]: MessageTransformationJoueur;
  [NOMS_MESSAGES.intentionTir]: MessageIntentionTir;
  [NOMS_MESSAGES.resultatTir]: MessageResultatTir;
  [NOMS_MESSAGES.degatsE2E]: MessageDegatsE2E;
}

/** Données joueur privées conservées côté serveur, jamais dévoilées au client. */
interface DonneesClientSalle {
  readonly indexApparition: number;
  readonly dernierTirMs: number;
  readonly derniereSequence: number;
  readonly prochaineReapparitionMs: number;
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
  private readonly clientsServeur = new Map<string, ClientSalle>();
  private monde: ReturnType<typeof genererMonde> = genererMonde();
  private simulationMaritime = new SimulationPiratesMaritimes({ graine: 'mvp-defaut' });
  private accumulationMaritime = 0;
  private modeE2E = false;

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
    this.simulationMaritime = new SimulationPiratesMaritimes({
      graine: this.state.metadonnees.graine,
      monde: this.monde,
    });
    this.peuplerPirates();
    this.setSimulationInterval((deltaMs) => this.actualiserSimulationMaritime(deltaMs), 50);

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
      prochaineReapparitionMs: 0,
    };

    const joueur = creerJoueur(client.sessionId, indexApparition, validation.valeur.nom);
    const bateau = creerBateau(client.sessionId, indexApparition);

    this.state.joueurs.set(client.sessionId, joueur);
    this.clientsServeur.set(client.sessionId, client);
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
    this.clientsServeur.delete(client.sessionId);
    this.state.bateaux.delete('bateau-' + client.sessionId);
    this.dernièresTransformations.delete(client.sessionId);

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

    for (const état of this.simulationMaritime.lireEtats()) {
      const bateau = creerBateauPirate(état.id);
      this.appliquerEtatBateauPirate(bateau, état);
      this.state.bateauxPirates.set(bateau.identifiant, bateau);
      this.creerEquipageMaritime(bateau);
    }
  }

  private creerEquipageMaritime(bateau: BateauPirate): void {
    for (const [index, décalage] of [
      { x: -0.65, y: 1.3, z: 0.8 },
      { x: 0.65, y: 1.28, z: 0.25 },
    ].entries()) {
      const pirate = creerPirate(bateau.identifiant + '-equipage-' + (index + 1));
      pirate.bateauId = bateau.identifiant;
      pirate.transformation.x = bateau.transformation.x + décalage.x;
      pirate.transformation.y = décalage.y;
      pirate.transformation.z = bateau.transformation.z + décalage.z;
      pirate.transformation.lacet = bateau.transformation.lacet;
      pirate.statut = bateau.statut === 'detruit' ? 'mort' : bateau.statut;
      pirate.vivant = bateau.actif;
      pirate.sante = bateau.actif ? 100 : 0;
      this.state.pirates.set(pirate.identifiant, pirate);
    }
  }

  private appliquerEtatBateauPirate(bateau: BateauPirate, état: EtatBateauPirateMaritime): void {
    bateau.transformation.x = état.position.x;
    bateau.transformation.y = 0.2;
    bateau.transformation.z = état.position.z;
    bateau.transformation.lacet = état.cap;
    bateau.sante = état.sante;
    bateau.actif = état.etat !== 'detruit';
    bateau.statut = état.etat;
    bateau.vitesse = état.vitesse;
    bateau.cibleId = état.cibleId;
    bateau.routeId = état.routeId;
  }

  private actualiserSimulationMaritime(deltaMs: number): void {
    const delta = Number.isFinite(deltaMs) ? Math.min(0.25, Math.max(0, deltaMs / 1000)) : 0;
    this.accumulationMaritime += delta;
    let étapes = 0;
    while (this.accumulationMaritime >= PAS_SIMULATION_MARITIME && étapes < 5) {
      this.accumulationMaritime -= PAS_SIMULATION_MARITIME;
      étapes += 1;
      const cibles = [...this.state.joueurs.values()].map((joueur) => ({
        id: joueur.sessionId,
        position: { x: joueur.transformation.x, z: joueur.transformation.z },
        vivant: joueur.vivant,
      }));
      const sortie = this.simulationMaritime.actualiser(PAS_SIMULATION_MARITIME, cibles);
      for (const état of sortie.bateaux) {
        const bateau = this.state.bateauxPirates.get(état.id);
        if (!bateau) {
          continue;
        }
        this.appliquerEtatBateauPirate(bateau, état);
        for (const pirate of this.state.pirates.values()) {
          if (pirate.bateauId !== bateau.identifiant) {
            continue;
          }
          pirate.transformation.x =
            bateau.transformation.x + (pirate.identifiant.endsWith('-1') ? -0.65 : 0.65);
          pirate.transformation.y = bateau.actif ? 1.3 : 0;
          pirate.transformation.z =
            bateau.transformation.z + (pirate.identifiant.endsWith('-1') ? 0.8 : 0.25);
          pirate.transformation.lacet = bateau.transformation.lacet;
          pirate.statut = bateau.actif ? bateau.statut : 'mort';
          pirate.vivant = bateau.actif;
          pirate.sante = bateau.actif ? 100 : 0;
        }
      }
      for (const attaque of sortie.attaques) {
        this.appliquerAttaqueMaritime(attaque.cibleId, attaque.degats);
      }
    }
  }

  private appliquerAttaqueMaritime(cibleId: string, degats: number): void {
    const joueur = this.state.joueurs.get(cibleId);
    const client = this.clientsServeur.get(cibleId);
    if (!joueur || !client || !joueur.vivant) {
      return;
    }
    const après = appliquerDegatsJoueur(
      { sessionId: joueur.sessionId, sante: joueur.sante, vivant: joueur.vivant },
      degats || DEGATS_ATTAQUE_PIRATE_MARITIME,
    );
    joueur.sante = après.sante;
    joueur.vivant = après.vivant;
    joueur.statut = après.vivant ? 'actif' : 'mort';
    if (!après.vivant) {
      const données: DonneesClientSalle = client.userData ?? {
        indexApparition: 0,
        dernierTirMs: 0,
        derniereSequence: 0,
        prochaineReapparitionMs: 0,
      };
      client.userData = {
        ...données,
        prochaineReapparitionMs: Date.now() + DELAI_REAPPARITION_JOUEUR_MS,
      };
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
      prochaineReapparitionMs: données.prochaineReapparitionMs,
    };

    const piratesCombat = [...this.state.bateauxPirates.values()]
      .filter((bateau) => bateau.actif)
      .map((bateau) => ({
        identifiant: bateau.identifiant,
        position: {
          x: bateau.transformation.x,
          y: bateau.transformation.y,
          z: bateau.transformation.z,
        },
        sante: bateau.sante,
        vivant: bateau.actif,
      }))
      .concat(
        [...this.state.pirates.values()].map((pirate) => ({
          identifiant: pirate.identifiant,
          position: {
            x: pirate.transformation.x,
            y: pirate.transformation.y,
            z: pirate.transformation.z,
          },
          sante: pirate.sante,
          vivant: pirate.vivant,
        })),
      );

    let cibleId = resoudreCibleTiree(
      intentionAcceptee.origine,
      intentionAcceptee.direction,
      piratesCombat,
    );

    let degats = 0;
    let pirateNeutralise = false;
    if (cibleId !== null) {
      const pirate = this.state.pirates.get(cibleId);
      const bateau = this.state.bateauxPirates.get(cibleId);
      if (bateau) {
        const applique = this.simulationMaritime.appliquerDegats(
          bateau.identifiant,
          DEGATS_PAR_TIR_PIRATE,
        );
        if (applique) {
          const état = this.simulationMaritime
            .lireEtats()
            .find((élément) => élément.id === bateau.identifiant);
          if (état) {
            this.appliquerEtatBateauPirate(bateau, état);
            for (const membre of this.state.pirates.values()) {
              if (membre.bateauId === bateau.identifiant) {
                membre.vivant = bateau.actif;
                membre.sante = bateau.actif ? 100 : 0;
                membre.statut = bateau.actif ? bateau.statut : 'mort';
              }
            }
          }
          degats = DEGATS_PAR_TIR_PIRATE;
          pirateNeutralise = !bateau.actif;
        }
      } else if (pirate) {
        if (pirate.bateauId) {
          const bateau = this.state.bateauxPirates.get(pirate.bateauId);
          const applique = bateau
            ? this.simulationMaritime.appliquerDegats(bateau.identifiant, DEGATS_PAR_TIR_PIRATE)
            : false;
          if (bateau && applique) {
            const état = this.simulationMaritime
              .lireEtats()
              .find((élément) => élément.id === bateau.identifiant);
            if (état) {
              this.appliquerEtatBateauPirate(bateau, état);
            }
            degats = DEGATS_PAR_TIR_PIRATE;
            pirateNeutralise = !bateau.actif;
          }
          if (bateau) {
            cibleId = bateau.identifiant;
          }
          const résultatBateau: MessageResultatTir = {
            sequence: intentionAcceptee.sequence,
            cibleId,
            degats,
            pirateNeutralise,
            horodatageServeur: maintenant,
          };
          client.send(NOMS_MESSAGES.resultatTir, résultatBateau);
          return;
        }
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
        prochaineReapparitionMs: 0,
      };
      client.userData = {
        indexApparition: donneesActuelles.indexApparition,
        dernierTirMs: donneesActuelles.dernierTirMs,
        derniereSequence: donneesActuelles.derniereSequence,
        prochaineReapparitionMs: maintenant + DELAI_REAPPARITION_JOUEUR_MS,
      };
    }
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

  private rejeterMessage(client: ClientSalle, code: number, raison: string): void {
    client.error(code, raison);
    client.leave(code, raison);
  }
}
