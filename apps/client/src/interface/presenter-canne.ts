import type { HarnaisCanne } from './harnais-canne.js';

export interface PresentationCanneDom {
  readonly conteneur: HTMLDivElement;
  readonly detruire: () => void;
}

function creerCellule(testid: string, contenu: string): HTMLTableCellElement {
  const cellule = document.createElement('td');
  cellule.textContent = contenu;
  cellule.dataset.testid = testid;
  return cellule;
}

export function monterPresentationCanne(
  harnais: HarnaisCanne,
  racine: HTMLElement,
): PresentationCanneDom {
  const conteneur = document.createElement('div');
  conteneur.className = 'presentation-canne';
  conteneur.dataset.testid = 'presentation-canne';
  conteneur.setAttribute('aria-label', 'Harnais de présentation de la canne à pêche');

  const titre = document.createElement('h2');
  titre.textContent = 'Canne à pêche — états de vue déterministes';
  titre.dataset.testid = 'presentation-canne-titre';
  conteneur.append(titre);

  const sousTitre = document.createElement('p');
  sousTitre.className = 'presentation-canne-graine';
  sousTitre.dataset.testid = 'presentation-canne-graine';
  sousTitre.textContent = `Graine : ${harnais.graine}`;
  conteneur.append(sousTitre);

  const tableau = document.createElement('table');
  tableau.className = 'presentation-canne-table';
  tableau.dataset.testid = 'presentation-canne-table';

  const entete = document.createElement('thead');
  const ligneEntete = document.createElement('tr');
  for (const colonne of ['Scénario', 'Vue', 'Phase', 'Résultat', 'Espèce', 'Taille']) {
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
    ligneDom.dataset.testid = 'presentation-canne-ligne';
    const celluleLibelle = document.createElement('th');
    celluleLibelle.setAttribute('scope', 'row');
    celluleLibelle.textContent = ligne.libelle;
    ligneDom.append(celluleLibelle);
    ligneDom.append(creerCellule('presentation-canne-vue', ligne.vue));
    ligneDom.append(creerCellule('presentation-canne-phase', ligne.phase));
    ligneDom.append(creerCellule('presentation-canne-resultat', ligne.resultat));
    ligneDom.append(creerCellule('presentation-canne-espece', ligne.espece));
    ligneDom.append(creerCellule('presentation-canne-taille', ligne.taille));
    corps.append(ligneDom);
  }
  tableau.append(corps);
  conteneur.append(tableau);

  const statistique = document.createElement('p');
  statistique.className = 'presentation-canne-zone';
  statistique.dataset.testid = 'presentation-canne-zone';
  statistique.textContent = `Zone : ${harnais.zone.nom}`;
  conteneur.append(statistique);

  racine.append(conteneur);

  return {
    conteneur,
    detruire: () => conteneur.remove(),
  };
}
