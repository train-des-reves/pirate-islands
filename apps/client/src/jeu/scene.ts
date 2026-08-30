import {
  Color3,
  Color4,
  FreeCamera,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  VertexData,
  type AbstractEngine,
  type AbstractMesh,
} from 'babylonjs';

import {
  GRAINE_MVP_PAR_DEFAUT,
  type DescripteurIle,
  type DescripteurMonde,
  type MarqueurIle,
  genererMonde,
} from '@pirate/coeur-jeu';

const SEGMENTS_ILE = 12;

export type ModeCameraMonde = 'ensemble' | 'rivage';

export interface OptionsMondeBabylon {
  readonly modeCamera?: ModeCameraMonde;
}

export interface MondeBabylon {
  readonly monde: DescripteurMonde;
  readonly camera: FreeCamera;
  readonly ocean: Mesh;
  readonly terrains: readonly Mesh[];
  readonly rivages: readonly Mesh[];
  readonly quais: readonly Mesh[];
  readonly objets: readonly AbstractMesh[];
  readonly liberer: () => void;
}

function couleurDepuisTableau(couleur: readonly [number, number, number]): Color3 {
  return new Color3(couleur[0], couleur[1], couleur[2]);
}

function créerMatériau(
  scene: Scene,
  nom: string,
  diffuse: Color3,
  options: { readonly speculaire?: Color3; readonly emissive?: Color3 } = {},
): StandardMaterial {
  const matériau = new StandardMaterial(nom, scene);
  matériau.diffuseColor = diffuse;
  matériau.specularColor = options.speculaire ?? new Color3(0.08, 0.12, 0.1);
  matériau.emissiveColor = options.emissive ?? new Color3(0, 0, 0);
  return matériau;
}

function appliquerGéométrie(mesh: Mesh, positions: number[], indices: number[]): void {
  const normales: number[] = [];
  VertexData.ComputeNormals(positions, indices, normales);

  const données = new VertexData();
  données.positions = positions;
  données.indices = indices;
  données.normals = normales;
  données.applyToMesh(mesh);
}

function ajouterFacesAnneau(
  indices: number[],
  premierAnneau: number,
  secondAnneau: number,
  segments: number,
): void {
  for (let index = 0; index < segments; index += 1) {
    const suivant = (index + 1) % segments;
    indices.push(
      premierAnneau + index,
      secondAnneau + index,
      secondAnneau + suivant,
      premierAnneau + index,
      secondAnneau + suivant,
      premierAnneau + suivant,
    );
  }
}

