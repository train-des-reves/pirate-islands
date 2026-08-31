import { expect, test } from '@playwright/test';

test.describe('acteur pirate terrestre', () => {
  test('affiche une rangée déterministe des cinq états', async ({ page }) => {
    const erreursPage: string[] = [];
    const erreursConsole: string[] = [];
    page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursConsole.push(message.text());
      }
    });

    await page.goto('/?e2e=1&vue=pirates&structure=1');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.locator('#app')).toHaveAttribute('data-mode', 'pirates');
    await expect(page.locator('#app')).toHaveAttribute('data-vue', 'pirates');
    await expect(page.locator('#app')).toHaveAttribute('data-structure', 'oui');
    await expect(page.getByTestId('pirate-fixture')).toHaveCount(5);
    await expect(page.getByTestId('pirates-planche')).toBeVisible();
    await expect(page.getByTestId('pirate-planche-carte')).toHaveCount(5);
    await expect(page.getByTestId('pirate-fixture').nth(0)).toHaveText('Inactif');
    await expect(page.getByTestId('pirate-fixture').nth(1)).toHaveText('Patrouille');
    await expect(page.getByTestId('pirate-fixture').nth(2)).toHaveText('Poursuite');
    await expect(page.getByTestId('pirate-fixture').nth(3)).toHaveText('Attaque · blessé');
    await expect(page.getByTestId('pirate-fixture').nth(4)).toHaveText('Mort');
    await expect(page.getByTestId('serveur-status')).toHaveText('Serveur joignable', {
      timeout: 10_000,
    });

    const cartes = page.getByTestId('pirate-planche-carte');
    const états = ['inactif', 'patrouille', 'poursuite', 'attaque', 'mort'];
    for (const [index, état] of états.entries()) {
      const carte = cartes.nth(index);
      await expect(carte).toHaveAttribute('data-etat', état);
      await expect(carte.locator('[data-role="silhouette"]')).toHaveCount(1);
      await expect(carte.locator('[data-role="arme"]')).toHaveCount(1);
      await expect(carte.locator('[data-role="barre-sante-fond"]')).toHaveCount(1);
      await expect(carte.locator('[data-role="marqueur-etat"]')).toHaveCount(1);
      await expect(carte.locator('[data-role="barre-sante"]')).toHaveCount(état === 'mort' ? 0 : 1);
    }

    await page.goto('/?e2e=1&vue=pirates');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await page.screenshot({
      path: 'docs/preuves/pirates-1280x720.png',
      fullPage: false,
    });

    expect(erreursPage).toEqual([]);
    expect(erreursConsole).toEqual([]);
  });

  test('anime une interpolation sans exposer de diagnostic dans la vue normale', async ({
    page,
  }) => {
    await page.goto('/?e2e=1&vue=pirates&animation=1');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.getByTestId('pirate-fixture')).toHaveCount(5);
    await expect(page.getByTestId('pirates-planche')).toHaveCount(0);
    await page.waitForTimeout(600);
    await expect(page.locator('.marqueurs-e2e')).toHaveCount(0);
  });
});
