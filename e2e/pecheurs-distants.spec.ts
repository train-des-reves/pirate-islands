import { expect, test, type Page } from '@playwright/test';

interface EtatPecheurE2E {
  readonly sessionId: string;
  readonly nom: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
}

interface EtatHarnessPecheurs {
  readonly salleId: string | undefined;
  readonly sessionId: string | undefined;
  readonly pêcheursDistants: readonly EtatPecheurE2E[];
}

async function lireEtatPecheurs(page: Page): Promise<EtatHarnessPecheurs> {
  return page.evaluate(() => {
    const crochet = (
      window as unknown as {
        __pirateIslandsE2E?: { lireEtatPecheurs?: () => EtatHarnessPecheurs };
      }
    ).__pirateIslandsE2E;
    if (!crochet?.lireEtatPecheurs) {
      throw new Error('Le crochet E2E des pêcheurs distants est absent.');
    }
    return crochet.lireEtatPecheurs();
  });
}

async function verrouillerPointeur(page: Page): Promise<void> {
  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: { verrouillerPointeur: () => void } })
      .__pirateIslandsE2E;
    crochet?.verrouillerPointeur();
  });
  await expect(page.locator('#app')).toHaveAttribute('data-pointeur', 'verrouille');
}

function urlModePecheurs(nom: string, salle?: string): string {
  const paramètres = new URLSearchParams({ e2e: '1', vue: 'pecheurs', nom });
  if (salle) {
    paramètres.set('room', salle);
  }
  return '/?' + paramètres.toString();
}

test.describe('pêcheurs distants synchronisés', () => {
  test.setTimeout(60_000);

  test('affiche, anime puis retire le pêcheur distant dans une fenêtre isolée', async ({
    page,
    browser,
  }) => {
    const erreursPremier: string[] = [];
    const erreursSecond: string[] = [];
    page.on('pageerror', (erreur) => erreursPremier.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursPremier.push(message.text());
      }
    });

    const contexteSecondJoueur = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const pageSecondJoueur = await contexteSecondJoueur.newPage();
    pageSecondJoueur.on('pageerror', (erreur) => erreursSecond.push(erreur.message));
    pageSecondJoueur.on('console', (message) => {
      if (message.type() === 'error') {
        erreursSecond.push(message.text());
      }
    });

    try {
      await page.goto(urlModePecheurs('Pêcheur-Aube-0001'));
      await expect(page.locator('#app')).toHaveAttribute('data-vue', 'pecheurs');
      await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready', {
        timeout: 30_000,
      });
      await expect
        .poll(() =>
          page.evaluate(() =>
            Boolean(
              (window as unknown as { __pirateIslandsE2E?: { lireEtatPecheurs?: unknown } })
                .__pirateIslandsE2E?.lireEtatPecheurs,
            ),
          ),
        )
        .toBe(true);
      await expect
        .poll(async () => (await lireEtatPecheurs(page)).salleId, { timeout: 15_000 })
        .toBeDefined();

      const identifiantSalle = (await lireEtatPecheurs(page)).salleId;
      expect(identifiantSalle).toBeDefined();
      expect(identifiantSalle).not.toBe('');

      await pageSecondJoueur.goto(urlModePecheurs('Pêcheur-Brume-0002', identifiantSalle));
      await expect(pageSecondJoueur.locator('#app')).toHaveAttribute('data-vue', 'pecheurs');
      await expect(pageSecondJoueur.locator('#app')).toHaveAttribute('data-scene', 'ready', {
        timeout: 30_000,
      });

      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                document.querySelectorAll('[data-testid="etiquette-pecheur"]').length,
            ),
          { timeout: 15_000 },
        )
        .toBe(1);

      const étatPremier = await lireEtatPecheurs(page);
      expect(étatPremier.pêcheursDistants).toHaveLength(1);
      expect(étatPremier.pêcheursDistants[0]?.nom).toBe('Pêcheur-Brume-0002');
      expect(étatPremier.pêcheursDistants[0]?.sessionId).toBeDefined();
      expect(étatPremier.sessionId).not.toBe(étatPremier.pêcheursDistants[0]?.sessionId);

      await expect(page.getByTestId('etiquette-pecheur')).toHaveText('Pêcheur-Brume-0002');

      await verrouillerPointeur(pageSecondJoueur);
      const positionAvant = (await lireEtatPecheurs(page)).pêcheursDistants[0]?.position;
      await pageSecondJoueur.keyboard.down('w');
      await expect
        .poll(async () => {
          const position = (await lireEtatPecheurs(page)).pêcheursDistants[0]?.position;
          return Math.hypot(
            (position?.x ?? 0) - (positionAvant?.x ?? 0),
            (position?.z ?? 0) - (positionAvant?.z ?? 0),
          );
        }, { timeout: 5_000 })
        .toBeGreaterThan(0.2);
      await pageSecondJoueur.keyboard.up('w');

      await page.screenshot({
        path: 'docs/preuves/playwright-resultats/pecheurs-distants-premier.png',
        fullPage: false,
      });
      await pageSecondJoueur.screenshot({
        path: 'docs/preuves/playwright-resultats/pecheurs-distants-second.png',
        fullPage: false,
      });

      await contexteSecondJoueur.close();
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                document.querySelectorAll('[data-testid="etiquette-pecheur"]').length,
            ),
          { timeout: 15_000 },
        )
        .toBe(0);
      expect((await lireEtatPecheurs(page)).pêcheursDistants).toHaveLength(0);

      expect(erreursPremier).toEqual([]);
      expect(erreursSecond).toEqual([]);
    } finally {
      if (contexteSecondJoueur.pages().length) {
        await contexteSecondJoueur.close();
      }
    }
  });
});
