export const ACTIONS_JEU = [
  'avancer',
  'reculer',
  'gauche',
  'droite',
  'interagir',
  'tirer',
  'pause',
] as const;

export type ActionJeu = (typeof ACTIONS_JEU)[number];

/**
 * Liaisons produit par défaut. Elles sont volontairement exprimées en codes
 * sémantiques du navigateur uniquement dans cette frontière d'entrée.
 */
export const LIAISONS_PAR_DEFAUT: Readonly<Record<ActionJeu, readonly string[]>> = {
  avancer: ['KeyZ', 'KeyW'],
  reculer: ['KeyS'],
  gauche: ['KeyQ', 'KeyA'],
  droite: ['KeyD'],
  interagir: ['KeyE'],
  tirer: ['Mouse0'],
  pause: ['Escape'],
};

export const TOUCHES_PAR_DEFAUT = LIAISONS_PAR_DEFAUT;

export interface EtatActions {
  readonly avancer: boolean;
  readonly reculer: boolean;
  readonly gauche: boolean;
  readonly droite: boolean;
  readonly interagir: boolean;
  readonly tirer: boolean;
  readonly pause: boolean;
  readonly regardX: number;
  readonly regardY: number;
  readonly pointeurVerrouille: boolean;
}

export interface TransitionsActions {
  readonly appuyees: readonly ActionJeu[];
  readonly relachees: readonly ActionJeu[];
}

export function creerEtatActions(): EtatActions {
  return {
    avancer: false,
    reculer: false,
    gauche: false,
    droite: false,
    interagir: false,
    tirer: false,
    pause: false,
    regardX: 0,
    regardY: 0,
    pointeurVerrouille: false,
  };
}

export interface CibleEvenements {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface DocumentPointeur extends CibleEvenements {
  readonly hidden?: boolean;
  readonly visibilityState?: string;
  readonly pointerLockElement?: object | null;
  exitPointerLock?: () => void;
}

export interface ElementVerrouillage {
  requestPointerLock?: () => void | Promise<void>;
}

export interface GestionnaireEntreesOptions {
  readonly cible?: CibleEvenements;
  readonly document?: DocumentPointeur;
  readonly elementVerrouillage?: ElementVerrouillage;
  readonly liaisons?: Readonly<Partial<Record<ActionJeu, readonly string[]>>>;
  readonly onPause?: () => void;
  readonly onChangementVerrouillage?: (verrouille: boolean) => void;
}

/**
 * Retourne vrai pour un élément qui doit conserver la saisie clavier ou
 * pointeur dans l'interface. La vérification accepte aussi les enfants d'un
 * contrôle grâce à `closest`, ce qui évite de capturer un bouton contenant une
 * icône ou un libellé.
 */
export function estControleDom(cible: EventTarget | null): boolean {
  if (cible === null || typeof cible !== 'object') {
    return false;
  }

  const element = cible as {
    readonly tagName?: unknown;
    readonly isContentEditable?: unknown;
    closest?: (selecteur: string) => unknown;
  };

  if (element.isContentEditable === true) {
    return true;
  }

  if (typeof element.tagName === 'string') {
    const balise = element.tagName.toUpperCase();
    if (balise === 'INPUT' || balise === 'TEXTAREA' || balise === 'SELECT' || balise === 'BUTTON') {
      return true;
    }
  }

  if (typeof element.closest === 'function') {
    return Boolean(
      element.closest('input, textarea, select, button, [contenteditable], [role="textbox"]'),
    );
  }

  return false;
}

function creerSource(type: 'touche' | 'souris', valeur: string | number): string {
  return `${type}:${valeur}`;
}

/**
 * Traduit les événements DOM en actions de jeu. Le reste du client ne voit
 * jamais les touches, boutons ou événements bruts : il lit uniquement un état
 * d'actions par image.
 */
export class GestionnaireEntrees {
  private readonly cible: CibleEvenements;
  private readonly document: DocumentPointeur;
  private readonly elementVerrouillage: ElementVerrouillage | undefined;
  private readonly actionParCode = new Map<string, ActionJeu>();
  private readonly actionParBouton = new Map<number, ActionJeu>();
  private readonly sourcesActives = new Map<string, ActionJeu>();
  private readonly actionsActives = new Set<ActionJeu>();
  private readonly actionsAppuyees = new Set<ActionJeu>();
  private readonly actionsRelachees = new Set<ActionJeu>();
  private readonly onPause: (() => void) | undefined;
  private readonly onChangementVerrouillage: ((verrouille: boolean) => void) | undefined;
  private regardX = 0;
  private regardY = 0;
  private pauseDemandee = false;
  private pointeurVerrouille = false;
  private attache = false;

