import { describe, expect, it } from 'vitest';

import {
  annulerReglages,
  appliquerReglages,
  chargerReglagesDepuisCookie,
  construireCookieReglages,
  creerEtatReglages,
  decoderReglages,
  DUREE_COOKIE_REGLAGES_SECONDES,
  encoderReglages,
  enregistrerReglagesCookie,
  modifierInversionReglages,
  modifierLiaisonReglages,
  NOM_COOKIE_REGLAGES,
  ouvrirReglages,
  REGLAGES_PAR_DEFAUT,
  reinitialiserReglages,
  TAILLE_MAX_COOKIE_REGLAGES,
  validerLiaison,
  validerReglages,
  VERSION_REGLAGES,
} from '../apps/client/src/interface/reglages';

describe('codec et cookie des réglages', () => {
  it('encode et décode les réglages sans perdre les variantes de clavier', () => {
    const réglages = {
      inversionVerticale: true,
      liaisons: {
        avancer: ['KeyZ'],
        reculer: ['KeyS'],
        gauche: ['KeyQ', 'KeyA'],
        droite: ['KeyD'],
        interagir: ['KeyE'],
        tirer: ['Mouse0'],
        pause: ['Escape'],
      },
    } as const;

    const valeur = encoderReglages(réglages);
    expect(valeur).not.toContain('{');
    expect(decoderReglages(valeur)).toEqual(réglages);
  });

  it('construit un cookie unique avec les attributs de durée et de portée requis', () => {
    const cookie = construireCookieReglages(REGLAGES_PAR_DEFAUT);

    expect(cookie.startsWith(NOM_COOKIE_REGLAGES + '=')).toBe(true);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=' + DUREE_COOKIE_REGLAGES_SECONDES);
    expect(cookie.match(new RegExp(NOM_COOKIE_REGLAGES, 'g'))).toHaveLength(1);
  });

  it('écrit puis relit le cookie dans une cible isolée', () => {
    const cible = { cookie: '' };

    enregistrerReglagesCookie(REGLAGES_PAR_DEFAUT, cible);

    expect(cible.cookie).toContain(NOM_COOKIE_REGLAGES + '=');
    expect(chargerReglagesDepuisCookie(cible.cookie)).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it('rejette une valeur absente, mal formée, trop grande ou d’une version inconnue', () => {
    expect(decoderReglages('')).toBeUndefined();
    expect(decoderReglages('%7B')).toBeUndefined();
    expect(decoderReglages('x'.repeat(TAILLE_MAX_COOKIE_REGLAGES + 1))).toBeUndefined();

    const versionInconnue = encodeURIComponent(
      JSON.stringify({
        v: VERSION_REGLAGES + 1,
        inversionVerticale: false,
        liaisons: REGLAGES_PAR_DEFAUT.liaisons,
      }),
    );
    expect(decoderReglages(versionInconnue)).toBeUndefined();

    expect(
      chargerReglagesDepuisCookie(
        NOM_COOKIE_REGLAGES +
          '=' +
          encodeURIComponent(
            JSON.stringify({
              v: VERSION_REGLAGES,
              inversionVerticale: false,
              liaisons: { ...REGLAGES_PAR_DEFAUT.liaisons, avancer: ['KeyZ', 'KeyZ'] },
            }),
          ),
      ),
    ).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it('revient aux défauts si le cookie est absent, invalide ou dupliqué', () => {
    const cookieValide = construireCookieReglages(REGLAGES_PAR_DEFAUT);
    const valeur = cookieValide.slice(cookieValide.indexOf('=') + 1).split(';', 1)[0];

    expect(chargerReglagesDepuisCookie('')).toEqual(REGLAGES_PAR_DEFAUT);
    expect(chargerReglagesDepuisCookie(NOM_COOKIE_REGLAGES + '=%7B')).toEqual(REGLAGES_PAR_DEFAUT);
    expect(
      chargerReglagesDepuisCookie(
        NOM_COOKIE_REGLAGES + '=' + valeur + '; ' + NOM_COOKIE_REGLAGES + '=' + valeur,
      ),
    ).toEqual(REGLAGES_PAR_DEFAUT);
  });
});

describe('validation des réglages', () => {
  it('signale un doublon au lieu de remplacer silencieusement une action', () => {
    const validation = validerLiaison('avancer', 'KeyS', REGLAGES_PAR_DEFAUT.liaisons);

    expect(validation.valide).toBe(false);
    expect(validation.erreur).toMatchObject({
      type: 'doublon',
      action: 'avancer',
      autreAction: 'reculer',
    });
  });

  it('refuse les touches réservées et les codes inconnus', () => {
    expect(validerLiaison('avancer', 'Escape', REGLAGES_PAR_DEFAUT.liaisons).erreur).toMatchObject({
      type: 'touche-reservee',
    });
    expect(validerLiaison('avancer', 'Tab', REGLAGES_PAR_DEFAUT.liaisons).erreur).toMatchObject({
      type: 'touche-reservee',
    });
    expect(
      validerLiaison('avancer', 'CodeInventé', REGLAGES_PAR_DEFAUT.liaisons).erreur,
    ).toMatchObject({
      type: 'touche-invalide',
    });
    expect(validerLiaison('pause', 'Escape', REGLAGES_PAR_DEFAUT.liaisons).valide).toBe(true);
  });

  it('valide un objet complet et rejette les liaisons absentes ou dupliquées', () => {
    expect(validerReglages(REGLAGES_PAR_DEFAUT).valide).toBe(true);
    expect(
      validerReglages({
        ...REGLAGES_PAR_DEFAUT,
        liaisons: { ...REGLAGES_PAR_DEFAUT.liaisons, avancer: ['KeyZ', 'KeyZ'] },
      }).erreurs,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'doublon', action: 'avancer' })]),
    );
    expect(
      validerReglages({
        inversionVerticale: false,
        liaisons: { ...REGLAGES_PAR_DEFAUT.liaisons, tirer: [] },
      }).valide,
    ).toBe(false);
  });
});

