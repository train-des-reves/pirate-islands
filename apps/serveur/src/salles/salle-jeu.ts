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
  PAS_SIMULATION_MARITIME_SEC,
  SimulationPiratesMaritimes,
  type CiblePerçue,
  type EtatBateauMaritimeSimulation,
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
  private monde: ReturnType<typeof genererMonde> = genererMonde();
  private modeE2E = false;
  private simulationMaritime: SimulationPiratesMaritimes | undefined;
  private accumulationMaritimeMs = 0;
  private readonly echeancesSuppressionBateaux = new Map<string, number>();

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
    this.simulationMaritime = new SimulationPiratesMaritimes({
      monde: this.monde,
      graine: this.state.metadonnees.graine,
      nombreBateaux: 1,
    });
    this.initialiserBateauxPirates();
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

  /** Crée un équipage visible par bateau à partir des routes déterministes. */
  private initialiserBateauxPirates(): void {
    const simulation = this.simulationMaritime;
    if (!simulation) {
      return;
    }

    const initial = simulation.lireEtatInitial();
    for (const bateau of initial.bateaux) {
      const état = creerBateauPirate(bateau.id, bateau.position, bateau.routeId);
      état.transformation.lacet = bateau.cap;
      état.statut = 'patrouille';
      this.state.bateauxPirates.set(état.identifiant, état);
      for (let index = 0; index < 2; index += 1) {
        const pirate = creerPirate(`${bateau.id}-equipage-${index + 1}`);
        pirate.bateauId = bateau.id;
        pirate.transformation.x = bateau.position.x + (index === 0 ? 0.7 : -0.7);
        pirate.transformation.y = 1.15;
        pirate.transformation.z = bateau.position.z + 0.8;
        pirate.transformation.lacet = bateau.cap;
        pirate.statut = 'patrouille';
        this.state.pirates.set(pirate.identifiant, pirate);
      }
    }
  }

  /** Avance l'IA et applique ses attaques sans jamais déléguer la décision au client. */
  private actualiserSimulationMaritime(deltaMs: number): void {
    const simulation = this.simulationMaritime;
    if (!simulation) {
      return;
    }

    const deltaSain = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    this.accumulationMaritimeMs = Math.min(1_000, this.accumulationMaritimeMs + deltaSain);
    while (this.accumulationMaritimeMs >= PAS_SIMULATION_MARITIME_SEC * 1_000) {
      this.accumulationMaritimeMs -= PAS_SIMULATION_MARITIME_SEC * 1_000;
      this.appliquerPasMaritime(simulation);
    }
  }

  private appliquerPasMaritime(simulation: SimulationPiratesMaritimes): void {
    const cibles: CiblePerçue[] = [];
    for (const joueur of this.state.joueurs.values()) {
      if (joueur.vivant) {
        cibles.push({
          id: joueur.sessionId,
          position: { x: joueur.transformation.x, z: joueur.transformation.z },
        });
      }
    }

    const sortie = simulation.actualiser(PAS_SIMULATION_MARITIME_SEC, cibles);
    const maintenant = Date.now();
    for (const bateau of sortie.bateaux) {
      this.appliquerEtatBateauPirate(bateau);
    }

    for (const attaque of sortie.attaques) {
      const joueur = this.state.joueurs.get(attaque.cible);
      if (!joueur || !joueur.vivant) {
        continue;
      }
      const après = appliquerDegatsJoueur(
        { sessionId: joueur.sessionId, sante: joueur.sante, vivant: joueur.vivant },
        attaque.degats,
      );
      joueur.sante = après.sante;
      joueur.vivant = après.vivant;
      joueur.statut = après.vivant ? 'actif' : 'mort';
      if (!après.vivant) {
        const client = this.clients.find((candidat) => candidat.sessionId === joueur.sessionId);
        if (client) {
          const données = client.userData ?? {
            indexApparition: 0,
            dernierTirMs: 0,
            derniereSequence: 0,
            prochaineReapparitionMs: 0,
          };
          client.userData = {
            ...données,
            prochaineReapparitionMs: maintenant + DELAI_REAPPARITION_JOUEUR_MS,
          };
        }
      }
    }

    for (const client of this.clients) {
      const joueur = this.state.joueurs.get(client.sessionId);
      if (joueur) {
        this.appliquerReapparitionSiDue(
          client,
          joueur,
          maintenant,
          client.userData ?? {
            indexApparition: 0,
            dernierTirMs: 0,
            derniereSequence: 0,
            prochaineReapparitionMs: 0,
          },
        );
      }
    }

    for (const [bateauId, echeance] of this.echeancesSuppressionBateaux) {
      if (maintenant < echeance) {
        continue;
      }
      this.echeancesSuppressionBateaux.delete(bateauId);
      this.state.bateauxPirates.delete(bateauId);
      for (const [pirateId, pirate] of this.state.pirates) {
        if (pirate.bateauId === bateauId) {
          this.state.pirates.delete(pirateId);
        }
      }
    }
  }

  private appliquerEtatBateauPirate(état: EtatBateauMaritimeSimulation): void {
    const bateau = this.state.bateauxPirates.get(état.id);
    if (!bateau) {
      return;
    }

    const détruit = état.etat === 'mort';
    bateau.transformation.x = état.position.x;
    bateau.transformation.y = état.position.y;
    bateau.transformation.z = état.position.z;
    bateau.transformation.lacet = état.cap;
    bateau.vitesse = détruit ? 0 : état.vitesse;
    bateau.statut = détruit ? 'detruit' : état.etat;
    bateau.actif = !détruit;

    for (const pirate of this.state.pirates.values()) {
      if (pirate.bateauId !== état.id) {
        continue;
      }
      if (détruit) {
        pirate.vivant = false;
        pirate.sante = 0;
        pirate.statut = 'mort';
        continue;
      }
      const offsetX = pirate.identifiant.endsWith('1') ? 0.7 : -0.7;
      pirate.transformation.x = état.position.x + offsetX;
      pirate.transformation.y = 1.15;
      pirate.transformation.z = état.position.z + 0.8;
      pirate.transformation.lacet = état.cap;
      pirate.statut = état.etat;
    }

    if (détruit && !this.echeancesSuppressionBateaux.has(état.id)) {
      this.echeancesSuppressionBateaux.set(état.id, Date.now() + 2_000);
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
        if (!pirateApresDegats.vivant && pirate.bateauId) {
          const bateau = this.state.bateauxPirates.get(pirate.bateauId);
          if (bateau) {
            bateau.sante = 0;
            bateau.actif = false;
            bateau.vitesse = 0;
            bateau.statut = 'detruit';
            this.simulationMaritime?.detruire(bateau.identifiant);
            for (const membre of this.state.pirates.values()) {
              if (membre.bateauId === bateau.identifiant) {
                membre.sante = 0;
                membre.vivant = false;
                membre.statut = 'mort';
              }
            }
            this.echeancesSuppressionBateaux.set(bateau.identifiant, Date.now() + 2_000);
          }
        }
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