  private readonly surToucheEnfoncee = (evenement: Event): void => {
    const touche = evenement as KeyboardEvent;
    const source = creerSource('touche', touche.code);
    const action = this.actionParCode.get(touche.code);

    if (
      action === undefined ||
      (estControleDom(touche.target) && !this.sourcesActives.has(source))
    ) {
      return;
    }

    if (this.sourcesActives.has(source)) {
      return;
    }

    touche.preventDefault();
    this.sourcesActives.set(source, action);
    this.actionsAppuyees.add(action);

    if (action === 'pause') {
      this.pauseDemandee = true;
      this.libererPointeur();
      this.onPause?.();
      return;
    }

    this.actionsActives.add(action);
  };

  private readonly surToucheRelachee = (evenement: Event): void => {
    const touche = evenement as KeyboardEvent;
    const source = creerSource('touche', touche.code);
    const action = this.sourcesActives.get(source);

    if (action === undefined) {
      return;
    }

    this.sourcesActives.delete(source);
    this.actionsRelachees.add(action);
    if (action !== 'pause' && !this.sourceActionEncoreActive(action)) {
      this.actionsActives.delete(action);
    }
  };

  private readonly surSourisEnfoncee = (evenement: Event): void => {
    const souris = evenement as MouseEvent;
    if (estControleDom(souris.target)) {
      return;
    }

    if (souris.button === 0) {
      this.demanderVerrouillage();
    }

    const action = this.actionParBouton.get(souris.button);
    if (action === undefined) {
      return;
    }

    const source = creerSource('souris', souris.button);
    if (this.sourcesActives.has(source)) {
      return;
    }

    souris.preventDefault();
    this.sourcesActives.set(source, action);
    this.actionsAppuyees.add(action);
    this.actionsActives.add(action);
  };

  private readonly surSourisRelachee = (evenement: Event): void => {
    const souris = evenement as MouseEvent;
    const source = creerSource('souris', souris.button);
    const action = this.sourcesActives.get(source);
    if (action === undefined) {
      return;
    }

    this.sourcesActives.delete(source);
    this.actionsRelachees.add(action);
    if (!this.sourceActionEncoreActive(action)) {
      this.actionsActives.delete(action);
    }
  };

  private readonly surMouvementSouris = (evenement: Event): void => {
    if (!this.pointeurVerrouille) {
      return;
    }

    const souris = evenement as MouseEvent;
    this.regardX += Number.isFinite(souris.movementX) ? souris.movementX : 0;
    this.regardY += Number.isFinite(souris.movementY) ? souris.movementY : 0;
  };

  private readonly surChangementVerrouillage = (): void => {
    const verrouille =
      this.elementVerrouillage !== undefined &&
      this.document.pointerLockElement === this.elementVerrouillage;
    this.definirVerrouillage(verrouille);
  };

  private readonly surErreurVerrouillage = (): void => {
    this.definirVerrouillage(false);
  };

  private readonly surPerteFocus = (): void => {
    this.reinitialiserEtat();
  };

  private readonly surVisibilite = (): void => {
    if (this.document.hidden === true || this.document.visibilityState === 'hidden') {
      this.reinitialiserEtat();
    }
  };

  public constructor(options: GestionnaireEntreesOptions = {}) {
    this.cible = options.cible ?? window;
    this.document = options.document ?? window.document;
    this.elementVerrouillage = options.elementVerrouillage;
    this.onPause = options.onPause;
    this.onChangementVerrouillage = options.onChangementVerrouillage;

    this.mettreAJourLiaisons(options.liaisons ?? LIAISONS_PAR_DEFAUT);
  }

  /**
   * Remplace les liaisons actives après validation par l'interface des
   * réglages. Le gameplay conserve ainsi le même contrat d'actions sémantiques.
   */
  public mettreAJourLiaisons(
    liaisons: Readonly<Partial<Record<ActionJeu, readonly string[]>>>,
  ): void {
    this.actionParCode.clear();
    this.actionParBouton.clear();

    for (const action of ACTIONS_JEU) {
      for (const code of liaisons[action] ?? []) {
        if (code.startsWith('Mouse')) {
          const bouton = Number(code.slice('Mouse'.length));
          if (Number.isInteger(bouton) && bouton >= 0) {
            this.actionParBouton.set(bouton, action);
          }
        } else {
          this.actionParCode.set(code, action);
        }
      }
    }

    this.reinitialiserEtat();
  }

