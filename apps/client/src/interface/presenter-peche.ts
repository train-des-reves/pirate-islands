import type { HarnaisPeche } from './harnais-peche.js';

export type ModePresentationPeche = 'regles-peche';

export interface PresentationPecheDom {
  readonly conteneur: HTMLDivElement;
  readonly detruire: () => void;
}

function creerPlage(libelle: string, contenu: string): HTMLTableCellElement {
  const cellule = document.createElement('td');
  cellule.textContent = contenu;
  cellule.setAttribute('data-testid', `peche-${libelle}`);
  return cellule;
}

export function monterPresentationPeche(
  harnais: HarnaisPeche,
  racine: HTMLElement,
): PresentationPecheDom {
  const conteneur = document.createElement('div');
  conteneur.className = 'presentation-peche';
  conteneur.dataset.testid = 'presentation-peche';
  conteneur.setAttribute('aria-label', 'Harnais de présentation des règles de pêche');

  const titre = document.createElement('h2');
  titre.textContent = 'Règles de pêche — déterministes';
  titre.dataset.testid = 'presentation-peche-titre';
  conteneur.append(titre);

  const sousTitre = document.createElement('p');
  sousTitre.className = 'presentation-peche-graine';
  sousTitre.dataset.testid = 'presentation-peche-graine';
  sousTitre.textContent = `Graine : ${harnais.graine}`;
  conteneur.append(sousTitre);

  const tableau = document.createElement('table');
  tableau.className = 'presentation-peche-table';
  tableau.dataset.testid = 'presentation-peche-table';

  const entete = document.createElement('thead');
  const ligneEntete = document.createElement('tr');
  for (const colonne of ['Scénario', 'Phase', 'Résultat', 'Espèce', 'Taille']) {
    const cellule = document.createElement('th');
    cellule.textContent = colonne;
    cellule.setAttribute('scope', 'col');
    ligneEntete.append(cellule);
  }
  entete.append(ligneEntete);
  tableau.append(entete);

  const corps = document.createElement('tbody');
  for (const ligne of harnais.lignes) {
    const ligneDom = document.createElement('tr');
    ligneDom.dataset.testid = 'presentation-peche-ligne';
    const celluleLibelle = document.createElement('th');
    celluleLibelle.setAttribute('scope', 'row');
    celluleLibelle.textContent = ligne.libelle;
    ligneDom.append(celluleLibelle);
    ligneDom.append(creerPlage('phase', ligne.phase));
    ligneDom.append(creerPlage('resultat', ligne.resultat));
    ligneDom.append(creerPlage('espece', ligne.espece));
    ligneDom.append(creerPlage('taille', ligne.taille));
    corps.append(ligneDom);
  }
  tableau.append(corps);
  conteneur.append(tableau);

  racine.append(conteneur);

  return {
    conteneur,
    detruire: () => conteneur.remove(),
  };
}
