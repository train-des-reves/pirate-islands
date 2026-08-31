import { expect, test } from '@playwright/test';

test('affiche les phases et résultats de pêche pour la graine peche-mvp-v1', async ({ page }) => {
  const erreursPage: string[] = [];
  const erreursConsole: string[] = [];
  page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      erreursConsole.push(message.text());
    }
  });

  await page.goto('/?e2e=1&presentation=regles-peche&graine=peche-mvp-v1');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await expect(page.locator('#app')).toHaveAttribute('data-presentation', 'regles-peche');
  await expect(page.getByTestId('presentation-peche-graine')).toHaveText('Graine : peche-mvp-v1');

  const lignes = page.getByTestId('presentation-peche-ligne');
  await expect(lignes).toHaveCount(6);

  const contenu = await lignes.allTextContents();
  const phaseScenarios = contenu.map((ligne) => ligne.replace(/\s+/g, ' ').trim());
  const scenario = (index: number): string => phaseScenarios[index] ?? '';

  expect(scenario(0)).toContain('Attente');
  expect(scenario(1)).toContain('Morsure');
  expect(scenario(2)).toContain('Prise');
  expect(scenario(3)).toContain('Trop tôt');
  expect(scenario(4)).toContain('Trop tard');
  expect(scenario(5)).toContain('Annulation');

  expect(scenario(2)).toContain('prise');
  expect(scenario(3)).toContain('trop_tot');
  expect(scenario(4)).toContain('trop_tard');
  expect(scenario(5)).toContain('annulee');

  await expect(page).toHaveScreenshot('peche-regles-1280x720.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
    scale: 'css',
  });
  await page.screenshot({
    path: 'docs/preuves/peche-regles-1280x720.png',
    fullPage: false,
  });

  expect(erreursPage).toEqual([]);
  expect(erreursConsole).toEqual([]);
});

test('ne montre aucun harnais dans la vue normale', async ({ page }) => {
  await page.goto('/?e2e=1');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', /ready|fallback/);
  await expect(page.getByTestId('presentation-peche')).toHaveCount(0);
});
