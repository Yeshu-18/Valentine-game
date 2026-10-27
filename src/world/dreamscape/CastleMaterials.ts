import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';

export interface DreamCastleMaterials {
  pearlWhite: THREE.MeshStandardMaterial;
  champagneGold: THREE.MeshStandardMaterial;
  blushRoseMarble: THREE.MeshPhysicalMaterial;
  softLavender: THREE.MeshStandardMaterial;
  powderBlueSpire: THREE.MeshStandardMaterial;
  crystalGlass: THREE.MeshPhysicalMaterial;
  velvetPlum: THREE.MeshStandardMaterial;
  warmLanternGlow: THREE.MeshStandardMaterial;
  fountainWater: THREE.MeshPhysicalMaterial;
  creamStone: THREE.MeshStandardMaterial;
  darkBronze: THREE.MeshStandardMaterial;
  telescopeBrass: THREE.MeshStandardMaterial;
  mirrorSilver: THREE.MeshStandardMaterial;
}

/**
 * Creates and registers all materials for the 5-Level Pastel Dreamscape Castle.
 * All resources are tracked via ResourceTracker for leak-free disposal.
 */
export function createDreamCastleMaterials(
  tracker: ResourceTracker,
): DreamCastleMaterials {
  const pearlWhite = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fcfaf7'),
      roughness: 0.28,
      metalness: 0.05,
    }),
  );

  const champagneGold = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d8b467'),
      metalness: 0.85,
      roughness: 0.22,
    }),
  );

  const blushRoseMarble = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f4dce2'),
      roughness: 0.32,
      clearcoat: 0.45,
      clearcoatRoughness: 0.2,
    }),
  );

  const softLavender = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e3d7f4'),
      roughness: 0.36,
      metalness: 0.08,
    }),
  );

  const powderBlueSpire = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b9d8f2'),
      roughness: 0.38,
      metalness: 0.22,
    }),
  );

  const crystalGlass = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.35,
      roughness: 0.12,
      transmission: 0.65,
      ior: 1.48,
    }),
  );

  const velvetPlum = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#831843'),
      roughness: 0.82,
      metalness: 0.04,
    }),
  );

  const warmLanternGlow = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 1.15,
      roughness: 0.2,
    }),
  );

  const fountainWater = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#67e8f9'),
      emissive: new THREE.Color('#0891b2'),
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.72,
      roughness: 0.08,
      clearcoat: 0.85,
    }),
  );

  const creamStone = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f5f0eb'),
      roughness: 0.78,
      metalness: 0.06,
    }),
  );

  const darkBronze = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b2f2f'),
      roughness: 0.48,
      metalness: 0.62,
    }),
  );

  const telescopeBrass = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#eab308'),
      metalness: 0.88,
      roughness: 0.24,
    }),
  );

  const mirrorSilver = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e2e8f0'),
      metalness: 0.92,
      roughness: 0.12,
    }),
  );

  return {
    pearlWhite,
    champagneGold,
    blushRoseMarble,
    softLavender,
    powderBlueSpire,
    crystalGlass,
    velvetPlum,
    warmLanternGlow,
    fountainWater,
    creamStone,
    darkBronze,
    telescopeBrass,
    mirrorSilver,
  };
}
