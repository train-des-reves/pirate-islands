import type { Point3D, ZonePeche } from '@pirate/coeur-jeu';
import {
  annulerPeche,
  avancerPeche,
  lancerPeche,
  pointDansZonePeche,
  releverPeche,
  type EtatPeche,
  type DescripteurMonde,
} from '@pirate/coeur-jeu';

import type { EtatActions } from './entrees';
import type { Vecteur3 } from './mouvement';

export type EtatVueCanne = 'rangee' | 'prete' | 'lancee' | 'morsure' | 'remontee';

export interface EtatCanne {
  readonly vue: EtatVueCanne;
  readonly sequence: number;
  readonly zoneId?: string;
  readonly peche: EtatPeche;
}

/** Présentation de la pêche injectée : le contrôleur ne manipule jamais le DOM. */
export interface InterfacePeche {
  readonly afficherInvite: (invite: string | null) => void;
  readonly afficherStatut: (statut: string) => void;
  readonly afficherResultat: (resultat: string) => void;
}

/**
 * Adaptateur autoritaire de pêche. En production le contrôleur passe par
 * `AdaptateurPecheCoeurJeu` (règles déterministes de #32) ; une fixture E2E
 * peut le remplacer pour piloter les états sans décider d'une prise locale.
 */
export interface AdaptateurPeche {
  lancer(etat: EtatPeche, zoneId: string, graine: string, sequence: number, temps: number): EtatPeche;
  avancer(etat: EtatPeche, temps: number): EtatPeche;
  relever(etat: EtatPeche, temps: number): EtatPeche;
  annuler(etat: EtatPeche, temps: number): EtatPeche;
}

export function construireAdaptateurPecheCoeurJeu(monde: DescripteurMonde): AdaptateurPeche {
  return {
    lancer: (etat, zoneId, graine, sequence, temps) =>
      lancerPeche(etat, monde, zoneId, graine, sequence, temps),
    avancer: avancerPeche,
    relever: releverPeche,
    annuler: annulerPeche,
  };
}

/**
 * Adaptateur neutre utilisé par le mode de production. Il ne décide jamais
 * qu'un poisson est pris : il ne fait qu'afficher la ligne lancée et la
 * remontée sans produire de morsure ni de résultat de prise. L'autorité de
 * pêche (morsure, prise, validation) revient au serveur dans une issue
 * ultérieure et est injectée via cet adaptateur.
 */
export const AdaptateurPecheNeutre: AdaptateurPeche = {
  lancer: (etat, zoneId, _graine, sequence, temps): EtatPeche => ({
    ...etat,
    phase: 'attente',
    zoneId,
    sequence,
    lanceAuMs: temps,
    tempsCourantMs: temps,
  }),
  avancer: (etat): EtatPeche => etat,
  relever: (etat, temps): EtatPeche => ({
    ...etat,
    phase: 'terminee',
    tempsCourantMs: temps,
  }),
  annuler: (etat, temps): EtatPeche => ({
    ...etat,
    phase: 'terminee',
    resultat: 'annulee',
    tempsCourantMs: temps,
  }),
};

export interface GestionnaireCanneOptions {
  readonly lireZone: () => ZonePeche | undefined;
  readonly lirePosition: () => Vecteur3;
  readonly lireHorodatage?: () => number;
  readonly graine: string;
  readonly interfacePeche: InterfacePeche;
  readonly adaptateur: AdaptateurPeche;
}

function nombreSain(valeur: number, repli = 0): number {
  return Number.isFinite(valeur) ? valeur : repli;
}

function vecteurSain(vecteur: Vecteur3): Point3D {
  return {
    x: nombreSain(vecteur.x),
    y: nombreSain(vecteur.y),
    z: nombreSain(vecteur.z),
  };
}

function dansZone(zone: ZonePeche | undefined, position: Vecteur3): boolean {
  if (!zone) {
    return false;
  }
  return pointDansZonePeche(zone, vecteurSain(position));
}

function etatRangee(zoneId: string | undefined): EtatCanne {
  return {
    vue: 'rangee',
    sequence: 0,
    ...(zoneId === undefined ? {} : { zoneId }),
    peche: {
      phase: 'inactive',
      sequence: 0,
      lanceAuMs: 0,
      tempsCourantMs: 0,
    },
  };
}

function libelleStatut(etat: EtatCanne): string {
  switch (etat.vue) {
    case 'rangee':
      return etat.zoneId === undefined ? 'Canne rangée' : 'Prêt à pêcher';
    case 'prete':
      return 'Canne prête — cliquez pour lancer';
    case 'lancee':
      return 'Ligne lancée — attendez une morsure';
    case 'morsure':
      return 'Morsure ! Cliquez pour remonter';
    case 'remontee':
      return etat.peche.resultat === 'prise' ? 'Poisson remonté' : 'Ligne remontée';
  }
}

