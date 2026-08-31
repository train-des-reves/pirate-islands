import { expect, test } from '@playwright/test';

test.describe('sloop pirate hostile', () => {
  test('affiche une galerie déterministe des quatre états avec planche et sillage', async ({
    page,
  }) => {
    const erreursPage: string[] = [];
    const erreursConsole: string[] = [];
    page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursConsole.push(message.text());
      }
    });

    await page.goto('/?e2e=1&vue=bateaux-pirates&structure=1');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.locator('#app')).toHaveAttribute('data-mode', 'bateaux-pirates');
    await expect(page.locator('#app')).toHaveAttribute('data-vue', 'bateaux-pirates');
    await expect(page.locator('#app')).toHaveAttribute('data-structure', 'oui');
    await expect(page.getByTestId('bateau-pirate-fixture')).toHaveCount(4);
    await expect(page.getByTestId('bateaux-pirates-planche')).toBeVisible();
    await expect(page.getByTestId('bateau-pirate-planche-carte')).toHaveCount(4);
    await expect(page.getByTestId('bateau-pirate-fixture').nth(0)).toHaveText('Intact');
    await expect(page.getByTestId('bateau-pirate-fixture').nth(1)).toHaveText('En mouvement');
    await expect(page.getByTestId('bateau-pirate-fixture').nth(2)).toHaveText('Endommagé');
    await expect(page.getByTestId('bateau-pirate-fixture').nth(3)).toHaveText('Détruit');
    await expect(page.getByTestId('serveur-status')).toHaveText('Serveur joignable', {
      timeout: 10_000,
    });

    const cartes = page.getByTestId('bateau-pirate-planche-carte');
    const états = ['intact', 'intact', 'endommage', 'detruit'];
    for (const [index, état] of états.entries()) {
      const carte = cartes.nth(index);
      await expect(carte).toHaveAttribute('data-etat', état);
      await expect(carte.locator('[data-role="silhouette"]')).toHaveCount(1);
      await expect(carte.locator('[data-role="barre-sante-fond"]')).toHaveCount(1);
      await expect(carte.locator('[data-role="marqueur-etat"]')).toHaveCount(1);
    }

    // Le bateau en mouvement expose un sillage, le détruit n'en a pas.
    await expect(page.locator('#app')).toHaveAttribute('data-etats-bateaux', 'intact|intact|endommage|detruit');
    const sillage = (await page.locator('#app').getAttribute('data-sillage-bateaux')) ?? '';
    const valeurs = sillage.split('|').map((valeur) => Number(valeur));
    expect(valeurs).toHaveLength(4);
    expect(valeurs[1]).toBeGreaterThan(0.9);
    expect(valeurs[3]).toBe(0);

    // La pose du sloop « En mouvement » est figée par le paramètre `temps` pour
    // des captures déterministes (la phase ne dépend jamais de l'horloge réelle).
    await page.goto('/?e2e=1&vue=bateaux-pirates&animation=1&temps=1.9635');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.getByTestId('bateau-pirate-fixture')).toHaveCount(4);
    await expect(page.getByTestId('bateaux-pirates-planche')).toHaveCount(0);
    await page.waitForTimeout(600);
    await expect(page.locator('.marqueurs-e2e')).toHaveCount(0);

    expect(erreursPage).toEqual([]);
    expect(erreursConsole).toEqual([]);
  });

  test('sloop en mouvement puis état endommagé/détruit avec captures déterministes', async ({
    page,
  }) => {
    const erreursPage: string[] = [];
    const erreursConsole: string[] = [];
    page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursConsole.push(message.text());
      }
    });

    // La pose du sloop « En mouvement » est figée par `temps` pour une capture
    // déterministe : la phase du sinus ne dépend jamais de l'horloge réelle.
    await page.goto('/?e2e=1&vue=bateaux-pirates&animation=1&temps=1.9635');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.getByTestId('bateau-pirate-fixture')).toHaveCount(4);
    await expect(page).toHaveScreenshot('bateau-pirate-mouvement-1280x720.png', {
      animations: 'disabled',
      caret: 'hide',
      // La plateforme CI Ubuntu observe un écart de rendu Babylon stable
      // (19 332 pixels, ratio 0,03) par rapport à la capture générée sous
      // SwiftShader local, identique entre deux runs et deux heads : ce n'est
      // pas de la flakiness, c'est une variance de rendu WebGL multiplateforme.
      // 0,035 est le plus petit seuil reproductible avec cette marge mesurée.
      maxDiffPixelRatio: 0.035,
      scale: 'css',
    });
    await page.screenshot({
      path: 'docs/preuves/bateau-pirate-mouvement-1280x720.png',
      fullPage: false,
    });

    await page.goto('/?e2e=1&vue=bateaux-pirates&structure=1&animation=1&temps=1.9635');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page).toHaveScreenshot('bateau-pirate-endommage-detruit-1280x720.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.035,
      scale: 'css',
    });
    await page.screenshot({
      path: 'docs/preuves/bateau-pirate-endommage-detruit-1280x720.png',
      fullPage: false,
    });

    expect(erreursPage).toEqual([]);
    expect(erreursConsole).toEqual([]);
  });
});
