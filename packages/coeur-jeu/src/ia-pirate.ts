import { creerAleatoire } from './aleatoire.js';

/** Tolérance numérique pour éviter les résidus de virgule flottante. */
const EPSILON_TEMPS = 1e-9;

/** État de la machine d'états d'un pirate. */
export type EtatIaPirate = 'inactif' | 'patrouille' | 'poursuite' | 'attaque' | 'retour' | 'mort';

export const ETATS_IA_PIRATE: readonly EtatIaPirate[] = [
  'inactif',
  'patrouille',
  'poursuite',
  'attaque',
  'retour',
  'mort',
];

/** Coordonnées horizontales utilisées par les règles d'IA. */
export interface Coordonnees {
  readonly x: number;
  readonly z: number;
}

/** Repère mobile exprimé en unités monde. */
export interface VecteurDeplacement {
  readonly x: number;
  readonly z: number;
}

/** Intention émise par l'IA, appliquée uniquement par le serveur. */
export interface IntentionDeplacement {
  readonly x: number;
  readonly z: number;
  readonly ligneDroite: boolean;
  readonly vitesse: number;
}

/** Intention d'attaque, appliquée uniquement par le serveur après validation. */
export interface IntentionAttaque {
  readonly identifiantSequence: number;
  readonly cible: string;
  readonly portee: number;
  readonly direction: VecteurDeplacement;
}

/** Sortie complète de l'étape d'IA. */
export interface SortieIaPirate {
  readonly etat: EtatIaPirate;
  readonly position: Coordonnees;
  readonly cap: number;
  readonly intentionDeplacement: IntentionDeplacement | undefined;
  readonly intentionAttaque: IntentionAttaque | undefined;
  readonly ciblePerdue: boolean;
  readonly progressionTemporisation: number;
}

/** Cible perçue par le pirate, fournie par le monde/positionnement. */
export interface CiblePerçue {
  readonly id: string;
  readonly position: Coordonnees;
}

/** Profil de comportement terrestre ou maritime. */
export interface ProfilIaPirate {
  readonly milieu: 'terre' | 'mer';
  readonly porteePerception: number;
  readonly porteeAttaque: number;
  readonly porteePoursuite: number;
  readonly porteeRetour: number;
  readonly cadenceAttaque: number;
  readonly delaiPerception: number;
  readonly delaiPerteCible: number;
  readonly delaiRetour: number;
  readonly vitessePatrouille: number;
  readonly vitessePoursuite: number;
  readonly vitesseRetour: number;
  readonly rayonHysteresis: number;
  readonly rayonPatrouille: number;
  readonly pointAncrage: Coordonnees;
  /** Points suivis dans l'ordre pendant la patrouille maritime. */
  readonly routePatrouille?: readonly Coordonnees[];
}

/** Limites terre/mer imposées aux déplacements. */
export interface LimitesZoneIaPirate {
  readonly largeur: number;
  readonly profondeur: number;
  readonly rayonTerrestreMax: number;
}

/** Option de construction de la machine d'états. */
export interface OptionsIaPirate {
  readonly graine: string;
  readonly profil: ProfilIaPirate;
  readonly positionDepart: Coordonnees;
  readonly limites?: Partial<LimitesZoneIaPirate>;
}

/**
 * Machine à états déterministe de l'IA pirate.
 *
 * Les transitions suivent un ordre stable : inactif → patrouille → poursuite →
 * attaque → retour → mort. La mort est terminale et ne peut pas être quittée.
 */
export class MachineEtatPirate {
  private readonly aleatoire: () => number;
  private readonly profil: ProfilIaPirate;
  private readonly limites: LimitesZoneIaPirate;
  private readonly origine: Coordonnees;
  private etat: EtatIaPirate;
  private position: Coordonnees;
  private cap: number;
  private capCible: number;
  private cible: CiblePerçue | undefined;
  private temporisateurPerception = 0;
  private temporisateurPerte = 0;
  private temporisateurRetour = 0;
  private temporisateurAttaque = 0;
  private prochaineCiblePatrouille: Coordonnees;
  private indexRoutePatrouille = 0;
  private ciblePerdue = false;
  private progressionTemporisation = 0;
  private sequence = 1;
  private attaqueEnAttente = false;

