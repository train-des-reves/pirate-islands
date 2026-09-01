import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

type EtatMaritime = {
  readonly salleId: string | undefined;
  readonly graine: string | undefined;
  readonly bateaux: readonly {
    readonly id: string;
    readonly routeId: string;
    readonly statut: string;
    readonly vitesse: number;
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
    readonly equipage: number;
    readonly attaqueActive: boolean;
  }[];
};

type CrochetMaritime = {
  readonly lireEtatMaritime?: () => EtatMaritime;
  readonly tirerReseau?: (cibleId?: string) => void;
  readonly lireCombat?: () => {
    readonly santeJoueur: number;
    readonly pirateNeutralise: boolean;
  };
};

async function lireEtat(page: Page): Promise<EtatMaritime> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetMaritime })
      .__pirateIslandsE2E;
    if (!crochet?.lireEtatMaritime) {
      throw new Error('Le crochet maritime est absent.');
    }
    return crochet.lireEtatMaritime();
  });
}

async function attendreCrochet(page: Page): Promise<void> {
  await expect
    .poll(() => lireEtat(page), { timeout: 15_000 })
    .toMatchObject({ graine: 'e2e-maritime' });
  await expect
    .poll(() => lireEtat(page), { timeout: 5_000 })
    .toMatchObject({ bateaux: [{ equipage: 2 }] });
}

test.describe('rencontre maritime autoritaire', () => {
  test('synchronise route, poursuite, attaque, dégâts et neutralisation sur deux observateurs', async ({
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

    await page.goto('/?e2e=1&vue=pirates-maritimes&graine=e2e-maritime');
    await expect(page.locator('#app')).toHaveAttribute('data-mode', 'pirates-maritimes');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await attendreCrochet(page);
    const initial = await lireEtat(page);
    expect(initial.bateaux[0]?.routeId).toBe('route-maritime-1');
    expect(initial.bateaux[0]?.equipage).toBe(2);

    const identifiantSalle = initial.salleId;
    expect(identifiantSalle).toBeTruthy();
    const contexteSecond = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const second = await contexteSecond.newPage();
    second.on('pageerror', (erreur) => erreursSecond.push(erreur.message));
    second.on(
      'console',
      (message) => message.type() === 'error' && erreursSecond.push(message.text()),
    );

    try {
      await second.goto(
        `/?e2e=1&vue=pirates-maritimes&graine=e2e-maritime&room=${encodeURIComponent(identifiantSalle!)}`,
      );
      await attendreCrochet(second);
      await expect
        .poll(() => lireEtat(second))
        .toMatchObject({
          salleId: identifiantSalle,
          bateaux: [{ equipage: 2 }],
        });
      await page.screenshot({ path: 'docs/preuves/pirates-maritimes-patrouille-1280x720.png' });

      await expect
        .poll(async () => (await lireEtat(page)).bateaux[0]?.attaqueActive, { timeout: 12_000 })
        .toBe(true);
      await expect
        .poll(
          async () =>
            await page.evaluate(() => {
              const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetMaritime })
                .__pirateIslandsE2E;
              return crochet?.lireCombat?.().santeJoueur ?? 100;
            }),
          { timeout: 5_000 },
        )
        .toBeLessThan(100);
      await page.screenshot({ path: 'docs/preuves/pirates-maritimes-attaque-1280x720.png' });

      const équipageId = (await lireEtat(page)).bateaux[0]!.id + '-equipage-1';
      for (let index = 0; index < 4; index += 1) {
        await page.evaluate((id) => {
          const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetMaritime })
            .__pirateIslandsE2E;
          crochet?.tirerReseau?.(id);
        }, équipageId);
        await page.waitForTimeout(180);
      }

      await expect
        .poll(async () => (await lireEtat(page)).bateaux[0]?.statut, { timeout: 5_000 })
        .toBe('detruit');
      await expect.poll(async () => (await lireEtat(second)).bateaux[0]?.statut).toBe('detruit');
      await expect
        .poll(
          async () =>
            await page.evaluate(() => {
              const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetMaritime })
                .__pirateIslandsE2E;
              return crochet?.lireCombat?.().pirateNeutralise ?? false;
            }),
        )
        .toBe(true);

      await page.screenshot({ path: 'docs/preuves/pirates-maritimes-detruit-1280x720.png' });
      await page.screenshot({ path: 'docs/preuves/pirates-maritimes-e2e-1280x720.png' });
      await second.screenshot({ path: 'docs/preuves/pirates-maritimes-observateur-1280x720.png' });
      expect(erreursPremier).toEqual([]);
      expect(erreursSecond).toEqual([]);
    } finally {
      await contexteSecond.close();
    }
  });
});
