import { copyFile, mkdir, writeFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

type EtatPilotageE2E = {
  readonly salleId: string | undefined;
  readonly sessionId: string | undefined;
  readonly bateauId: string | undefined;
  readonly piloteSessionId: string | undefined;
  readonly piloteNom: string | undefined;
  readonly statutBarre: string | undefined;
  readonly refusMotif: string | undefined;
  readonly refusMessage: string | undefined;
  readonly mode: string;
  readonly invite: string;
  readonly positionJoueur: { readonly x: number; readonly y: number; readonly z: number };
  readonly positionBateau: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotationBateau: number;
  readonly vitesse: number;
};

type CrochetPilotage = {
  readonly lireEtat?: () => { readonly pilotage?: EtatPilotageE2E };
  readonly reinitialiser?: () => void;
  readonly deplacerBord?: (offset: { x: number; y?: number; z: number }) => void;
  readonly demanderBarre?: () => void;
  readonly piloter?: (intentions: { poussee: number; gouvernail: number }) => void;
  readonly avancerTemps?: (deltaMs: number) => void;
  readonly positionnerJoueurE2E?: (position: { x: number; y: number; z: number }) => void;
};

async function lireEtat(page: Page): Promise<EtatPilotageE2E> {
  return page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    const état = crochet?.lireEtat?.().pilotage;
    if (!état) {
      throw new Error('Le crochet E2E du pilotage réseau est absent.');
    }
    return état;
  });
}

async function attendreEtat(
  page: Page,
  condition: (état: EtatPilotageE2E) => boolean,
  description: string,
  timeout = 15_000,
): Promise<void> {
  let dernierÉtat = 'indisponible';
  try {
    await expect
      .poll(
        async () => {
          const état = await lireEtat(page);
          dernierÉtat = JSON.stringify(état);
          return condition(état);
        },
        { timeout, intervals: [20, 50, 100, 200] },
      )
      .toBe(true);
  } catch (erreur) {
    const statut = (await page.getByTestId('pilotage-reseau-statut').textContent()) ?? '';
    throw new Error(`${description} État=${dernierÉtat} Statut=${statut}`, { cause: erreur });
  }
}

async function appeler(
  page: Page,
  action: 'reinitialiser' | 'piloter' | 'positionnerJoueurE2E',
  argument?: { poussee: number; gouvernail: number } | { x: number; y: number; z: number },
): Promise<void> {
  await page.evaluate(
    ({ action: nomAction, argument: argumentAction }) => {
      const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
        .__pirateIslandsE2E;
      if (nomAction === 'reinitialiser') {
        crochet?.reinitialiser?.();
      } else if (nomAction === 'piloter' && argumentAction) {
        crochet?.piloter?.(argumentAction as { poussee: number; gouvernail: number });
      } else if (nomAction === 'positionnerJoueurE2E' && argumentAction) {
        crochet?.positionnerJoueurE2E?.(argumentAction as { x: number; y: number; z: number });
      }
    },
    { action, argument },
  );
}

async function deplacerBord(
  page: Page,
  offset: { x: number; y?: number; z: number },
): Promise<void> {
  await page.evaluate((déplacement) => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    crochet?.deplacerBord?.(déplacement);
  }, offset);
}

async function avancerTemps(page: Page, deltaMs: number): Promise<void> {
  await page.evaluate((delta) => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    crochet?.avancerTemps?.(delta);
  }, deltaMs);
}

async function demanderBarre(page: Page): Promise<void> {
  await page.evaluate(() => {
    const crochet = (window as unknown as { __pirateIslandsE2E?: CrochetPilotage })
      .__pirateIslandsE2E;
    crochet?.demanderBarre?.();
  });
}

async function capturerComposite(pagePilote: Page, pageObservateur: Page): Promise<void> {
  const dossier = 'docs/preuves/playwright-resultats';
  await mkdir(dossier, { recursive: true });
  const [capturePilote, captureObservateur] = await Promise.all([
    pagePilote.screenshot({ path: `${dossier}/pilotage-reseau-pilote.png` }),
    pageObservateur.screenshot({ path: `${dossier}/pilotage-reseau-observateur.png` }),
  ]);
  const composite = await pagePilote.evaluate(
    async ({ imagePilote, imageObservateur }) => {
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
      const [pilote, observateur] = await Promise.all([
        charger(imagePilote),
        charger(imageObservateur),
      ]);
      contexte.drawImage(pilote, 0, 0, 640, 720);
      contexte.drawImage(observateur, 640, 0, 640, 720);
      return canvas.toDataURL('image/png');
    },
    {
      imagePilote: `data:image/png;base64,${capturePilote.toString('base64')}`,
      imageObservateur: `data:image/png;base64,${captureObservateur.toString('base64')}`,
    },
  );
  const cheminComposite = `${dossier}/pilotage-reseau-1280x720.png`;
  await writeFile(cheminComposite, Buffer.from(composite.split(',')[1] ?? '', 'base64'));
  await copyFile(cheminComposite, 'docs/preuves/pilotage-reseau-1280x720.png');
}