  public constructor(options: OptionsIaPirate) {
    this.aleatoire = creerAleatoire(options.graine);
    this.profil = figerProfil(options.profil);
    this.limites = figerLimites(options.limites ?? {});
    this.origine = { ...options.positionDepart };
    this.position = { ...options.positionDepart };
    this.etat = 'inactif';
    this.cap = 0;
    this.capCible = 0;
    this.temporisateurPerception = Math.max(0, options.profil.delaiPerception);
    this.prochaineCiblePatrouille = choisirCiblePatrouille(
      this.aleatoire,
      this.profil.pointAncrage,
      this.profil.rayonPatrouille,
      this.limites,
      this.profil.routePatrouille,
      this.indexRoutePatrouille,
    );
  }

  /** État courant, en lecture seule. */
  public lireEtat(): EtatIaPirate {
    return this.etat;
  }

  /** Position courante, en lecture seule. */
  public lirePosition(): Coordonnees {
    return { ...this.position };
  }

  /** Cap courant en radians, en lecture seule. */
  public lireCap(): number {
    return this.cap;
  }

  /** Cible courante, en lecture seule. */
  public lireCible(): CiblePerçue | undefined {
    return this.cible ? { ...this.cible } : undefined;
  }

  /** Prochain point de patrouille, exposé pour les diagnostics et les tests. */
  public lireCiblePatrouille(): Coordonnees {
    return { ...this.prochaineCiblePatrouille };
  }

  /** Progression du temporisateur courant sur [0, 1], nul hors temporisation. */
  public lireProgression(): number {
    return this.progressionTemporisation;
  }

  public reinitialiser(): void {
    this.etat = 'inactif';
    this.position = { ...this.origine };
    this.cap = 0;
    this.capCible = 0;
    this.cible = undefined;
    this.temporisateurPerception = Math.max(0, this.profil.delaiPerception);
    this.temporisateurPerte = 0;
    this.temporisateurRetour = 0;
    this.temporisateurAttaque = 0;
    this.indexRoutePatrouille = 0;
    this.prochaineCiblePatrouille = choisirCiblePatrouille(
      this.aleatoire,
      this.profil.pointAncrage,
      this.profil.rayonPatrouille,
      this.limites,
      this.profil.routePatrouille,
      this.indexRoutePatrouille,
    );
    this.ciblePerdue = false;
    this.progressionTemporisation = 0;
    this.sequence = 1;
    this.attaqueEnAttente = false;
  }

  /**
   * Fait avancer la machine d'états d'un pas de temps fixe.
   *
   * @param deltaSecondes Pas de temps en secondes, supposé fixe.
   * @param cible Cible perçue, absente si aucun pirate/cible n'est visible.
   */
  public actualiser(deltaSecondes: number, cible: CiblePerçue | undefined): SortieIaPirate {
    const delta = deltaSain(deltaSecondes);
    const cibleSaine = normaliserCible(cible);
    this.ciblePerdue = false;
    this.progressionTemporisation = 0;

    switch (this.etat) {
      case 'mort':
        this.temporisateurAttaque = Math.max(0, this.temporisateurAttaque - delta);
        break;
      case 'inactif':
        this.inactif(delta, cibleSaine);
        break;
      case 'patrouille':
        this.patrouiller(delta, cibleSaine);
        break;
      case 'poursuite':
        this.poursuivre(delta, cibleSaine);
        break;
      case 'attaque':
        this.attaquer(delta, cibleSaine);
        break;
      case 'retour':
        this.retourner(delta, cibleSaine);
        break;
    }

    return this.construireSortie();
  }

  /** Force la transition vers l'état mort, irréversible. */
  public tuer(): void {
    this.etat = 'mort';
    this.cible = undefined;
    this.ciblePerdue = false;
    this.progressionTemporisation = 0;
  }

  private inactif(delta: number, cible: CiblePerçue | undefined): void {
    if (cible && estDansPortee(this.position, cible.position, this.profil.porteePerception)) {
      this.etat = 'poursuite';
      this.cible = cible;
      this.capCible = angleVers(this.position, cible.position);
      this.temporisateurPerte = this.profil.delaiPerteCible;
      return;
    }

    this.temporisateurPerception = Math.max(0, this.temporisateurPerception - delta);
    if (this.temporisateurPerception > EPSILON_TEMPS) {
      return;
    }

    this.etat = 'patrouille';
    this.capCible = angleVers(this.position, this.prochaineCiblePatrouille);
  }

