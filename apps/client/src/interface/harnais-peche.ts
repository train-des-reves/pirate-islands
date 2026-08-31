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
} from '@pirate/coeur-jeu';

export interface LignePresentationPeche {
  readonly libelle: string;
  readonly phase: string;
  readonly resultat: string;
  readonly espece: string;
  readonly taille: string;
}

export interface HarnaisPeche {
  readonly lignes: readonly LignePresentationPeche[];
  readonly graine: string;
}

function formaterResultat(etat: EtatPeche): string {
  return etat.resultat ?? '';
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

function construireLigne(libelle: string, etat: EtatPeche): LignePresentationPeche {
  return {
    libelle,
    phase: etat.phase,
    resultat: formaterResultat(etat),
    espece: formaterEspece(etat),
    taille: formaterTaille(etat),
  };
}

export function construireHarnaisPeche(
  graine: string,
  sequence: number,
): HarnaisPeche {
  const monde = genererMonde(graine);
  const zone = monde.zonesPeche[0];
  if (!zone) {
    throw new Error('Le monde doit exposer au moins une zone de pêche.');
  }
  const prévision = calculerPrevisionPeche(graine, sequence);
  const délai = prévision.delaiMorsureMs;
  const fin = délai + DUREE_FENETRE_MORSURE_MS;

  const attente = avancerPeche(
    lancerPeche(ETAT_PECHE_INACTIF, monde, zone.id, graine, sequence, 0),
    délai - 1,
  );
  const morsure = avancerPeche(
    lancerPeche(ETAT_PECHE_INACTIF, monde, zone.id, graine, sequence, 0),
    délai,
  );
  const prise = releverPeche(morsure, délai + Math.floor(DUREE_FENETRE_MORSURE_MS / 2));
  const tropTot = releverPeche(
    lancerPeche(ETAT_PECHE_INACTIF, monde, zone.id, graine, sequence, 0),
    délai - 1,
  );
  const tropTard = avancerPeche(
    lancerPeche(ETAT_PECHE_INACTIF, monde, zone.id, graine, sequence, 0),
    fin + 1,
  );
  const annulation = annulerPeche(
    avancerPeche(
      lancerPeche(ETAT_PECHE_INACTIF, monde, zone.id, graine, sequence, 0),
      délai,
    ),
    délai,
  );

  const lignes: readonly LignePresentationPeche[] = [
    construireLigne('Attente', attente),
    construireLigne('Morsure', morsure),
    construireLigne('Prise', prise),
    construireLigne('Trop tôt', tropTot),
    construireLigne('Trop tard', tropTard),
    construireLigne('Annulation', annulation),
  ];

  return { lignes, graine };
}
