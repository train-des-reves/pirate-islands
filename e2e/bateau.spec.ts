import { expect, test } from '@playwright/test';

const vues = [
  {
    camera: 'bateau-exterieur',
    nom: 'extérieur',
    preuve: 'bateau-exterieur-1280x720.png',
    description: 'la coque, le pont, la cabine et le toit',
  },
  {
    camera: 'bateau-cabine',
    nom: 'cabine',
    preuve: 'bateau-cabine-1280x720.png',
    description: 'les deux hublots et le poste de pilotage',
  },
  {
    camera: 'bateau-cale',
    nom: 'cale',
    preuve: 'bateau-cale-1280x720.png',
    description: 'la trappe, l’escalier et la cale sous le pont',
  },
] as const;

for (const vue of vues) {
  test('présente la vue ' + vue.nom + ' du bateau avec ' + vue.description, async ({ page }) => {
    const erreursPage: string[] = [];
    const erreursConsole: string[] = [];
    page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursConsole.push(message.text());
      }
    });

    await page.goto('/?e2e=1&graine=mvp-defaut&camera=' + vue.camera);
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await expect(page.locator('#app')).toHaveAttribute('data-graine', 'mvp-defaut');
    await expect(page.locator('#app')).toHaveAttribute('data-camera', vue.camera);
    await expect(page.locator('#app')).toHaveAttribute('data-presentation', vue.camera);
    await expect(page.locator('#app')).toHaveAttribute('data-bateau', 'bateau-quai');
    await expect(page.locator('#app')).toHaveAttribute('data-bateau-hublots', '2');
    await expect(page.locator('#app')).toHaveAttribute('data-bateau-ancrages', '4');
    await expect(page.locator('#app')).toHaveAttribute('data-bateau-surfaces', '11');
    await expect(page.locator('#app')).toHaveAttribute('data-bateau-collisions', '20');
    await expect(page.getByTestId('serveur-status')).toHaveText('Serveur joignable', {
      timeout: 10_000,
    });
    await expect(page.locator('.eyebrow')).toContainText('Bateau de pêche');

    await page.screenshot({
      type: 'png',
      path: 'docs/preuves/' + vue.preuve,
      fullPage: false,
    });

    expect(erreursPage).toEqual([]);
    expect(erreursConsole).toEqual([]);
  });
}
