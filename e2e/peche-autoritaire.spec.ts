import { expect, test, type Page } from '@playwright/test';

type EtatPecheE2E = {
  lignesActives: number;
  ligneLocale: { joueurId: string; sequence: number; zoneId: string; phase: string } | undefined;
  dernierResultat: { resultat: string; joueurId: string } | undefined;
};

type CrochetPeche = {
  lirePeche?: () => EtatPecheE2E;
  preparerPecheE2E?: () => void;
  lancerPeche?: () => void;
  releverPeche?: () => void;
  quitterSalleE2E?: () => void;
};

async function lirePeche(page: Page): Promise<EtatPecheE2E> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPeche }).__pirateIslandsE2E;
    return (
      crochet?.lirePeche?.() ?? {
        lignesActives: 0,
        ligneLocale: undefined,
        dernierResultat: undefined,
      }
    );
  });
}

async function attendrePeche(
  page: Page,
  condition: (état: EtatPecheE2E) => boolean,
): Promise<void> {
  let dernier = '';
  try {
    await expect
      .poll(
        async () => {
          const état = await lirePeche(page);
          dernier = JSON.stringify(état);
          return condition(état);
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  } catch (erreur) {
    const diagnostic = await page.getByTestId('combat-deconnexion').innerText();
    throw new Error(
      `${erreur instanceof Error ? erreur.message : erreur} État=${dernier} Diagnostic=${diagnostic}`,
      { cause: erreur },
    );
  }
}

test('montre la ligne autoritaire à deux clients et le refus français', async ({ browser }) => {
  const contexteA = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'docs/preuves', size: { width: 1280, height: 720 } },
  });
  const contexteB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const pageA = await contexteA.newPage();
  const pageB = await contexteB.newPage();

  try {
    await pageA.goto('/?e2e=1&diagnostic=salle&peche=1&graine=peche-mvp-v1');
    await expect(pageA.getByTestId('diagnostic-salle')).toBeVisible();
    await expect(pageA.getByTestId('diagnostic-salle-id')).not.toHaveText(/en attente/);
    const salleId = (await pageA.getByTestId('diagnostic-salle-id').innerText()).replace(
      'Salle : ',
      '',
    );

    await pageB.goto(
      `/?e2e=1&diagnostic=salle&peche=1&graine=peche-mvp-v1&room=${encodeURIComponent(salleId)}`,
    );
    await expect(pageB.getByTestId('diagnostic-salle')).toBeVisible();
    await expect(pageA.getByTestId('diagnostic-nombre-joueurs')).toHaveText(
      'Joueurs connectés : 2',
    );
    await expect(pageB.getByTestId('diagnostic-nombre-joueurs')).toHaveText(
      'Joueurs connectés : 2',
    );
    await expect
      .poll(
        () =>
          pageA.evaluate(
            () =>
              typeof (window as unknown as { __pirateIslandsE2E?: CrochetPeche }).__pirateIslandsE2E
                ?.lancerPeche === 'function',
          ),
        { timeout: 10_000 },
      )
      .toBe(true);

    await pageA.evaluate(() => {
      const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPeche })
        .__pirateIslandsE2E;
      crochet?.preparerPecheE2E?.();
      crochet?.lancerPeche?.();
    });
    await attendrePeche(pageA, (état) => état.ligneLocale?.phase === 'attente');
    await attendrePeche(
      pageB,
      (état) => état.lignesActives === 1 && état.ligneLocale?.phase === 'attente',
    );

    await pageB.evaluate(() => {
      const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPeche })
        .__pirateIslandsE2E;
      crochet?.releverPeche?.();
    });
    await expect(pageB.getByTestId('combat-deconnexion')).toContainText('Aucune ligne active');
    await expect(pageA.getByTestId('peche-lignes-actives')).toHaveText('Lignes actives : 1');

    const captureA = await pageA.screenshot({ type: 'png' });
    const captureB = await pageB.screenshot({ type: 'png' });
    const composite = await pageA.evaluate(
      async ({ imageA, imageB }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const contexte = canvas.getContext('2d');
        if (!contexte) {
          throw new Error('Canvas de preuve indisponible.');
        }
        const charger = (source: string): Promise<HTMLImageElement> =>
          new Promise((résoudre, rejeter) => {
            const image = new Image();
            image.onload = () => résoudre(image);
            image.onerror = () => rejeter(new Error('Image de preuve invalide.'));
            image.src = source;
          });
        const [gauche, droite] = await Promise.all([charger(imageA), charger(imageB)]);
        contexte.drawImage(gauche, 0, 0, 640, 720);
        contexte.drawImage(droite, 640, 0, 640, 720);
        return canvas.toDataURL('image/png');
      },
      {
        imageA: `data:image/png;base64,${captureA.toString('base64')}`,
        imageB: `data:image/png;base64,${captureB.toString('base64')}`,
      },
    );
    const contenuComposite = Buffer.from(composite.split(',')[1] ?? '', 'base64');
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile('docs/preuves/peche-autoritaire-1280x720.png', contenuComposite),
    );

    await attendrePeche(pageA, (état) => état.ligneLocale?.phase === 'morsure');
    await pageA.evaluate(() => {
      const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPeche })
        .__pirateIslandsE2E;
      crochet?.releverPeche?.();
    });
    await attendrePeche(pageA, (état) => état.dernierResultat?.resultat === 'prise');
    await attendrePeche(pageA, (état) => état.lignesActives === 0);
    await pageA.evaluate(() => {
      const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPeche })
        .__pirateIslandsE2E;
      crochet?.quitterSalleE2E?.();
    });
  } finally {
    const video = pageA.video();
    await pageB.close();
    await pageA.close();
    const cheminVideo = await video?.path();
    await contexteB.close();
    await contexteA.close();
    if (cheminVideo) {
      await import('node:fs/promises').then(({ rename }) =>
        rename(cheminVideo, 'docs/preuves/peche-autoritaire-autorite.webm'),
      );
    }
  }
});
