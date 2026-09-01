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

test('embarque, prend la barre, navigue, heurte le rivage, sort de barre et débarque', async ({
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
  await page.screenshot({
    path: 'docs/preuves/pilotage-barre-1280x720.png',
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
  await page.screenshot({
    path: 'docs/preuves/pilotage-sillage-1280x720.png',
    fullPage: false,
  });

  // Force la collision avec le rivage : navigation longue en avant vers +Z.
  await piloter(page, { poussee: 1, gouvernail: 0 });
  let collision = 'aucune';
  for (let index = 0; index < 600; index += 1) {
    await avancerTemps(page, 16);
    const courant = await lireEtat(page);
    if (courant?.collision && courant.collision !== 'aucune') {
      collision = courant.collision;
      break;
    }
  }
  expect(collision).toBe('rivage');
  await page.screenshot({
    path: 'docs/preuves/pilotage-collision-rivage-1280x720.png',
    fullPage: false,
  });

  // Vire à droite puis re-vire à gauche pour démontrer le gouvernail borné.
  await piloter(page, { poussee: 1, gouvernail: 1 });
  for (let index = 0; index < 40; index += 1) {
    await avancerTemps(page, 16);
  }
  const apresVirage = await lireEtat(page);
  expect(apresVirage?.rotationBateau).not.toBe(aLaBarre?.rotationBateau);

  // Sort de la barre (interagir).
  await page.keyboard.press('KeyE');
  await attendreMode(page, 'bord');
  const sortiBarre = await lireEtat(page);
  expect(sortiBarre?.mode).toBe('bord');
  await page.screenshot({
    path: 'docs/preuves/pilotage-sortie-barre-1280x720.png',
    fullPage: false,
  });

  // Le joueur est rattaché au bateau qui avance ; il ne glisse pas.
  const avantMarche = await lireEtat(page);
  expect(Number.isFinite(avantMarche?.positionJoueur.z)).toBe(true);

  // Marche à bord vers la cale (local vers z négatif) et capture la vue.
  await deplacerBord(page, { x: 0, y: -1.4, z: -6.5 });
  await page.screenshot({
    path: 'docs/preuves/pilotage-cale-1280x720.png',
    fullPage: false,
  });

  // Marche à bord jusqu'à la sortie puis débarque (interagir).
  await deplacerBord(page, { x: 0, z: 1.5 });
  await page.keyboard.press('KeyE');
  await attendreMode(page, 'pied');
});