  private patrouiller(delta: number, cible: CiblePerçue | undefined): void {
    const atteint = this.avancerVersCible(
      delta,
      this.prochaineCiblePatrouille,
      this.profil.vitessePatrouille,
    );

    if (atteint) {
      if (this.profil.routePatrouille && this.profil.routePatrouille.length > 0) {
        this.indexRoutePatrouille =
          (this.indexRoutePatrouille + 1) % this.profil.routePatrouille.length;
      }
      this.prochaineCiblePatrouille = choisirCiblePatrouille(
        this.aleatoire,
        this.profil.pointAncrage,
        this.profil.rayonPatrouille,
        this.limites,
        this.profil.routePatrouille,
        this.indexRoutePatrouille,
      );
      this.capCible = angleVers(this.position, this.prochaineCiblePatrouille);
    }

    if (cible && estDansPortee(this.position, cible.position, this.profil.porteePerception)) {
      this.cible = cible;
      this.etat = 'poursuite';
      this.capCible = angleVers(this.position, cible.position);
      this.temporisateurPerte = this.profil.delaiPerteCible;
    }
  }

  private poursuivre(delta: number, cible: CiblePerçue | undefined): void {
    this.temporisateurPerte = Math.max(0, this.temporisateurPerte - delta);
    const cibleOrigine = this.cible ?? cible;
    if (cibleSaineContinue(cible, cibleOrigine, this.profil)) {
      this.cible = cible;
      this.temporisateurPerte = this.profil.delaiPerteCible;
    } else if (this.temporisateurPerte <= 0) {
      this.etat = 'retour';
      this.capCible = angleVers(this.position, this.profil.pointAncrage);
      this.temporisateurRetour = this.profil.delaiRetour;
      this.ciblePerdue = true;
      return;
    }

    const cibleCourante = this.cible;
    if (!cibleCourante) {
      this.etat = 'retour';
      this.capCible = angleVers(this.position, this.profil.pointAncrage);
      this.temporisateurRetour = this.profil.delaiRetour;
      return;
    }

    if (estDansPortee(this.position, cibleCourante.position, this.profil.porteeAttaque)) {
      this.etat = 'attaque';
      this.temporisateurAttaque = this.profil.cadenceAttaque;
      this.capCible = angleVers(this.position, cibleCourante.position);
      return;
    }

    const distanceCible = distance(this.position, cibleCourante.position);
    if (distanceCible > this.profil.porteePoursuite + this.profil.rayonHysteresis) {
      this.etat = 'retour';
      this.capCible = angleVers(this.position, this.profil.pointAncrage);
      this.temporisateurRetour = this.profil.delaiRetour;
      this.ciblePerdue = true;
      return;
    }

    this.avancerVersCible(delta, cibleCourante.position, this.profil.vitessePoursuite);
  }

  private attaquer(delta: number, cible: CiblePerçue | undefined): void {
    const cibleCourante = this.cible;
    if (!cibleCourante) {
      this.etat = 'retour';
      this.capCible = angleVers(this.position, this.profil.pointAncrage);
      this.temporisateurRetour = this.profil.delaiRetour;
      return;
    }

    let cibleValide = false;
    if (cibleSaineContinue(cible, cibleCourante, this.profil)) {
      this.cible = cible;
      this.temporisateurPerte = this.profil.delaiPerteCible;
      cibleValide = true;
    } else {
      this.attaqueEnAttente = false;
      this.temporisateurPerte = Math.max(0, this.temporisateurPerte - delta);
      if (this.temporisateurPerte <= 0) {
        this.etat = 'retour';
        this.capCible = angleVers(this.position, this.profil.pointAncrage);
        this.temporisateurRetour = this.profil.delaiRetour;
        this.ciblePerdue = true;
        return;
      }
    }

    if (!cibleValide) {
      return;
    }

    const cibleActuelle = this.cible;
    if (!cibleActuelle) {
      this.etat = 'retour';
      this.capCible = angleVers(this.position, this.profil.pointAncrage);
      this.temporisateurRetour = this.profil.delaiRetour;
      return;
    }

    const distanceCourante = distance(this.position, cibleActuelle.position);
    if (distanceCourante > this.profil.porteePoursuite + this.profil.rayonHysteresis) {
      this.etat = 'retour';
      this.capCible = angleVers(this.position, this.profil.pointAncrage);
      this.temporisateurRetour = this.profil.delaiRetour;
      this.ciblePerdue = true;
      return;
    }

    if (distanceCourante > this.profil.porteeAttaque) {
      this.etat = 'poursuite';
      this.attaqueEnAttente = false;
      this.avancerVersCible(delta, cibleActuelle.position, this.profil.vitessePoursuite);
      return;
    }

    this.capCible = angleVers(this.position, cibleActuelle.position);
    this.tournerVersCible(delta);
    this.temporisateurAttaque = Math.max(0, this.temporisateurAttaque - delta);
    if (this.temporisateurAttaque <= 0) {
      this.attaqueEnAttente = true;
      this.temporisateurAttaque = Math.max(0.001, this.profil.cadenceAttaque);
    }
  }