  public attacher(): void {
    if (this.attache) {
      return;
    }

    this.attache = true;
    this.cible.addEventListener('keydown', this.surToucheEnfoncee);
    this.cible.addEventListener('keyup', this.surToucheRelachee);
    this.cible.addEventListener('mousedown', this.surSourisEnfoncee);
    this.cible.addEventListener('mouseup', this.surSourisRelachee);
    this.cible.addEventListener('mousemove', this.surMouvementSouris);
    this.cible.addEventListener('blur', this.surPerteFocus);
    this.document.addEventListener('visibilitychange', this.surVisibilite);
    this.document.addEventListener('pointerlockchange', this.surChangementVerrouillage);
    this.document.addEventListener('pointerlockerror', this.surErreurVerrouillage);
  }

  public detacher(): void {
    if (!this.attache) {
      return;
    }

    this.attache = false;
    this.cible.removeEventListener('keydown', this.surToucheEnfoncee);
    this.cible.removeEventListener('keyup', this.surToucheRelachee);
    this.cible.removeEventListener('mousedown', this.surSourisEnfoncee);
    this.cible.removeEventListener('mouseup', this.surSourisRelachee);
    this.cible.removeEventListener('mousemove', this.surMouvementSouris);
    this.cible.removeEventListener('blur', this.surPerteFocus);
    this.document.removeEventListener('visibilitychange', this.surVisibilite);
    this.document.removeEventListener('pointerlockchange', this.surChangementVerrouillage);
    this.document.removeEventListener('pointerlockerror', this.surErreurVerrouillage);
    this.reinitialiserEtat();
  }

  public lireEtat(): EtatActions {
    const etat: EtatActions = {
      avancer: this.actionsActives.has('avancer'),
      reculer: this.actionsActives.has('reculer'),
      gauche: this.actionsActives.has('gauche'),
      droite: this.actionsActives.has('droite'),
      interagir: this.actionsActives.has('interagir'),
      tirer: this.actionsActives.has('tirer'),
      pause: this.pauseDemandee,
      regardX: this.regardX,
      regardY: this.regardY,
      pointeurVerrouille: this.pointeurVerrouille,
    };

    this.regardX = 0;
    this.regardY = 0;
    this.pauseDemandee = false;
    return etat;
  }

  public lireTransitions(): TransitionsActions {
    const transitions: TransitionsActions = {
      appuyees: [...this.actionsAppuyees],
      relachees: [...this.actionsRelachees],
    };
    this.actionsAppuyees.clear();
    this.actionsRelachees.clear();
    return transitions;
  }

  /**
   * Simule le résultat du verrouillage uniquement pour le harnais E2E. Le
   * gameplay normal passe par l'événement `pointerlockchange` du navigateur.
   */
  public simulerVerrouillage(verrouille: boolean): void {
    this.definirVerrouillage(verrouille);
  }

  public estPointeurVerrouille(): boolean {
    return this.pointeurVerrouille;
  }

  public reinitialiserEtat(): void {
    if (this.pointeurVerrouille) {
      try {
        this.document.exitPointerLock?.();
      } catch {
        // Le navigateur peut refuser une libération déjà effectuée pendant
        // une perte de visibilité; l'état local doit tout de même être sûr.
      }
    }
    this.sourcesActives.clear();
    this.actionsActives.clear();
    this.actionsAppuyees.clear();
    this.actionsRelachees.clear();
    this.regardX = 0;
    this.regardY = 0;
    this.pauseDemandee = false;
    this.definirVerrouillage(false);
  }

  private sourceActionEncoreActive(action: ActionJeu): boolean {
    for (const actionSource of this.sourcesActives.values()) {
      if (actionSource === action) {
        return true;
      }
    }
    return false;
  }

  private demanderVerrouillage(): void {
    const demander = this.elementVerrouillage?.requestPointerLock;
    if (demander === undefined) {
      return;
    }

    try {
      void Promise.resolve(demander.call(this.elementVerrouillage)).catch(() => {
        this.definirVerrouillage(false);
      });
    } catch {
      this.definirVerrouillage(false);
    }
  }

  private libererPointeur(): void {
    this.document.exitPointerLock?.();
    this.definirVerrouillage(false);
  }

  private definirVerrouillage(verrouille: boolean): void {
    if (this.pointeurVerrouille === verrouille) {
      return;
    }

    this.pointeurVerrouille = verrouille;
    this.onChangementVerrouillage?.(verrouille);
  }
}
