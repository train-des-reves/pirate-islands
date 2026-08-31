import { expect, test } from '@playwright/test';

test('affiche le harnais de présentation de la canne pour la graine peche-mvp-v1', async ({ page }) => {
  const erreursPage: string[] = [];
  const erreursConsole: string[] = [];
  page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      erreursConsole.push(message.text());
    }
  });

  await page.goto('/?e2e=1&presentation=canne-peche&graine=peche-mvp-v1');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await expect(page.locator('#app')).toHaveAttribute('data-presentation', 'canne-peche');
  await expect(page.getByTestId('presentation-canne')).toHaveCount(1);
  await expect(page.getByTestId('presentation-canne-graine')).toHaveText('Graine : peche-mvp-v1');

  const lignes = page.getByTestId('presentation-canne-ligne');
  await expect(lignes).toHaveCount(7);
  const contenu = await lignes.allTextContents();
  const scenarios = contenu.map((ligne) => ligne.replace(/\s+/g, ' ').trim());
  expect(scenarios[0]).toContain('Rangée');
  expect(scenarios[1]).toContain('Attente');
  expect(scenarios[2]).toContain('Morsure');
  expect(scenarios[3]).toContain('Prise');
  expect(scenarios[4]).toContain('Trop tôt');
  expect(scenarios[5]).toContain('Trop tard');
  expect(scenarios[6]).toContain('Annulation');

  await expect(page).toHaveScreenshot('canne-presentation-1280x720.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.02,
    scale: 'css',
  });

  expect(erreursPage).toEqual([]);
  expect(erreursConsole).toEqual([]);
});

test('force les états de la canne via la fixture et capture la séquence complète', async ({ page }) => {
  const erreursPage: string[] = [];
  const erreursConsole: string[] = [];
  page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      erreursConsole.push(message.text());
    }
  });

  await page.goto('/?e2e=1&presentation=canne-peche&graine=peche-mvp-v1');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await page.waitForFunction(() => {
    type Crochet = { forcerEtatCanne?: (vue: string) => void };
    return Boolean((window as unknown as { __pirateIslandsE2E?: Crochet }).__pirateIslandsE2E?.forcerEtatCanne);
  });

  await page.evaluate(() => {
    type Crochet = { forcerEtatCanne?: (vue: string) => void };
    (window as unknown as { __pirateIslandsE2E?: Crochet }).__pirateIslandsE2E?.forcerEtatCanne?.('rangee');
  });
  await page.screenshot({ path: 'docs/preuves/canne-repos-1280x720.png', fullPage: false });

  await page.evaluate(() => {
    type Crochet = { forcerEtatCanne?: (vue: string) => void };
    (window as unknown as { __pirateIslandsE2E?: Crochet }).__pirateIslandsE2E?.forcerEtatCanne?.('prete');
  });
  await page.screenshot({ path: 'docs/preuves/canne-prete-1280x720.png', fullPage: false });

  await page.evaluate(() => {
    type Crochet = { forcerEtatCanne?: (vue: string) => void };
    (window as unknown as { __pirateIslandsE2E?: Crochet }).__pirateIslandsE2E?.forcerEtatCanne?.('lancee');
  });
  await page.screenshot({ path: 'docs/preuves/canne-lancee-1280x720.png', fullPage: false });

  await page.evaluate(() => {
    type Crochet = { forcerEtatCanne?: (vue: string) => void };
    (window as unknown as { __pirateIslandsE2E?: Crochet }).__pirateIslandsE2E?.forcerEtatCanne?.('morsure');
  });
  await page.screenshot({ path: 'docs/preuves/canne-morsure-1280x720.png', fullPage: false });

  await page.evaluate(() => {
    type Crochet = { forcerEtatCanne?: (vue: string) => void };
    (window as unknown as { __pirateIslandsE2E?: Crochet }).__pirateIslandsE2E?.forcerEtatCanne?.('remontee');
  });
  await page.screenshot({ path: 'docs/preuves/canne-remontee-1280x720.png', fullPage: false });

  expect(erreursPage).toEqual([]);
  expect(erreursConsole).toEqual([]);
});

test('ne montre aucun harnais de pêche dans la vue normale', async ({ page }) => {
  await page.goto('/?e2e=1');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', /ready|fallback/);
  await expect(page.getByTestId('presentation-canne')).toHaveCount(0);
  await expect(page.getByTestId('peche-invite')).toBeHidden();
});
