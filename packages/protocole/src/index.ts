export const VERSION_PROTOCOLE = '0.1.0';

export type StatutSante = 'ok';

export interface ReponseSante {
  readonly status: StatutSante;
  readonly service: 'serveur';
  readonly protocolVersion: string;
  readonly timestamp: string;
}

export function creerReponseSante(instant: Date = new Date()): ReponseSante {
  return {
    status: 'ok',
    service: 'serveur',
    protocolVersion: VERSION_PROTOCOLE,
    timestamp: instant.toISOString(),
  };
}

export function estReponseSante(valeur: unknown): valeur is ReponseSante {
  if (typeof valeur !== 'object' || valeur === null) {
    return false;
  }

  const objet = valeur as Record<string, unknown>;
  return (
    objet.status === 'ok' &&
    objet.service === 'serveur' &&
    typeof objet.protocolVersion === 'string' &&
    typeof objet.timestamp === 'string'
  );
}

export * from './messages.js';
export * from './schemas.js';
export * from './validation.js';
export * from './navigation-bateau.js';