function créerTerrain(ile: DescripteurIle, scene: Scene): Mesh {
  const mesh = new Mesh(`terrain-${ile.id}`, scene);
  const positions: number[] = [];
  const indices: number[] = [];
  const base = ile.collision.hauteurBase;
  const hauteurRivage = ile.rivage.hauteur;
  const hauteurCouronne = ile.hauteurTerrain * (ile.forme === 'falaise' ? 0.9 : 0.76);

  for (let index = 0; index < SEGMENTS_ILE; index += 1) {
    const angle = (index / SEGMENTS_ILE) * Math.PI * 2;
    const cosinus = Math.cos(angle);
    const sinus = Math.sin(angle);
    positions.push(cosinus * ile.rayonX, base, sinus * ile.rayonZ);
  }

  for (let index = 0; index < SEGMENTS_ILE; index += 1) {
    const angle = (index / SEGMENTS_ILE) * Math.PI * 2;
    const cosinus = Math.cos(angle);
    const sinus = Math.sin(angle);
    const relief = ile.relief[index] ?? 1;
    positions.push(
      cosinus * ile.rayonX * 0.98 * relief,
      hauteurRivage,
      sinus * ile.rayonZ * 0.98 * relief,
    );
  }

  for (let index = 0; index < SEGMENTS_ILE; index += 1) {
    const angle = (index / SEGMENTS_ILE) * Math.PI * 2;
    const cosinus = Math.cos(angle);
    const sinus = Math.sin(angle);
    const relief = ile.relief[index] ?? 1;
    positions.push(
      cosinus * ile.rayonX * 0.6 * relief,
      hauteurCouronne,
      sinus * ile.rayonZ * 0.6 * relief,
    );
  }

  const sommet = positions.length / 3;
  positions.push(0, ile.hauteurTerrain, 0);
  ajouterFacesAnneau(indices, 0, SEGMENTS_ILE, SEGMENTS_ILE);
  ajouterFacesAnneau(indices, SEGMENTS_ILE, SEGMENTS_ILE * 2, SEGMENTS_ILE);

  for (let index = 0; index < SEGMENTS_ILE; index += 1) {
    const suivant = (index + 1) % SEGMENTS_ILE;
    indices.push(SEGMENTS_ILE * 2 + index, sommet, SEGMENTS_ILE * 2 + suivant);
  }

  appliquerGéométrie(mesh, positions, indices);
  mesh.position.set(
    ile.transformation.position.x,
    ile.transformation.position.y,
    ile.transformation.position.z,
  );
  mesh.rotation.y = ile.transformation.rotationY;
  const matériauTerrain = créerMatériau(
    scene,
    `matériau-${ile.id}`,
    couleurDepuisTableau(ile.couleurTerrain),
  );
  matériauTerrain.backFaceCulling = false;
  matériauTerrain.emissiveColor = couleurDepuisTableau(ile.couleurTerrain).scale(0.4);
  mesh.material = matériauTerrain;
  mesh.checkCollisions = true;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.metadata = { type: 'terrain', ileId: ile.id, collision: ile.collision };
  return mesh;
}

function créerRivage(ile: DescripteurIle, scene: Scene): Mesh {
  const mesh = new Mesh(`rivage-${ile.id}`, scene);
  const positions: number[] = [];
  const indices: number[] = [];
  const rayonInterieurX = ile.rayonX * 0.91;
  const rayonInterieurZ = ile.rayonZ * 0.91;

  for (let index = 0; index < SEGMENTS_ILE; index += 1) {
    const angle = (index / SEGMENTS_ILE) * Math.PI * 2;
    positions.push(
      Math.cos(angle) * ile.rivage.rayonX,
      ile.rivage.hauteur,
      Math.sin(angle) * ile.rivage.rayonZ,
    );
    positions.push(
      Math.cos(angle) * rayonInterieurX,
      ile.rivage.hauteur + 0.015,
      Math.sin(angle) * rayonInterieurZ,
    );
  }

  for (let index = 0; index < SEGMENTS_ILE; index += 1) {
    const suivant = (index + 1) % SEGMENTS_ILE;
    const extérieur = index * 2;
    const intérieur = extérieur + 1;
    const extérieurSuivant = suivant * 2;
    const intérieurSuivant = extérieurSuivant + 1;
    indices.push(
      extérieur,
      extérieurSuivant,
      intérieurSuivant,
      extérieur,
      intérieurSuivant,
      intérieur,
    );
  }

  appliquerGéométrie(mesh, positions, indices);
  mesh.position.set(
    ile.transformation.position.x,
    ile.transformation.position.y,
    ile.transformation.position.z,
  );
  mesh.rotation.y = ile.rivage.rotationY;
  mesh.material = créerMatériau(
    scene,
    `matériau-rivage-${ile.id}`,
    couleurDepuisTableau(ile.couleurRivage),
  );
  mesh.isPickable = false;
  mesh.metadata = { type: 'rivage', ileId: ile.id };
  return mesh;
}

