import { describe, expect, it } from 'vitest';

import {
  DELAI_MORSURE_MAX_MS,
  DELAI_MORSURE_MIN_MS,
  DUREE_FENETRE_MORSURE_MS,
  ESPECES_POISSON,
  ETAT_PECHE_INACTIF,
  annulerPeche,
  avancerPeche,
  calculerPrevisionPeche,
  genererMonde,
  lancerPeche,
  pointDansZonePeche,
  releverPeche,
  trouverEspece,
  type EspecePeche,
  type EtatPeche,
  type ZonePeche,
  zonePecheValide,
} from '@pirate/coeur-jeu';

function zoneDeMonde(monde: ReturnType<typeof genererMonde>): ZonePeche {
  const zone = monde.zonesPeche[0];
  if (!zone) {
    throw new Error('Le monde doit exposer au moins une zone de pêche.');
  }
  return zone;
}

function lancerAvec(
  monde: ReturnType<typeof genererMonde>,
  zone: ZonePeche,
  sequence: number,
  graine = 'peche-mvp-v1',
  temps = 0,
): EtatPeche {
  return lancerPeche(ETAT_PECHE_INACTIF, monde, zone.id, graine, sequence, temps);
}

describe('règles déterministes de pêche', () => {
  it('reproduit exactement la même prévision et le même état pour une même graine et séquence', () => {
    const première = calculerPrevisionPeche('peche-mvp-v1', 7);
    const seconde = calculerPrevisionPeche('peche-mvp-v1', 7);
    expect(première).toEqual(seconde);

    const monde = genererMonde('peche-mvp-v1');
    const zone = zoneDeMonde(monde);
    const étatPremier = lancerAvec(monde, zone, 7);
    const étatSecond = lancerAvec(monde, zone, 7);
    expect(étatPremier).toEqual(étatSecond);
    expect(étatPremier.phase).toBe('attente');
  });

  it('répartit sur au moins 100 séquences plusieurs délais et plusieurs espèces', () => {
    const délais = new Set<number>();
    const espèces = new Set<EspecePeche>();

    for (let séquence = 0; séquence < 100; séquence += 1) {
      const prévision = calculerPrevisionPeche('peche-mvp-v1', séquence);
      expect(prévision.delaiMorsureMs).toBeGreaterThanOrEqual(DELAI_MORSURE_MIN_MS);
      expect(prévision.delaiMorsureMs).toBeLessThanOrEqual(DELAI_MORSURE_MAX_MS);
      délais.add(prévision.delaiMorsureMs);
      espèces.add(prévision.espece);

      const espece = trouverEspece(prévision.espece);
      expect(espece).toBeDefined();
      if (espece) {
        expect(prévision.taille).toBeGreaterThanOrEqual(espece.tailleMin);
        expect(prévision.taille).toBeLessThanOrEqual(espece.tailleMax);
      }
    }

    expect(délais.size).toBeGreaterThan(1);
    expect(espèces.size).toBeGreaterThan(1);
  });

  it('applique les limites exactes de la fenêtre de morsure', () => {
    const monde = genererMonde('peche-mvp-v1');
    const zone = zoneDeMonde(monde);
    const séquence = 42;
    const prévision = calculerPrevisionPeche('peche-mvp-v1', séquence);
    const début = prévision.delaiMorsureMs;
    const fin = début + DUREE_FENETRE_MORSURE_MS;

    expect(releverPeche(lancerAvec(monde, zone, séquence), début - 1).resultat).toBe('trop_tot');
    expect(releverPeche(lancerAvec(monde, zone, séquence), début).resultat).toBe('prise');
    expect(releverPeche(lancerAvec(monde, zone, séquence), fin).resultat).toBe('prise');
    expect(releverPeche(lancerAvec(monde, zone, séquence), fin + 1).resultat).toBe('trop_tard');
  });

  it('gère le lancer valide, le double lancer, le relevé sans ligne et le double relevé', () => {
    const monde = genererMonde('peche-mvp-v1');
    const zone = zoneDeMonde(monde);
    const lancer = lancerAvec(monde, zone, 10);
    expect(lancer.phase).toBe('attente');

    const double = lancerPeche(lancer, monde, zone.id, 'peche-mvp-v1', 11, 0);
    expect(double).toBe(lancer);

    expect(releverPeche(ETAT_PECHE_INACTIF, 0)).toBe(ETAT_PECHE_INACTIF);

    expect(lancer.delaiMorsureMs).toBeDefined();
    expect(lancer.fenetreMorsureMs).toBeDefined();
    const milieu = lancer.lanceAuMs + (lancer.delaiMorsureMs ?? 0) + Math.floor((lancer.fenetreMorsureMs ?? 0) / 2);
    const réussite = releverPeche(lancer, milieu);
    expect(réussite.resultat).toBe('prise');
    expect(releverPeche(réussite, milieu + 1)).toBe(réussite);
  });

  it('couvre l’annulation avant et après la morsure', () => {
    const monde = genererMonde('peche-mvp-v1');
    const zone = zoneDeMonde(monde);

    const avantMorsure = lancerAvec(monde, zone, 20);
    expect(avantMorsure.delaiMorsureMs).toBeDefined();
    const annulationAttente = avancerPeche(avantMorsure, (avantMorsure.delaiMorsureMs ?? 0) - 1);
    expect(annulerPeche(annulationAttente, annulationAttente.tempsCourantMs).resultat).toBe(
      'annulee',
    );

    const dansMorsure = avancerPeche(avantMorsure, avantMorsure.delaiMorsureMs ?? 0);
    expect(dansMorsure.phase).toBe('morsure');
    expect(annulerPeche(dansMorsure, dansMorsure.tempsCourantMs).resultat).toBe('annulee');
  });

  it('produit le même résultat final quel que soit le découpage du temps', () => {
    const monde = genererMonde('peche-mvp-v1');
    const zone = zoneDeMonde(monde);
    const séquence = 33;
    const prévision = calculerPrevisionPeche('peche-mvp-v1', séquence);
    const fin = prévision.delaiMorsureMs + DUREE_FENETRE_MORSURE_MS;

    const uneÉtape = avancerPeche(lancerAvec(monde, zone, séquence), fin + 5);
    expect(uneÉtape.resultat).toBe('trop_tard');

    const plusieursÉtapes = lancerAvec(monde, zone, séquence);
    const intermédiaire = avancerPeche(plusieursÉtapes, 300);
    const morsure = avancerPeche(intermédiaire, prévision.delaiMorsureMs);
    const final = avancerPeche(morsure, fin + 5);

    expect(morsure.phase).toBe('morsure');
    expect(final.phase).toBe('terminee');
    expect(final.resultat).toBe('trop_tard');
    expect(final.espece).toBe(uneÉtape.espece);
    expect(final.taille).toBe(uneÉtape.taille);
  });

  it('refuse les entrées invalides sans muter l’état précédent', () => {
    const monde = genererMonde('peche-mvp-v1');
    const zone = zoneDeMonde(monde);
    const étatActif = lancerAvec(monde, zone, 50);

    expect(avancerPeche(étatActif, Number.NaN)).toBe(étatActif);
    expect(avancerPeche(étatActif, Number.POSITIVE_INFINITY)).toBe(étatActif);
    expect(avancerPeche(étatActif, Number.NEGATIVE_INFINITY)).toBe(étatActif);
    expect(avancerPeche(étatActif, étatActif.tempsCourantMs - 1)).toBe(étatActif);
    expect(releverPeche(étatActif, Number.NaN)).toBe(étatActif);
    expect(annulerPeche(étatActif, -1)).toBe(étatActif);

    expect(
      lancerPeche(ETAT_PECHE_INACTIF, monde, zone.id, 'peche-mvp-v1', -1, 0),
    ).toBe(ETAT_PECHE_INACTIF);
    expect(
      lancerPeche(ETAT_PECHE_INACTIF, monde, zone.id, 'peche-mvp-v1', 2.5, 0),
    ).toBe(ETAT_PECHE_INACTIF);

    expect(
      lancerPeche(ETAT_PECHE_INACTIF, monde, 'zone-inconnue', 'peche-mvp-v1', 50, 0).resultat,
    ).toBe('hors_zone');
    expect(() => calculerPrevisionPeche('peche-mvp-v1', -2)).toThrow();
    expect(() => calculerPrevisionPeche('peche-mvp-v1', 1.5)).toThrow();
    expect(() => calculerPrevisionPeche('', 1)).toThrow();
  });

  it('détermine un point dans la zone, sur la limite et juste dehors', () => {
    const monde = genererMonde('peche-mvp-v1');
    const zone = zoneDeMonde(monde);
    const centre = zone.centre;

    expect(
      pointDansZonePeche(zone, { x: centre.x, y: centre.y, z: centre.z }),
    ).toBe(true);
    expect(
      pointDansZonePeche(zone, { x: centre.x + zone.rayon, y: centre.y, z: centre.z }),
    ).toBe(true);
    expect(
      pointDansZonePeche(zone, { x: centre.x + zone.rayon + 0.001, y: centre.y, z: centre.z }),
    ).toBe(false);
  });

  it('attache au moins une zone valide à chacune des trois îles', () => {
    const monde = genererMonde('peche-mvp-v1');
    expect(monde.iles).toHaveLength(3);

    const identifiants = monde.zonesPeche.map((zone) => zone.id);
    expect(new Set(identifiants).size).toBe(identifiants.length);

    for (const zone of monde.zonesPeche) {
      expect(zonePecheValide(monde, zone)).toBe(true);
      expect(Number.isFinite(zone.rayon)).toBe(true);
      expect(zone.rayon).toBeGreaterThan(0);
      expect(monde.iles.some((ile) => ile.id === zone.ileId)).toBe(true);
    }

    for (const ile of monde.iles) {
      expect(monde.zonesPeche.filter((zone) => zone.ileId === ile.id).length).toBeGreaterThanOrEqual(
        1,
      );
    }
  });

  it('n’importe ni Babylon.js, ni Colyseus, ni API navigateur dans coeur-jeu', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const racine = resolve(process.cwd(), 'packages/coeur-jeu');
    const packageJson = JSON.parse(await readFile(resolve(racine, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    const dépendances = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.peerDependencies ?? {}),
    };
    expect(dépendances['babylonjs']).toBeUndefined();
    expect(dépendances['@colyseus/schema']).toBeUndefined();
    expect(dépendances['colyseus']).toBeUndefined();

    const fichier = await readdir(resolve(racine, 'src'));
    let contenu = '';
    for (const nom of fichier) {
      contenu += await readFile(resolve(racine, 'src', nom), 'utf8');
    }

    expect(contenu).not.toMatch(/from ['"]babylonjs['"]/);
    expect(contenu).not.toMatch(/colyseus/);
    expect(contenu).not.toMatch(/\bdocument\./);
    expect(contenu).not.toMatch(/\bwindow\./);
    expect(contenu).not.toMatch(/Math\.random/);
    expect(contenu).not.toMatch(/Date\.now/);
    expect(contenu).not.toMatch(/performance\.now/);

    const module = await import('@pirate/coeur-jeu');
    expect(module).toBeDefined();
    expect(ESPECES_POISSON).toHaveLength(3);
  });
});
