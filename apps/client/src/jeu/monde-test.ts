import { Color3, MeshBuilder, StandardMaterial, type Mesh, type Scene } from 'babylonjs';

import { creerMondeCollision, type BoiteCollision, type MondeCollision } from './mouvement';

export const MURS_BAC_A_SABLE: readonly BoiteCollision[] = [
  { minX: -4.8, maxX: 4.8, minY: 0, maxY: 3.2, minZ: 1.6, maxZ: 2.05 },
  { minX: -8.8, maxX: -8.35, minY: 0, maxY: 3.2, minZ: -8.8, maxZ: 8.8 },
  { minX: 8.35, maxX: 8.8, minY: 0, maxY: 3.2, minZ: -8.8, maxZ: 8.8 },
  { minX: -8.8, maxX: 8.8, minY: 0, maxY: 3.2, minZ: 8.35, maxZ: 8.8 },
];

export function construireBacASable(scene: Scene): MondeCollision {
  const materiauSol = new StandardMaterial('materiau-sol-bac', scene);
  materiauSol.diffuseColor = new Color3(0.76, 0.54, 0.29);
  materiauSol.specularColor = new Color3(0.18, 0.12, 0.06);

  const sol = MeshBuilder.CreateGround(
    'sol-bac-a-sable',
    { width: 18, height: 18, subdivisions: 2 },
    scene,
  );
  sol.position.y = 0;
  sol.material = materiauSol;
  sol.isPickable = false;

  const materiauMurs = new StandardMaterial('materiau-murs-bac', scene);
  materiauMurs.diffuseColor = new Color3(0.28, 0.12, 0.08);
  materiauMurs.emissiveColor = new Color3(0.04, 0.015, 0.01);
  materiauMurs.specularColor = new Color3(0.45, 0.24, 0.12);

  for (const [index, mur] of MURS_BAC_A_SABLE.entries()) {
    const mesh = creerMeshMur(scene, mur, `mur-test-${index}`);
    mesh.material = materiauMurs;
    mesh.isPickable = false;
  }

  const materiauRepere = new StandardMaterial('materiau-repere-bac', scene);
  materiauRepere.diffuseColor = new Color3(0.91, 0.73, 0.31);
  materiauRepere.emissiveColor = new Color3(0.12, 0.07, 0.01);
  const repere = MeshBuilder.CreateBox(
    'repere-mur-collision',
    { width: 9.2, height: 0.12, depth: 0.04 },
    scene,
  );
  repere.position.set(0, 3.26, 1.82);
  repere.material = materiauRepere;
  repere.isPickable = false;

  return creerMondeCollision(MURS_BAC_A_SABLE);
}

function creerMeshMur(scene: Scene, mur: BoiteCollision, nom: string): Mesh {
  const mesh = MeshBuilder.CreateBox(
    nom,
    {
      width: mur.maxX - mur.minX,
      height: mur.maxY - mur.minY,
      depth: mur.maxZ - mur.minZ,
    },
    scene,
  );
  mesh.position.set(
    (mur.minX + mur.maxX) / 2,
    (mur.minY + mur.maxY) / 2,
    (mur.minZ + mur.maxZ) / 2,
  );
  return mesh;
}
