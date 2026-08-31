import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

interface EtatJeuE2E {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly camera: { readonly lacet: number; readonly tangage: number };
  readonly reglages: {
    readonly inversionVerticale: boolean;
    readonly liaisons: Record<string, readonly string[]>;
  };
}

interface CrochetE2E {
  verrouillerPointeur: () => void;
  lireEtat: () => EtatJeuE2E;
}

async function attendreJeu(page: Page): Promise<void> {
  await expect(page.getByTestId('serveur-status')).toHaveText('Serveur joignable', {
    timeout: 10_000,
  });
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as unknown as { __pirateIslandsE2E?: unknown }).__pirateIslandsE2E),
      ),
    )
    .toBe(true);
}

async function verrouillerPointeur(page: Page): Promise<void> {
  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetE2E }).__pirateIslandsE2E;
    crochet?.verrouillerPointeur();
  });
  await expect(page.locator('#app')).toHaveAttribute('data-pointeur', 'verrouille');
}

async function lireEtat(page: Page): Promise<EtatJeuE2E> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetE2E }).__pirateIslandsE2E;
    if (!crochet) {
      throw new Error('Le crochet E2E des réglages est absent.');
    }
    return crochet.lireEtat();
  });
}

async function ouvrirRéglagesDepuisLaPause(page: Page): Promise<void> {
  await verrouillerPointeur(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await expect(page.getByTestId('reprendre-jeu')).toBeFocused();
  await page.getByTestId('ouvrir-reglages').click();
  await expect(page.getByTestId('reglages-overlay')).toBeVisible();
  await expect(page.getByTestId('inversion-verticale')).toBeFocused();
}

test('n’expose pas le crochet hors du mode E2E explicite', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('serveur-status')).toHaveText('Serveur joignable', {
    timeout: 10_000,
  });
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as unknown as { __pirateIslandsE2E?: unknown }).__pirateIslandsE2E),
      ),
    )
    .toBe(false);
});

test('configure les réglages, recharge et conserve le déplacement avec Z', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?e2e=1');
  await attendreJeu(page);
  await ouvrirRéglagesDepuisLaPause(page);

  await page.getByTestId('inversion-verticale').check();
  await page.getByTestId('touche-avancer').click();
  await page.keyboard.press('z');
  await expect(page.getByTestId('touche-avancer')).toHaveText('Z');
  await page.getByTestId('appliquer-reglages').click();
  await expect(page.getByTestId('reglages-overlay')).toBeHidden();
  await expect(page.locator('#app')).toHaveAttribute('data-inversion', 'oui');

  const stockage = await page.evaluate(() => ({
    cookie: document.cookie,
    stockageLocal: Object.keys(localStorage),
  }));
  expect(stockage.cookie).toContain('pirate_islands_settings=');
  expect(stockage.stockageLocal).not.toContain('pirate_islands_settings');
  const réglagesCookie = stockage.cookie
    .split('; ')
    .find((morceau) => morceau.startsWith('pirate_islands_settings='));
  expect(réglagesCookie).toBeDefined();
  const valeurCookie = réglagesCookie?.slice('pirate_islands_settings='.length) ?? '';
  const objetCookie = JSON.parse(decodeURIComponent(valeurCookie)) as {
    readonly v: number;
    readonly inversionVerticale: boolean;
    readonly liaisons: { readonly avancer: readonly string[] };
  };
  expect(objetCookie).toMatchObject({
    v: 1,
    inversionVerticale: true,
    liaisons: { avancer: ['KeyZ'] },
  });

  await page.reload();
  await attendreJeu(page);
  await ouvrirRéglagesDepuisLaPause(page);
  await expect(page.getByTestId('inversion-verticale')).toBeChecked();
  await expect(page.getByTestId('etat-inversion')).toHaveText('Oui');
  await expect(page.getByTestId('touche-avancer')).toHaveText('Z');
  await page.getByTestId('annuler-reglages').click();
  await expect(page.getByTestId('ouvrir-reglages')).toBeFocused();
  await page.getByTestId('reprendre-jeu').click();
  await expect(page.locator('#app')).toHaveAttribute('data-pointeur', 'verrouille');

  const avantTouches = await lireEtat(page);
  await page.keyboard.down('w');
  await page.waitForTimeout(250);
  await page.keyboard.up('w');
  const aprèsW = await lireEtat(page);
  expect(aprèsW.position.z).toBeCloseTo(avantTouches.position.z, 1);

  await page.keyboard.down('z');
  await expect
    .poll(async () => (await lireEtat(page)).position.z, { timeout: 3_000 })
    .toBeGreaterThan(avantTouches.position.z + 0.35);
  await page.keyboard.up('z');

  const avantRegard = await lireEtat(page);
  await page.evaluate(() => {
    const evenement = new MouseEvent('mousemove', { bubbles: true });
    Object.defineProperty(evenement, 'movementX', { value: 0 });
    Object.defineProperty(evenement, 'movementY', { value: 10 });
    window.dispatchEvent(evenement);
  });
  await expect
    .poll(async () => (await lireEtat(page)).camera.tangage)
    .toBeGreaterThan(avantRegard.camera.tangage);
});

test('un contexte neuf reçoit les valeurs par défaut', async ({ browser }) => {
  const contexte = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await contexte.newPage();
  try {
    await page.goto('/?e2e=1');
    await attendreJeu(page);
    await ouvrirRéglagesDepuisLaPause(page);
    await expect(page.getByTestId('inversion-verticale')).not.toBeChecked();
    await expect(page.getByTestId('etat-inversion')).toHaveText('Non');
    await expect(page.getByTestId('touche-avancer')).toHaveText('Z / W');
    await expect(page.getByTestId('reglages-message')).toBeEmpty();
  } finally {
    await contexte.close();
  }
});