/**
 * Contrôleur local du mode pêche. Il n'édite jamais la santé, le score ou un
 * inventaire et ne décide pas seul qu'un poisson est pris : il suit l'état
 * produit par l'adaptateur injecté et n'expose que la présentation.
 */
export class GestionnaireCanne {
  private readonly lireZone: () => ZonePeche | undefined;
  private readonly lirePosition: () => Vecteur3;
  private readonly lireHorodatage: () => number;
  private readonly graine: string;
  private readonly interfacePeche: InterfacePeche;
  private readonly adaptateur: AdaptateurPeche;
  private etat: EtatCanne;
  private tireurPrecedent = false;
  private interacteurPrecedent = false;

  public constructor(options: GestionnaireCanneOptions) {
    this.lireZone = options.lireZone;
    this.lirePosition = options.lirePosition;
    this.lireHorodatage =
      options.lireHorodatage ??
      (() => (typeof performance === 'undefined' ? Date.now() : performance.now()));
    this.graine = options.graine;
    this.interfacePeche = options.interfacePeche;
    this.adaptateur = options.adaptateur;
    this.etat = etatRangee(undefined);
  }

  public lireEtat(): EtatCanne {
    return this.etat;
  }

  public lireZoneProche(): ZonePeche | undefined {
    return this.lireZone();
  }

  /** Vrai si le mode pêche est actif : le pistolet doit alors être mis en retrait. */
  public estModeActif(): boolean {
    return this.etat.vue !== 'rangee';
  }

  /**
   * Consomme un instant d'actions sémantiques. `interagir` entre/sort du mode
   * près d'une zone, `tirer` lance puis relève. Retourne vrai quand l'action
   * `tirer` a été consommée par la pêche (pour garantir l'exclusivité).
   */
  public actualiser(
    actions: Pick<EtatActions, 'tirer' | 'interagir'>,
    horodatage = this.lireHorodatage(),
  ): boolean {
    const temps = nombreSain(horodatage, 0);
    const pressionTirer = actions.tirer && !this.tireurPrecedent;
    const pressionInteragir = actions.interagir && !this.interacteurPrecedent;
    this.tireurPrecedent = actions.tirer;
    this.interacteurPrecedent = actions.interagir;

    // Hors mode pêche, `tirer` n'est jamais consommé par la canne : il doit
    // atteindre exclusivement le système pistolet.
    if (this.etat.vue === 'rangee') {
      this.interfacePeche.afficherInvite(this.zoneValide() ? 'Commencer à pêcher' : null);
      if (pressionInteragir && this.zoneValide()) {
        this.entrerMode();
        return false;
      }
      return false;
    }

    // En mode pêche, toute pression sur `tirer` est consommée par la canne :
    // aucune intention de pistolet ne doit être émise pendant ce mode.
    if (pressionTirer) {
      this.actualiserTirer(temps);
      return true;
    }

    // L'invite n'apparaît qu'à portée d'une zone, et uniquement quand la canne
    // est rangée (le statut prend le relais dès que le mode pêche est actif).
    if (this.etat.vue === 'prete') {
      this.interfacePeche.afficherInvite(null);
    }

    if (pressionInteragir) {
      this.gererInteragir(temps);
    }

    const vue = this.etat.vue;
    if (vue === 'lancee' || vue === 'morsure') {
      this.avancerAttente(temps);
    }

    return false;
  }

  private actualiserTirer(temps: number): void {
    const vue = this.etat.vue;
    if (vue === 'prete') {
      this.lancer(temps);
      return;
    }
    if (vue === 'lancee' || vue === 'morsure') {
      this.relever(temps);
    }
  }

  private entrerMode(): void {
    const zone = this.zoneValide();
    if (!zone) {
      return;
    }
    this.etat = {
      vue: 'prete',
      sequence: 0,
      zoneId: zone.id,
      peche: etatRangee(undefined).peche,
    };
    this.interfacePeche.afficherInvite('Commencer à pêcher');
    this.interfacePeche.afficherStatut(libelleStatut(this.etat));
  }

  public lancer(temps?: number): boolean {
    if (this.etat.vue !== 'prete') {
      return false;
    }
    const zone = this.lireZoneProche();
    const maintenant = nombreSain(temps ?? this.lireHorodatage(), 0);
    const prochaineSequence = this.etat.sequence + 1;
    const suit = this.adaptateur.lancer(
      this.etat.peche,
      zone?.id ?? '',
      this.graine,
      prochaineSequence,
      maintenant,
    );
    if (suit.phase !== 'attente') {
      this.etat = { ...this.etat, vue: 'remontee', peche: suit };
      this.interfacePeche.afficherInvite(null);
      this.interfacePeche.afficherStatut('Rien ne mord ici');
      return false;
    }
    this.etat = {
      vue: 'lancee',
      sequence: prochaineSequence,
      ...(zone?.id === undefined ? {} : { zoneId: zone.id }),
      peche: suit,
    };
    this.interfacePeche.afficherInvite(null);
    this.interfacePeche.afficherStatut(libelleStatut(this.etat));
    return true;
  }