  private retourner(delta: number, cible: CiblePerçue | undefined): void {
    if (cibleSaineContinue(cible, this.cible, this.profil)) {
      this.cible = cible;
      this.etat = 'poursuite';
      this.temporisateurPerte = this.profil.delaiPerteCible;
      return;
    }

    this.temporisateurRetour = Math.max(0, this.temporisateurRetour - delta);
    this.capCible = angleVers(this.position, this.profil.pointAncrage);
    this.avancerVersCible(delta, this.profil.pointAncrage, this.profil.vitesseRetour);

    const distanceAncrage = distance(this.position, this.profil.pointAncrage);
    if (distanceAncrage <= this.profil.porteeRetour) {
      this.etat = 'patrouille';
      this.indexRoutePatrouille = 0;
      this.prochaineCiblePatrouille = choisirCiblePatrouille(
        this.aleatoire,
        this.profil.pointAncrage,
        this.profil.rayonPatrouille,
        this.limites,
        this.profil.routePatrouille,
        this.indexRoutePatrouille,
      );
      this.capCible = angleVers(this.position, this.prochaineCiblePatrouille);
    }
  }

  private avancerVersCible(delta: number, cible: Coordonnees, vitesse: number): boolean {
    this.capCible = angleVers(this.position, cible);
    this.tournerVersCible(delta);
    const distanceCible = distance(this.position, cible);

    if (distanceCible <= 0.001) {
      return true;
    }

    const distanceMax = Math.max(0, vitesse) * delta;
    const distanceParcourue = Math.min(distanceMax, distanceCible);
    const directionX = (cible.x - this.position.x) / distanceCible;
    const directionZ = (cible.z - this.position.z) / distanceCible;
    this.position = bornerCoordonnees(
      {
        x: this.position.x + directionX * distanceParcourue,
        z: this.position.z + directionZ * distanceParcourue,
      },
      this.limites,
    );

    return distanceParcourue >= distanceCible - 0.001;
  }

  private tournerVersCible(delta: number): void {
    const ecart = angleLePlusCourt(this.capCible - this.cap);
    const vitesseAngulaire = 3.2;
    const variation =
      Math.min(Math.abs(ecart), Math.max(0, vitesseAngulaire) * delta) * Math.sign(ecart);
    this.cap = normaliserAngle(this.cap + variation);
  }

  private construireSortie(): SortieIaPirate {
    const progressionTemporisation = this.calculerProgression();
    this.progressionTemporisation = progressionTemporisation;
    const intentionDeplacement = this.construireIntentionDeplacement();
    const intentionAttaque = this.construireIntentionAttaque();
    const ciblePerdue = this.ciblePerdue;

    return {
      etat: this.etat,
      position: { ...this.position },
      cap: this.cap,
      intentionDeplacement,
      intentionAttaque,
      ciblePerdue,
      progressionTemporisation,
    };
  }

  private construireIntentionDeplacement(): IntentionDeplacement | undefined {
    if (this.etat !== 'patrouille' && this.etat !== 'poursuite' && this.etat !== 'retour') {
      return undefined;
    }

    const vitesse =
      this.etat === 'poursuite'
        ? this.profil.vitessePoursuite
        : this.etat === 'retour'
          ? this.profil.vitesseRetour
          : this.profil.vitessePatrouille;
    const direction = directionDepuisCap(this.cap);
    return {
      x: direction.x * vitesse,
      z: direction.z * vitesse,
      ligneDroite: true,
      vitesse,
    };
  }

  private construireIntentionAttaque(): IntentionAttaque | undefined {
    if (this.etat !== 'attaque' || !this.cible || !this.attaqueEnAttente) {
      return undefined;
    }

    this.attaqueEnAttente = false;
    const direction = directionDepuisCap(this.cap);
    const sequence = this.sequence;
    this.sequence += 1;
    return {
      identifiantSequence: sequence,
      cible: this.cible.id,
      portee: this.profil.porteeAttaque,
      direction,
    };
  }

  private calculerProgression(): number {
    if (this.etat === 'attaque' && this.temporisateurAttaque > 0) {
      return Math.min(1, 1 - this.temporisateurAttaque / Math.max(1, this.profil.cadenceAttaque));
    }
    if ((this.etat === 'retour' || this.etat === 'poursuite') && this.temporisateurRetour > 0) {
      return Math.min(1, 1 - this.temporisateurRetour / Math.max(1, this.profil.delaiRetour));
    }
    return 0;
  }
}

function deltaSain(deltaSecondes: number): number {
  if (!Number.isFinite(deltaSecondes)) {
    return 0;
  }
  return Math.max(0, deltaSecondes);
}