function créerQuai(ile: DescripteurIle, scene: Scene): Mesh {
  const quai = MeshBuilder.CreateBox(
    `quai-${ile.id}`,
    {
      width: ile.approche.quai.longueur,
      height: 0.32,
      depth: ile.approche.quai.largeur,
    },
    scene,
  );
  quai.position.set(
    ile.approche.quai.position.x,
    ile.approche.quai.position.y,
    ile.approche.quai.position.z,
  );
  quai.rotation.y = ile.approche.quai.rotationY;
  quai.material = créerMatériau(scene, `matériau-quai-${ile.id}`, new Color3(0.28, 0.16, 0.09));
  quai.checkCollisions = true;
  quai.isPickable = false;
  quai.metadata = { type: 'quai', ileId: ile.id };
  return quai;
}

function créerOrnement(ile: DescripteurIle, scene: Scene): Mesh | undefined {
  if (ile.forme !== 'cratere') {
    return undefined;
  }

  const cratere = MeshBuilder.CreateTorus(
    `cratère-${ile.id}`,
    {
      diameter: 2,
      thickness: 0.28,
      tessellation: 12,
    },
    scene,
  );
  cratere.position.set(
    ile.transformation.position.x,
    ile.transformation.position.y + ile.hauteurTerrain + 0.04,
    ile.transformation.position.z,
  );
  cratere.scaling.set(ile.rayonX * 0.2, 0.45, ile.rayonZ * 0.2);
  cratere.rotation.y = ile.transformation.rotationY;
  cratere.material = créerMatériau(
    scene,
    `matériau-cratère-${ile.id}`,
    new Color3(0.12, 0.18, 0.17),
    { emissive: new Color3(0.015, 0.025, 0.02) },
  );
  cratere.isPickable = false;
  cratere.metadata = { type: 'ornement', ileId: ile.id };
  return cratere;
}

function créerOcean(scene: Scene, monde: DescripteurMonde): Mesh {
  const ocean = MeshBuilder.CreateGround(
    'ocean',
    {
      width: monde.ocean.largeur,
      height: monde.ocean.profondeur,
      subdivisions: 24,
    },
    scene,
  );
  ocean.position.y = monde.ocean.hauteur;
  ocean.isPickable = false;
  ocean.material = créerMatériau(scene, 'matériau-ocean', new Color3(0.015, 0.28, 0.42), {
    speculaire: new Color3(0.3, 0.65, 0.75),
    emissive: new Color3(0.005, 0.04, 0.07),
  });
  ocean.metadata = { type: 'ocean' };
  return ocean;
}

function créerCiel(scene: Scene): Mesh {
  const ciel = MeshBuilder.CreateBox('ciel', { size: 260 }, scene);
  ciel.isPickable = false;
  ciel.infiniteDistance = true;
  const matériau = new StandardMaterial('matériau-ciel', scene);
  matériau.backFaceCulling = false;
  matériau.disableLighting = true;
  matériau.emissiveColor = new Color3(0.18, 0.46, 0.69);
  ciel.material = matériau;
  return ciel;
}

function configurerAmbiance(scene: Scene): HemisphericLight {
  scene.clearColor = new Color4(0.31, 0.66, 0.82, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.31, 0.66, 0.82);
  scene.fogDensity = 0.0032;
  scene.collisionsEnabled = true;

  const lumière = new HemisphericLight('lumière-ciel', new Vector3(0.1, 1, 0.2), scene);
  lumière.intensity = 1.15;
  lumière.diffuse = new Color3(0.85, 0.95, 1);
  lumière.groundColor = new Color3(0.035, 0.12, 0.17);
  return lumière;
}

