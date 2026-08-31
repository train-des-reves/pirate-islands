import { expect, test } from '@playwright/test';

test.describe('monde ensemencé', () => {
  test('affiche exactement trois îles étiquetées dans la vue d’ensemble', async ({ page }) => {
    const erreursPage: string[] = [];
    const erreursConsole: string[] = [];
    page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursConsole.push(message.text());
      }
    });

    await page.goto('/?e2e=1&graine=mvp-defaut&camera=ensemble');
    await expect(page.locator('#scene-canvas')).toBeVisible();
    await expect(page.locator('#app')).toHaveAttribute('data-mode', 'monde');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.locator('#app')).toHaveAttribute('data-graine', 'mvp-defaut');
    await expect(page.locator('#app')).toHaveAttribute('data-camera', 'ensemble');
    await expect(page.locator('#app')).toHaveAttribute('data-iles', '3');
    await expect(page.locator('#app')).toHaveAttribute('data-diagnostics', 'actifs');
    await expect(page.locator('[data-testid="marqueur-ile"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="marqueur-ile"]').nth(0)).toContainText('Île Aube');
    await expect(page.locator('[data-testid="marqueur-ile"]').nth(1)).toContainText('Île Brume');
    await expect(page.locator('[data-testid="marqueur-ile"]').nth(2)).toContainText('Île Corail');
    await expect(page.getByTestId('serveur-status')).toHaveText('Serveur joignable', {
      timeout: 10_000,
    });

    await page.screenshot({
      path: 'docs/preuves/monde-ensemble-1280x720.png',
      fullPage: false,
    });

    expect(erreursPage).toEqual([]);
    expect(erreursConsole).toEqual([]);
  });

  test('cadre un rivage depuis une hauteur de joueur avec la même graine', async ({ page }) => {
    await page.goto('/?e2e=1&graine=mvp-defaut&camera=rivage');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.locator('#app')).toHaveAttribute('data-camera', 'rivage');
    await expect(page.locator('[data-testid="marqueur-ile"]')).toHaveCount(3);

    await page.screenshot({
      path: 'docs/preuves/monde-rivage-1280x720.png',
      fullPage: false,
    });
  });

  test('ne montre aucun marqueur de diagnostic dans la vue normale', async ({ page }) => {
    await page.goto('/?graine=mvp-defaut&camera=ensemble');
    await expect(page.locator('#app')).toHaveAttribute('data-diagnostics', 'inactifs');
    await expect(page.locator('[data-testid="marqueur-ile"]')).toHaveCount(0);
  });
});
