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
  hauteurSurfaceIle,
  MachineEtatPirate,
  PROFIL_TERRE,
  reinitialiserJoueurReapparu,
  reapparitionDue,
  resoudreCibleTiree,
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
const PAS_SIMULATION_PIRATES_MS = 50;
const PAS_SIMULATION_PIRATES_SEC = PAS_SIMULATION_PIRATES_MS / 1000;
const NOMBRE_MAXIMUM_PAS_PAR_TICK = 4;
const MARGE_INTERIEURE_ILE = 0.84;

interface IaPirateServeur {
  readonly machine: MachineEtatPirate;
  readonly ileId: string;
}

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
  private readonly iaPirates = new Map<string, IaPirateServeur>();
  private monde: ReturnType<typeof genererMonde> = genererMonde();
  private modeE2E = false;
  private modeRencontreE2E = false;
  private accumulationSimulationSec = 0;

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
    this.modeRencontreE2E = this.modeE2E && this.state.metadonnees.graine === 'rencontre-mvp';
    this.metadata = {
      identifiantSalle: this.roomId,
      versionProtocole: this.state.metadonnees.versionProtocole,
      graine: this.state.metadonnees.graine,
      capaciteMaximale: CAPACITE_SALLE,
    };

    this.monde = genererMonde(this.state.metadonnees.graine);
    this.peuplerPirates();
    this.setSimulationInterval((deltaMs) => this.actualiserSimulation(deltaMs), PAS_SIMULATION_PIRATES_MS);

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

    // Le harnais E2E de rencontre commence directement sur l’île isolée. Ce
    // raccourci est strictement borné au mode serveur de test et à sa graine
    // documentée ; aucun client de production ne peut choisir cette position.
    if (this.modeRencontreE2E && indexApparition === 0) {
      const apparition = this.monde.iles[0]?.apparitionsPirates[0];
      if (apparition) {
        joueur.transformation.x = apparition.position.x;
        joueur.transformation.y = 0;
        joueur.transformation.z = apparition.position.z;
      }
    }

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
        pirate.statut = 'inactif';
        this.state.pirates.set(pirate.identifiant, pirate);
        this.iaPirates.set(pirate.identifiant, {
          ileId: ile.id,
          machine: new MachineEtatPirate({
            graine: this.state.metadonnees.graine + ':' + apparition.id,
            profil: {
              ...PROFIL_TERRE,
              pointAncrage: {
                x: ile.transformation.position.x,
                z: ile.transformation.position.z,
              },
            },
            positionDepart: { x: apparition.position.x, z: apparition.position.z },
            limites: {
              largeur: 220,
              profondeur: 220,
              rayonTerrestreMax: Math.max(ile.rayonX, ile.rayonZ),
              centre: {
                x: ile.transformation.position.x,
                z: ile.transformation.position.z,
              },
              rayonX: ile.rayonX,
              rayonZ: ile.rayonZ,
              rotationY: ile.transformation.rotationY,
              rayonTerrestreRatio: MARGE_INTERIEURE_ILE,
            },
          }),
        });
      }
    }
  }

  /** Exécute l’IA sur un pas fixe, sans laisser le retard créer une rafale. */
  private actualiserSimulation(deltaMs: number): void {
    const deltaSain = Number.isFinite(deltaMs) ? Math.max(0, Math.min(250, deltaMs)) : 0;
    this.accumulationSimulationSec = Math.min(
      this.accumulationSimulationSec + deltaSain / 1000,
      PAS_SIMULATION_PIRATES_SEC * NOMBRE_MAXIMUM_PAS_PAR_TICK,
    );

    for (const client of this.clients) {
      const joueur = this.state.joueurs.get(client.sessionId);
      const donnees = client.userData;
      if (joueur && donnees && !joueur.vivant) {
        this.appliquerReapparitionSiDue(client, joueur, Date.now(), donnees);
      }
    }

    let nombrePas = 0;
    while (
      this.accumulationSimulationSec + 1e-9 >= PAS_SIMULATION_PIRATES_SEC &&
      nombrePas < NOMBRE_MAXIMUM_PAS_PAR_TICK
    ) {
      this.accumulationSimulationSec -= PAS_SIMULATION_PIRATES_SEC;
      this.actualiserPirates(PAS_SIMULATION_PIRATES_SEC);
      nombrePas += 1;
    }
  }

  private actualiserPirates(deltaSec: number): void {
    for (const [pirateId, ia] of this.iaPirates) {
      const pirate = this.state.pirates.get(pirateId);
      const ile = this.monde.iles.find((entrée) => entrée.id === ia.ileId);
      if (!pirate || !ile || !pirate.vivant) {
        continue;
      }

      const cible = this.trouverCiblePirate(ile, pirate);
      const sortie = ia.machine.actualiser(deltaSec, cible);
      pirate.transformation.x = sortie.position.x;
      pirate.transformation.z = sortie.position.z;
      const surface = hauteurSurfaceIle(ile, {
        x: sortie.position.x,
        y: 0,
        z: sortie.position.z,
      });
      if (surface !== undefined) {
        pirate.transformation.y = surface + 0.45;
      }
      pirate.transformation.lacet = sortie.cap;
      pirate.statut = sortie.etat;

      const intention = sortie.intentionAttaque;
      if (!intention) {
        continue;
      }

      const joueur = this.state.joueurs.get(intention.cible);
      if (!joueur || !joueur.vivant || !this.estPointSurIle(ile, joueur.transformation)) {
        continue;
      }

      const distance = Math.hypot(
        joueur.transformation.x - pirate.transformation.x,
        joueur.transformation.z - pirate.transformation.z,
      );
      if (distance > intention.portee) {
        continue;
      }

      const joueurApresDegats = appliquerDegatsJoueur(
        { sessionId: joueur.sessionId, sante: joueur.sante, vivant: joueur.vivant },
        DEGATS_PAR_TIR_PIRATE,
      );
      joueur.sante = joueurApresDegats.sante;
      joueur.vivant = joueurApresDegats.vivant;
      joueur.statut = joueurApresDegats.vivant ? 'actif' : 'mort';
      if (!joueurApresDegats.vivant) {
        const client = this.clients.find((entrée) => entrée.sessionId === joueur.sessionId);
        if (client) {
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
    }
  }

  private trouverCiblePirate(
    ile: ReturnType<typeof genererMonde>['iles'][number],
    pirate: { readonly transformation: { readonly x: number; readonly z: number } },
  ): { readonly id: string; readonly position: { readonly x: number; readonly z: number } } | undefined {
    let meilleure:
      | { readonly id: string; readonly position: { readonly x: number; readonly z: number } }
      | undefined;
    let distanceMinimale = Number.POSITIVE_INFINITY;
    for (const joueur of this.state.joueurs.values()) {
      if (!joueur.vivant || !this.estPointSurIle(ile, joueur.transformation)) {
        continue;
      }
      const distance = Math.hypot(
        joueur.transformation.x - pirate.transformation.x,
        joueur.transformation.z - pirate.transformation.z,
      );
      if (distance < distanceMinimale) {
        distanceMinimale = distance;
        meilleure = {
          id: joueur.sessionId,
          position: { x: joueur.transformation.x, z: joueur.transformation.z },
        };
      }
    }
    return meilleure;
  }

  private estPointSurIle(
    ile: ReturnType<typeof genererMonde>['iles'][number],
    point: { readonly x: number; readonly z: number },
  ): boolean {
    return hauteurSurfaceIle(ile, { x: point.x, y: 0, z: point.z }) !== undefined;
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
        if (!pirateApresDegats.vivant) {
          this.iaPirates.get(cibleId)?.machine.tuer();
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