describe('état du brouillon', () => {
  it('applique, annule et réinitialise sans partager les objets', () => {
    const ouvert = ouvrirReglages(creerEtatReglages());
    const modifié = modifierLiaisonReglages(
      modifierInversionReglages(ouvert, true),
      'avancer',
      'KeyZ',
    );

    expect(modifié.applique).toEqual(REGLAGES_PAR_DEFAUT);
    expect(modifié.brouillon.inversionVerticale).toBe(true);
    expect(modifié.brouillon.liaisons.avancer).toEqual(['KeyZ']);

    const annulé = annulerReglages(modifié);
    expect(annulé.ouvert).toBe(false);
    expect(annulé.applique).toEqual(REGLAGES_PAR_DEFAUT);
    expect(annulé.brouillon).toEqual(REGLAGES_PAR_DEFAUT);

    const appliqué = appliquerReglages(modifié);
    expect(appliqué.applique).toBe(true);
    expect(appliqué.etat.ouvert).toBe(false);
    expect(appliqué.etat.applique).toEqual(modifié.brouillon);
    expect(appliqué.etat.brouillon).toEqual(modifié.brouillon);
    expect(appliqué.etat.applique).not.toBe(appliqué.etat.brouillon);

    const réinitialisé = reinitialiserReglages(modifié);
    expect(réinitialisé.applique).toEqual(modifié.applique);
    expect(réinitialisé.brouillon).toEqual(REGLAGES_PAR_DEFAUT);
    expect(réinitialisé.message).toContain('défaut');

    const défautsAppliqués = appliquerReglages(réinitialisé);
    expect(défautsAppliqués.applique).toBe(true);
    expect(défautsAppliqués.etat.applique).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it('refuse de sauvegarder un brouillon invalide', () => {
    const état = modifierLiaisonReglages(ouvrirReglages(creerEtatReglages()), 'avancer', 'Escape');
    const résultat = appliquerReglages(état);

    expect(résultat.applique).toBe(false);
    expect(résultat.erreurs[0]).toMatchObject({ type: 'touche-reservee' });
    expect(résultat.etat.ouvert).toBe(true);
  });
});
