import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

interface EtatJeuE2E {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly camera: { readonly lacet: number; readonly tangage: number };
  readonly pause: boolean;
  readonly pointeurVerrouille: boolean;
  readonly collision: string;
  readonly tir: {
    readonly compteur: number;
    readonly etat: { readonly recul: number; readonly eclairBouche: boolean };
    readonly derniereIntention:
      | {
          readonly sequence: number;
          readonly origine: { readonly x: number; readonly y: number; readonly z: number };
          readonly direction: { readonly x: number; readonly y: number; readonly z: number };
          readonly horodatageClient: number;
        }
      | undefined;
    readonly intentions: readonly EtatJeuE2E['tir']['derniereIntention'][];
  };
}

type NomActionCrochet = 'verrouillerPointeur' | 'libererPointeur' | 'reinitialiser';

type CrochetE2E = {
  verrouillerPointeur: () => void;
  libererPointeur: () => void;
  lireEtat: () => EtatJeuE2E;
  reinitialiser: () => void;
  tirer: (nombre?: number) => void;
  avancerTemps: (deltaMs: number) => void;
};

async function verifierCrochet(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as unknown as { __pirateIslandsE2E?: unknown }).__pirateIslandsE2E),
      ),
    )
    .toBe(true);
}

async function appelerCrochet(page: Page, action: NomActionCrochet): Promise<void> {
  await page.evaluate((nomAction) => {
    type Crochet = Record<NomActionCrochet, () => void> & { lireEtat: () => EtatJeuE2E };
    const crochet = (window as unknown as { __pirateIslandsE2E?: Crochet }).__pirateIslandsE2E;
    if (!crochet) {
      throw new Error('Le crochet E2E des entrées est absent.');
    }
    crochet[nomAction]();
  }, action);
}

async function lireEtat(page: Page): Promise<EtatJeuE2E> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetE2E }).__pirateIslandsE2E;
    if (!crochet) {
      throw new Error('Le crochet E2E des entrées est absent.');
    }
    return crochet.lireEtat();
  });
}

test('verrouille, déplace, regarde, bloque au mur et ouvre la pause', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByTestId('serveur-status')).toHaveText('Serveur joignable', {
    timeout: 10_000,
  });
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');

  await verifierCrochet(page);
  await appelerCrochet(page, 'reinitialiser');
  await page.locator('#scene-canvas').click();
  await page.evaluate(() => {
    const hook = (window as unknown as { __pirateIslandsE2E?: { verrouillerPointeur: () => void } })
      .__pirateIslandsE2E;
    hook?.verrouillerPointeur();
  });
  await expect(page.locator('#app')).toHaveAttribute('data-pointeur', 'verrouille');

  const avantMarche = await lireEtat(page);
  await page.keyboard.down('w');
  await expect
    .poll(async () => (await lireEtat(page)).position.z, { timeout: 3_000 })
    .toBeGreaterThan(avantMarche.position.z + 0.5);
  await page.keyboard.up('w');

  await page.keyboard.down('w');
  await expect.poll(async () => (await lireEtat(page)).collision, { timeout: 3_000 }).toBe('mur');
  await page.keyboard.up('w');
  const contreMur = await lireEtat(page);
  expect(contreMur.position.z).toBeLessThan(1.7);

  const avantRegard = await lireEtat(page);
  await page.mouse.move(700, 360, { steps: 2 });
  await expect
    .poll(async () => (await lireEtat(page)).camera.lacet)
    .not.toBe(avantRegard.camera.lacet);

  await page.evaluate(() => {
    const evenement = new MouseEvent('mousemove', { bubbles: true });
    Object.defineProperty(evenement, 'movementX', { value: 0 });
    Object.defineProperty(evenement, 'movementY', { value: -10_000 });
    window.dispatchEvent(evenement);
  });
  await expect
    .poll(async () => (await lireEtat(page)).camera.tangage)
    .toBeCloseTo(Math.PI / 2 - 0.01, 2);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-pause', 'oui');
  await expect(page.locator('#app')).toHaveAttribute('data-pointeur', 'libere');
  expect((await lireEtat(page)).pause).toBe(true);
});

test('ne capture pas une touche dans un contrôle DOM', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await verifierCrochet(page);
  await appelerCrochet(page, 'reinitialiser');
  await page.evaluate(() => {
    const hook = (window as unknown as { __pirateIslandsE2E?: { verrouillerPointeur: () => void } })
      .__pirateIslandsE2E;
    hook?.verrouillerPointeur();
    const champ = document.createElement('input');
    champ.setAttribute('aria-label', 'Saisie de test');
    champ.dataset.testid = 'champ-saisie-e2e';
    document.body.append(champ);
    champ.focus();
  });

  const avant = await lireEtat(page);
  await page.keyboard.press('z');
  await expect.poll(async () => (await lireEtat(page)).position).toEqual(avant.position);
  await page.evaluate(() => document.querySelector('[data-testid="champ-saisie-e2e"]')?.remove());
});

test('émet une intention par tir, respecte la cadence et récupère le recul', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?e2e=1&temps=5000');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await verifierCrochet(page);
  await appelerCrochet(page, 'reinitialiser');
  await page.locator('#scene-canvas').click();
  await appelerCrochet(page, 'verrouillerPointeur');
  await page.waitForTimeout(180);
  expect(await page.getByTestId('tir-diagnostic').getAttribute('data-compteur')).toBe('0');
  await page.screenshot({
    path: 'docs/preuves/pistolet-tir-repos-1280x720.png',
    fullPage: false,
  });

  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetE2E }).__pirateIslandsE2E;
    crochet?.tirer(3);
  });
  await page.screenshot({
    path: 'docs/preuves/pistolet-tir-eclair-recul-1280x720.png',
    fullPage: false,
  });
  await page.waitForTimeout(120);

  const aprèsTirs = await lireEtat(page);
  expect(aprèsTirs.tir.compteur).toBe(3);
  expect(aprèsTirs.tir.intentions).toHaveLength(3);
  expect(aprèsTirs.tir.intentions.map((intention) => intention?.sequence)).toEqual([1, 2, 3]);
  expect(aprèsTirs.tir.intentions.map((intention) => intention?.horodatageClient)).toEqual([
    5000, 5150, 5300,
  ]);
  expect(aprèsTirs.tir.etat.recul).toBe(1);
  expect(aprèsTirs.tir.etat.eclairBouche).toBe(true);

  const intention = aprèsTirs.tir.derniereIntention;
  expect(intention).toBeDefined();
  expect(
    Math.hypot(
      intention?.direction.x ?? 0,
      intention?.direction.y ?? 0,
      intention?.direction.z ?? 0,
    ),
  ).toBeCloseTo(1);
  expect(Number.isFinite(intention?.origine.x ?? Number.NaN)).toBe(true);

  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetE2E }).__pirateIslandsE2E;
    crochet?.avancerTemps(180);
  });
  await page.screenshot({
    path: 'docs/preuves/pistolet-tir-recuperation-1280x720.png',
    fullPage: false,
  });
  await page.waitForTimeout(120);
  const aprèsRécupération = await lireEtat(page);
  expect(aprèsRécupération.tir.etat.recul).toBe(0);
  expect(aprèsRécupération.tir.etat.eclairBouche).toBe(false);
});
