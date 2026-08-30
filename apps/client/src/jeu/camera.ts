import type { FreeCamera } from 'babylonjs';

export const SENSIBILITE_REGARD_PAR_DEFAUT = 0.0025;
export const LIMITE_TANGAGE = Math.PI / 2 - 0.01;

export interface EtatRegard {
  readonly lacet: number;
  readonly tangage: number;
}

export interface ControleCameraOptions {
  readonly sensibilite?: number;
  readonly inversionVerticale?: () => boolean;
  readonly lacetInitial?: number;
  readonly tangageInitial?: number;
}

export function bornerTangage(tangage: number, limite = LIMITE_TANGAGE): number {
  if (!Number.isFinite(tangage)) {
    return 0;
  }

  const limiteSaine = Number.isFinite(limite)
    ? Math.max(0, Math.min(Math.abs(limite), Math.PI / 2))
    : LIMITE_TANGAGE;
  return Math.max(-limiteSaine, Math.min(limiteSaine, tangage));
}

export const limiterTangage = bornerTangage;

export function appliquerRegard(
  etat: EtatRegard,
  deltaX: number,
  deltaY: number,
  inversionVerticale: boolean,
  sensibilite = SENSIBILITE_REGARD_PAR_DEFAUT,
): EtatRegard {
  const signeVertical = inversionVerticale ? 1 : -1;
  const deltaSainX = Number.isFinite(deltaX) ? deltaX : 0;
  const deltaSainY = Number.isFinite(deltaY) ? deltaY : 0;
  const sensibiliteSaine = Number.isFinite(sensibilite)
    ? sensibilite
    : SENSIBILITE_REGARD_PAR_DEFAUT;

  return {
    lacet: etat.lacet + deltaSainX * sensibiliteSaine,
    tangage: bornerTangage(etat.tangage + signeVertical * deltaSainY * sensibiliteSaine),
  };
}

/** Contrôleur de caméra sans contrôle clavier ou souris Babylon intégré. */
export class CameraPremierePersonne {
  private readonly camera: FreeCamera;
  private readonly sensibilite: number;
  private readonly lireInversion: () => boolean;
  private readonly etatInitial: EtatRegard;
  private etat: EtatRegard;

  public constructor(camera: FreeCamera, options: ControleCameraOptions = {}) {
    this.camera = camera;
    this.sensibilite = options.sensibilite ?? SENSIBILITE_REGARD_PAR_DEFAUT;
    this.lireInversion = options.inversionVerticale ?? (() => false);
    this.etatInitial = {
      lacet: options.lacetInitial ?? camera.rotation.y,
      tangage: bornerTangage(options.tangageInitial ?? camera.rotation.x),
    };
    this.etat = { ...this.etatInitial };
    this.appliquerRotation();
  }

  public regarder(deltaX: number, deltaY: number): void {
    this.etat = appliquerRegard(this.etat, deltaX, deltaY, this.lireInversion(), this.sensibilite);
    this.appliquerRotation();
  }

  public obtenirEtat(): EtatRegard {
    return { ...this.etat };
  }

  public reinitialiser(): void {
    this.etat = { ...this.etatInitial };
    this.appliquerRotation();
  }

  public synchroniserPosition(position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }): void {
    this.camera.position.copyFromFloats(position.x, position.y, position.z);
  }

  private appliquerRotation(): void {
    this.camera.rotation.x = this.etat.tangage;
    this.camera.rotation.y = this.etat.lacet;
    this.camera.rotation.z = 0;
  }
}
