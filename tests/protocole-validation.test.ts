import { describe, expect, it } from 'vitest';

import {
  LIMITE_ORIGINE_ABS,
  LIMITE_HORODATAGE,
  LIMITE_SEQUENCE_TIR,
  TAILLE_MAX_GRAINE,
  estMessageDegatsE2EValide,
  estMessageIntentionTirValide,
  estMessagePingValide,
  estOptionsConnexionValides,
  validerMessageDegatsE2E,
  validerMessageIntentionTir,
  validerMessagePing,
  validerOptionsConnexion,
} from '@pirate/protocole';

function intentionValide(): Record<string, number> {
  return {
    sequence: 1,
    origineX: 0,
    origineY: 0,
    origineZ: 0,
    directionX: 0,
    directionY: 0,
    directionZ: 1,
    horodatageClient: 1_000,
  };
}

describe('validation runtime du protocole', () => {
  it('accepte les payloads minimaux valides', () => {
    expect(estOptionsConnexionValides(undefined)).toBe(true);
    expect(estOptionsConnexionValides({ graine: 'mvp-defaut' })).toBe(true);
    expect(estMessagePingValide({ horodatage: 1_725_000_000_000 })).toBe(true);
  });

  it('rejette un champ obligatoire absent', () => {
    expect(validerMessagePing({}).valide).toBe(false);
    expect(validerMessagePing({ horodatage: undefined }).valide).toBe(false);
  });

  it('rejette les nombres non finis et hors bornes', () => {
    expect(validerMessagePing({ horodatage: Number.NaN }).valide).toBe(false);
    expect(validerMessagePing({ horodatage: Number.POSITIVE_INFINITY }).valide).toBe(false);
    expect(validerMessagePing({ horodatage: LIMITE_HORODATAGE + 1 }).valide).toBe(false);
    expect(validerMessagePing({ horodatage: -1 }).valide).toBe(false);
  });

  it('rejette les chaînes trop longues et les champs inconnus', () => {
    expect(validerOptionsConnexion({ graine: 'a'.repeat(TAILLE_MAX_GRAINE + 1) }).valide).toBe(
      false,
    );
    expect(validerOptionsConnexion({ graine: ' mvp-defaut' }).valide).toBe(false);
    expect(validerOptionsConnexion({ sessionId: 'usurpée' }).valide).toBe(false);
    expect(validerMessagePing({ horodatage: 1, sessionId: 'usurpée' }).valide).toBe(false);
  });

  it('rejette les conteneurs qui ne sont pas des objets simples', () => {
    expect(validerOptionsConnexion([]).valide).toBe(false);
    expect(validerOptionsConnexion('mvp-defaut').valide).toBe(false);
    expect(validerMessagePing(null).valide).toBe(false);
  });

  it('accepte une intention de tir minimale valide', () => {
    expect(estMessageIntentionTirValide(intentionValide())).toBe(true);
  });

  it('rejette une intention de tir avec séquence invalide ou rejouée', () => {
    expect(validerMessageIntentionTir({ ...intentionValide(), sequence: 0 }).valide).toBe(false);
    expect(
      validerMessageIntentionTir({ ...intentionValide(), sequence: Number.NaN }).valide,
    ).toBe(false);
    expect(
      validerMessageIntentionTir({ ...intentionValide(), sequence: LIMITE_SEQUENCE_TIR + 1 }).valide,
    ).toBe(false);
  });

  it('rejette une intention de tir avec origine ou direction non finie ou nulle', () => {
    expect(
      validerMessageIntentionTir({ ...intentionValide(), origineX: LIMITE_ORIGINE_ABS + 1 }).valide,
    ).toBe(false);
    expect(
      validerMessageIntentionTir({ ...intentionValide(), origineX: Number.POSITIVE_INFINITY }).valide,
    ).toBe(false);
    expect(
      validerMessageIntentionTir({
        ...intentionValide(),
        directionX: 0,
        directionY: 0,
        directionZ: 0,
      }).valide,
    ).toBe(false);
    expect(
      validerMessageIntentionTir({ ...intentionValide(), directionX: Number.NaN }).valide,
    ).toBe(false);
  });

  it('rejette une intention de tir avec champ inconnu ou manquant', () => {
    expect(validerMessageIntentionTir({ ...intentionValide(), sessionId: 'usurpée' }).valide).toBe(
      false,
    );
    expect(
      validerMessageIntentionTir({
        sequence: 1,
        origineX: 0,
        origineY: 0,
        origineZ: 0,
        directionX: 0,
        directionY: 0,
        directionZ: 1,
      }).valide,
    ).toBe(false);
  });

  it('valide le message E2E de dégâts uniquement avec degats finis bornés', () => {
    expect(estMessageDegatsE2EValide({ degats: 25 })).toBe(true);
    expect(validerMessageDegatsE2E({ degats: -1 }).valide).toBe(false);
    expect(validerMessageDegatsE2E({ degats: 101 }).valide).toBe(false);
    expect(validerMessageDegatsE2E({ degats: Number.NaN }).valide).toBe(false);
    expect(validerMessageDegatsE2E({ degats: 25, sante: 100 }).valide).toBe(false);
    expect(validerMessageDegatsE2E({}).valide).toBe(false);
  });
});
