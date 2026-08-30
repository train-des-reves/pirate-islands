import { démarrerServeur } from './server.js';

const serveur = await démarrerServeur();

console.log(`Serveur Pirate Islands disponible sur ${serveur.url}`);

const arrêter = (): void => {
  void serveur.arreter().then(() => process.exit(0));
};

process.once('SIGINT', arrêter);
process.once('SIGTERM', arrêter);
