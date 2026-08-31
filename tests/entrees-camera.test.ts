import { describe, expect, it, vi } from 'vitest';

import {
  ACTIONS_JEU,
  creerEtatActions,
  estControleDom,
  GestionnaireEntrees,
  LIAISONS_PAR_DEFAUT,
} from '../apps/client/src/jeu/entrees';
import { appliquerRegard, bornerTangage, LIMITE_TANGAGE } from '../apps/client/src/jeu/camera';
import {
  calculerDirectionRelativeCamera,
  creerEtatJoueur,
  creerMondeCollision,
  simulerMouvementJoueur,
} from '../apps/client/src/jeu/mouvement';

interface EvenementTest {
  readonly target?: EventTarget | null;
  readonly code?: string;
  readonly button?: number;
  readonly movementX?: number;
  readonly movementY?: number;
  preventDefault(): void;
}

class CibleTest {
  private readonly ecouteurs = new Map<string, Set<EventListener>>();

  public addEventListener(type: string, listener: EventListener): void {
    const ecouteurs = this.ecouteurs.get(type) ?? new Set<EventListener>();
    ecouteurs.add(listener);
    this.ecouteurs.set(type, ecouteurs);
  }

  public removeEventListener(type: string, listener: EventListener): void {
    this.ecouteurs.get(type)?.delete(listener);
  }

  public emettre(
    type: string,
    donnees: Omit<EvenementTest, 'preventDefault'> = {},
  ): { annule: boolean } {
    let annule = false;
    const evenement: EvenementTest = {
      ...donnees,
      preventDefault: () => {
        annule = true;
      },
    };
    for (const ecouteur of this.ecouteurs.get(type) ?? []) {
      ecouteur(evenement as unknown as Event);
    }
    return { annule };
  }
}

class DocumentTest extends CibleTest {
  public hidden = false;
  public visibilityState = 'visible';
  public pointerLockElement: object | null = null;
  public readonly exitPointerLock = vi.fn(() => {
    this.pointerLockElement = null;
  });
}

function creerEntrees(): {
  readonly entrees: GestionnaireEntrees;
  readonly cible: CibleTest;
  readonly document: DocumentTest;
  readonly element: { readonly requestPointerLock: ReturnType<typeof vi.fn> };
} {
  const cible = new CibleTest();
  const document = new DocumentTest();
  const element = { requestPointerLock: vi.fn() };
  const entrees = new GestionnaireEntrees({ cible, document, elementVerrouillage: element });
  entrees.attacher();
  return { entrees, cible, document, element };
}

describe('entrées sémantiques', () => {
  it('déclare les actions et les associations ZQSD/WASD par défaut', () => {
    expect(ACTIONS_JEU).toEqual([
      'avancer',
      'reculer',
      'gauche',
      'droite',
      'interagir',
      'tirer',
      'pause',
    ]);
    expect(LIAISONS_PAR_DEFAUT).toEqual({
      avancer: ['KeyZ', 'KeyW'],
      reculer: ['KeyS'],
      gauche: ['KeyQ', 'KeyA'],
      droite: ['KeyD'],
      interagir: ['KeyE'],
      tirer: ['Mouse0'],
      pause: ['Escape'],
    });
  });

  it('expose les transitions appuyée et relâchée derrière une action', () => {
    const { entrees, cible } = creerEntrees();

    const appui = cible.emettre('keydown', { code: 'KeyZ' });
    expect(appui.annule).toBe(true);
    expect(entrees.lireEtat().avancer).toBe(true);
    expect(entrees.lireTransitions()).toEqual({ appuyees: ['avancer'], relachees: [] });

    cible.emettre('keyup', { code: 'KeyZ' });
    expect(entrees.lireEtat().avancer).toBe(false);
    expect(entrees.lireTransitions()).toEqual({ appuyees: [], relachees: ['avancer'] });
    entrees.detacher();
  });

  it('garde une action active tant qu’une de ses deux touches reste enfoncée', () => {
    const { entrees, cible } = creerEntrees();

    cible.emettre('keydown', { code: 'KeyZ' });
    cible.emettre('keydown', { code: 'KeyW' });
    cible.emettre('keyup', { code: 'KeyZ' });

    expect(entrees.lireEtat().avancer).toBe(true);
    cible.emettre('keyup', { code: 'KeyW' });
    expect(entrees.lireEtat().avancer).toBe(false);
  });

  it('traduit le bouton gauche et demande le verrouillage du pointeur', () => {
    const { entrees, cible, element } = creerEntrees();

    cible.emettre('mousedown', { button: 0 });

    expect(element.requestPointerLock).toHaveBeenCalledOnce();
    expect(entrees.lireEtat().tirer).toBe(true);
    cible.emettre('mouseup', { button: 0 });
    expect(entrees.lireEtat().tirer).toBe(false);
  });

  it('suit les changements de verrouillage signalés par le navigateur', () => {
    const { entrees, document, element } = creerEntrees();

    document.pointerLockElement = element;
    document.emettre('pointerlockchange');
    expect(entrees.lireEtat().pointeurVerrouille).toBe(true);

    document.pointerLockElement = null;
    document.emettre('pointerlockchange');
    expect(entrees.lireEtat().pointeurVerrouille).toBe(false);
  });

  it('accumule le regard par image lorsque le pointeur est verrouillé', () => {
    const { entrees, cible } = creerEntrees();

    entrees.simulerVerrouillage(true);
    cible.emettre('mousemove', { movementX: 12, movementY: -7 });

    expect(entrees.lireEtat()).toMatchObject({
      regardX: 12,
      regardY: -7,
      pointeurVerrouille: true,
    });
    expect(entrees.lireEtat()).toMatchObject({ regardX: 0, regardY: 0 });
  });

  it('ignore une saisie dans un contrôle DOM', () => {
    const { entrees, cible } = creerEntrees();
    const champ = {
      tagName: 'INPUT',
      isContentEditable: false,
      closest: () => champ,
    } as unknown as EventTarget;

    const appui = cible.emettre('keydown', { code: 'KeyZ', target: champ });

    expect(appui.annule).toBe(false);
    expect(entrees.lireEtat().avancer).toBe(false);
    expect(estControleDom(champ)).toBe(true);
    expect(estControleDom(null)).toBe(false);
  });

  it('réinitialise les actions, le regard et le pointeur à la perte de focus ou de visibilité', () => {
    const { entrees, cible, document } = creerEntrees();

    entrees.simulerVerrouillage(true);
    cible.emettre('keydown', { code: 'KeyW' });
    cible.emettre('mousemove', { movementX: 5, movementY: 4 });
    cible.emettre('blur');
    expect(entrees.lireEtat()).toEqual(creerEtatActions());

    entrees.simulerVerrouillage(true);
    cible.emettre('keydown', { code: 'KeyW' });
    document.hidden = true;
    document.visibilityState = 'hidden';
    document.emettre('visibilitychange');
    expect(entrees.lireEtat()).toEqual(creerEtatActions());
  });

  it('libère le pointeur et produit une pause sur Échap', () => {
    const onPause = vi.fn();
    const { entrees, cible, document } = creerEntrees();
    const entreesAvecPause = new GestionnaireEntrees({
      cible,
      document,
      elementVerrouillage: { requestPointerLock: vi.fn() },
      onPause,
    });
    entrees.detacher();
    entreesAvecPause.attacher();
    entreesAvecPause.simulerVerrouillage(true);

    cible.emettre('keydown', { code: 'Escape' });
    const etat = entreesAvecPause.lireEtat();

    expect(etat.pause).toBe(true);
    expect(etat.pointeurVerrouille).toBe(false);
    expect(document.exitPointerLock).toHaveBeenCalledOnce();
    expect(onPause).toHaveBeenCalledOnce();
  });

  it('détache tous les écouteurs', () => {
    const { entrees, cible } = creerEntrees();
    entrees.detacher();
    cible.emettre('keydown', { code: 'KeyZ' });

    expect(entrees.lireEtat().avancer).toBe(false);
  });
});

