import type { ReponseSante } from '@pirate/protocole';

export const PORT_SERVEUR_DE_TEST = 0;

export function reponseSanteValide(valeur: unknown): valeur is ReponseSante {
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
