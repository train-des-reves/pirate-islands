export function figerProfondément<T>(valeur: T): T {
  if (typeof valeur !== 'object' || valeur === null || Object.isFrozen(valeur)) {
    return valeur;
  }

  for (const enfant of Object.values(valeur)) {
    if (typeof enfant === 'object' && enfant !== null) {
      figerProfondément(enfant);
    }
  }

  return Object.freeze(valeur);
}
