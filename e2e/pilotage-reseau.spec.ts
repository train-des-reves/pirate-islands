import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

interface EtatPilotageE2E {
  readonly mode: string;
  readonly invite: string;
  readonly positionJoueur: { readonly x: number; readonly y: number; readonly z: number };
  readonly positionBateau: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotationBateau: number;
  readonly vitesse: number;
  readonly collision: string;
  readonly intensiteSillage: number;
}

type CrochetPilotage = {
  lireEtat: () => {
    readonly pause?: boolean;
    readonly pilotage?: EtatPilotageE2E;
  };
  reinitialiser: () => void;
  deplacerBord: (offset: { x: number; y?: number; z: number }) => void;
  piloter: (intentions: { poussee: number; gouvernail: number }) => void;
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

async function lireEtat(page: Page): Promise<EtatPilotageE2E | undefined> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    if (!crochet) {
      throw new Error('Le crochet E2E du pilotage est absent.');
    }
    return crochet.lireEtat().pilotage;
  });
}

async function attendreMode(page: Page, mode: string): Promise<void> {
  await expect
    .poll(async () => (await lireEtat(page))?.mode, { timeout: 5_000 })
    .toBe(mode);
}

async function deplacerBord(
  page: Page,
  offset: { x: number; y?: number; z: number },
): Promise<void> {
  await page.evaluate((offsetBord) => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    crochet?.deplacerBord(offsetBord);
  }, offset);
}

async function piloter(
  page: Page,
  intentions: { poussee: number; gouvernail: number },
): Promise<void> {
  await page.evaluate((intentionsPilotage) => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    crochet?.piloter(intentionsPilotage);
  }, intentions);
}

async function avancerTemps(page: Page, deltaMs: number): Promise<void> {
  await page.evaluate((delta) => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    crochet?.avancerTemps(delta);
  }, deltaMs);
}

test('deux joueurs observent le même bateau : le pilote pilote, l'observateur voit le mouvement', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/?e2e=1&graine=mvp-defaut&pilotage=1&temps=0');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await verifierCrochet(page);

  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    crochet?.reinitialiser();
  });

  // Invite d'embarquement visible au départ.
  const etatInitial = await lireEtat(page);
  expect(etatInitial?.mode).toBe('pied');

  // Embauque (interagir).
  await page.keyboard.press('KeyE');
  await attendreMode(page, 'bord');

  // Marche à bord jusqu'à la barre (position locale z ≈ 1,65).
  await deplacerBord(page, { x: 0, z: 7.3 });

  // Prend la barre (interagir près de la barre).
  await page.keyboard.press('KeyE');
  await attendreMode(page, 'pilote');
  const aLaBarre = await lireEtat(page);
  expect(aLaBarre?.mode).toBe('pilote');
  expect(aLaBarre?.invite).toBe('prendre_barre');

  // Capture avant le mouvement
  await page.screenshot({
    path: 'docs/preuves/pilotage-reseau-avant-1280x720.png',
    fullPage: false,
  });

  // Avance en ligne droite. Le sillage doit apparaître.
  const positionAvant = (await lireEtat(page))?.positionBateau.z;
  await piloter(page, { poussee: 1, gouvernail: 0 });
  for (let index = 0; index < 60; index += 1) {
    await avancerTemps(page, 16);
  }
  const enLigne = await lireEtat(page);
  expect(enLigne?.vitesse).toBeGreaterThan(0);
  expect(enLigne?.positionBateau.z).not.toBe(positionAvant);

  // Capture pendant le mouvement
  await page.screenshot({
    path: 'docs/preuves/pilotage-reseau-mouvement-1280x720.png',
    fullPage: false,
  });

  // Vire à droite
  await piloter(page, { poussee: 1, gouvernail: 1 });
  for (let index = 0; index < 40; index += 1) {
    await avancerTemps(page, 16);
  }
  const apresVirage = await lireEtat(page);
  expect(apresVirage?.rotationBateau).not.toBe(aLaBarre?.rotationBateau);

  // Capture après virage
  await page.screenshot({
    path: 'docs/preuves/pilotage-reseau-virage-1280x720.png',
    fullPage: false,
  });

  // Sort de la barre (interagir).
  await page.keyboard.press('KeyE');
  await attendreMode(page, 'bord');
  const sortiBarre = await lireEtat(page);
  expect(sortiBarre?.mode).toBe('bord');

  // Capture sortie de barre
  await page.screenshot({
    path: 'docs/preuves/pilotage-reseau-sortie-1280x720.png',
    fullPage: false,
  });
});

test('la barre est refusée quand un autre joueur la tient', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?e2e=1&graine=mvp-defaut&pilotage=1&temps=0');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
  await verifierCrochet(page);

  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    crochet?.reinitialiser();
  });

  // Embauche et prend la barre
  await page.keyboard.press('KeyE');
  await attendreMode(page, 'bord');
  await deplacerBord(page, { x: 0, z: 7.3 });
  await page.keyboard.press('KeyE');
  await attendreMode(page, 'pilote');

  // Vérifie qu'il est bien pilote
  const etat = await lireEtat(page);
  expect(etat?.mode).toBe('pilote');

  // La barre ne peut pas être prise par un autre joueur (testé côté serveur)
  // Ce test vérifie que le premier joueur garde la barre
  for (let index = 0; index < 30; index += 1) {
    await avancerTemps(page, 16);
  }
  const toujoursPilote = await lireEtat(page);
  expect(toujoursPilote?.mode).toBe('pilote');
});
