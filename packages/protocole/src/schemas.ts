import { Decoder, Encoder, schema, t, type SchemaType } from '@colyseus/schema';

export const CAPACITE_SALLE = 8;
export const SANTE_JOUEUR_MAXIMALE = 100;
export const SANTE_BATEAU_MAXIMALE = 100;
export const SANTE_PIRATE_MAXIMALE = 100;
export const GRAINE_PAR_DEFAUT = 'mvp-defaut';
export const PHASE_SALLE_ATTENTE = 'attente';
export const PHASE_SALLE_PARTIE = 'partie';

export const TransformationSchema = schema(
  {
    x: t.number().default(0),
    y: t.number().default(0),
    z: t.number().default(0),
    lacet: t.number().default(0),
    tangage: t.number().default(0),
    roulis: t.number().default(0),
  },
  'Transformation',
);
export type Transformation = SchemaType<typeof TransformationSchema>;

export const MetadonneesSalleSchema = schema(
  {
    identifiantSalle: t.string().default(''),
    versionProtocole: t.string().default('0.1.0'),
    graine: t.string().default(GRAINE_PAR_DEFAUT),
    capaciteMaximale: t.uint8().default(CAPACITE_SALLE),
  },
  'MetadonneesSalle',
);
export type MetadonneesSalle = SchemaType<typeof MetadonneesSalleSchema>;

export interface MetadonneesSalleMatchmaking {
  readonly identifiantSalle: string;
  readonly versionProtocole: string;
  readonly graine: string;
  readonly capaciteMaximale: number;
}

export const JoueurSchema = schema(
  {
    identifiant: t.string().default(''),
    sessionId: t.string().default(''),
    nom: t.string().default('Pêcheur'),
    transformation: TransformationSchema,
    sante: t.uint16().default(SANTE_JOUEUR_MAXIMALE),
    vivant: t.boolean().default(true),
    statut: t.string().default('actif'),
    bateauId: t.string().default(''),
  },
  'Joueur',
);
export type Joueur = SchemaType<typeof JoueurSchema>;

export const BateauSchema = schema(
  {
    identifiant: t.string().default(''),
    proprietaireSessionId: t.string().default(''),
    transformation: TransformationSchema,
    sante: t.uint16().default(SANTE_BATEAU_MAXIMALE),
    actif: t.boolean().default(true),
    statut: t.string().default('amarré'),
  },
  'Bateau',
);
export type Bateau = SchemaType<typeof BateauSchema>;

export const PirateSchema = schema(
  {
    identifiant: t.string().default(''),
    transformation: TransformationSchema,
    sante: t.uint16().default(SANTE_PIRATE_MAXIMALE),
    vivant: t.boolean().default(true),
    statut: t.string().default('inactif'),
    bateauId: t.string().default(''),
  },
  'Pirate',
);
export type Pirate = SchemaType<typeof PirateSchema>;

export const EtatSalleSchema = schema(
  {
    metadonnees: MetadonneesSalleSchema,
    phase: t.string().default('attente'),
    joueurs: t.map(JoueurSchema),
    bateaux: t.map(BateauSchema),
    pirates: t.map(PirateSchema),
  },
  'EtatSalle',
);
export type EtatSalle = SchemaType<typeof EtatSalleSchema>;

export interface PointApparition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly lacet: number;
}

export const APPARITIONS_JOUEURS: readonly PointApparition[] = Object.freeze([
  { x: -3, y: 0, z: 0, lacet: 0 },
  { x: 3, y: 0, z: 0, lacet: Math.PI },
  { x: 0, y: 0, z: -3, lacet: Math.PI / 2 },
  { x: 0, y: 0, z: 3, lacet: -Math.PI / 2 },
  { x: -3, y: 0, z: -3, lacet: Math.PI / 4 },
  { x: 3, y: 0, z: -3, lacet: (3 * Math.PI) / 4 },
  { x: -3, y: 0, z: 3, lacet: -Math.PI / 4 },
  { x: 3, y: 0, z: 3, lacet: (-3 * Math.PI) / 4 },
]);

export function obtenirPointApparition(index: number): PointApparition {
  const indexNormalise = Math.max(0, Math.floor(index)) % APPARITIONS_JOUEURS.length;
  return APPARITIONS_JOUEURS[indexNormalise] ?? APPARITIONS_JOUEURS[0]!;
}

export function creerTransformation(
  point: PointApparition = obtenirPointApparition(0),
): Transformation {
  return new TransformationSchema({
    x: point.x,
    y: point.y,
    z: point.z,
    lacet: point.lacet,
    tangage: 0,
    roulis: 0,
  });
}

export function creerJoueur(
  sessionId: string,
  indexApparition: number,
  nom: string = 'Pêcheur',
): Joueur {
  const bateauId = 'bateau-' + sessionId;
  return new JoueurSchema({
    identifiant: sessionId,
    sessionId,
    nom,
    transformation: creerTransformation(obtenirPointApparition(indexApparition)),
    sante: SANTE_JOUEUR_MAXIMALE,
    vivant: true,
    statut: 'actif',
    bateauId,
  });
}

export function creerBateau(sessionId: string, indexApparition: number): Bateau {
  return new BateauSchema({
    identifiant: 'bateau-' + sessionId,
    proprietaireSessionId: sessionId,
    transformation: creerTransformation(obtenirPointApparition(indexApparition)),
    sante: SANTE_BATEAU_MAXIMALE,
    actif: true,
    statut: 'amarré',
  });
}

export function creerPirate(identifiant: string, indexApparition = 0): Pirate {
  return new PirateSchema({
    identifiant,
    transformation: creerTransformation(obtenirPointApparition(indexApparition)),
    sante: SANTE_PIRATE_MAXIMALE,
    vivant: true,
    statut: 'inactif',
    bateauId: '',
  });
}

export function creerEtatSalle(options: {
  readonly identifiantSalle: string;
  readonly graine?: string;
  readonly versionProtocole?: string;
}): EtatSalle {
  return new EtatSalleSchema({
    metadonnees: new MetadonneesSalleSchema({
      identifiantSalle: options.identifiantSalle,
      versionProtocole: options.versionProtocole ?? '0.1.0',
      graine: options.graine ?? GRAINE_PAR_DEFAUT,
      capaciteMaximale: CAPACITE_SALLE,
    }),
    phase: 'attente',
  });
}

export function encoderEtatSalle(etat: EtatSalle): Uint8Array {
  return new Encoder(etat).encodeAll();
}

export function decoderEtatSalle(octets: Uint8Array): EtatSalle {
  const etat = new EtatSalleSchema();
  new Decoder(etat).decode(octets);
  return etat;
}