  public relever(temps?: number): void {
    if (this.etat.vue !== 'lancee' && this.etat.vue !== 'morsure') {
      return;
    }
    const maintenant = nombreSain(temps ?? this.lireHorodatage(), 0);
    const fini = this.adaptateur.relever(this.etat.peche, maintenant);
    this.etat = { ...this.etat, vue: 'remontee', peche: fini };
    this.interfacePeche.afficherResultat(fini.resultat ?? '');
    this.interfacePeche.afficherStatut(libelleStatut(this.etat));
  }

  public annuler(temps?: number): void {
    if (this.etat.vue !== 'lancee' && this.etat.vue !== 'morsure') {
      return;
    }
    const maintenant = nombreSain(temps ?? this.lireHorodatage(), 0);
    const fini = this.adaptateur.annuler(this.etat.peche, maintenant);
    this.etat = { ...this.etat, vue: 'remontee', peche: fini };
    this.interfacePeche.afficherResultat('annulee');
    this.interfacePeche.afficherStatut('Pêche annulée');
  }

  /**
   * Applique un état de pêche poussé par une autorité externe (serveur dans une
   * issue ultérieure). Un état obsolète (séquence antérieure, ou même séquence
   * avec un temps antérieur) est ignoré sans régression ni erreur.
   */
  public recevoirEtatServeur(etat: EtatPeche): void {
    const courant = this.etat.peche;
    const obsolète =
      etat.sequence < courant.sequence ||
      (etat.sequence === courant.sequence && etat.tempsCourantMs < courant.tempsCourantMs);
    if (obsolète) {
      return;
    }
    if (etat.phase === 'morsure' && this.etat.vue !== 'morsure') {
      this.etat = { ...this.etat, vue: 'morsure', peche: etat };
      this.interfacePeche.afficherStatut(libelleStatut(this.etat));
      return;
    }
    if (etat.phase === 'terminee') {
      this.etat = { ...this.etat, vue: 'remontee', peche: etat };
      this.interfacePeche.afficherStatut(libelleStatut(this.etat));
      return;
    }
    this.etat = { ...this.etat, peche: etat };
  }

  public reinitialiser(): void {
    this.etat = etatRangee(undefined);
    this.tireurPrecedent = false;
    this.interacteurPrecedent = false;
    this.interfacePeche.afficherInvite(null);
    this.interfacePeche.afficherStatut('Canne rangée');
    this.interfacePeche.afficherResultat('');
  }

  private zoneValide(): ZonePeche | undefined {
    const zone = this.lireZoneProche();
    return zone && dansZone(zone, this.lirePosition()) ? zone : undefined;
  }

  private gererInteragir(temps: number): void {
    if (this.etat.vue === 'rangee') {
      const zone = this.zoneValide();
      if (zone) {
        this.etat = {
          vue: 'prete',
          sequence: 0,
          zoneId: zone.id,
          peche: etatRangee(undefined).peche,
        };
        this.interfacePeche.afficherInvite('Commencer à pêcher');
        this.interfacePeche.afficherStatut(libelleStatut(this.etat));
      }
      return;
    }

    // Sortie du mode : annule le geste visuel le cas échéant.
    if (this.etat.vue === 'lancee' || this.etat.vue === 'morsure') {
      this.annuler(temps);
    }
    this.etat = etatRangee(undefined);
    this.interfacePeche.afficherInvite(null);
    this.interfacePeche.afficherStatut('Canne rangée');
  }

  private avancerAttente(temps: number): void {
    if (this.etat.vue !== 'lancee' && this.etat.vue !== 'morsure') {
      return;
    }
    const suit = this.adaptateur.avancer(this.etat.peche, temps);
    // État serveur en retard ou obsolète : on ignore pour ne pas régresser.
    // Un retour est obsolète s'il porte une séquence plus ancienne, ou la même
    // séquence avec un temps courant antérieur.
    if (
      suit.sequence < this.etat.peche.sequence ||
      (suit.sequence === this.etat.peche.sequence &&
        suit.tempsCourantMs < this.etat.peche.tempsCourantMs)
    ) {
      return;
    }
    if (suit.phase === 'morsure' && this.etat.vue !== 'morsure') {
      this.etat = { ...this.etat, vue: 'morsure', peche: suit };
      this.interfacePeche.afficherStatut(libelleStatut(this.etat));
      return;
    }
    if (suit.phase === 'terminee') {
      this.etat = { ...this.etat, vue: 'remontee', peche: suit };
      this.interfacePeche.afficherStatut(libelleStatut(this.etat));
      return;
    }
    this.etat = { ...this.etat, peche: suit };
  }
}
