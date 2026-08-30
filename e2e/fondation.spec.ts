import { expect, test } from '@playwright/test';

test('affiche la fondation mer/ciel et confirme le serveur', async ({ page }) => {
  const erreursPage: string[] = [];
  const erreursConsole: string[] = [];

  page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      erreursConsole.push(message.text());
    }
  });

  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
  await page.goto('/');

  await expect(page).toHaveTitle(/Pirate Islands/);
  await expect(page.locator('#scene-canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pirate Islands' })).toBeVisible();
  await expect(page.getByTestId('serveur-status')).toHaveText('Serveur joignable', {
    timeout: 10_000,
  });
  await expect(page.locator('#app')).toHaveAttribute('data-scene', /ready|fallback/);

  await page.screenshot({
    path: 'docs/preuves/pirate-islands-1280x720.png',
    fullPage: false,
  });

  expect(erreursPage).toEqual([]);
  expect(erreursConsole).toEqual([]);
});
