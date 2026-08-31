import { expect, test, type Page } from '@playwright/test';

const URL_PANNEAU = '/?e2e=1&panneau=1';

function urlPanneauAvecServeur(serveur: string): string {
  return URL_PANNEAU + '&serveur=' + encodeURIComponent(serveur);
}

async function ouvrirPanneau(page: Page, nom: string): Promise<void> {
  await page.goto(URL_PANNEAU);
  await expect(page.getByTestId('panneau-accueil')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'accueil');
  await page.getByTestId('champ-nom').fill(nom);
}

async function rejoindreSalle(page: Page, identifiantSalle?: string): Promise<void> {
  await page.getByTestId('champ-salle').fill(identifiantSalle ?? '');
  await page.getByTestId('bouton-rejoindre').click();
}

async function attendreConnecte(page: Page): Promise<void> {
  await expect(page.getByTestId('connexion-infos')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('connexion-statut')).toHaveAttribute('data-etat', 'connecte');
}

test.describe('arrivée en salle multijoueur', () => {
  test.setTimeout(60_000);

  test('deux contextes isolés rejoignent la même salle et le compteur réagit', async ({
    page,
    browser,
  }) => {
    const erreursPremier: string[] = [];
    const erreursSecond: string[] = [];
    page.on('pageerror', (erreur) => erreursPremier.push(erreur.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        erreursPremier.push(message.text());
      }
    });

    const contexteSecondJoueur = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const pageSecondJoueur = await contexteSecondJoueur.newPage();
    pageSecondJoueur.on('pageerror', (erreur) => erreursSecond.push(erreur.message));
    pageSecondJoueur.on('console', (message) => {
      if (message.type() === 'error') {
        erreursSecond.push(message.text());
      }
    });

    try {
      await ouvrirPanneau(page, 'Pêcheur-Aube-0001');
      await rejoindreSalle(page);
      await attendreConnecte(page);
      const identifiantSalle = (await page.getByTestId('connexion-salle').innerText()).trim();
      expect(identifiantSalle).not.toBe('—');
      await expect(page.getByTestId('connexion-nom')).toHaveText('Pêcheur-Aube-0001');
      await expect(page.getByTestId('connexion-joueurs')).toHaveText('1 joueur');

      await ouvrirPanneau(pageSecondJoueur, 'Pêcheur-Brume-0002');
      await rejoindreSalle(pageSecondJoueur, identifiantSalle);
      await attendreConnecte(pageSecondJoueur);
      await expect(pageSecondJoueur.getByTestId('connexion-salle')).toHaveText(identifiantSalle);
      await expect(pageSecondJoueur.getByTestId('connexion-nom')).toHaveText('Pêcheur-Brume-0002');
      await expect(pageSecondJoueur.getByTestId('connexion-joueurs')).toHaveText('2 joueurs');

      await expect(page.getByTestId('connexion-joueurs')).toHaveText('2 joueurs');

      await page.screenshot({
        path: 'docs/preuves/playwright-resultats/arrivee-salle-premier.png',
        fullPage: false,
      });
      await pageSecondJoueur.screenshot({
        path: 'docs/preuves/playwright-resultats/arrivee-salle-second.png',
        fullPage: false,
      });

      await contexteSecondJoueur.close();
      await expect(page.getByTestId('connexion-joueurs')).toHaveText('1 joueur');

      expect(erreursPremier).toEqual([]);
      expect(erreursSecond).toEqual([]);
    } finally {
      if (contexteSecondJoueur.pages().length) {
        await contexteSecondJoueur.close();
      }
    }
  });

  test('affiche une interface utile lorsque le serveur est indisponible', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (erreur) => erreurs.push(erreur.message));

    await page.goto(urlPanneauAvecServeur('http://127.0.0.1:1'));
    await expect(page.getByTestId('panneau-accueil')).toBeVisible();
    await page.getByTestId('champ-nom').fill('Pêcheur-Aube-0001');
    await rejoindreSalle(page);

    await expect(page.getByTestId('connexion-statut')).toHaveAttribute('data-etat', 'echec', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('connexion-message')).toContainText('Serveur indisponible');
    await expect(page.getByTestId('bouton-reessayer')).toBeVisible();
    await expect(page.getByTestId('bouton-retour')).toBeVisible();

    await page.screenshot({
      path: 'docs/preuves/playwright-resultats/arrivee-salle-serveur-indisponible.png',
      fullPage: false,
    });

    await page.getByTestId('bouton-retour').click();
    await expect(page.getByTestId('connexion-statut')).toHaveAttribute('data-etat', 'attente');
    await expect(page.getByTestId('connexion-message')).toHaveText('Prêt à embarquer.');
    await expect(page.getByTestId('formulaire-connexion')).toBeVisible();

    expect(erreurs).toEqual([]);
  });
});
