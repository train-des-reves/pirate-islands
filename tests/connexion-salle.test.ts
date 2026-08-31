import { describe, expect, it } from 'vitest';

import {
  classifierErreurConnexion,
  genererNomPecheur,
  estSallePleine,
  reduireEtatConnexion,
  validerNomSaisi,
} from '../apps/client/src/jeu/connexion-salle';

describe('réducteur d’état de connexion', () => {
  it('suit le parcours attendu depuis l’attente jusqu’à l’état connecté', () => {
    let etat = reduireEtatConnexion('attente', { type: 'demarrer' });
    expect(etat).toBe('attente');
    etat = reduireEtatConnexion(etat, { type: 'connecter' });
    expect(etat).toBe('connexion');
    etat = reduireEtatConnexion(etat, { type: 'connecte' });
    expect(etat).toBe('connecte');
  });

  it('classe la salle pleine, la reconnexion et l’échec', () => {
    expect(reduireEtatConnexion('connecte', { type: 'salle-pleine' })).toBe('salle-pleine');
    expect(reduireEtatConnexion('connecte', { type: 'reconnexion' })).toBe('reconnexion');
    expect(reduireEtatConnexion('connecte', { type: 'echec' })).toBe('echec');
    expect(reduireEtatConnexion('connecte', { type: 'deconnecte' })).toBe('deconnecte');
    expect(reduireEtatConnexion('connecte', { type: 'deconnecter' })).toBe('deconnecte');
  });
});

describe('classification des erreurs de connexion', () => {
  it('reconnaît la salle pleine dans le message du SDK Colyseus', () => {
    const classification = classifierErreurConnexion(
      new Error("La salle jeu:abc est déjà complète. (is already full)"),
    );
    expect(classification.etat).toBe('salle-pleine');
    expect(estSallePleine(new Error('room is already full'))).toBe(true);
  });

  it('classe une panne réseau comme serveur indisponible', () => {
    const classification = classifierErreurConnexion(new Error('Failed to fetch'));
    expect(classification.etat).toBe('echec');
    expect(classification.message).toContain('Serveur indisponible');
  });

  it('classe une erreur inconnue en échec générique', () => {
    const classification = classifierErreurConnexion(new Error('Erreur inattendue'));
    expect(classification.etat).toBe('echec');
    expect(classification.message).toContain('Connexion impossible');
  });
});

describe('nom de pêcheur local', () => {
  it('génère un nom stable avec un générateur déterministe', () => {
    const seq = [0, 0];
    const nom = genererNomPecheur(() => seq.shift() ?? 0);
    expect(nom).toMatch(/^Pêcheur-[A-Za-zÀ-ÿ]+-\d{4}$/);
  });

  it('valide la longueur et le caractère obligatoire du nom', () => {
    expect(validerNomSaisi('')).toBeDefined();
    expect(validerNomSaisi('   ')).toBeDefined();
    expect(validerNomSaisi('a'.repeat(33))).toBeDefined();
    expect(validerNomSaisi('Marin')).toBeUndefined();
  });
});