function créerCamera(
  scene: Scene,
  monde: DescripteurMonde,
  modeCamera: ModeCameraMonde,
): FreeCamera {
  const premièreIle = monde.iles[0];
  if (!premièreIle) {
    throw new Error('Le monde doit contenir au moins une île.');
  }

  const camera = new FreeCamera('camera-principal', Vector3.Zero(), scene);
  camera.minZ = 0.1;
  camera.maxZ = 600;
  camera.fov = 0.72;
  camera.checkCollisions = true;
  camera.ellipsoid = new Vector3(0.45, 0.9, 0.45);

  if (modeCamera === 'rivage') {
    const apparition = premièreIle.apparitionJoueur.position;
    const direction = premièreIle.approche.direction;
    camera.position.set(apparition.x, apparition.y + 0.8, apparition.z);
    camera.setTarget(
      new Vector3(
        apparition.x + direction.x * 16,
        premièreIle.hauteurTerrain + 0.25,
        apparition.z + direction.z * 16,
      ),
    );
  } else {
    camera.position = new Vector3(0, 112, 20);
    camera.setTarget(new Vector3(0, 0, 18));
    camera.fov = 0.86;
  }

  scene.activeCamera = camera;
  return camera;
}

export function construireMondeBabylon(
  scene: Scene,
  monde: DescripteurMonde = genererMonde(GRAINE_MVP_PAR_DEFAUT),
  options: OptionsMondeBabylon = {},
): MondeBabylon {
  const lumière = configurerAmbiance(scene);
  const ciel = créerCiel(scene);
  const ocean = créerOcean(scene, monde);
  const terrains: Mesh[] = [];
  const rivages: Mesh[] = [];
  const quais: Mesh[] = [];
  const objets: AbstractMesh[] = [ciel, ocean];

  for (const ile of monde.iles) {
    const terrain = créerTerrain(ile, scene);
    const rivage = créerRivage(ile, scene);
    const quai = créerQuai(ile, scene);
    const ornement = créerOrnement(ile, scene);
    terrains.push(terrain);
    rivages.push(rivage);
    quais.push(quai);
    objets.push(terrain, rivage, quai);
    if (ornement) {
      objets.push(ornement);
    }
  }

  const camera = créerCamera(scene, monde, options.modeCamera ?? 'ensemble');
  const liberer = (): void => {
    for (const objet of objets) {
      objet.dispose(false, true);
    }
    camera.dispose();
    lumière.dispose();
  };

  return { monde, camera, ocean, terrains, rivages, quais, objets, liberer };
}

function positionnerMarqueur(
  élément: HTMLElement,
  marqueur: MarqueurIle,
  scene: Scene,
  camera: FreeCamera,
  moteur: AbstractEngine,
): void {
  const fenêtre = camera.viewport.toGlobal(moteur.getRenderWidth(), moteur.getRenderHeight());
  const projection = Vector3.Project(
    new Vector3(marqueur.position.x, marqueur.position.y, marqueur.position.z),
    Matrix.Identity(),
    scene.getTransformMatrix(),
    fenêtre,
  );
  const visible = projection.z >= 0 && projection.z <= 1;
  élément.hidden = !visible;
  if (visible) {
    élément.style.left = `${projection.x}px`;
    élément.style.top = `${projection.y}px`;
  }
}

export function installerMarqueursE2E(
  scene: Scene,
  monde: DescripteurMonde,
  camera: FreeCamera,
): () => void {
  const conteneur = document.createElement('div');
  conteneur.className = 'marqueurs-e2e';
  conteneur.dataset.testid = 'marqueurs-e2e';
  conteneur.setAttribute('aria-label', 'Marqueurs E2E des îles');

  const éléments = monde.marqueurs.map((marqueur) => {
    const élément = document.createElement('span');
    élément.className = 'marqueur-ile';
    élément.dataset.testid = 'marqueur-ile';
    élément.dataset.ileId = marqueur.ileId;
    élément.textContent = marqueur.label;
    conteneur.append(élément);
    return { élément, marqueur };
  });
  document.querySelector('#app')?.append(conteneur);

  const miseÀJour = (): void => {
    const moteur = scene.getEngine();
    for (const { élément, marqueur } of éléments) {
      positionnerMarqueur(élément, marqueur, scene, camera, moteur);
    }
  };
  const observateur = scene.onAfterRenderObservable.add(miseÀJour);
  miseÀJour();

  return () => {
    scene.onAfterRenderObservable.remove(observateur);
    conteneur.remove();
  };
}