describe('caméra première personne', () => {
  it('n’inverse que le regard vertical', () => {
    const initial = { lacet: 0, tangage: 0 };
    const normal = appliquerRegard(initial, 8, 8, false);
    const inverse = appliquerRegard(initial, 8, 8, true);

    expect(normal.lacet).toBe(inverse.lacet);
    expect(normal.tangage).toBe(-inverse.tangage);
    expect(normal.tangage).toBeLessThan(0);
  });

  it('borne le tangage dans les deux directions', () => {
    expect(bornerTangage(100)).toBe(LIMITE_TANGAGE);
    expect(bornerTangage(-100)).toBe(-LIMITE_TANGAGE);
    expect(bornerTangage(Number.NaN)).toBe(0);
  });
});

describe('mouvement et collisions', () => {
  it('normalise la diagonale et la rend relative au lacet', () => {
    const actions = { ...creerEtatActions(), avancer: true, droite: true };
    const direction = calculerDirectionRelativeCamera(actions, 0);

    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1);
    expect(direction.x).toBeCloseTo(Math.SQRT1_2);
    expect(direction.z).toBeCloseTo(Math.SQRT1_2);

    const tourne = calculerDirectionRelativeCamera(
      { ...creerEtatActions(), avancer: true },
      Math.PI / 2,
    );
    expect(tourne.x).toBeCloseTo(1);
    expect(tourne.z).toBeCloseTo(0);
  });

  it('maintient le joueur au sol sous gravité', () => {
    const monde = creerMondeCollision([], { solY: 0, gravite: -18 });
    const joueur = simulerMouvementJoueur(
      creerEtatJoueur({ x: 0, y: 0, z: 0 }),
      creerEtatActions(),
      0,
      1,
      monde,
    );

    expect(joueur.position.y).toBe(0);
    expect(joueur.vitesseVerticale).toBe(0);
    expect(joueur.auSol).toBe(true);
    expect(joueur.collision).toBe('sol');
  });

  it('bloque un déplacement qui franchirait un mur', () => {
    const monde = creerMondeCollision([
      { minX: -2, maxX: 2, minY: 0, maxY: 3, minZ: 0, maxZ: 0.4 },
    ]);
    const joueur = simulerMouvementJoueur(
      creerEtatJoueur({ x: 0, y: 0, z: -3 }),
      { ...creerEtatActions(), avancer: true },
      0,
      2,
      monde,
    );

    expect(joueur.position.z).toBeCloseTo(-monde.rayonJoueur);
    expect(joueur.collision).toBe('mur');
  });
});
