import { expect, test, type Page } from '@playwright/test';

const URL_RENCONTRE = '/?e2e=1&diagnostic=salle&combat=1&rencontre=1&graine=rencontre-mvp';

interface PirateE2E {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly sante: number;
  readonly vivant: boolean;
  readonly statut: string;
}

interface CrochetRencontre {
  readonly lirePirates?: () => readonly PirateE2E[];
}

async function attendreCrochet(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetRencontre })
            .__pirateIslandsE2E;
          return Boolean(crochet?.lirePirates);
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function lirePirates(page: Page): Promise<readonly PirateE2E[]> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetRencontre })
      .__pirateIslandsE2E;
    return crochet?.lirePirates?.() ?? [];
  });
}

test('synchronise une rencontre terrestre entre deux contextes', async ({ page, browser }) => {
  test.setTimeout(45_000);
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const secondPage = await secondContext.newPage();

  try {
    await page.goto(URL_RENCONTRE);
    await expect(page.getByTestId('diagnostic-salle')).toBeVisible();
    await attendreCrochet(page);
    await expect(page.getByTestId('rencontre-pirates')).toBeVisible();
    await expect
      .poll(async () => (await lirePirates(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const roomId = await page.getByTestId('diagnostic-salle-id').innerText();
    await expect.poll(async () => (await lirePirates(page)).length, { timeout: 15_000 }).toBe(9);
    const identifiantsAttendus = (await lirePirates(page)).map((entrée) => entrée.id).sort();
    expect(identifiantsAttendus.every((identifiant) => identifiant.length > 0)).toBe(true);

    await secondPage.goto(
      URL_RENCONTRE + '&room=' + encodeURIComponent(roomId.replace('Salle : ', '')),
    );
    await attendreCrochet(secondPage);
    await expect(secondPage.getByTestId('rencontre-pirates')).toBeVisible();

    await expect
      .poll(async () => (await lirePirates(secondPage)).length, { timeout: 15_000 })
      .toBe(9);
    await expect
      .poll(
        async () => {
          const état = (pirates: readonly PirateE2E[]) =>
            pirates
              .map((entrée) => `${entrée.id}:${entrée.sante}:${entrée.vivant}:${entrée.statut}`)
              .sort()
              .join('|');
          return état(await lirePirates(page)) === état(await lirePirates(secondPage));
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    expect((await lirePirates(secondPage)).map((entrée) => entrée.id).sort()).toEqual(
      identifiantsAttendus,
    );
    await expect(page.getByTestId('rencontre-etat')).toContainText(
      /patrouille|attaque|retour|inactif/,
    );
    await page.screenshot({ path: 'docs/preuves/rencontre-pirates-observateur-1-1280x720.png' });
    await secondPage.screenshot({
      path: 'docs/preuves/rencontre-pirates-observateur-2-1280x720.png',
    });
  } finally {
    await secondContext.close();
  }
});
