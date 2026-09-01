import { expect, test, type Page } from '@playwright/test';

type EtatMaritime = {
  readonly salleId: string | undefined;
  readonly graine: string | undefined;
  readonly bateaux: readonly {
    readonly id: string;
    readonly statut: string;
    readonly vitesse: number;
    readonly cibleId: string;
    readonly attaqueActive: boolean;
    readonly equipage: number;
    readonly sillage: number;
  }[];
};

type CrochetMaritime = {
  readonly lireEtatMaritime?: () => EtatMaritime;
  readonly neutraliserPirateMaritime?: (cibleId?: string) => void;
};

async function lireEtat(page: Page): Promise<EtatMaritime> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetMaritime })
      .__pirateIslandsE2E;
    if (!crochet?.lireEtatMaritime) {
      throw new Error('Le crochet E2E maritime est absent.');
    }
    return crochet.lireEtatMaritime();
  });
}

function urlMaritime(nom: string, room?: string): string {
  const paramètres = new URLSearchParams({
    e2e: '1',
    vue: 'pirates-maritimes',
    graine: 'rencontre-maritime-e2e',
    nom,
  });
  if (room) {
    paramètres.set('room', room);
  }
  return '/?' + paramètres.toString();
}

test.describe('rencontre maritime autoritaire', () => {
  test('synchronise patrouille, poursuite, attaque, dégâts et neutralisation à deux observateurs', async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    const erreursPremier: string[] = [];
    const erreursSecond: string[] = [];
    page.on('pageerror', (erreur) => erreursPremier.push(erreur.message));
    page.on(
      'console',
      (message) => message.type() === 'error' && erreursPremier.push(message.text()),
    );

    const contexteSecond = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pageSecond = await contexteSecond.newPage();
    pageSecond.on('pageerror', (erreur) => erreursSecond.push(erreur.message));
    pageSecond.on(
      'console',
      (message) => message.type() === 'error' && erreursSecond.push(message.text()),
    );

    try {
      await page.goto(urlMaritime('Pêcheur-Aube-0001'));
      await expect(page.locator('#app')).toHaveAttribute('data-mode', 'pirates-maritimes');
      await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready', {
        timeout: 30_000,
      });
      await expect
        .poll(async () => (await lireEtat(page)).bateaux.length, { timeout: 15_000 })
        .toBe(2);

      const salle = await page.locator('[data-testid="diagnostic-salle-id"]').innerText();
      const identifiantSalle = salle.replace('Salle : ', '').trim();
      expect(identifiantSalle).not.toBe('en attente…');
      await pageSecond.goto(urlMaritime('Pêcheur-Brume-0002', identifiantSalle));
      await expect(pageSecond.locator('#app')).toHaveAttribute('data-scene', 'ready', {
        timeout: 30_000,
      });
      await expect
        .poll(async () => (await lireEtat(pageSecond)).bateaux.length, { timeout: 15_000 })
        .toBe(2);

      const étatsVus = new Set<string>();
      await expect
        .poll(
          async () => {
            for (const bateau of (await lireEtat(page)).bateaux) {
              étatsVus.add(bateau.statut);
            }
            return étatsVus.has('attaque');
          },
          { timeout: 15_000 },
        )
        .toBe(true);

      const attaque = (await lireEtat(page)).bateaux.find((bateau) => bateau.statut === 'attaque');
      expect(attaque).toBeDefined();
      expect(attaque?.cibleId).not.toBe('');
      expect(attaque?.equipage).toBe(2);
      expect(
        (await lireEtat(pageSecond)).bateaux.find((bateau) => bateau.id === attaque?.id),
      ).toEqual(expect.objectContaining({ statut: 'attaque', attaqueActive: true, equipage: 2 }));

      await expect
        .poll(
          async () =>
            (await lireEtat(page)).bateaux.find((bateau) => bateau.id === attaque?.id)?.sillage ??
            0,
          { timeout: 8_000 },
        )
        .toBeGreaterThan(0);
      await page.screenshot({ path: 'docs/preuves/pirates-maritimes-attaque-1280x720.png' });

      await page.evaluate((id) => {
        (
          window as unknown as { __pirateIslandsE2E?: CrochetMaritime }
        ).__pirateIslandsE2E?.neutraliserPirateMaritime?.(id);
      }, attaque?.id);
      await expect
        .poll(
          async () =>
            (await lireEtat(page)).bateaux.find((bateau) => bateau.id === attaque?.id)?.statut,
          { timeout: 8_000 },
        )
        .toBe('detruit');
      await expect
        .poll(
          async () =>
            (await lireEtat(pageSecond)).bateaux.find((bateau) => bateau.id === attaque?.id)
              ?.statut,
          { timeout: 8_000 },
        )
        .toBe('detruit');
      const détruit = (await lireEtat(page)).bateaux.find((bateau) => bateau.id === attaque?.id);
      expect(détruit?.sillage).toBe(0);
      expect(détruit?.equipage).toBe(2);
      await pageSecond.screenshot({
        path: 'docs/preuves/pirates-maritimes-second-observateur-1280x720.png',
      });

      expect(erreursPremier).toEqual([]);
      expect(erreursSecond).toEqual([]);
    } finally {
      await contexteSecond.close();
    }
  });
});
