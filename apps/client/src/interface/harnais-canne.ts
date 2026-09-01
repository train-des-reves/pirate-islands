import {
  DUREE_FENETRE_MORSURE_MS,
  ETAT_PECHE_INACTIF,
  annulerPeche,
  avancerPeche,
  calculerPrevisionPeche,
  genererMonde,
  lancerPeche,
  releverPeche,
  trouverEspece,
  type EtatPeche,
  type ZonePeche,
} from '@pirate/coeur-jeu';

import type { EtatCanne, EtatVueCanne } from '../jeu/canne';

export interface LigneHarnaisCanne {
  readonly libelle: string;
  readonly vue: EtatVueCanne;
  readonly phase: string;
  readonly resultat: string;
  readonly espece: string;
  readonly taille: string;
}

export interface HarnaisCanne {
  readonly lignes: readonly LigneHarnaisCanne[];
  readonly graine: string;
  readonly zone: ZonePeche;
  readonly etatRepos: EtatCanne;
  readonly etatLancee: EtatCanne;
  readonly etatMorsure: EtatCanne;
}

function etatDepuisPeche(etat: EtatPeche, sequence: number): EtatCanne {
  if (etat.phase === 'inactive') {
    return { vue: 'rangee', sequence, peche: etat };
  }
  if (etat.phase === 'attente') {
    return { vue: 'lancee', sequence, peche: etat };
  }
  if (etat.phase === 'morsure') {
    return { vue: 'morsure', sequence, peche: etat };
  }
  return { vue: 'remontee', sequence, peche: etat };
}

function lancerBase(zone: ZonePeche, graine: string, sequence: number): EtatPeche {
  return lancerPeche(ETAT_PECHE_INACTIF, { zonesPeche: [zone] }, zone.id, graine, sequence, 0);
}

function formaterEspece(etat: EtatPeche): string {
  if (etat.espece === undefined) {
    return '';
  }
  const espece = trouverEspece(etat.espece);
  return espece?.nom ?? etat.espece;
}

function formaterTaille(etat: EtatPeche): string {
  return etat.taille === undefined ? '' : `${etat.taille.toFixed(1)} cm`;
}

function construireLigne(libelle: string, etat: EtatPeche): LigneHarnaisCanne {
  const vue = etatDepuisPeche(etat, 1).vue;
  return {
    libelle,
    vue,
    phase: etat.phase,
    resultat: etat.resultat ?? '',
    espece: formaterEspece(etat),
    taille: formaterTaille(etat),
  };
}

export function construireHarnaisCanne(
  graine: string,
  sequence: number,
): HarnaisCanne {
  const monde = genererMonde(graine);
  const zone = monde.zonesPeche[0];
  if (!zone) {
    throw new Error('Le monde doit exposer au moins une zone de pêche.');
  }

  const prévision = calculerPrevisionPeche(graine, sequence);
  const délai = prévision.delaiMorsureMs;
  const fin = délai + DUREE_FENETRE_MORSURE_MS;
  const base = lancerBase(zone, graine, sequence);

  const repos = etatDepuisPeche(ETAT_PECHE_INACTIF, sequence);
  const attente = etatDepuisPeche(avancerPeche(base, délai - 1), sequence);
  const morsure = etatDepuisPeche(avancerPeche(base, délai), sequence);
  const prise = releverPeche(avancerPeche(base, délai), délai + Math.floor(DUREE_FENETRE_MORSURE_MS / 2));
  const tropTot = releverPeche(base, délai - 1);
  const tropTard = avancerPeche(base, fin + 1);
  const annulation = annulerPeche(avancerPeche(base, délai), délai);

  const lignes: readonly LigneHarnaisCanne[] = [
    construireLigne('Rangée', ETAT_PECHE_INACTIF),
    construireLigne('Attente', attente.peche),
    construireLigne('Morsure', morsure.peche),
    construireLigne('Prise', prise),
    construireLigne('Trop tôt', tropTot),
    construireLigne('Trop tard', tropTard),
    construireLigne('Annulation', annulation),
  ];

  return {
    lignes,
    graine,
    zone,
    etatRepos: repos,
    etatLancee: attente,
    etatMorsure: morsure,
  };
}
