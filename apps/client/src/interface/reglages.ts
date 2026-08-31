import { ACTIONS_JEU, LIAISONS_PAR_DEFAUT, type ActionJeu } from '../jeu/entrees';

export const NOM_COOKIE_REGLAGES = 'pirate_islands_settings';
export const VERSION_REGLAGES = 1 as const;
export const DUREE_COOKIE_REGLAGES_SECONDES = 365 * 24 * 60 * 60;
export const TAILLE_MAX_COOKIE_REGLAGES = 2_048;

const CODES_SOURIS_RECONNUS = /^Mouse[0-4]$/;
const CODES_CLAVIER_RECONNUS =
  /^(?:Key[A-Z]|Digit[0-9]|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal|Comma)|Arrow(?:Up|Down|Left|Right)|Space|Enter|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Tab|CapsLock|NumLock|ScrollLock|PrintScreen|ContextMenu|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Minus|Equal|Backquote|IntlBackslash|IntlRo|IntlYen|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right)|F(?:[1-9]|1[0-2]))$/;

const CODES_RESERVES = new Set([
  'Tab',
  'MetaLeft',
  'MetaRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'PrintScreen',
  'ContextMenu',
  'BrowserBack',
  'BrowserForward',
  'BrowserRefresh',
  'BrowserStop',
  'BrowserSearch',
  'BrowserFavorites',
  'BrowserHome',
  'LaunchMail',
  'LaunchApp1',
  'LaunchApp2',
  'Unidentified',
  'Dead',
  'Compose',
]);

export type LiaisonsReglages = { readonly [Action in ActionJeu]: readonly string[] };

export interface ReglagesJeu {
  readonly inversionVerticale: boolean;
  readonly liaisons: LiaisonsReglages;
}

export type TypeErreurReglages = 'structure' | 'touche-invalide' | 'touche-reservee' | 'doublon';

export interface ErreurReglages {
  readonly type: TypeErreurReglages;
  readonly action?: ActionJeu;
  readonly autreAction?: ActionJeu;
  readonly message: string;
}

export interface ValidationReglages {
  readonly valide: boolean;
  readonly erreurs: readonly ErreurReglages[];
}

export interface ValidationLiaison {
  readonly valide: boolean;
  readonly erreur?: ErreurReglages;
}

export interface EtatReglages {
  readonly applique: ReglagesJeu;
  readonly brouillon: ReglagesJeu;
  readonly ouvert: boolean;
  readonly message: string;
}

export interface ResultatApplicationReglages {
  readonly applique: boolean;
  readonly etat: EtatReglages;
  readonly erreurs: readonly ErreurReglages[];
}

interface ObjetCookieReglages {
  readonly v: unknown;
  readonly inversionVerticale: unknown;
  readonly liaisons: unknown;
}

const NOMS_ACTIONS = {
  avancer: 'Avancer',
  reculer: 'Reculer',
  gauche: 'Gauche',
  droite: 'Droite',
  interagir: 'Interagir',
  tirer: 'Tirer',
  pause: 'Pause',
} as const satisfies Record<ActionJeu, string>;

function creerLiaisonsParDefaut(): LiaisonsReglages {
  const liaisons = {} as Record<ActionJeu, readonly string[]>;
  for (const action of ACTIONS_JEU) {
    liaisons[action] = [...LIAISONS_PAR_DEFAUT[action]];
  }
  return liaisons;
}

export const REGLAGES_PAR_DEFAUT: ReglagesJeu = Object.freeze({
  inversionVerticale: false,
  liaisons: Object.freeze(creerLiaisonsParDefaut()),
});

function clonerReglages(reglages: ReglagesJeu): ReglagesJeu {
  const liaisons = {} as Record<ActionJeu, readonly string[]>;
  for (const action of ACTIONS_JEU) {
    liaisons[action] = [...reglages.liaisons[action]];
  }
  return {
    inversionVerticale: reglages.inversionVerticale,
    liaisons,
  };
}

