import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

const URL_COMBAT = '/?e2e=1&diagnostic=salle&graine=mvp-defaut&combat=1';

type LireCombatResultat = {
  readonly cibleId: string | null;
  readonly santeJoueur: number;
  readonly santePirate: number;
  readonly pirateNeutralise: boolean;
  readonly enAttenteReapparition: boolean;
  readonly dernierResultat:
    | {
        readonly sequence: number;
        readonly cibleId: string | null;
        readonly degats: number;
        readonly pirateNeutralise: boolean;
        readonly horodatageServeur: number;
      }
    | undefined;
  readonly codeDeconnexion: number | undefined;
};

type CrochetCombat = {
  readonly tirerReseau?: (cibleId?: string) => void;
  readonly tirerDansLeVide?: () => void;
  readonly rejouerTir?: () => void;
  readonly infligerDegatsE2E?: (degats: number) => void;
  readonly lireCombat?: () => LireCombatResultat;
  readonly lireDeconnexion?: () => number | undefined;
};

async function attendreCrochet(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetCombat })
          .__pirateIslandsE2E;
        return Boolean(crochet?.tirerReseau && crochet?.lireCombat);
      }),
    )
    .toBe(true);
}

async function lireCombat(page: Page): Promise<LireCombatResultat> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetCombat })
      .__pirateIslandsE2E;
    if (!crochet?.lireCombat) {
      throw new Error('Le crochet de lecture du combat est absent.');
    }
    return crochet.lireCombat();
  });
}

async function tirer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetCombat })
      .__pirateIslandsE2E;
    crochet?.tirerReseau?.();
  });
}

async function tirerDansLeVide(page: Page): Promise<void> {
  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetCombat })
      .__pirateIslandsE2E;
    crochet?.tirerDansLeVide?.();
  });
}

async function rejouerTir(page: Page): Promise<void> {
  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetCombat })
      .__pirateIslandsE2E;
    crochet?.rejouerTir?.();
  });
}

async function infligerDegatsJoueur(page: Page, degats: number): Promise<void> {
  await page.evaluate((valeur) => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetCombat })
      .__pirateIslandsE2E;
    crochet?.infligerDegatsE2E?.(valeur);
  }, degats);
}

