import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

interface EtatJeuE2E {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly camera: { readonly lacet: number; readonly tangage: number };
  readonly pause: boolean;
  readonly pointeurVerrouille: boolean;
  readonly collision: string;
}

type NomActionCrochet = 'verrouillerPointeur' | 'libererPointeur' | 'reinitialiser';

type CrochetE2E = {
  verrouillerPointeur: () => void;
  libererPointeur: () => void;
  lireEtat: () => EtatJeuE2E;
  reinitialiser: () => void;
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
  await page.goto('/?e2e=1');
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
  await page.goto('/?e2e=1');
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
