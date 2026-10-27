import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  FOREST_LAKE_LOCAL_POS,
  HEARTWOOD_SANCTUARY_LOCAL_POS,
  HIDDEN_POOL_LOCAL_POS,
  ISLAND_ZONES,
  getHeartIslandMask,
  getPathWeight,
  getTerrainHeight,
  getTerrainNormal,
  isInsideSightlineCorridor,
  worldToCastleLocal,
} from './terrainMath';

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
  y?: number;
  height?: number;
}

export interface VegetationBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  update: (elapsedTime: number) => void;
  dispose: () => void;
}

// Deterministic seeded PRNG (Mulberry32)
function createSeededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a tileable procedural leaf-grain micro-bump texture so tree canopies
 * and shrubs catch warm dappled golden-hour sunlight instead of looking like smooth balloons.
 */
function createLeafMicroBumpTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const rand = createSeededRandom(994422);
  for (let i = 0; i < 3200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 1.4 + rand() * 3.2;
    const ry = 0.8 + rand() * 1.8;
    const ang = rand() * Math.PI;
    const bright = rand() > 0.48 ? 205 : 55;
    ctx.fillStyle = `rgba(${bright}, ${bright}, ${bright}, 0.28)`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, ang, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Perturbs vertices of a puff geometry with organic 3D harmonic displacement
 * so each foliage cluster has natural botanical leaf clumps rather than spherical facets.
 */
function perturbLeafPuffGeometry(
  geo: THREE.BufferGeometry,
  amp: number,
  freq: number,
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;
    const wave =
      Math.sin(vx * freq + vy * (freq * 0.8)) *
        Math.cos(vz * freq - vx * 0.7) *
        amp +
      Math.sin((vx + vz) * freq * 1.7) * (amp * 0.45);
    pos.setXYZ(i, vx + nx * wave, vy + ny * wave * 0.85, vz + nz * wave);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Checks if a coordinate is inside the architectural footprint of Central Plaza
 * or any of the 6 distant landmark plateaus so trees frame landmarks instead of obscuring them.
 */
function isInsideLandmarkOrPlazaClearing(x: number, z: number): boolean {
  // Keep 0–35m governed strictly by intentional selective ornamental placement
  if (Math.hypot(x, z) < 35.0) return true;

  // Keep sightline corridors from Central Plaza to all 6 distant landmarks unobstructed
  if (isInsideSightlineCorridor(x, z)) return true;

  for (let i = 0; i < ISLAND_ZONES.length; i++) {
    const zone = ISLAND_ZONES[i];
    const d = Math.hypot(x - zone.x, z - zone.z);
    const clearFactor = zone.id === 'carnival-midway' ? 1.08 : 0.72;
    if (d < zone.radius * clearFactor) return true;
  }

  // Keep the Forest Lake, Hidden Pool, Heartwood Sanctuary, and handcrafted Ancient Forest
  // completely free of generic island vegetation trees/pines/boulders
  const { localX, localZ } = worldToCastleLocal(x, z);
  const lakeDx = (localX - FOREST_LAKE_LOCAL_POS.localX) / 1.22;
  const lakeDz = (localZ - FOREST_LAKE_LOCAL_POS.localZ) / 0.95;
  if (Math.hypot(lakeDx, lakeDz) < 16.5) return true;
  if (
    Math.hypot(
      localX - HIDDEN_POOL_LOCAL_POS.localX,
      localZ - HIDDEN_POOL_LOCAL_POS.localZ,
    ) < 7.5
  ) {
    return true;
  }
  if (
    Math.hypot(
      localX - HEARTWOOD_SANCTUARY_LOCAL_POS.localX,
      localZ - HEARTWOOD_SANCTUARY_LOCAL_POS.localZ,
    ) < 16.0
  ) {
    return true;
  }
  if (localX >= 8.0 && localX <= 145.0 && localZ >= -35.0 && localZ <= 70.0) {
    return true;
  }

  // Keep the Pastel Dreamscape Castle (origin 88, 18), front pathway, Conservatory doorway,
  // and Rear Rose/Butterfly Garden 100% clear of procedural island trees and boulders
  if (x >= 56.0 && x <= 112.0 && z >= -10.0 && z <= 58.0) {
    return true;
  }

  return false;
}

/**
 * Builds a composite 6-part deciduous tree trunk + grounded root-collar earth mound + gnarled root flare + forked boughs
 * pivoted at bottom-center (Y = 0) so every tree sits naturally grounded into the terrain.
 */
function createCanopyTrunkGeometry(): THREE.BufferGeometry {
  const earthCollar = new THREE.CylinderGeometry(0.46, 0.68, 0.22, 8);
  earthCollar.translate(0, 0.06, 0);

  const mainTrunk = new THREE.CylinderGeometry(0.2, 0.38, 2.55, 8);
  mainTrunk.translate(0, 1.27, 0);

  const rootFlare = new THREE.CylinderGeometry(0.36, 0.56, 0.48, 8);
  rootFlare.translate(0, 0.24, 0);

  const branchL = new THREE.CylinderGeometry(0.09, 0.18, 1.45, 7);
  branchL.rotateZ(0.58);
  branchL.translate(-0.48, 2.45, 0.08);

  const branchR = new THREE.CylinderGeometry(0.08, 0.16, 1.35, 7);
  branchR.rotateZ(-0.52);
  branchR.rotateY(1.1);
  branchR.translate(0.38, 2.55, 0.28);

  const branchBack = new THREE.CylinderGeometry(0.08, 0.15, 1.25, 7);
  branchBack.rotateX(-0.52);
  branchBack.translate(0.05, 2.5, -0.42);

  return mergeGeometries([
    earthCollar,
    mainTrunk,
    rootFlare,
    branchL,
    branchR,
    branchBack,
  ]);
}

/**
 * Builds a 13-puff organically perturbed leaf-cluster tree crown geometry
 * so trees read as lush, layered botanical boughs rather than smooth geometric spheres.
 */
function createCanopyFoliageGeometry(): THREE.BufferGeometry {
  const puffSpecs: Array<[number, number, number, number, number, number]> = [
    // [x, y, z, radius, scaleXZ, scaleY]
    [0.0, 3.65, 0.0, 1.28, 1.22, 0.84],
    [-1.12, 3.15, 0.32, 0.92, 1.15, 0.78],
    [1.1, 3.22, -0.28, 0.9, 1.16, 0.78],
    [0.24, 3.2, 1.08, 0.88, 1.14, 0.76],
    [-0.25, 3.18, -1.06, 0.88, 1.14, 0.76],
    [-0.78, 3.78, -0.68, 0.82, 1.12, 0.8],
    [0.82, 3.82, 0.65, 0.82, 1.12, 0.8],
    [-0.82, 3.75, 0.72, 0.76, 1.1, 0.78],
    [0.75, 3.72, -0.75, 0.76, 1.1, 0.78],
    [0.08, 4.48, 0.12, 0.86, 1.15, 0.82],
    [-0.48, 4.25, -0.22, 0.68, 1.1, 0.78],
    [0.46, 4.28, 0.28, 0.66, 1.1, 0.78],
    [0.0, 2.88, 0.68, 0.65, 1.18, 0.7],
  ];

  const puffs = puffSpecs.map(([px, py, pz, r, sxz, sy], idx) => {
    const g = new THREE.IcosahedronGeometry(r, 2);
    perturbLeafPuffGeometry(g, 0.15 * r, 3.1 + (idx % 3) * 0.45);
    g.scale(sxz, sy, sxz);
    g.translate(px, py, pz);
    return g;
  });

  return mergeGeometries(puffs);
}

/**
 * Builds a composite 4-tier organically ruffled alpine/coastal pine foliage geometry.
 */
function createPineFoliageGeometry(): THREE.BufferGeometry {
  const tier1 = perturbLeafPuffGeometry(
    new THREE.ConeGeometry(1.78, 2.4, 10, 3),
    0.14,
    3.4,
  );
  tier1.translate(0, 2.4, 0);

  const tier2 = perturbLeafPuffGeometry(
    new THREE.ConeGeometry(1.42, 2.2, 10, 3),
    0.12,
    3.8,
  );
  tier2.translate(0, 3.7, 0);

  const tier3 = perturbLeafPuffGeometry(
    new THREE.ConeGeometry(1.02, 2.0, 9, 2),
    0.1,
    4.2,
  );
  tier3.translate(0, 4.9, 0);

  const spire = perturbLeafPuffGeometry(
    new THREE.ConeGeometry(0.56, 1.45, 8, 2),
    0.07,
    4.6,
  );
  spire.translate(0, 5.9, 0);

  return mergeGeometries([tier1, tier2, tier3, spire]);
}

/**
 * Builds a multi-blade botanical grass & wildflower tuft geometry (7 slender arched blades).
 */
function createGrassTuftGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const bladeConfigs = [
    { x: 0.0, z: 0.0, h: 0.48, w: 0.08, tiltX: 0.12, tiltZ: 0.0, rotY: 0.0 },
    { x: 0.09, z: 0.05, h: 0.42, w: 0.07, tiltX: 0.22, tiltZ: -0.18, rotY: 1.1 },
    { x: -0.09, z: 0.04, h: 0.44, w: 0.07, tiltX: -0.18, tiltZ: 0.24, rotY: 2.2 },
    { x: 0.04, z: -0.09, h: 0.39, w: 0.07, tiltX: -0.25, tiltZ: -0.15, rotY: 3.3 },
    { x: -0.06, z: -0.08, h: 0.41, w: 0.07, tiltX: 0.2, tiltZ: 0.2, rotY: 4.4 },
    { x: 0.13, z: -0.03, h: 0.34, w: 0.065, tiltX: 0.3, tiltZ: -0.25, rotY: 5.1 },
    { x: -0.12, z: 0.08, h: 0.36, w: 0.065, tiltX: -0.28, tiltZ: 0.28, rotY: 0.6 },
  ];

  for (const cfg of bladeConfigs) {
    const b = new THREE.ConeGeometry(cfg.w, cfg.h, 4);
    b.scale(1.0, 1.0, 0.38);
    b.translate(0, cfg.h * 0.5, 0);
    b.rotateX(cfg.tiltX);
    b.rotateZ(cfg.tiltZ);
    b.rotateY(cfg.rotY);
    b.translate(cfg.x, 0, cfg.z);
    blades.push(b);
  }

  return mergeGeometries(blades);
}

export function createVegetationSystem(): VegetationBundle {
  const group = new THREE.Group();
  group.name = 'HeartIslandVegetation';

  const rand = createSeededRandom(20270214);
  const colliders: CircleCollider[] = [];

  const dummy = new THREE.Object3D();
  const normal = new THREE.Vector3();
  const tempColor = new THREE.Color();

  const canopyTransforms: Array<{
    x: number;
    y: number;
    z: number;
    scale: number;
    scaleY: number;
    rotY: number;
    tiltX: number;
    tiltZ: number;
    tintIndex: number;
  }> = [];

  const pineTransforms: Array<{
    x: number;
    y: number;
    z: number;
    scale: number;
    scaleY: number;
    rotY: number;
    tiltX: number;
    tiltZ: number;
    tint: number;
  }> = [];

  // 1A. Selective Small Ornamental Trees in the 22–35m Outer Plaza Garden Ring
  // (0–12m and 12–22m have ZERO trees so the Fountain Core and Inner Parterre Ring remain open!)
  // Placed in curated asymmetric garden pairs between the 6 radiating boulevards and kiosks.
  const ornamentalGardenClusters: Array<{
    ang: number;
    r: number;
    scale: number;
    tint: number;
  }> = [
    { ang: 0.42, r: 29.2, scale: 0.76, tint: 2 }, // NNE pocket (east of Clock Tower)
    { ang: 0.54, r: 32.8, scale: 0.88, tint: 0 },
    { ang: 1.18, r: 28.6, scale: 0.74, tint: 2 }, // ENE pocket (between NE & East gateways)
    { ang: 1.31, r: 32.4, scale: 0.86, tint: 1 },
    { ang: 1.92, r: 28.8, scale: 0.78, tint: 0 }, // ESE garden pocket
    { ang: 2.38, r: 31.8, scale: 0.84, tint: 2 }, // SSE garden pocket
    { ang: -0.42, r: 29.2, scale: 0.76, tint: 2 }, // NNW pocket (west of Clock Tower)
    { ang: -0.54, r: 32.8, scale: 0.88, tint: 0 },
    { ang: -1.18, r: 28.6, scale: 0.74, tint: 1 }, // WNW pocket (between NW & West gateways)
    { ang: -1.31, r: 32.4, scale: 0.86, tint: 0 },
    { ang: -1.92, r: 28.8, scale: 0.78, tint: 2 }, // WSW garden pocket
    { ang: -2.38, r: 31.8, scale: 0.84, tint: 0 }, // SSW garden pocket
  ];

  for (let i = 0; i < ornamentalGardenClusters.length; i++) {
    const c = ornamentalGardenClusters[i];
    const x = Math.sin(c.ang) * c.r;
    const z = Math.cos(c.ang) * c.r;
    if (isInsideSightlineCorridor(x, z)) continue;
    const y = getTerrainHeight(x, z);

    canopyTransforms.push({
      x,
      y: y - 0.04,
      z,
      scale: c.scale,
      scaleY: c.scale * (0.94 + (i % 3) * 0.06),
      rotY: c.ang + Math.PI * 0.5 + (i % 2 === 0 ? 0.22 : -0.18),
      tiltX: ((i % 3) - 1) * 0.025,
      tiltZ: ((i % 2) - 0.5) * 0.025,
      tintIndex: c.tint,
    });
    colliders.push({ x, z, radius: 0.48 * c.scale });
  }

  // 1B. 35m+ Progressive Outer Island Groves & Lush Wilderness Framing
  // Density increases progressively from 35m to 52m, while keeping outer island hills lush.
  const maxTreeAttempts = 1600;
  for (let i = 0; i < maxTreeAttempts; i++) {
    const x = (rand() - 0.5) * 310;
    const z = (rand() - 0.5) * 295;

    const rCenter = Math.hypot(x, z);
    if (rCenter < 35.0) continue;

    // Progressive transition from 35m to 52m so tree density ramps up naturally outside the plaza
    if (rCenter < 52.0) {
      const rampProb = THREE.MathUtils.smoothstep(rCenter, 35.0, 52.0);
      if (rand() > rampProb) continue;
    }

    const mask = getHeartIslandMask(x, z);
    if (mask < 0.065) continue;

    const y = getTerrainHeight(x, z);
    if (y < 2.2) continue;

    getTerrainNormal(x, z, normal);
    if (normal.y < 0.78) continue;

    const pathW = getPathWeight(x, z);
    if (pathW > 0.06) continue;

    if (isInsideLandmarkOrPlazaClearing(x, z)) continue;

    // Natural grove modulation: favor organic clusters rather than uniform grid spacing
    const groveSignal =
      Math.sin(x * 0.075 + 1.2) * Math.cos(z * 0.075 - 0.8) * 0.5 + 0.5;
    const minSpacing = groveSignal > 0.58 ? 4.4 : 6.4;

    let tooClose = false;
    for (let j = 0; j < colliders.length; j++) {
      const c = colliders[j];
      if (Math.hypot(x - c.x, z - c.z) < minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const scale = 0.8 + rand() * 0.52;
    const scaleY = scale * (0.9 + rand() * 0.22);
    const rotY = rand() * Math.PI * 2;
    const tiltX = (rand() - 0.5) * 0.05;
    const tiltZ = (rand() - 0.5) * 0.05;

    const pinePreference =
      (z > 32 ? 0.6 : 0.12) + (y > 12.0 ? 0.45 : 0.0) + (x < -35 ? 0.25 : 0.0);

    if (rand() < pinePreference && pineTransforms.length < 170) {
      pineTransforms.push({
        x,
        y: y - 0.06,
        z,
        scale,
        scaleY,
        rotY,
        tiltX,
        tiltZ,
        tint: rand(),
      });
      colliders.push({ x, z, radius: 0.5 * scale });
    } else if (canopyTransforms.length < 200) {
      const rTint = rand();
      const tintIndex =
        x > 20 && z < 40 && rTint > 0.48
          ? 2 // Warm blossom trees on eastern & southern hills
          : rTint > 0.45
            ? 1
            : 0;

      canopyTransforms.push({
        x,
        y: y - 0.06,
        z,
        scale,
        scaleY,
        rotY,
        tiltX,
        tiltZ,
        tintIndex,
      });
      colliders.push({ x, z, radius: 0.5 * scale });
    }
  }

  // Build Instanced Canopy Trees (Trunk + Foliage)
  const canopyTrunkGeo = createCanopyTrunkGeometry();
  const canopyFoliageGeo = createCanopyFoliageGeometry();
  const pineEarthCollar = new THREE.CylinderGeometry(0.4, 0.62, 0.2, 7);
  pineEarthCollar.translate(0, 0.05, 0);
  const pineShaft = new THREE.CylinderGeometry(0.18, 0.34, 2.2, 7);
  pineShaft.translate(0, 1.1, 0);
  const pineTrunkGeo = mergeGeometries([pineEarthCollar, pineShaft]);
  const pineFoliageGeo = createPineFoliageGeometry();

  const leafBumpTex = createLeafMicroBumpTexture();
  const windUniforms = { uTime: { value: 0 } };

  const applyCanopyWindShader = (mat: THREE.MeshStandardMaterial) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniforms.uTime;
      shader.vertexShader =
        `uniform float uTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float hFactor = smoothstep(2.1, 4.8, transformed.y);
          float instSeed = 0.0;
          #ifdef USE_INSTANCING
            instSeed = instanceMatrix[3][0] * 0.14 + instanceMatrix[3][2] * 0.14;
          #endif
          float breeze = sin(uTime * 1.65 + instSeed + transformed.x * 1.4) * 0.11 * hFactor;
          float flutter = cos(uTime * 3.1 + instSeed * 1.7 + transformed.z * 2.2) * 0.045 * hFactor;
          transformed.x += breeze + flutter;
          transformed.z += breeze * 0.7 - flutter;
          `,
        );
    };
  };

  const barkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#614432'),
    roughness: 0.86,
    metalness: 0.02,
  });

  const canopyLeafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.72,
    metalness: 0.02,
    bumpMap: leafBumpTex,
    bumpScale: 0.055,
  });
  applyCanopyWindShader(canopyLeafMat);

  const pineLeafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.76,
    metalness: 0.02,
    bumpMap: leafBumpTex,
    bumpScale: 0.045,
  });
  applyCanopyWindShader(pineLeafMat);

  const canopyTrunkInst = new THREE.InstancedMesh(
    canopyTrunkGeo,
    barkMat,
    canopyTransforms.length,
  );
  const canopyFoliageInst = new THREE.InstancedMesh(
    canopyFoliageGeo,
    canopyLeafMat,
    canopyTransforms.length,
  );
  canopyTrunkInst.castShadow = true;
  canopyTrunkInst.receiveShadow = true;
  canopyFoliageInst.castShadow = true;
  canopyFoliageInst.receiveShadow = true;

  const leafPalettes = [
    new THREE.Color('#3f8f46'), // Rich Botanical Emerald
    new THREE.Color('#64b54c'), // Sunlit Warm-Lime Canopy
    new THREE.Color('#f291af'), // Soft Sakura Blossom Pink
  ];

  for (let i = 0; i < canopyTransforms.length; i++) {
    const t = canopyTransforms[i];
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.tiltX, t.rotY, t.tiltZ);
    dummy.scale.set(t.scale, t.scaleY, t.scale);
    dummy.updateMatrix();

    canopyTrunkInst.setMatrixAt(i, dummy.matrix);
    canopyFoliageInst.setMatrixAt(i, dummy.matrix);

    tempColor.copy(leafPalettes[t.tintIndex]);
    tempColor.offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.05);
    canopyFoliageInst.setColorAt(i, tempColor);
  }
  canopyTrunkInst.instanceMatrix.needsUpdate = true;
  canopyFoliageInst.instanceMatrix.needsUpdate = true;
  if (canopyFoliageInst.instanceColor) {
    canopyFoliageInst.instanceColor.needsUpdate = true;
  }
  canopyTrunkInst.computeBoundingSphere();
  canopyFoliageInst.computeBoundingSphere();
  group.add(canopyTrunkInst, canopyFoliageInst);

  // Build Instanced Highland Pines (Trunk + Foliage)
  const pineTrunkInst = new THREE.InstancedMesh(
    pineTrunkGeo,
    barkMat,
    pineTransforms.length,
  );
  const pineFoliageInst = new THREE.InstancedMesh(
    pineFoliageGeo,
    pineLeafMat,
    pineTransforms.length,
  );
  pineTrunkInst.castShadow = true;
  pineTrunkInst.receiveShadow = true;
  pineFoliageInst.castShadow = true;
  pineFoliageInst.receiveShadow = true;

  const cPineDark = new THREE.Color('#285e48');
  const cPineLight = new THREE.Color('#3a7a5c');

  for (let i = 0; i < pineTransforms.length; i++) {
    const t = pineTransforms[i];
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.tiltX, t.rotY, t.tiltZ);
    dummy.scale.set(t.scale, t.scaleY, t.scale);
    dummy.updateMatrix();

    pineTrunkInst.setMatrixAt(i, dummy.matrix);
    pineFoliageInst.setMatrixAt(i, dummy.matrix);

    tempColor.lerpColors(cPineDark, cPineLight, t.tint);
    pineFoliageInst.setColorAt(i, tempColor);
  }
  pineTrunkInst.instanceMatrix.needsUpdate = true;
  pineFoliageInst.instanceMatrix.needsUpdate = true;
  if (pineFoliageInst.instanceColor) {
    pineFoliageInst.instanceColor.needsUpdate = true;
  }
  pineTrunkInst.computeBoundingSphere();
  pineFoliageInst.computeBoundingSphere();
  group.add(pineTrunkInst, pineFoliageInst);

  // 2. Sculpted Coastal & Cliffside Boulders (InstancedMesh)
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  rockGeo.translate(0, 0.55, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.88,
    metalness: 0.06,
  });

  const rockTransforms: Array<{
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    rotY: number;
    tint: number;
  }> = [];

  for (let i = 0; i < 650 && rockTransforms.length < 150; i++) {
    const x = (rand() - 0.5) * 300;
    const z = (rand() - 0.5) * 285;
    const mask = getHeartIslandMask(x, z);
    if (mask < 0.01) continue;

    const y = getTerrainHeight(x, z);
    if (y < 0.25) continue;

    const pathW = getPathWeight(x, z);
    if (pathW > 0.04) continue;
    if (isInsideLandmarkOrPlazaClearing(x, z)) continue;

    getTerrainNormal(x, z, normal);
    // Restrict boulders strictly to shorelines and cliff bases
    const isShoreOrCliff = y < 2.0 || normal.y < 0.82;
    if (!isShoreOrCliff) continue;

    const sx = 0.65 + rand() * 1.25;
    const sy = 0.45 + rand() * 0.85;
    const sz = 0.65 + rand() * 1.15;

    rockTransforms.push({
      x,
      y: y - 0.18,
      z,
      sx,
      sy,
      sz,
      rotY: rand() * Math.PI * 2,
      tint: rand(),
    });

    if (Math.max(sx, sz) > 1.05) {
      colliders.push({ x, z, radius: Math.max(sx, sz) * 0.72 });
    }
  }

  const rockInst = new THREE.InstancedMesh(
    rockGeo,
    rockMat,
    rockTransforms.length,
  );
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  const cRockWarm = new THREE.Color('#8c8881');
  const cRockSlate = new THREE.Color('#575d69');

  for (let i = 0; i < rockTransforms.length; i++) {
    const r = rockTransforms[i];
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set((rand() - 0.5) * 0.25, r.rotY, (rand() - 0.5) * 0.25);
    dummy.scale.set(r.sx, r.sy, r.sz);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);

    tempColor.lerpColors(cRockWarm, cRockSlate, r.tint);
    rockInst.setColorAt(i, tempColor);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  // 3. Instanced Meadow Grass Tufts & Wildflowers outside paved areas (4,000 instances + Wind Sway)
  const grassGeo = createGrassTuftGeometry();
  const grassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.78,
    metalness: 0.0,
  });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader =
      `uniform float uTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float uvY2 = uv.y * uv.y;
        vec3 wp = transformed;
        #ifdef USE_INSTANCING
          wp = (instanceMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        transformed.x += sin(uTime * 1.6 + wp.x * 0.7 + wp.z * 0.5) * 0.08 * uvY2;
        transformed.z += cos(uTime * 1.3 + wp.z * 0.6) * 0.05 * uvY2;
        `,
      );
  };

  const grassCount = 4000;
  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grassInst.receiveShadow = true;

  const grassPalette = [
    new THREE.Color('#4f9e4b'),
    new THREE.Color('#6bbb52'),
    new THREE.Color('#418a47'),
    new THREE.Color('#f5b8d0'),
    new THREE.Color('#ffe07d'),
  ];

  let placedGrass = 0;
  for (let attempt = 0; attempt < 11000 && placedGrass < grassCount; attempt++) {
    const x = (rand() - 0.5) * 290;
    const z = (rand() - 0.5) * 280;
    const rPlaza = Math.hypot(x, z);
    if (rPlaza < 31.5) continue; // Keep off Central Plaza stone paving
    if (Math.hypot(x + 74, z - 64) < 11.5) continue; // Keep off Castle Landing Terrace stone paving
    if (Math.hypot(x + 28.5, z - 26.0) < 3.0) continue; // Keep off Broom Travel Stand plinth
    if (x >= 56.0 && x <= 112.0 && z >= -10.0 && z <= 58.0) continue; // Keep off Dream Castle & Conservatory floors

    // Keep off the Forest Lake, Hidden Pool, and Sanctuary Pool water surfaces
    const gLocal = worldToCastleLocal(x, z);
    if (
      Math.hypot(
        (gLocal.localX - FOREST_LAKE_LOCAL_POS.localX) / 1.22,
        (gLocal.localZ - FOREST_LAKE_LOCAL_POS.localZ) / 0.95,
      ) < 12.5
    ) {
      continue;
    }
    if (
      Math.hypot(
        gLocal.localX - HIDDEN_POOL_LOCAL_POS.localX,
        gLocal.localZ - HIDDEN_POOL_LOCAL_POS.localZ,
      ) < 6.0
    ) {
      continue;
    }
    if (
      Math.hypot(
        gLocal.localX - HEARTWOOD_SANCTUARY_LOCAL_POS.localX,
        gLocal.localZ - HEARTWOOD_SANCTUARY_LOCAL_POS.localZ,
      ) < 7.5
    ) {
      continue;
    }

    // Natural meadow drift clustering (avoids uniform white-noise scatter)
    const meadowDrift =
      Math.sin(x * 0.09 + 0.7) * Math.cos(z * 0.09 - 1.1) * 0.5 + 0.5;
    if (rPlaza < 38.0 && rand() > (rPlaza - 31.5) / 6.5) continue;
    if (meadowDrift < 0.22 && rand() > 0.35) continue;

    const y = getTerrainHeight(x, z);
    if (y < 2.1) continue;

    getTerrainNormal(x, z, normal);
    if (normal.y < 0.82) continue;

    const pathW = getPathWeight(x, z);
    if (pathW > 0.12) continue;

    dummy.position.set(x, y - 0.03, z);
    dummy.rotation.set(
      (rand() - 0.5) * 0.08,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.08,
    );
    const s = 0.62 + rand() * 0.68;
    dummy.scale.set(s, s * (0.82 + rand() * 0.4), s);
    dummy.updateMatrix();
    grassInst.setMatrixAt(placedGrass, dummy.matrix);

    // Group wildflower colors by drift wave so blossoms appear in natural patches
    const flowerPatchWave =
      Math.sin(x * 0.14 - 0.5) * Math.cos(z * 0.14 + 0.9);
    const pRoll = rand();
    const colorIdx =
      flowerPatchWave > 0.42 && pRoll > 0.45
        ? 3
        : flowerPatchWave < -0.42 && pRoll > 0.48
          ? 4
          : Math.floor(rand() * 3);
    tempColor.copy(grassPalette[colorIdx]);
    grassInst.setColorAt(placedGrass, tempColor);
    placedGrass++;
  }
  grassInst.count = placedGrass;
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  group.add(grassInst);

  return {
    group,
    colliders,
    update(elapsedTime: number) {
      windUniforms.uTime.value = elapsedTime;
    },
    dispose() {
      canopyTrunkGeo.dispose();
      canopyFoliageGeo.dispose();
      pineTrunkGeo.dispose();
      pineFoliageGeo.dispose();
      rockGeo.dispose();
      grassGeo.dispose();
      leafBumpTex?.dispose();
      barkMat.dispose();
      canopyLeafMat.dispose();
      pineLeafMat.dispose();
      rockMat.dispose();
      grassMat.dispose();
    },
  };
}