function creerErreur(
  type: TypeErreurReglages,
  message: string,
  action?: ActionJeu,
  autreAction?: ActionJeu,
): ErreurReglages {
  const erreur: ErreurReglages = { type, message };
  if (action === undefined) {
    return erreur;
  }
  if (autreAction === undefined) {
    return { ...erreur, action };
  }
  return { ...erreur, action, autreAction };
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null;
}

function estCodeReconnu(code: string): boolean {
  return CODES_CLAVIER_RECONNUS.test(code) || CODES_SOURIS_RECONNUS.test(code);
}

function estCodeReserve(code: string, action: ActionJeu): boolean {
  return (code === 'Escape' && action !== 'pause') || CODES_RESERVES.has(code);
}

function trouverDoublon(
  action: ActionJeu,
  code: string,
  liaisons: Partial<Record<ActionJeu, readonly string[]>>,
): ActionJeu | undefined {
  for (const autreAction of ACTIONS_JEU) {
    if (autreAction === action) {
      continue;
    }
    if ((liaisons[autreAction] ?? []).includes(code)) {
      return autreAction;
    }
  }
  return undefined;
}

export function libelleAction(action: ActionJeu): string {
  return NOMS_ACTIONS[action];
}

export function libelleCodeTouche(code: string): string {
  if (code.startsWith('Mouse')) {
    const bouton = code.slice('Mouse'.length);
    return bouton === '0' ? 'Bouton gauche' : 'Bouton ' + (Number(bouton) + 1);
  }

  const libelles: Readonly<Record<string, string>> = {
    Escape: 'Échap',
    Space: 'Espace',
    Enter: 'Entrée',
    Backspace: 'Retour arrière',
    ArrowUp: 'Flèche haut',
    ArrowDown: 'Flèche bas',
    ArrowLeft: 'Flèche gauche',
    ArrowRight: 'Flèche droite',
    PageUp: 'Page précédente',
    PageDown: 'Page suivante',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
  };
  const libelle = libelles[code];
  if (libelle !== undefined) {
    return libelle;
  }
  if (code.startsWith('Key')) {
    return code.slice('Key'.length);
  }
  if (code.startsWith('Digit')) {
    return code.slice('Digit'.length);
  }
  if (code.startsWith('Numpad')) {
    return 'Pavé ' + code.slice('Numpad'.length);
  }
  return code;
}

export function validerLiaison(
  action: ActionJeu,
  code: unknown,
  liaisons: Partial<Record<ActionJeu, readonly string[]>> = {},
): ValidationLiaison {
  if (typeof code !== 'string' || code.length === 0 || !estCodeReconnu(code)) {
    return {
      valide: false,
      erreur: creerErreur(
        'touche-invalide',
        'La touche choisie pour ' + libelleAction(action) + " n'est pas reconnue.",
        action,
      ),
    };
  }

  if (estCodeReserve(code, action)) {
    return {
      valide: false,
      erreur: creerErreur(
        'touche-reservee',
        code === 'Escape'
          ? 'Échap est réservée à l’action Pause.'
          : libelleCodeTouche(code) + ' est réservée par le navigateur ou le système.',
        action,
      ),
    };
  }

  const autreAction = trouverDoublon(action, code, liaisons);
  if (autreAction !== undefined) {
    return {
      valide: false,
      erreur: creerErreur(
        'doublon',
        libelleCodeTouche(code) + ' est déjà utilisée pour ' + libelleAction(autreAction) + '.',
        action,
        autreAction,
      ),
    };
  }

  return { valide: true };
}