function distanceEntre(
  première: { readonly x: number; readonly y: number; readonly z: number },
  seconde: { readonly x: number; readonly y: number; readonly z: number },
): number {
  return Math.hypot(première.x - seconde.x, première.y - seconde.y, première.z - seconde.z);
}

test('synchronise la barre, le mouvement, le refus et la reprise à deux joueurs', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const contextePilote = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const contexteObservateur = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const pagePilote = await contextePilote.newPage();
  const pageObservateur = await contexteObservateur.newPage();

  let contextePiloteFerme = false;
  try {
    await pagePilote.goto(
      `/?e2e=1&pilotage=1&graine=mvp-defaut&nom=${encodeURIComponent('Pêcheur-Aube-0001')}`,
    );
    await expect(pagePilote.locator('#app')).toHaveAttribute('data-mode', 'pilote');
    await expect(pagePilote.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await attendreEtat(
      pagePilote,
      (état) => Boolean(état.salleId && état.sessionId && état.bateauId),
      'Le pilote ne rejoint pas la salle avec son bateau partagé.',
    );

    const étatInitialPilote = await lireEtat(pagePilote);
    const salleId = étatInitialPilote.salleId;
    const bateauId = étatInitialPilote.bateauId;
    const sessionPilote = étatInitialPilote.sessionId;
    if (!salleId || !bateauId || !sessionPilote) {
      throw new Error('La salle, le bateau ou la session du pilote est introuvable.');
    }

    await pageObservateur.goto(
      `/?e2e=1&pilotage=1&graine=mvp-defaut&room=${encodeURIComponent(salleId)}&nom=${encodeURIComponent('Pêcheur-Brume-0002')}`,
    );
    await expect(pageObservateur.locator('#app')).toHaveAttribute('data-mode', 'pilote');
    await expect(pageObservateur.locator('#app')).toHaveAttribute('data-scene', 'ready');
    await attendreEtat(
      pageObservateur,
      (état) => état.salleId === salleId && état.bateauId === bateauId && Boolean(état.sessionId),
      'Le second joueur ne rejoint pas la salle du pilote.',
    );
    const étatInitialObservateur = await lireEtat(pageObservateur);
    const sessionObservateur = étatInitialObservateur.sessionId;
    if (!sessionObservateur || sessionObservateur === sessionPilote) {
      throw new Error('Les deux joueurs doivent avoir des sessions distinctes.');
    }

    await appeler(pagePilote, 'reinitialiser');
    await pagePilote.keyboard.press('KeyE');
    await attendreEtat(
      pagePilote,
      (état) => état.mode === 'bord',
      'Le pilote ne monte pas à bord.',
    );
    await deplacerBord(pagePilote, { x: 0, z: 7.3 });
    await attendreEtat(
      pagePilote,
      (état) => état.invite === 'prendre_barre',
      'L’invite de prise de barre du pilote est absente.',
    );
    const positionBateauAvantPrise = (await lireEtat(pagePilote)).positionBateau;
    // Le déplacement local prépare l’invite ; cette position E2E synchronise aussi
    // la position autoritaire du joueur avant la validation de distance du serveur.
    await appeler(pagePilote, 'positionnerJoueurE2E', positionBateauAvantPrise);
    await demanderBarre(pagePilote);
    await attendreEtat(
      pagePilote,
      (état) =>
        état.mode === 'pilote' &&
        état.statutBarre === 'occupee' &&
        état.piloteSessionId === sessionPilote,
      'Le serveur n’accorde pas la barre au premier joueur.',
    );

    await appeler(pageObservateur, 'reinitialiser');
    await pageObservateur.keyboard.press('KeyE');
    await attendreEtat(
      pageObservateur,
      (état) => état.mode === 'bord',
      'L’observateur ne monte pas à bord.',
    );
    await deplacerBord(pageObservateur, { x: 0, z: 7.3 });
    await attendreEtat(
      pageObservateur,
      (état) => état.invite === 'prendre_barre',
      'L’invite de prise de barre de l’observateur est absente.',
    );
    const positionBateauAvantMouvement = (await lireEtat(pagePilote)).positionBateau;
    await appeler(pageObservateur, 'positionnerJoueurE2E', positionBateauAvantMouvement);
    await demanderBarre(pageObservateur);
    await attendreEtat(
      pageObservateur,
      (état) => état.mode === 'bord' && état.statutBarre === 'occupee',
      'L’observateur ne reste pas à bord après le refus de barre.',
    );
    await expect(pageObservateur.getByTestId('pilotage-reseau-statut')).toContainText(
      'Barre occupée par',
      { timeout: 10_000 },
    );
    await capturerComposite(pagePilote, pageObservateur);

    const avantMouvementPilote = await lireEtat(pagePilote);
    const avantMouvementObservateur = await lireEtat(pageObservateur);
    await pageObservateur.bringToFront();
    await appeler(pagePilote, 'piloter', { poussee: 1, gouvernail: 0 });
    let dernierDiagnosticMouvement = 'indisponible';
    try {
      await expect
        .poll(
          async () => {
            await Promise.all([avancerTemps(pagePilote, 50), avancerTemps(pageObservateur, 50)]);
            const [pilote, observateur] = await Promise.all([
              lireEtat(pagePilote),
              lireEtat(pageObservateur),
            ]);
            const déplacement = distanceEntre(
              pilote.positionBateau,
              avantMouvementPilote.positionBateau,
            );
            const convergence = distanceEntre(pilote.positionBateau, observateur.positionBateau);
            const dérivePassagerPilote =
              distanceEntre(pilote.positionJoueur, pilote.positionBateau) -
              distanceEntre(
                avantMouvementPilote.positionJoueur,
                avantMouvementPilote.positionBateau,
              );
            const dérivePassagerObservateur =
              distanceEntre(observateur.positionJoueur, observateur.positionBateau) -
              distanceEntre(
                avantMouvementObservateur.positionJoueur,
                avantMouvementObservateur.positionBateau,
              );
            dernierDiagnosticMouvement = JSON.stringify({
              pilote,
              observateur,
              déplacement,
              convergence,
              dérivePassagerPilote,
              dérivePassagerObservateur,
            });
            return (
              pilote.vitesse > 0 &&
              observateur.vitesse > 0 &&
              déplacement > 0.1 &&
              convergence < 0.75 &&
              Math.abs(dérivePassagerPilote) < 0.75 &&
              Math.abs(dérivePassagerObservateur) < 0.75
            );
          },
          { timeout: 10_000, intervals: [20, 50, 100, 200] },
        )
        .toBe(true);
    } catch (erreur) {
      const connexion =
        (await pageObservateur.getByTestId('connexion-message').textContent()) ?? '';
      const connexionÉtat =
        (await pageObservateur.getByTestId('connexion-statut').getAttribute('data-etat')) ?? '';
      throw new Error(
        `Le bateau ne progresse pas après l’intention. ${dernierDiagnosticMouvement} Connexion=${connexionÉtat}:${connexion}`,
        {
          cause: erreur,
        },
      );
    }
    await capturerComposite(pagePilote, pageObservateur);

    await contextePilote.close();
    contextePiloteFerme = true;
    await attendreEtat(
      pageObservateur,
      (état) => état.mode === 'bord' && état.statutBarre === 'libre' && !état.piloteSessionId,
      'La déconnexion du pilote ne libère pas la barre.',
      10_000,
    );
    await expect(pageObservateur.getByTestId('pilotage-reseau-statut')).toHaveText('Barre libre');

    await demanderBarre(pageObservateur);
    await attendreEtat(
      pageObservateur,
      (état) =>
        état.mode === 'pilote' &&
        état.statutBarre === 'occupee' &&
        état.piloteSessionId === sessionObservateur,
      'La barre ne peut pas être reprise après le départ du pilote.',
    );
    const positionAvantReprise = (await lireEtat(pageObservateur)).positionBateau;
    await appeler(pageObservateur, 'piloter', { poussee: 1, gouvernail: 0 });
    await attendreEtat(
      pageObservateur,
      (état) => distanceEntre(état.positionBateau, positionAvantReprise) > 0.1,
      'Le nouveau pilote ne déplace pas le bateau.',
      10_000,
    );
    await mkdir('docs/preuves/playwright-resultats', { recursive: true });
    await pageObservateur.screenshot({
      path: 'docs/preuves/playwright-resultats/pilotage-reseau-reprise-1280x720.png',
    });
    await copyFile(
      'docs/preuves/playwright-resultats/pilotage-reseau-reprise-1280x720.png',
      'docs/preuves/pilotage-reseau-reprise-1280x720.png',
    );
  } finally {
    if (!contextePiloteFerme) {
      await contextePilote.close();
    }
    await contexteObservateur.close();
  }
});
