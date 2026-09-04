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
  LignePecheSchema,
  obtenirPointApparition,
  type MessageAnnulerPeche,
  type MessageAvancerPecheE2E,
  type EtatSalle,
  type Bateau,
  type Joueur,
  type MessageDegatsE2E,
  type MessageIntentionTir,
  type MessageLancerPeche,
  type MessagePreparerPecheE2E,
  type MessagePing,
  type MessagePositionE2E,
  type MessageReleverPeche,
  type MessageResultatPeche,
  type MessagePong,
  type MessageResultatTir,
  type MessageTransformationJoueur,
  type MessageDemandeBarre,
  type MessageRefusBarre,
  type MessageLiberationBarre,
  type MessageIntentionPilotage,
  type MessageEtatBarre,
  type MetadonneesSalleMatchmaking,
  validerMessageAnnulerPeche,
  validerMessageAvancerPecheE2E,
  validerMessageDegatsE2E,
  validerMessageIntentionTir,
  validerMessageLancerPeche,
  validerMessagePreparerPecheE2E,
  validerMessagePing,
  validerMessagePositionE2E,
  validerMessageReleverPeche,
  validerMessageTransformationJoueur,
  validerMessageDemandeBarre,
  validerMessageLiberationBarre,
  validerIntentionPilotage,
  DISTANCE_MAXIMALE_BARRE,
  validerOptionsConnexion,
  VITESSE_MAXIMALE_JOUEUR,
} from '@pirate/protocole';
import {
  CADENCE_LANCER_PECHE_MS,
  DELAI_REAPPARITION_JOUEUR_MS,
  DISTANCE_ORIGINE_PECHE_ADMISE,
  DEGATS_PAR_TIR_PIRATE,
  MachineEtatPirate,
  PROFIL_TERRE,
  appliquerDegatsJoueur,
  appliquerDegatsPirate,
  annulerPeche,
  avancerPeche,
  choisirReapparition,
  ETAT_PECHE_INACTIF,
  genererMonde,
  lancerPeche,
  pointDansCollisionIle,
  pointDansZonePeche,
  PORTEE_PECHE,
  reinitialiserJoueurReapparu,
  reapparitionDue,
  releverPeche,
  resoudreCibleTiree,
  PAS_SIMULATION_MARITIME_SEC,
  SimulationPiratesMaritimes,
  type CiblePerçue,
  type DescripteurIle,
  type EtatBateauMaritimeSimulation,
  type EtatPeche,
  type SortieIaPirate,
  appliquerTraînéeBateau,
  creerEtatBateauPilotage,
  type EtatBateauPilotage,
  type IntentionsPilotageServeur,
  simulerPasPilotage,
  DELTA_SIMULATION_BATEAU,
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
  [NOMS_MESSAGES.positionE2E]: MessagePositionE2E;
  [NOMS_MESSAGES.demandeBarre]: MessageDemandeBarre;
  [NOMS_MESSAGES.liberationBarre]: MessageLiberationBarre;
  [NOMS_MESSAGES.intentionPilotage]: MessageIntentionPilotage;
  [NOMS_MESSAGES.etatBarre]: MessageEtatBarre;
  [NOMS_MESSAGES.refusBarre]: MessageRefusBarre;
}

/** Données joueur privées conservées côté serveur, jamais dévoilées au client. */
interface EtatPilotageBateau extends EtatBateauPilotage {
  intentions: IntentionsPilotageServeur;
}

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
export const PAS_SIMULATION_PIRATES_MS = 50;
const PAS_SIMULATION_PIRATES_SEC = PAS_SIMULATION_PIRATES_MS / 1000;

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

