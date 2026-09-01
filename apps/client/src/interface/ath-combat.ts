import {
  SANTE_JOUEUR_MAXIMALE,
  SANTE_PIRATE_MAXIMALE,
  type MessageResultatTir,
} from '@pirate/protocole';

export interface SourceJoueurAthCombat {
  readonly sante: number;
  readonly vivant: boolean;
}

export interface SourceCibleAthCombat {
  readonly identifiant: string;
  readonly sante: number;
  readonly vivant: boolean;
}

export interface EtatAthCombat {
  readonly joueur: {
    readonly sante: number;
    readonly vivant: boolean;
  };
  readonly cible: {
    readonly identifiant: string;
    readonly sante: number;
    readonly vivant: boolean;
  } | null;
  readonly dernierTir: MessageResultatTir | undefined;
}

export interface ElementsAthCombat {
  readonly conteneur: HTMLElement;
  readonly barreJoueur: HTMLElement;
  readonly valeurJoueur: HTMLElement;
  readonly cible: HTMLElement;
  readonly barreCible: HTMLElement;
  readonly valeurCible: HTMLElement;
  readonly resultat: HTMLElement;
  readonly mort: HTMLElement;
}

function limiterSante(sante: number, maximum: number): number {
  return Number.isFinite(sante) ? Math.min(maximum, Math.max(0, Math.round(sante))) : 0;
}

export function construireEtatAthCombat(
  joueur: SourceJoueurAthCombat,
  cible: SourceCibleAthCombat | undefined,
  dernierTir: MessageResultatTir | undefined,
): EtatAthCombat {
  return {
    joueur: {
      sante: limiterSante(joueur.sante, SANTE_JOUEUR_MAXIMALE),
      vivant: joueur.vivant,
    },
    cible:
      cible === undefined
        ? null
        : {
            identifiant: cible.identifiant,
            sante: limiterSante(cible.sante, SANTE_PIRATE_MAXIMALE),
            vivant: cible.vivant,
          },
    dernierTir,
  };
}

function afficherBarre(
  barre: HTMLElement,
  valeur: HTMLElement,
  sante: number,
  maximum: number,
): void {
  const santeSaine = limiterSante(sante, maximum);
  const ratio = santeSaine / maximum;
  barre.style.transform = `scaleX(${ratio})`;
  barre.setAttribute('aria-valuenow', String(santeSaine));
  valeur.textContent = `${santeSaine} / ${maximum}`;
  valeur.dataset.etat = ratio <= 0 ? 'vide' : ratio <= 0.25 ? 'critique' : 'active';
}

export function afficherAthCombat(elements: ElementsAthCombat, etat: EtatAthCombat): void {
  const cible = etat.cible;
  elements.conteneur.hidden = false;
  elements.conteneur.dataset.etatJoueur = etat.joueur.vivant ? 'vivant' : 'mort';
  elements.conteneur.dataset.etatCible =
    cible === null ? 'aucune' : cible.vivant ? 'vivante' : 'neutralisee';

  afficherBarre(
    elements.barreJoueur,
    elements.valeurJoueur,
    etat.joueur.sante,
    SANTE_JOUEUR_MAXIMALE,
  );
  elements.mort.hidden = etat.joueur.vivant;

  if (cible === null) {
    elements.cible.textContent = 'Aucune cible';
    afficherBarre(elements.barreCible, elements.valeurCible, 0, SANTE_PIRATE_MAXIMALE);
  } else {
    elements.cible.textContent = cible.vivant
      ? `Pirate · ${cible.identifiant}`
      : 'Pirate neutralisé';
    afficherBarre(elements.barreCible, elements.valeurCible, cible.sante, SANTE_PIRATE_MAXIMALE);
  }

  const dernierTir = etat.dernierTir;
  if (dernierTir === undefined) {
    elements.resultat.textContent = 'En attente de tir';
  } else if (dernierTir.cibleId === null) {
    elements.resultat.textContent = 'Tir raté · aucun pirate touché';
  } else if (dernierTir.pirateNeutralise) {
    elements.resultat.textContent = `Pirate neutralisé · ${dernierTir.degats} dégâts`;
  } else {
    elements.resultat.textContent = `Impact confirmé · ${dernierTir.degats} dégâts`;
  }
}
