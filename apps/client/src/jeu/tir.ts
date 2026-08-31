import type { EtatRegard } from './camera';
import type { Vecteur3 } from './mouvement';

export const CADENCE_TIR_MS = 150;
export const DUREE_RECUPERATION_TIR_MS = 180;
export const DUREE_ECLAIR_BOUCHE_MS = 70;
export const AMPLITUDE_RECUL_TIR = 0.09;

export interface ViseeTir {
  readonly origine: Vecteur3;
  readonly direction: Vecteur3;
}

export interface IntentionTir {
  readonly sequence: number;
  readonly origine: Vecteur3;
  readonly direction: Vecteur3;
  /** Horodatage client en millisecondes. */
  readonly horodatageClient: number;
}

export interface EmetteurIntentionTir {
  émettre(intention: IntentionTir): void;
}

export type ReceveurIntentionTir = (intention: IntentionTir) => void;

export interface GestionnaireTirOptions {
  readonly obtenirVisee: () => ViseeTir;
  readonly emetteur: EmetteurIntentionTir;
  readonly cadenceMs?: number;
  readonly lireHorodatage?: () => number;
}

function nombreSain(valeur: number, repli = 0): number {
  if (!Number.isFinite(valeur)) {
    return repli;
  }

  return valeur === 0 ? 0 : valeur;
}

function vecteurSain(vecteur: Vecteur3): Vecteur3 {
  return {
    x: nombreSain(vecteur.x),
    y: nombreSain(vecteur.y),
    z: nombreSain(vecteur.z),
  };
}

export function normaliserDirection(
  direction: Vecteur3,
  repli: Vecteur3 = { x: 0, y: 0, z: 1 },
): Vecteur3 {
  const directionSaine = vecteurSain(direction);
  const longueur = Math.hypot(directionSaine.x, directionSaine.y, directionSaine.z);
  if (longueur > Number.EPSILON) {
    return {
      x: directionSaine.x / longueur,
      y: directionSaine.y / longueur,
      z: directionSaine.z / longueur,
    };
  }

  const repliSain = vecteurSain(repli);
  const longueurRepli = Math.hypot(repliSain.x, repliSain.y, repliSain.z);
  if (longueurRepli <= Number.EPSILON) {
    return { x: 0, y: 0, z: 1 };
  }

  return {
    x: repliSain.x / longueurRepli,
    y: repliSain.y / longueurRepli,
    z: repliSain.z / longueurRepli,
  };
}

/** Calcule la direction de visée dans le même repère que la caméra. */
export function calculerDirectionDepuisRegard(
  regard: Pick<EtatRegard, 'lacet' | 'tangage'>,
): Vecteur3 {
  const lacet = nombreSain(regard.lacet);
  const tangage = nombreSain(regard.tangage);
  const cosinusTangage = Math.cos(tangage);

  return normaliserDirection({
    x: Math.sin(lacet) * cosinusTangage,
    y: -Math.sin(tangage),
    z: Math.cos(lacet) * cosinusTangage,
  });
}

export function calculerReculTir(
  maintenant: number,
  dernierTir: number | undefined,
  dureeMs = DUREE_RECUPERATION_TIR_MS,
): number {
  if (dernierTir === undefined) {
    return 0;
  }

  const duréeSaine = Math.max(1, nombreSain(dureeMs, DUREE_RECUPERATION_TIR_MS));
  const delta = Math.max(0, nombreSain(maintenant) - dernierTir);
  return Math.min(1, Math.max(0, 1 - delta / duréeSaine));
}

export function eclairBoucheVisible(
  maintenant: number,
  dernierTir: number | undefined,
  dureeMs = DUREE_ECLAIR_BOUCHE_MS,
): boolean {
  if (dernierTir === undefined) {
    return false;
  }

  return (
    Math.max(0, nombreSain(maintenant) - dernierTir) <
    Math.max(0, nombreSain(dureeMs, DUREE_ECLAIR_BOUCHE_MS))
  );
}

export class GestionnaireTirLocal {
  private readonly obtenirVisee: () => ViseeTir;
  private readonly emetteur: EmetteurIntentionTir;
  private readonly cadenceMs: number;
  private readonly lireHorodatage: () => number;
  private sequence = 1;
  private dernierTir: number | undefined;
  private derniereIntention: IntentionTir | undefined;
  private actif = false;

  public constructor(options: GestionnaireTirOptions) {
    this.obtenirVisee = options.obtenirVisee;
    this.emetteur = options.emetteur;
    this.cadenceMs = Math.max(1, nombreSain(options.cadenceMs ?? CADENCE_TIR_MS, CADENCE_TIR_MS));
    this.lireHorodatage =
      options.lireHorodatage ??
      (() => (typeof performance === 'undefined' ? Date.now() : performance.now()));
  }

  /** Consomme l'état sémantique tirer, une fois par image. */
  public actualiser(tirer: boolean, horodatageClient = this.lireHorodatage()): void {
    if (!tirer) {
      this.actif = false;
      return;
    }

    const maintenant = Math.max(0, nombreSain(horodatageClient, this.lireHorodatage()));
    const cadenceRespectee =
      this.dernierTir === undefined || maintenant - this.dernierTir >= this.cadenceMs;
    this.actif = true;
    if (!cadenceRespectee) {
      return;
    }

    const visee = this.obtenirVisee();
    const intention: IntentionTir = {
      sequence: this.sequence,
      origine: vecteurSain(visee.origine),
      direction: normaliserDirection(visee.direction),
      horodatageClient: maintenant,
    };
    this.sequence += 1;
    this.dernierTir = maintenant;
    this.derniereIntention = intention;
    this.emetteur.émettre(intention);
  }

  public lireCompteur(): number {
    return this.sequence - 1;
  }

  public lireDerniereIntention(): IntentionTir | undefined {
    return this.derniereIntention;
  }

  public lireDernierTir(): number | undefined {
    return this.dernierTir;
  }

  public estActif(): boolean {
    return this.actif;
  }

  public reinitialiser(): void {
    this.sequence = 1;
    this.dernierTir = undefined;
    this.derniereIntention = undefined;
    this.actif = false;
  }
}