function normaliserCible(cible: CiblePerçue | undefined): CiblePerçue | undefined {
  if (!cible || !Number.isFinite(cible.position.x) || !Number.isFinite(cible.position.z)) {
    return undefined;
  }
  return { id: cible.id, position: { x: cible.position.x, z: cible.position.z } };
}

function cibleSaineContinue(
  perçue: CiblePerçue | undefined,
  précédente: CiblePerçue | undefined,
  profil: ProfilIaPirate,
): boolean {
  if (!perçue || !précédente) {
    return false;
  }
  if (perçue.id !== précédente.id) {
    return false;
  }
  return estDansPortee(précédente.position, perçue.position, profil.porteePerception);
}

function estDansPortee(origine: Coordonnees, cible: Coordonnees, portee: number): boolean {
  return distance(origine, cible) <= portee;
}

function distance(premier: Coordonnees, second: Coordonnees): number {
  return Math.hypot(premier.x - second.x, premier.z - second.z);
}

function angleVers(source: Coordonnees, cible: Coordonnees): number {
  return Math.atan2(cible.z - source.z, cible.x - source.x);
}

function directionDepuisCap(cap: number): VecteurDeplacement {
  return { x: Math.cos(cap), z: Math.sin(cap) };
}

function normaliserAngle(angle: number): number {
  const deuxPi = Math.PI * 2;
  return ((angle % deuxPi) + deuxPi) % deuxPi;
}

function angleLePlusCourt(angle: number): number {
  const deuxPi = Math.PI * 2;
  const normalise = ((angle % deuxPi) + deuxPi) % deuxPi;
  return normalise > Math.PI ? normalise - deuxPi : normalise;
}

function choisirCiblePatrouille(
  aleatoire: () => number,
  ancrage: Coordonnees,
  rayon: number,
  limites: LimitesZoneIaPirate,
  route: readonly Coordonnees[] | undefined = undefined,
  indexRoute = 0,
): Coordonnees {
  if (route && route.length > 0) {
    const point = route[Math.max(0, indexRoute) % route.length];
    if (point) {
      return bornerCoordonnees(point, limites);
    }
  }
  const cible = {
    x: ancrage.x + (aleatoire() * 2 - 1) * rayon,
    z: ancrage.z + (aleatoire() * 2 - 1) * rayon,
  };
  return bornerCoordonnees(cible, limites);
}

function bornerCoordonnees(coordonnees: Coordonnees, limites: LimitesZoneIaPirate): Coordonnees {
  return {
    x: bornerNombre(coordonnees.x, -limites.largeur / 2, limites.largeur / 2),
    z: bornerNombre(coordonnees.z, -limites.profondeur / 2, limites.profondeur / 2),
  };
}

function bornerNombre(valeur: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(valeur)) {
    return minimum;
  }
  return Math.max(minimum, Math.min(maximum, valeur));
}

function figerProfil(profil: ProfilIaPirate): ProfilIaPirate {
  return Object.freeze({ ...profil });
}

function figerLimites(limites: Partial<LimitesZoneIaPirate>): LimitesZoneIaPirate {
  return Object.freeze({
    largeur: limites.largeur ?? 220,
    profondeur: limites.profondeur ?? 220,
    rayonTerrestreMax: limites.rayonTerrestreMax ?? 18,
  });
}

export const PROFIL_TERRE: ProfilIaPirate = Object.freeze({
  milieu: 'terre',
  porteePerception: 16,
  porteeAttaque: 6,
  porteePoursuite: 20,
  porteeRetour: 2.5,
  cadenceAttaque: 1,
  delaiPerception: 0.5,
  delaiPerteCible: 1.2,
  delaiRetour: 0.4,
  vitessePatrouille: 1.8,
  vitessePoursuite: 3.6,
  vitesseRetour: 2.6,
  rayonHysteresis: 1.5,
  rayonPatrouille: 7,
  pointAncrage: { x: 0, z: 0 },
});

export const PROFIL_MER: ProfilIaPirate = Object.freeze({
  milieu: 'mer',
  porteePerception: 22,
  porteeAttaque: 8,
  porteePoursuite: 26,
  porteeRetour: 3,
  cadenceAttaque: 1.4,
  delaiPerception: 0.8,
  delaiPerteCible: 1.8,
  delaiRetour: 0.6,
  vitessePatrouille: 2.4,
  vitessePoursuite: 5,
  vitesseRetour: 3.2,
  rayonHysteresis: 2,
  rayonPatrouille: 9,
  pointAncrage: { x: 0, z: 0 },
});
