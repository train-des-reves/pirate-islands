/**
 * Générateur pseudo-aléatoire déterministe partagé par les règles de coeur-jeu.
 *
 * Aucune dépendance à l'horloge réelle : `creerAleatoire` dérive toujours la même
 * séquence d'une même graine, ce qui garantit des tests et des simulations stables.
 */

/** Convertit une chaîne de graine en un entier 32 bits non signé. */
export function entierGraine(graine: string): number {
  let hash = 2166136261;

  for (let index = 0; index < graine.length; index += 1) {
    hash ^= graine.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/** Crée une fonction de tirage uniforme sur [0, 1) à partir d'une graine. */
export function creerAleatoire(graine: string): () => number {
  let état = entierGraine(graine) || 0x9e3779b9;

  return () => {
    état = (état + 0x6d2b79f5) >>> 0;
    let valeur = état;
    valeur = Math.imul(valeur ^ (valeur >>> 15), valeur | 1);
    valeur ^= valeur + Math.imul(valeur ^ (valeur >>> 7), valeur | 61);
    return ((valeur ^ (valeur >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tirage d'un nombre dans l'intervalle [minimum, maximum[. */
export function plageAleatoire(alea: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * alea();
}