function joueurDansIle(ile: DescripteurIle, joueur: Joueur): boolean {
  // La transformation d’un joueur est portée à hauteur du sol pour tester la
  // surface horizontale, même pendant les anciennes apparitions à y = 0.
  return pointDansCollisionIle(ile, {
    x: joueur.transformation.x,
    y: ile.collision.hauteurSurface,
    z: joueur.transformation.z,
  });
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
  private readonly machinesPirates = new Map<string, MachineEtatPirate>();
  private readonly ilesPirates = new Map<string, DescripteurIle>();
  private readonly etatsPeche = new Map<string, EtatPeche>();
  private monde: ReturnType<typeof genererMonde> = genererMonde();
  private modeE2E = false;
  private readonly bateauxPilotage = new Map<string, EtatPilotageBateau>();
  private accumulationPilotageMs = 0;
  private simulationMaritime: SimulationPiratesMaritimes | undefined;
  private accumulationMaritimeMs = 0;
  private readonly echeancesSuppressionBateaux = new Map<string, number>();
  private horloge: HorlogeSimulation = creerHorlogeSimulation();

  /** Injecte une horloge contrôlée avant l-initialisation de la salle. */
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
    this.simulationMaritime = new SimulationPiratesMaritimes({
      monde: this.monde,
      graine: this.state.metadonnees.graine,
      nombreBateaux: 1,
    });
    this.initialiserBateauxPirates();
    this.setSimulationInterval((deltaMs) => {
      if (this.horloge.automatique && !this.modeE2E) {
        this.horloge.avancerMs(deltaMs);
      }
      this.actualiserSimulationPilotage(deltaMs);
      this.actualiserPeches();
      this.actualiserSimulationMaritime(deltaMs);
      this.actualiserSimulationPirates();
    }, PAS_SIMULATION_PIRATES_MS);

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
    this.initialiserEtatPilotage(bateau);
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
    const bateauPilotageId = this.bateauPilotageId();
    const bateauPilotage = bateauPilotageId ? this.state.bateaux.get(bateauPilotageId) : undefined;
    const étatPilotage = bateauPilotageId ? this.bateauxPilotage.get(bateauPilotageId) : undefined;

    if (bateauPilotage && étatPilotage?.piloteSessionId === client.sessionId) {
      this.arreterPilotage(bateauPilotage, étatPilotage);
      this.publierEtatBarre(bateauPilotage);
    }

    this.state.joueurs.delete(client.sessionId);
    const bateauPersonnelId = 'bateau-' + client.sessionId;
    if (bateauPersonnelId !== bateauPilotageId) {
      this.state.bateaux.delete(bateauPersonnelId);
      this.bateauxPilotage.delete(bateauPersonnelId);
    }
    this.dernièresTransformations.delete(client.sessionId);
    this.nettoyerLignePeche(client.sessionId);

    if (this.state.joueurs.size === 0) {
      if (bateauPilotageId) {
        this.state.bateaux.delete(bateauPilotageId);
        this.bateauxPilotage.delete(bateauPilotageId);
      }
      this.state.phase = PHASE_SALLE_ATTENTE;
      this.accumulationPilotageMs = 0;
    } else if (bateauPilotage) {
      const prochainProprietaire = this.state.joueurs.values().next().value as Joueur | undefined;
      if (prochainProprietaire) {
        bateauPilotage.proprietaireSessionId = prochainProprietaire.sessionId;
        const état = bateauPilotageId ? this.bateauxPilotage.get(bateauPilotageId) : undefined;
        if (état) {
          état.proprietaireSessionId = prochainProprietaire.sessionId;
        }
      }
    }
  }

  /** Initialise la copie privée de l'état de pilotage pour un bateau. */
  private initialiserEtatPilotage(bateau: Bateau): void {
    const état = creerEtatBateauPilotage(
      bateau.identifiant,
      bateau.proprietaireSessionId,
      bateau.transformation.x,
      bateau.transformation.y,
      bateau.transformation.z,
      bateau.transformation.lacet,
    );
    this.bateauxPilotage.set(bateau.identifiant, {
      ...état,
      intentions: { poussee: 0, gouvernail: 0 },
    });
  }

  /** Le premier bateau créé reste le navire partagé de la session. */
  private bateauPilotageId(): string | undefined {
    return this.state.bateaux.keys().next().value as string | undefined;
  }

  /** Copie l'état privé autoritaire dans le schéma synchronisé. */
  private synchroniserEtatPilotage(bateau: Bateau, état: EtatPilotageBateau): void {
    bateau.proprietaireSessionId = état.proprietaireSessionId;
    bateau.piloteSessionId = état.piloteSessionId ?? '';
    bateau.transformation.x = état.positionX;
    bateau.transformation.y = état.positionY;
    bateau.transformation.z = état.positionZ;
    bateau.transformation.lacet = état.rotationY;
    bateau.vitesse = état.vitesse;
    bateau.vitesseAngulaire = état.vitesseAngulaire;
    bateau.statut = état.piloteSessionId === null ? 'amarré' : 'en_mouvement';
  }

  /** Publie l'état courant de la barre à tous les clients de la salle. */
  private publierEtatBarre(bateau: Bateau): void {
    const état = this.bateauxPilotage.get(bateau.identifiant);
    if (!état) {
      return;
    }
    const pilote = état.piloteSessionId ? this.state.joueurs.get(état.piloteSessionId) : undefined;
    this.broadcast(NOMS_MESSAGES.etatBarre, {
      bateauId: bateau.identifiant,
      piloteSessionId: état.piloteSessionId ?? '',
      piloteNom: pilote?.nom ?? '',
      statut: état.piloteSessionId === null ? 'libre' : 'occupee',
      positionX: état.positionX,
      positionY: état.positionY,
      positionZ: état.positionZ,
      rotationY: état.rotationY,
      vitesse: état.vitesse,
      vitesseAngulaire: état.vitesseAngulaire,
      sequence: état.dernierSequence,
    });
  }

  /** Arrête un bateau et rend sa barre disponible. */
  private arreterPilotage(bateau: Bateau, état: EtatPilotageBateau): void {
    état.piloteSessionId = null;
    état.intentions = { poussee: 0, gouvernail: 0 };
    état.vitesse = 0;
    état.vitesseAngulaire = 0;
    état.dernierSequence = 0;
    état.dernierEnvoiMs = 0;
    this.synchroniserEtatPilotage(bateau, état);
  }

  /** Simule tous les bateaux à une cadence fixe, quelle que soit la cadence des callbacks. */
  private actualiserSimulationPilotage(deltaMs: number): void {
    const deltaSain = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    this.accumulationPilotageMs = Math.min(1_000, this.accumulationPilotageMs + deltaSain);

    while (this.accumulationPilotageMs >= DELTA_SIMULATION_BATEAU * 1_000) {
      this.accumulationPilotageMs -= DELTA_SIMULATION_BATEAU * 1_000;
      for (const [bateauId, état] of this.bateauxPilotage) {
        const bateau = this.state.bateaux.get(bateauId);
        if (!bateau) {
          this.bateauxPilotage.delete(bateauId);
          continue;
        }

        if (état.piloteSessionId === null) {
          appliquerTraînéeBateau(état, DELTA_SIMULATION_BATEAU);
        } else {
          simulerPasPilotage(état, état.intentions);
        }
        this.synchroniserEtatPilotage(bateau, état);
        if (état.piloteSessionId !== null) {
          this.publierEtatBarre(bateau);
        }
      }
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
        this.ilesPirates.set(pirate.identifiant, ile);
        this.machinesPirates.set(
          pirate.identifiant,
          new MachineEtatPirate({
            graine: this.monde.graine + ':' + pirate.identifiant,
            profil: {
              ...PROFIL_TERRE,
              pointAncrage: {
                x: ile.transformation.position.x,
                z: ile.transformation.position.z,
              },
            },
            positionDepart: {
              x: apparition.position.x,
              z: apparition.position.z,
            },
            limites: {
              largeur: ile.rayonX * 2,
              profondeur: ile.rayonZ * 2,
              rayonTerrestreMax: Math.min(ile.rayonX, ile.rayonZ) * 0.78,
              centre: {
                x: ile.collision.centre.x,
                z: ile.collision.centre.z,
              },
              rayonX: ile.rayonX * 0.78,
              rayonZ: ile.rayonZ * 0.78,
              rotationY: ile.collision.rotationY,
            },
          }),
        );
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
            dernierLancerPecheMs: -Infinity,
            derniereSequencePeche: 0,
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
            dernierLancerPecheMs: -Infinity,
            derniereSequencePeche: 0,
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

  /** Avance toutes les machines d’IA sur un pas fixe et applique leurs sorties. */
  private actualiserSimulationPirates(): void {
    for (const pirate of this.state.pirates.values()) {
      const machine = this.machinesPirates.get(pirate.identifiant);
      const ile = this.ilesPirates.get(pirate.identifiant);
      if (!machine || !ile) {
        continue;
      }

      if (!pirate.vivant) {
        machine.tuer();
      }

      const cible = pirate.vivant
        ? this.trouverCiblePirate(ile, machine.lirePosition())
        : undefined;
      const sortie = machine.actualiser(PAS_SIMULATION_PIRATES_SEC, cible);
      this.appliquerSortiePirate(pirate.identifiant, sortie);

      if (sortie.intentionAttaque) {
        this.appliquerAttaquePirate(pirate.identifiant, sortie);
      }
    }
  }

  private trouverCiblePirate(
    ile: DescripteurIle,
    positionPirate: { readonly x: number; readonly z: number },
  ): CiblePerçue | undefined {
    let meilleure: CiblePerçue | undefined;
    let meilleureDistance = Number.POSITIVE_INFINITY;

    for (const joueur of this.state.joueurs.values()) {
      if (!joueur.vivant || !joueurDansIle(ile, joueur)) {
        continue;
      }

      const distance = Math.hypot(
        joueur.transformation.x - positionPirate.x,
        joueur.transformation.z - positionPirate.z,
      );
      if (distance < meilleureDistance) {
        meilleureDistance = distance;
        meilleure = {
          id: joueur.sessionId,
          position: {
            x: joueur.transformation.x,
            z: joueur.transformation.z,
          },
        };
      }
    }

    return meilleure;
  }

  private appliquerSortiePirate(identifiant: string, sortie: SortieIaPirate): void {
    const pirate = this.state.pirates.get(identifiant);
    if (!pirate) {
      return;
    }

    pirate.transformation.x = sortie.position.x;
    pirate.transformation.z = sortie.position.z;
    pirate.transformation.lacet = sortie.cap;
    pirate.statut = sortie.etat;
    pirate.vivant = sortie.etat !== 'mort';
  }

  private appliquerAttaquePirate(identifiant: string, sortie: SortieIaPirate): void {
    const intention = sortie.intentionAttaque;
    if (!intention) {
      return;
    }

    const pirate = this.state.pirates.get(identifiant);
    const joueur = this.state.joueurs.get(intention.cible);
    if (
      !pirate ||
      !joueur ||
      !joueur.vivant ||
      !this.ileDuPirateContientJoueur(identifiant, joueur)
    ) {
      return;
    }

    const distance = Math.hypot(
      joueur.transformation.x - pirate.transformation.x,
      joueur.transformation.z - pirate.transformation.z,
    );
    if (distance > intention.portee) {
      return;
    }

    const après = appliquerDegatsJoueur(
      {
        sessionId: joueur.sessionId,
        sante: joueur.sante,
        vivant: joueur.vivant,
      },
      DEGATS_PAR_TIR_PIRATE,
    );
    joueur.sante = après.sante;
    joueur.vivant = après.vivant;
    joueur.statut = après.vivant ? 'actif' : 'mort';

    if (!après.vivant) {
      const client = this.clients.find((entrée) => entrée.sessionId === joueur.sessionId);
      if (client) {
        const données: DonneesClientSalle = client.userData ?? {
          indexApparition: 0,
          dernierTirMs: 0,
          derniereSequence: 0,
          dernierLancerPecheMs: -Infinity,
          derniereSequencePeche: 0,
          prochaineReapparitionMs: 0,
        };
        client.userData = {
          ...données,
          prochaineReapparitionMs: Date.now() + DELAI_REAPPARITION_JOUEUR_MS,
        };
      }
    }
  }

  private ileDuPirateContientJoueur(identifiant: string, joueur: Joueur): boolean {
    const ile = this.ilesPirates.get(identifiant);
    return ile ? joueurDansIle(ile, joueur) : false;
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

    if (type === NOMS_MESSAGES.positionE2E) {
      this.traiterPositionE2E(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.demandeBarre) {
      this.traiterDemandeBarre(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.liberationBarre) {
      this.traiterLiberationBarre(client, message);
      return;
    }

    if (type === NOMS_MESSAGES.intentionPilotage) {
      this.traiterIntentionPilotage(client, message);
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

  /** Positionne le mannequin sur une île pour les scénarios E2E déterministes. */
  private traiterPositionE2E(client: ClientSalle, message: unknown): void {
    if (!this.modeE2E) {
      this.rejeterMessage(
        client,
        CODE_MESSAGE_INVALIDE,
        'Le message E2E de position n’est pas autorisé.',
      );
      return;
    }

    const validation = validerMessagePositionE2E(message);
    if (!validation.valide) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, validation.erreurs.join(' '));
      return;
    }

    const joueur = this.state.joueurs.get(client.sessionId);
    if (!joueur) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, 'Le joueur est inconnu.');
      return;
    }

    const position = validation.valeur.position;
    const surUneIle = this.monde.iles.some((ile) =>
      pointDansCollisionIle(ile, {
        x: position.x,
        y: ile.collision.hauteurSurface,
        z: position.z,
      }),
    );
    const procheDUnBateau = [...this.state.bateaux.values()].some(
      (bateau) =>
        Math.hypot(position.x - bateau.transformation.x, position.z - bateau.transformation.z) <=
        DISTANCE_MAXIMALE_BARRE + 1,
    );
    if (!surUneIle && !procheDUnBateau) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, 'La position E2E doit être sur une île.');
      return;
    }

    joueur.transformation.x = position.x;
    joueur.transformation.y = position.y;
    joueur.transformation.z = position.z;
    this.dernièresTransformations.set(client.sessionId, {
      x: position.x,
      y: position.y,
      z: position.z,
      horodatage: Date.now(),
    });
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
      this.refuserActionPeche(
        client,
        CODE_MESSAGE_INVALIDE,
        'Le joueur est hors de la zone de pêche.',
      );
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

  private refuserBarre(
    client: ClientSalle,
    bateauId: string,
    motif: MessageRefusBarre['motif'],
    message: string,
  ): void {
    client.send(NOMS_MESSAGES.refusBarre, { bateauId, motif, message });
  }

  private rejeterMessage(client: ClientSalle, code: number, raison: string): void {
    client.error(code, raison);
    client.leave(code, raison);
  }

  private traiterDemandeBarre(client: ClientSalle, message: unknown): void {
    const validation = validerMessageDemandeBarre(message);
    if (!validation) {
      this.rejeterMessage(
        client,
        CODE_MESSAGE_INVALIDE,
        'Le message de demande de barre est invalide.',
      );
      return;
    }
    const bateauId = (message as MessageDemandeBarre).bateauId;
    const bateau = this.state.bateaux.get(bateauId);
    if (!bateau) {
      this.refuserBarre(client, bateauId, 'invalide', 'Le bateau demandé n’existe pas.');
      return;
    }
    const état = this.bateauxPilotage.get(bateauId);
    const joueur = this.state.joueurs.get(client.sessionId);
    if (!joueur || !état) {
      this.rejeterMessage(client, CODE_MESSAGE_INVALIDE, 'Le joueur est inconnu.');
      return;
    }

    if (!joueur.vivant) {
      this.refuserBarre(
        client,
        bateauId,
        'invalide',
        'Un pêcheur mort ne peut pas tenir la barre.',
      );
      return;
    }

    if (état.piloteSessionId !== null) {
      this.refuserBarre(
        client,
        bateauId,
        état.piloteSessionId === client.sessionId ? 'deja-pilote' : 'barre-occupee',
        état.piloteSessionId === client.sessionId
          ? 'Vous tenez déjà la barre.'
          : 'La barre est occupée par un autre pêcheur.',
      );
      this.publierEtatBarre(bateau);
      return;
    }

    const distance = Math.hypot(
      joueur.transformation.x - bateau.transformation.x,
      joueur.transformation.z - bateau.transformation.z,
    );
    if (distance > DISTANCE_MAXIMALE_BARRE) {
      this.refuserBarre(
        client,
        bateauId,
        'distance',
        'Vous êtes trop loin de la barre pour la prendre.',
      );
      return;
    }

    état.piloteSessionId = client.sessionId;
    état.intentions = { poussee: 0, gouvernail: 0 };
    this.synchroniserEtatPilotage(bateau, état);
    this.publierEtatBarre(bateau);
  }

  private traiterLiberationBarre(client: ClientSalle, message: unknown): void {
    const validation = validerMessageLiberationBarre(message);
    if (!validation) {
      this.rejeterMessage(
        client,
        CODE_MESSAGE_INVALIDE,
        'Le message de libération de barre est invalide.',
      );
      return;
    }
    const bateauId = (message as MessageLiberationBarre).bateauId;
    const bateau = this.state.bateaux.get(bateauId);
    const état = this.bateauxPilotage.get(bateauId);
    if (!bateau || !état) {
      this.refuserBarre(client, bateauId, 'invalide', 'Le bateau demandé n’existe pas.');
      return;
    }

    if (état.piloteSessionId !== client.sessionId) {
      return;
    }

    this.arreterPilotage(bateau, état);
    this.publierEtatBarre(bateau);
  }

  private traiterIntentionPilotage(client: ClientSalle, message: unknown): void {
    if (typeof message !== 'object' || message === null) {
      client.error(CODE_MESSAGE_INVALIDE, 'L’intention de pilotage est invalide.');
      return;
    }
    const objet = message as Record<string, unknown>;
    const bateauId = typeof objet.bateauId === 'string' ? objet.bateauId : '';
    const bateau = this.state.bateaux.get(bateauId);
    const état = this.bateauxPilotage.get(bateauId);
    if (!bateau || !état) {
      client.error(CODE_MESSAGE_INVALIDE, 'Le bateau demandé n’existe pas.');
      return;
    }

    if (état.piloteSessionId !== client.sessionId) {
      return;
    }

    const validation = validerIntentionPilotage(
      message,
      {
        sessionIdProprietaire: état.proprietaireSessionId,
        sessionIdPilote: état.piloteSessionId,
        positionX: état.positionX,
        positionY: état.positionY,
        positionZ: état.positionZ,
        rotationY: état.rotationY,
        vitesse: état.vitesse,
        vitesseAngulaire: état.vitesseAngulaire,
        dernierSequencePilote: état.dernierSequence,
        dernierEnvoiMs: état.dernierEnvoiMs,
      },
      Date.now(),
    );
    if (!validation.valide) {
      client.error(CODE_MESSAGE_INVALIDE, validation.raison);
      return;
    }

    état.intentions = {
      poussee: validation.intention.poussee,
      gouvernail: validation.intention.gouvernail,
    };
    état.dernierSequence = validation.intention.sequence;
    état.dernierEnvoiMs = Date.now();
    this.synchroniserEtatPilotage(bateau, état);
    this.publierEtatBarre(bateau);
  }
}