test('tir accepté, raté sans effet, mort et réapparition côté serveur', async ({ page }) => {
  test.setTimeout(60_000);
  const erreursPage: string[] = [];
  const erreursConsole: string[] = [];
  page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      erreursConsole.push(message.text());
    }
  });

  await page.goto(URL_COMBAT);
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'diagnostic-salle');
  await expect(page.getByTestId('diagnostic-salle')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-diagnostics', 'actifs');
  await attendreCrochet(page);
  await expect(page.getByTestId('ath-combat')).toBeVisible();
  await expect(page.getByTestId('ath-combat-sante-joueur')).toHaveText('100 / 100');
  await expect(page.getByTestId('ath-combat-cible')).toHaveText('Aucune cible');

  const initial = await lireCombat(page);
  expect(initial.santeJoueur).toBe(100);
  expect(initial.enAttenteReapparition).toBe(false);
  expect(initial.cibleId).toBeNull();

  // Premier tir réseau : le serveur vise un pirate vivant choisi de façon
  // déterministe et réduit sa santé de 25. Aucun résultat n'est fourni par le client.
  await tirer(page);
  await expect
    .poll(async () => (await lireCombat(page)).dernierResultat, { timeout: 5_000 })
    .toBeDefined();
  const aprèsPremierTir = await lireCombat(page);
  expect(aprèsPremierTir.cibleId).not.toBeNull();
  expect(aprèsPremierTir.dernierResultat?.sequence).toBe(1);
  expect(aprèsPremierTir.dernierResultat?.degats).toBe(25);
  expect(aprèsPremierTir.pirateNeutralise).toBe(false);
  await expect
    .poll(async () => (await lireCombat(page)).santePirate, { timeout: 2_000 })
    .toBeLessThan(100);
  await expect(page.getByTestId('combat-cible')).toContainText('Cible : ');
  await expect(page.getByTestId('ath-combat-cible')).toContainText('Pirate · ');
  await expect(page.getByTestId('ath-combat-sante-cible')).toHaveText('75 / 100');
  await expect(page.getByTestId('ath-combat-resultat')).toHaveText('Impact confirmé · 25 dégâts');
  await page.screenshot({
    path: 'docs/preuves/combat-tir-accepte-1280x720.png',
    fullPage: false,
  });

  // Raté sans effet : un tir dans le vide (direction horizontale à hauteur de
  // yeux) ne touche aucun pirate et ne change aucune santé, après la cadence.
  await page.waitForTimeout(160);
  const avantRaté = await lireCombat(page);
  await tirerDansLeVide(page);
  await expect
    .poll(async () => (await lireCombat(page)).dernierResultat?.sequence, { timeout: 5_000 })
    .toBe(2);
  const aprèsRaté = await lireCombat(page);
  expect(aprèsRaté.cibleId).toBeNull();
  expect(aprèsRaté.santePirate).toBe(avantRaté.santePirate);
  await page.screenshot({
    path: 'docs/preuves/combat-rate-sans-effet-1280x720.png',
    fullPage: false,
  });

  // Dégâts joueur via le mannequin E2E réservé : le serveur tue le joueur sans
  // que le client ait fourni une santé ou un résultat.
  await infligerDegatsJoueur(page, 100);
  await expect
    .poll(async () => (await lireCombat(page)).enAttenteReapparition, { timeout: 5_000 })
    .toBe(true);
  await expect(page.getByTestId('combat-reapparition')).toHaveText('En attente : oui');
  await expect(page.getByTestId('ath-combat-mort')).toBeVisible();
  await expect(page.getByTestId('ath-combat-mort')).toContainText('Réapparition en cours');
  await expect(page.getByTestId('ath-combat-sante-joueur')).toHaveText('0 / 100');
  await page.screenshot({
    path: 'docs/preuves/combat-joueur-mort-1280x720.png',
    fullPage: false,
  });

  // Réapparition déterministe : après le délai, une nouvelle action réseau
  // restaure la santé pleine et le statut vivant à une apparition serveur.
  await page.waitForTimeout(3_200);
  await tirer(page);
  await expect
    .poll(async () => (await lireCombat(page)).enAttenteReapparition, { timeout: 6_000 })
    .toBe(false);
  await expect.poll(async () => (await lireCombat(page)).santeJoueur, { timeout: 6_000 }).toBe(100);
  await expect(page.getByTestId('combat-reapparition')).toHaveText('En attente : non');
  await expect(page.getByTestId('ath-combat-mort')).toBeHidden();
  await expect(page.getByTestId('ath-combat-sante-joueur')).toHaveText('100 / 100');
  await page.screenshot({
    path: 'docs/preuves/combat-reapparition-1280x720.png',
    fullPage: false,
  });

  // Rejeu d'une séquence déjà consommée : le serveur rejette l'intention (code
  // 4003) et déconnecte le joueur, sans dégât ajouté ni nouvelle santé pirate.
  const santePirateAvantRejeu = (await lireCombat(page)).santePirate;
  await rejouerTir(page);
  await expect
    .poll(async () => (await lireCombat(page)).codeDeconnexion, { timeout: 6_000 })
    .toBe(4003);
  expect((await lireCombat(page)).santePirate).toBe(santePirateAvantRejeu);
  await page.screenshot({
    path: 'docs/preuves/combat-rejeu-refuse-1280x720.png',
    fullPage: false,
  });

  expect(erreursPage).toEqual([]);
  expect(erreursConsole).toEqual([]);
});

test('n’expose pas le crochet de combat sans le mode documenté', async ({ page }) => {
  await page.goto('/?e2e=1&diagnostic=salle&graine=mvp-defaut');
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'diagnostic-salle');
  await expect(page.getByTestId('diagnostic-salle')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetCombat })
          .__pirateIslandsE2E;
        return Boolean(crochet?.tirerReseau);
      }),
    )
    .toBe(false);
});
