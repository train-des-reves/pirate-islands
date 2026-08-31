import { describe, expect, it } from 'vitest';

import {
  LIMITE_HORODATAGE,
  TAILLE_MAX_GRAINE,
  estMessagePingValide,
  estOptionsConnexionValides,
  validerMessagePing,
  validerOptionsConnexion,
} from '@pirate/protocole';

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
});