export function validerReglages(reglages: unknown): ValidationReglages {
  const erreurs: ErreurReglages[] = [];
  if (!estObjet(reglages)) {
    return {
      valide: false,
      erreurs: [creerErreur('structure', 'La structure des réglages est invalide.')],
    };
  }

  if (typeof reglages.inversionVerticale !== 'boolean') {
    erreurs.push(creerErreur('structure', 'L’inversion verticale doit être un booléen.'));
  }

  if (!estObjet(reglages.liaisons)) {
    erreurs.push(creerErreur('structure', 'Les liaisons de touches sont absentes.'));
    return { valide: false, erreurs };
  }

  const liaisons = reglages.liaisons;
  const liaisonsValidees = {} as Partial<Record<ActionJeu, readonly string[]>>;
  for (const action of ACTIONS_JEU) {
    const valeurs = liaisons[action];
    if (!Array.isArray(valeurs) || valeurs.length === 0) {
      erreurs.push(
        creerErreur(
          'structure',
          'La liaison de ' + libelleAction(action) + ' est absente.',
          action,
        ),
      );
      continue;
    }

    const codesValides: string[] = [];
    for (const code of valeurs) {
      if (codesValides.includes(code)) {
        erreurs.push(
          creerErreur(
            'doublon',
            libelleCodeTouche(String(code)) + ' est répétée pour ' + libelleAction(action) + '.',
            action,
          ),
        );
        continue;
      }
      const validation = validerLiaison(action, code, liaisonsValidees);
      if (!validation.valide) {
        if (validation.erreur !== undefined) {
          erreurs.push(validation.erreur);
        }
        continue;
      }
      codesValides.push(code as string);
      liaisonsValidees[action] = codesValides;
    }
    liaisonsValidees[action] = codesValides;
  }

  return { valide: erreurs.length === 0, erreurs };
}

function creerObjetReglages(reglages: ReglagesJeu): Record<string, unknown> {
  const liaisons: Record<string, readonly string[]> = {};
  for (const action of ACTIONS_JEU) {
    liaisons[action] = [...reglages.liaisons[action]];
  }
  return {
    v: VERSION_REGLAGES,
    inversionVerticale: reglages.inversionVerticale,
    liaisons,
  };
}

export function encoderReglages(reglages: ReglagesJeu): string {
  const validation = validerReglages(reglages);
  if (!validation.valide) {
    throw new Error(validation.erreurs[0]?.message ?? 'Les réglages sont invalides.');
  }

  const valeur = encodeURIComponent(JSON.stringify(creerObjetReglages(reglages)));
  if (valeur.length > TAILLE_MAX_COOKIE_REGLAGES) {
    throw new Error('Les réglages dépassent la taille maximale du cookie.');
  }
  return valeur;
}

export function decoderReglages(valeur: string): ReglagesJeu | undefined {
  if (valeur.length === 0 || valeur.length > TAILLE_MAX_COOKIE_REGLAGES) {
    return undefined;
  }

  try {
    const decodé: unknown = JSON.parse(decodeURIComponent(valeur));
    if (!estObjet(decodé)) {
      return undefined;
    }
    const objet = decodé as unknown as ObjetCookieReglages;
    if (
      objet.v !== VERSION_REGLAGES ||
      typeof objet.inversionVerticale !== 'boolean' ||
      !estObjet(objet.liaisons)
    ) {
      return undefined;
    }

    const candidat = {
      inversionVerticale: objet.inversionVerticale,
      liaisons: objet.liaisons,
    };
    const validation = validerReglages(candidat);
    if (!validation.valide) {
      return undefined;
    }

    const liaisons = {} as Record<ActionJeu, readonly string[]>;
    for (const action of ACTIONS_JEU) {
      const codes = objet.liaisons[action];
      if (
        !Array.isArray(codes) ||
        !codes.every((code): code is string => typeof code === 'string')
      ) {
        return undefined;
      }
      liaisons[action] = [...codes];
    }
    return {
      inversionVerticale: objet.inversionVerticale,
      liaisons,
    };
  } catch {
    return undefined;
  }
}

function lireValeurCookieUnique(cookie: string): string | undefined {
  let valeur: string | undefined;
  let occurrences = 0;
  for (const morceau of cookie.split(';')) {
    const séparateur = morceau.indexOf('=');
    if (séparateur < 0 || morceau.slice(0, séparateur).trim() !== NOM_COOKIE_REGLAGES) {
      continue;
    }
    occurrences += 1;
    valeur = morceau.slice(séparateur + 1).trim();
  }
  return occurrences === 1 ? valeur : undefined;
}

