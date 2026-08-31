import type { EtatHarnaisPilotage } from '../jeu/harnais-pilotage';

export interface InvitePilotageDom {
  readonly conteneur: HTMLElement;
  readonly mettreAJour: (etat: EtatHarnaisPilotage) => void;
  readonly detruire: () => void;
}

const LIBELLES_INVITE: Readonly<Record<EtatHarnaisPilotage['invite'], string>> = {
  prendre_barre: 'Prendre la barre',
  embarquer: 'Embarquer à bord',
  debarcher: 'Débarquer à un point sûr',
  aucune: '',
};

export function monterInvitePilotage(racine: HTMLElement): InvitePilotageDom {
  const conteneur = document.createElement('div');
  conteneur.className = 'invite-pilotage';
  conteneur.dataset.testid = 'invite-pilotage';
  conteneur.setAttribute('aria-live', 'polite');

  const texte = document.createElement('p');
  texte.className = 'invite-pilotage-texte';
  texte.dataset.testid = 'invite-pilotage-texte';
  conteneur.append(texte);

  const diagnostic = document.createElement('p');
  diagnostic.className = 'invite-pilotage-diagnostic';
  diagnostic.dataset.testid = 'invite-pilotage-diagnostic';
  conteneur.append(diagnostic);

  racine.append(conteneur);

  return {
    conteneur,
    mettreAJour: (etat) => {
      texte.textContent = LIBELLES_INVITE[etat.invite];
      texte.dataset.mode = etat.mode;
      texte.dataset.invite = etat.invite;
      conteneur.dataset.mode = etat.mode;
      conteneur.dataset.invite = etat.invite;
      diagnostic.textContent =
        `Vitesse ${etat.vitesse.toFixed(1)} m/s · Sillage ${etat.intensiteSillage.toFixed(2)} · ` +
        `Collision ${etat.collision}`;
      diagnostic.dataset.vitesse = etat.vitesse.toFixed(3);
      diagnostic.dataset.sillage = etat.intensiteSillage.toFixed(3);
      diagnostic.dataset.collision = etat.collision;
    },
    detruire: () => conteneur.remove(),
  };
}

export const LIBELLES_INVITE_PILOTAGE = LIBELLES_INVITE;
