import {
  PROFIL_TERRE,
  creerScenario,
  simulerIaPirate,
  type CiblePerçue,
  type Coordonnees,
  type EtatIaPirate,
  type ResultatSimulationPirate,
  type SortieIaPirate,
} from '@pirate/coeur-jeu';

/** Graine fixe du scénario du visualiseur, pour une preuve déterministe. */
export const GRAINE_VISUALISEUR_IA = 'ia-pirate-visualiseur';

/** Poséidon de la cible perçue, en unité monde. */
const POSITION_DEPART: Coordonnees = { x: 0, z: 0 };

/** Instant auquel la cible apparaît, en secondes. */
const INSTANT_APPARITION_CIBLE = 1;

/** Instant auquel la cible disparaît, en secondes. */
const INSTANT_DISPARITION_CIBLE = 6;

/** Durée totale de la simulation, en secondes. */
const DUREE_SIMULATION = 8;

/** Pas de temps fixe de la simulation, en secondes. */
const DELTA_SIMULATION = 0.05;

/** Largeur et hauteur de référence du canevas 2D. */
const LARGEUR_CANEVAS = 1280;
const HAUTEUR_CANEVAS = 720;

/** Étendue du monde affichée, en unités monde de part et d'autre du centre. */
const PORTEE_AFFICHAGE = 42;

/** Couleurs lisibles du harnais. */
const COULEURS = {
  fond: '#062033',
  grille: 'rgba(120, 200, 230, 0.12)',
  trajectoire: 'rgba(148, 227, 255, 0.62)',
  pirate: '#8fe3ff',
  pirateContour: '#05253e',
  cible: '#ff7a5c',
  ancrage: '#ffd98a',
  porteePerception: 'rgba(143, 227, 255, 0.14)',
  porteeAttaque: 'rgba(255, 122, 92, 0.16)',
  texte: '#eefaff',
  texteSecondaire: 'rgba(232, 250, 255, 0.72)',
} as const;

/** Cible perçue construite pour le scénario. */
function cibleScenario(identifiant: string, x: number, z: number): CiblePerçue {
  return { id: identifiant, position: { x, z } };
}

/** Scénario fixe du visualiseur : patrouille → poursuite → attaque → retour. */
export const SCENARIO_VISUALISEUR_IA = creerScenario({
  graine: GRAINE_VISUALISEUR_IA,
  profil: PROFIL_TERRE,
  positionDepart: POSITION_DEPART,
  deltaSec: DELTA_SIMULATION,
  dureeSec: DUREE_SIMULATION,
  entreesCibles: [
    { instant: INSTANT_APPARITION_CIBLE, cible: cibleScenario('cible-joueur', 0, -14) },
    { instant: INSTANT_DISPARITION_CIBLE, cible: undefined },
  ],
});

/** État exposé pour les tests E2E du visualiseur. */
export interface EtatVisualiseurIa {
  readonly etatFinal: EtatIaPirate;
  readonly transitions: readonly EtatIaPirate[];
  readonly instantAffichage: number;
  readonly etatAffichage: EtatIaPirate;
  readonly position: Coordonnees;
  readonly cap: number;
  readonly progression: number;
}

/** Résultat du montage du visualiseur. */
export interface VisualiseurIa {
  readonly resultat: ResultatSimulationPirate;
  afficherInstant: (instant: number) => void;
  lireEtat: () => EtatVisualiseurIa;
  detruire: () => void;
}

/**
 * Construit le harnais visuel du visualiseur d'IA pirate, alimenté par la
 * simulation déterministe et réservé au mode E2E. Insère son DOM dans le
 * conteneur fourni et dessine le plan XZ sur un canevas 2D.
 */
