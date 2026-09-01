import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

const URL_RENCONTRE = '/?e2e=1&diagnostic=salle&combat=1&graine=rencontre-terrestre';

interface PirateE2E {
  readonly identifiant: string;
  readonly sante: number;
  readonly vivant: boolean;
  readonly statut: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
}

interface CrochetRencontre {
  readonly tirerReseau?: (cibleId?: string) => void;
  readonly lirePirates?: () => readonly PirateE2E[];
  readonly positionnerJoueurE2E?: (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => void;
}

async function attendreCrochet(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetRencontre })
          .__pirateIslandsE2E;
        return Boolean(crochet?.lirePirates);
      }),
    )
    .toBe(true);
}

async function lirePirates(page: Page): Promise<readonly PirateE2E[]> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetRencontre })
      .__pirateIslandsE2E;
    if (!crochet?.lirePirates) {
      throw new Error('Le crochet des pirates est absent.');
    }
    return crochet.lirePirates();
  });
}

test('deux observateurs partagent la rencontre terrestre déterministe', async ({ browser }) => {
  test.setTimeout(45_000);
  const premierContexte = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const secondContexte = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const premier = await premierContexte.newPage();
  const second = await secondContexte.newPage();
  const erreurs: string[] = [];
  premier.on('pageerror', (erreur) => erreurs.push(erreur.message));
  second.on('pageerror', (erreur) => erreurs.push(erreur.message));

  await premier.goto(URL_RENCONTRE);
  await attendreCrochet(premier);
  const salleTexte = await premier.getByTestId('diagnostic-salle-id').textContent();
  const salleId = salleTexte?.replace('Salle : ', '').trim();
  expect(salleId).toBeTruthy();

  await second.goto(URL_RENCONTRE + '&room=' + encodeURIComponent(salleId!));
  await attendreCrochet(second);

  const pirate = (await lirePirates(premier))[0];
  expect(pirate).toBeDefined();
  await premier.evaluate((position) => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetRencontre })
      .__pirateIslandsE2E;
    crochet?.positionnerJoueurE2E?.(position);
  }, pirate!.position);

  await premier.waitForTimeout(100);
  const étatSecond = (await lirePirates(second)).find(
    (entrée) => entrée.identifiant === pirate!.identifiant,
  );
  const étatPremier = (await lirePirates(premier)).find(
    (entrée) => entrée.identifiant === pirate!.identifiant,
  );
  expect(étatSecond?.sante).toBe(étatPremier?.sante);

  await premier.screenshot({ path: 'docs/preuves/pirates-terrestres-premier-1280x720.png' });
  await second.screenshot({ path: 'docs/preuves/pirates-terrestres-second-1280x720.png' });
  expect(erreurs).toEqual([]);

  await premierContexte.close();
  await secondContexte.close();
});