export function chargerReglagesDepuisCookie(cookie: string): ReglagesJeu {
  const valeur = lireValeurCookieUnique(cookie);
  const reglages = valeur === undefined ? undefined : decoderReglages(valeur);
  return reglages === undefined ? clonerReglages(REGLAGES_PAR_DEFAUT) : reglages;
}

export function construireCookieReglages(reglages: ReglagesJeu): string {
  return (
    NOM_COOKIE_REGLAGES +
    '=' +
    encoderReglages(reglages) +
    '; Path=/; SameSite=Lax; Max-Age=' +
    DUREE_COOKIE_REGLAGES_SECONDES
  );
}

export function enregistrerReglagesCookie(
  reglages: ReglagesJeu,
  cible: { cookie: string } = document,
): void {
  cible.cookie = construireCookieReglages(reglages);
}

export function construireLiaisonsEntrees(
  reglages: ReglagesJeu,
): Readonly<Record<ActionJeu, readonly string[]>> {
  const liaisons = {} as Record<ActionJeu, readonly string[]>;
  for (const action of ACTIONS_JEU) {
    liaisons[action] = [...reglages.liaisons[action]];
  }
  return liaisons;
}

export function creerEtatReglages(applique: ReglagesJeu = REGLAGES_PAR_DEFAUT): EtatReglages {
  const valeurSaine = validerReglages(applique).valide ? applique : REGLAGES_PAR_DEFAUT;
  const copie = clonerReglages(valeurSaine);
  return {
    applique: copie,
    brouillon: clonerReglages(copie),
    ouvert: false,
    message: '',
  };
}

export function ouvrirReglages(etat: EtatReglages): EtatReglages {
  return {
    applique: clonerReglages(etat.applique),
    brouillon: clonerReglages(etat.applique),
    ouvert: true,
    message: '',
  };
}

export function modifierInversionReglages(
  etat: EtatReglages,
  inversionVerticale: boolean,
): EtatReglages {
  return {
    ...etat,
    brouillon: {
      inversionVerticale,
      liaisons: { ...etat.brouillon.liaisons },
    },
    message: '',
  };
}

export function modifierLiaisonReglages(
  etat: EtatReglages,
  action: ActionJeu,
  code: string,
): EtatReglages {
  return {
    ...etat,
    brouillon: {
      inversionVerticale: etat.brouillon.inversionVerticale,
      liaisons: { ...etat.brouillon.liaisons, [action]: [code] },
    },
    message: '',
  };
}

export function avecMessageReglages(etat: EtatReglages, message: string): EtatReglages {
  return { ...etat, message };
}

export function appliquerReglages(etat: EtatReglages): ResultatApplicationReglages {
  const validation = validerReglages(etat.brouillon);
  if (!validation.valide) {
    return {
      applique: false,
      etat: {
        ...etat,
        message: validation.erreurs[0]?.message ?? 'Les réglages sont invalides.',
      },
      erreurs: validation.erreurs,
    };
  }

  const applique = clonerReglages(etat.brouillon);
  return {
    applique: true,
    etat: {
      applique,
      brouillon: clonerReglages(applique),
      ouvert: false,
      message: 'Réglages appliqués.',
    },
    erreurs: [],
  };
}

export function annulerReglages(etat: EtatReglages): EtatReglages {
  return {
    applique: clonerReglages(etat.applique),
    brouillon: clonerReglages(etat.applique),
    ouvert: false,
    message: '',
  };
}

export function reinitialiserReglages(etat: EtatReglages): EtatReglages {
  const défauts = clonerReglages(REGLAGES_PAR_DEFAUT);
  return {
    applique: clonerReglages(etat.applique),
    brouillon: défauts,
    ouvert: etat.ouvert,
    message: 'Valeurs par défaut restaurées.',
  };
}