export function construireVisualiseurIa(
  conteneur: HTMLElement,
  conteneurCanvas: HTMLCanvasElement,
): VisualiseurIa {
  const resultat = simulerIaPirate(SCENARIO_VISUALISEUR_IA);
  const instantInitial = resultat.etapes[0]?.temps ?? 0;
  let instantCourant = instantInitial;

  const visualiseur = document.createElement('section');
  visualiseur.className = 'ia-visualiseur';
  visualiseur.dataset.testid = 'visualiseur-ia';

  const entete = document.createElement('header');
  entete.className = 'ia-visualiseur__entete';
  entete.innerHTML = `
    <div>
      <p class="ia-visualiseur__eyebrow">Harnais visuel E2E · MVP-2G</p>
      <h2 class="ia-visualiseur__titre">Machine d'états de l'IA pirate</h2>
      <p class="ia-visualiseur__sous-titre">
        Patrouille → poursuite → attaque → retour, réglages terre, graine
        <code>${GRAINE_VISUALISEUR_IA}</code>.
      </p>
    </div>
    <p class="ia-visualiseur__etat" data-testid="ia-etat">Inactif</p>
  `;
  visualiseur.append(entete);

  const tableau = document.createElement('section');
  tableau.className = 'ia-visualiseur__tableau';

  const canevas = document.createElement('canvas');
  canevas.className = 'ia-visualiseur__canevas';
  canevas.width = LARGEUR_CANEVAS;
  canevas.height = HAUTEUR_CANEVAS;
  canevas.setAttribute('aria-label', 'Plan XZ du déplacement et des états de l’IA pirate');
  canevas.dataset.testid = 'ia-canevas';
  tableau.append(canevas);

  const legende = document.createElement('div');
  legende.className = 'ia-visualiseur__legende';
  legende.dataset.testid = 'ia-legende';
  legende.innerHTML = `
    <div class="ia-visualiseur__mesure">
      <span class="ia-visualiseur__libelle">Temps</span>
      <strong data-testid="ia-temps">0,00 s</strong>
    </div>
    <div class="ia-visualiseur__mesure">
      <span class="ia-visualiseur__libelle">Position</span>
      <strong data-testid="ia-position">0·6</strong>
    </div>
    <div class="ia-visualiseur__mesure">
      <span class="ia-visualiseur__libelle">Cap</span>
      <strong data-testid="ia-cap">0°</strong>
    </div>
    <div class="ia-visualiseur__mesure ia-visualiseur__mesure--large">
      <span class="ia-visualiseur__libelle">Temporisation</span>
      <div class="ia-visualiseur__jauge" data-testid="ia-progression">
        <span class="ia-visualiseur__jauge-remplissage"></span>
      </div>
    </div>
    <div class="ia-visualiseur__mesure--chronologie">
      <span class="ia-visualiseur__libelle">Transitions</span>
      <ol class="ia-visualiseur__chronologie" data-testid="ia-transitions"></ol>
    </div>
  `;
  tableau.append(legende);
  visualiseur.append(tableau);

  conteneur.append(visualiseur);

  // Le canevas Babylon existant sert de fond, on le masque pour le harnais.
  conteneurCanvas.style.opacity = '0';

  const attributsEtat = new Map<EtatIaPirate, string>([]);
  attributsEtat.set('inactif', 'Inactif');
  attributsEtat.set('patrouille', 'Patrouille');
  attributsEtat.set('poursuite', 'Poursuite');
  attributsEtat.set('attaque', 'Attaque');
  attributsEtat.set('retour', 'Retour');
  attributsEtat.set('mort', 'Mort');

  const chronologie = visualiseur.querySelector<HTMLOListElement>(
    '[data-testid="ia-transitions"]',
  );
  const etatAffichage = visualiseur.querySelector<HTMLElement>('[data-testid="ia-etat"]');
  const tempsAffichage = visualiseur.querySelector<HTMLElement>('[data-testid="ia-temps"]');
  const positionAffichage = visualiseur.querySelector<HTMLElement>('[data-testid="ia-position"]');
  const capAffichage = visualiseur.querySelector<HTMLElement>('[data-testid="ia-cap"]');
  const jauge = visualiseur.querySelector<HTMLElement>('[data-testid="ia-progression"]');
  const jaugeRemplissage = jauge?.querySelector<HTMLElement>('.ia-visualiseur__jauge-remplissage');

  // Remplit la frise des transitions observées.
  const transitionsAffichées: readonly EtatIaPirate[] =
    resultat.transitions.length > 0 ? ['inactif', ...resultat.transitions] : ['inactif'];
  for (const etat of transitionsAffichées) {
    const item = document.createElement('li');
    item.dataset.etat = etat;
    item.textContent = attributsEtat.get(etat) ?? etat;
    chronologie?.append(item);
  }

  function trouverEtape(instant: number): SortieIaPirate | undefined {
    const instantSain = Math.max(0, instant);
    let dernière: SortieIaPirate | undefined;
    for (const étape of resultat.etapes) {
      if (étape.temps <= instantSain) {
        dernière = étape.sortie;
      } else {
        break;
      }
    }
    return dernière;
  }

  function afficherInstant(instant: number): void {
    const instantSain = Math.max(0, instant);
    instantCourant = instantSain;
    const étape = trouverEtape(instantSain);
    if (!étape) {
      return;
    }

    const libellé = attributsEtat.get(étape.etat) ?? étape.etat;
    if (etatAffichage) {
      etatAffichage.textContent = libellé;
      etatAffichage.dataset.etat = étape.etat;
    }
    if (tempsAffichage) {
      tempsAffichage.textContent = `${instantSain.toFixed(2)} s`;
    }
    if (positionAffichage) {
      positionAffichage.textContent = `${étape.position.x.toFixed(1)} · ${étape.position.z.toFixed(1)}`;
    }
    if (capAffichage) {
      capAffichage.textContent = `${(étape.cap * 180 / Math.PI).toFixed(0)}°`;
    }
    if (jaugeRemplissage) {
      jaugeRemplissage.style.width = `${Math.min(1, Math.max(0, étape.progressionTemporisation)) * 100}%`;
    }
    if (jauge) {
      jauge.dataset.progression = étape.progressionTemporisation.toFixed(3);
    }

    dessiner(canevas, étape);
  }

  function dessiner(canevasElement: HTMLCanvasElement, étape: SortieIaPirate): void {
    const contexte = canevasElement.getContext('2d');
    if (!contexte) {
      return;
    }

    const centreX = LARGEUR_CANEVAS / 2;
    const centreY = HAUTEUR_CANEVAS / 2 - 40;
    const échelle = Math.min(LARGEUR_CANEVAS, HAUTEUR_CANEVAS) / (2 * PORTEE_AFFICHAGE);

    const convertirX = (x: number): number => centreX + x * échelle;
    const convertirZ = (z: number): number => centreY - z * échelle;

    contexte.clearRect(0, 0, LARGEUR_CANEVAS, HAUTEUR_CANEVAS);
    contexte.fillStyle = COULEURS.fond;
    contexte.fillRect(0, 0, LARGEUR_CANEVAS, HAUTEUR_CANEVAS);

    // Grille de repère tous les 5 unités monde.
    contexte.strokeStyle = COULEURS.grille;
    contexte.lineWidth = 1;
    for (let valeur = -PORTEE_AFFICHAGE; valeur <= PORTEE_AFFICHAGE; valeur += 5) {
      contexte.beginPath();
      contexte.moveTo(convertirX(valeur), convertirZ(-PORTEE_AFFICHAGE));
      contexte.lineTo(convertirX(valeur), convertirZ(PORTEE_AFFICHAGE));
      contexte.stroke();
      contexte.beginPath();
      contexte.moveTo(convertirX(-PORTEE_AFFICHAGE), convertirZ(valeur));
      contexte.lineTo(convertirX(PORTEE_AFFICHAGE), convertirZ(valeur));
      contexte.stroke();
    }

    // Point d'ancrage.
    contexte.strokeStyle = COULEURS.ancrage;
    contexte.lineWidth = 2;
    contexte.beginPath();
    contexte.arc(convertirX(SCENARIO_VISUALISEUR_IA.profil.pointAncrage.x), convertirZ(SCENARIO_VISUALISEUR_IA.profil.pointAncrage.z), 4, 0, Math.PI * 2);
    contexte.stroke();

    // Trajectoire du pirate jusqu'à l'instant courant.
    contexte.strokeStyle = COULEURS.trajectoire;
    contexte.lineWidth = 2;
    contexte.setLineDash([6, 6]);
    contexte.beginPath();
    let premier = true;
    for (const pas of resultat.etapes) {
      if (pas.temps > instantCourant) {
        break;
      }
      const x = convertirX(pas.sortie.position.x);
      const z = convertirZ(pas.sortie.position.z);
      if (premier) {
        contexte.moveTo(x, z);
        premier = false;
      } else {
        contexte.lineTo(x, z);
      }
    }
    contexte.stroke();
    contexte.setLineDash([]);

    // Portée de perception autour du pirate.
    contexte.strokeStyle = COULEURS.porteePerception;
    contexte.lineWidth = 1;
    contexte.beginPath();
    contexte.arc(
      convertirX(étape.position.x),
      convertirZ(étape.position.z),
      SCENARIO_VISUALISEUR_IA.profil.porteePerception * échelle,
      0,
      Math.PI * 2,
    );
    contexte.stroke();

    // Cible perçue si elle est dans la fenêtre à l'instant courant.
    const cible = trouverCibleAffichée(instantCourant);
    if (cible) {
      contexte.strokeStyle = COULEURS.porteeAttaque;
      contexte.beginPath();
      contexte.arc(
        convertirX(cible.position.x),
        convertirZ(cible.position.z),
        SCENARIO_VISUALISEUR_IA.profil.porteeAttaque * échelle,
        0,
        Math.PI * 2,
      );
      contexte.stroke();

      contexte.fillStyle = COULEURS.cible;
      contexte.beginPath();
      contexte.arc(convertirX(cible.position.x), convertirZ(cible.position.z), 7, 0, Math.PI * 2);
      contexte.fill();
    }

    // Pirate : triangle orienté par le cap.
    const x = convertirX(étape.position.x);
    const z = convertirZ(étape.position.z);
    const taille = 11;
    const avance = { x: x + Math.cos(étape.cap) * taille, z: z - Math.sin(étape.cap) * taille };
    const gauche = {
      x: x + Math.cos(étape.cap + 2.6) * taille * 0.8,
      z: z - Math.sin(étape.cap + 2.6) * taille * 0.8,
    };
    const droite = {
      x: x + Math.cos(étape.cap - 2.6) * taille * 0.8,
      z: z - Math.sin(étape.cap - 2.6) * taille * 0.8,
    };
    contexte.fillStyle = COULEURS.pirate;
    contexte.strokeStyle = COULEURS.pirateContour;
    contexte.lineWidth = 2;
    contexte.beginPath();
    contexte.moveTo(avance.x, avance.z);
    contexte.lineTo(gauche.x, gauche.z);
    contexte.lineTo(droite.x, droite.z);
    contexte.closePath();
    contexte.fill();
    contexte.stroke();
  }

  function trouverCibleAffichée(instant: number): CiblePerçue | undefined {
    let cible: CiblePerçue | undefined;
    for (const entrée of SCENARIO_VISUALISEUR_IA.entreesCibles) {
      if (entrée.instant <= instant) {
        cible = entrée.cible;
      } else {
        break;
      }
    }
    return cible;
  }

  function lireEtat(): EtatVisualiseurIa {
    const étape = trouverEtape(instantCourant);
    return {
      etatFinal: resultat.etatFinal,
      transitions: resultat.transitions,
      instantAffichage: instantCourant,
      etatAffichage: étape?.etat ?? 'inactif',
      position: étape?.position ?? { ...POSITION_DEPART },
      cap: étape?.cap ?? 0,
      progression: étape?.progressionTemporisation ?? 0,
    };
  }

  afficherInstant(instantInitial);

  return {
    resultat,
    afficherInstant,
    lireEtat,
    detruire: () => {
      visualiseur.remove();
      conteneurCanvas.style.opacity = '';
    },
  };
}
