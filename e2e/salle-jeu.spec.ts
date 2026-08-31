import { expect, test } from '@playwright/test';

const URL_DIAGNOSTIC = '/?e2e=1&diagnostic=salle&graine=mvp-defaut';

function extraireValeurDiagnostic(texte: string, préfixe: string): string {
  if (!texte.startsWith(préfixe)) {
    throw new Error('Diagnostic inattendu : ' + texte);
  }

  return texte.slice(préfixe.length).trim();
}

test.describe('salle de jeu multijoueur', () => {
  test('synchronise deux contextes puis retire le joueur sortant', async ({ page, browser }) => {
    const erreursPage: string[] = [];
    const erreursConsole: string[] = [];
    page.on('pageerror', (erreur) => erreursPage.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursConsole.push(message.text());
      }
    });
    const contexteSecondJoueur = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const pageSecondJoueur = await contexteSecondJoueur.newPage();
    const erreursPageSecondJoueur: string[] = [];
    const erreursConsoleSecondJoueur: string[] = [];
    pageSecondJoueur.on('pageerror', (erreur) => erreursPageSecondJoueur.push(erreur.message));
    pageSecondJoueur.on('console', (message) => {
      if (message.type() === 'error') {
        erreursConsoleSecondJoueur.push(message.text());
      }
    });

    try {
      await page.goto(URL_DIAGNOSTIC);
      await expect(page.locator('#app')).toHaveAttribute('data-mode', 'diagnostic-salle');
      await expect(page.getByTestId('diagnostic-salle')).toBeVisible();
      expect(
        await page.evaluate(() =>
          Boolean((window as unknown as { __pirateIslandsE2E?: unknown }).__pirateIslandsE2E),
        ),
      ).toBe(false);
      await expect(page.getByTestId('diagnostic-nombre-joueurs')).toHaveText(
        'Joueurs connectés : 1',
      );

      const identifiantSalle = extraireValeurDiagnostic(
        await page.getByTestId('diagnostic-salle-id').innerText(),
        'Salle :',
      );
      const premièreSession = extraireValeurDiagnostic(
        await page.getByTestId('diagnostic-session-id').innerText(),
        'Session locale :',
      );

      await pageSecondJoueur.goto(URL_DIAGNOSTIC + '&room=' + encodeURIComponent(identifiantSalle));
      await expect(pageSecondJoueur.locator('#app')).toHaveAttribute(
        'data-mode',
        'diagnostic-salle',
      );
      await expect(pageSecondJoueur.getByTestId('diagnostic-salle')).toBeVisible();
      expect(
        await pageSecondJoueur.evaluate(() =>
          Boolean((window as unknown as { __pirateIslandsE2E?: unknown }).__pirateIslandsE2E),
        ),
      ).toBe(false);
      await expect(pageSecondJoueur.getByTestId('diagnostic-nombre-joueurs')).toHaveText(
        'Joueurs connectés : 2',
      );
      await expect(page.getByTestId('diagnostic-nombre-joueurs')).toHaveText(
        'Joueurs connectés : 2',
      );

      const salleSecondJoueur = extraireValeurDiagnostic(
        await pageSecondJoueur.getByTestId('diagnostic-salle-id').innerText(),
        'Salle :',
      );
      const deuxièmeSession = extraireValeurDiagnostic(
        await pageSecondJoueur.getByTestId('diagnostic-session-id').innerText(),
        'Session locale :',
      );

      expect(salleSecondJoueur).toBe(identifiantSalle);
      expect(deuxièmeSession).not.toBe(premièreSession);

      await page.screenshot({
        path: 'docs/preuves/playwright-resultats/salle-jeu-premier.png',
        fullPage: false,
      });
      await pageSecondJoueur.screenshot({
        path: 'docs/preuves/playwright-resultats/salle-jeu-second.png',
        fullPage: false,
      });

      await contexteSecondJoueur.close();
      await expect(page.getByTestId('diagnostic-nombre-joueurs')).toHaveText(
        'Joueurs connectés : 1',
      );

      expect(erreursPage).toEqual([]);
      expect(erreursConsole).toEqual([]);
      expect(erreursPageSecondJoueur).toEqual([]);
      expect(erreursConsoleSecondJoueur).toEqual([]);
    } finally {
      if (contexteSecondJoueur.pages().length) {
        await contexteSecondJoueur.close();
      }
    }
  });

  test('ne montre pas le diagnostic sans le mode E2E documenté', async ({ page }) => {
    await page.goto('/?diagnostic=salle&graine=mvp-defaut');

    await expect(page.locator('#app')).toHaveAttribute('data-diagnostics', 'inactifs');
    await expect(page.getByTestId('diagnostic-salle')).toBeHidden();
  });
});
