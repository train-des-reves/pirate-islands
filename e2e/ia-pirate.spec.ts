import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __pirateIslandsE2E?: {
      lireEtatViseurIa?: () => {
        readonly etatFinal: string;
        readonly transitions: readonly string[];
      };
      afficherInstantViseurIa?: (instant: number) => void;
    };
  }
}

test.describe('visualiseur d’IA pirate', () => {
  test('restitue la séquence déterministe patrouille → poursuite → attaque → retour', async ({
    page,
  }) => {
    const erreursPage: string[] = [];
    const erreursConsole: string[] = [];
    page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursConsole.push(message.text());
      }
    });

    await page.goto('/?e2e=1&vue=ia');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.locator('#app')).toHaveAttribute('data-mode', 'ia');
    await expect(page.locator('#app')).toHaveAttribute('data-vue', 'ia');
    await expect(page.getByTestId('visualiseur-ia')).toBeVisible();

    const étatInitial = await page.evaluate(() => window.__pirateIslandsE2E?.lireEtatViseurIa?.());
    expect(étatInitial?.etatFinal).toBe('retour');
    expect(étatInitial?.transitions).toContain('poursuite');
    expect(étatInitial?.transitions).toContain('attaque');

    const chronologie = page.getByTestId('ia-transitions');
    const libellés = await chronologie.locator('li').allTextContents();
    expect(libellés).toContain('Inactif');
    expect(libellés).toContain('Patrouille');
    expect(libellés).toContain('Poursuite');
    expect(libellés).toContain('Attaque');
    expect(libellés).toContain('Retour');

    // Capture de la vue d'ensemble après un instant représentatif.
    await page.evaluate(() => window.__pirateIslandsE2E?.afficherInstantViseurIa?.(5.5));
    await expect(page.getByTestId('ia-etat')).toHaveText('Attaque');
    await page.screenshot({
      path: 'docs/preuves/ia-visualiseur-attaque-1280x720.png',
      fullPage: false,
    });

    // Capture de l'état de retour en fin de scénario.
    await page.evaluate(() => window.__pirateIslandsE2E?.afficherInstantViseurIa?.(7.6));
    await expect(page.getByTestId('ia-etat')).toHaveText('Retour');
    await page.screenshot({
      path: 'docs/preuves/ia-visualiseur-retour-1280x720.png',
      fullPage: false,
    });

    expect(erreursPage).toEqual([]);
    expect(erreursConsole).toEqual([]);
  });
});
