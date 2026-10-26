/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ResourceTracker, createBeveledBoxGeometry } from '../ProceduralKit';
import {
  FOREST_SEED,
  castleLocalToWorld,
  getTerrainHeight,
  mulberry32,
} from '../terrainMath';
import { ForestAudioSynthesizer } from './ForestAudio';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';

export interface ForestWildlifeBundle {
  group: THREE.Group;
  particleCount: number;
  creatureCounts: {
    butterflies: number;
    birds: number;
    frogs: number;
    owls: number;
    fireflies: number;
    tinyCreatures: number;
  };
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
    audio: ForestAudioSynthesizer,
  ) => void;
  dispose: () => void;
}

interface ButterflyInstance {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  anchor: THREE.Vector3;
  currentPos: THREE.Vector3;
  phase: number;
  flapSpeed: number;
  driftRadius: number;
  flightHeight: number;
  colorType: string;
  scatterTimer: number;
}

interface WoodlandBirdInstance {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  perchA: THREE.Vector3;
  perchB: THREE.Vector3;
  targetPerch: 0 | 1;
  currentPos: THREE.Vector3;
  isFlying: boolean;
  flightProgress: number;
  flightDuration: number;
  flightCurve: THREE.CatmullRomCurve3 | null;
  idleTimer: number;
  lookYaw: number;
  colorType: string;
}

interface WoodlandFrogInstance {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  throatMesh: THREE.Mesh;
  homePos: THREE.Vector3;
  currentPos: THREE.Vector3;
  facingYaw: number;
  waterDir: THREE.Vector2;
  isHopping: boolean;
  hopProgress: number;
  hopStart: THREE.Vector3;
  hopTarget: THREE.Vector3;
  idleTimer: number;
}

interface AmbientCreatureInstance {
  group: THREE.Group;
  homePos: THREE.Vector3;
  hidePos: THREE.Vector3;
  currentPos: THREE.Vector3;
  isFleeing: boolean;
  fleeProgress: number;
  facingYaw: number;
}

/**
 * Creates a soft glowing circular particle texture for fireflies and dust motes.
 */
function createFireflySpriteTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const rad = size * 0.5;
  const grad = ctx.createRadialGradient(rad, rad, 0, rad, rad, rad);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.25, 'rgba(217, 249, 157, 0.95)'); // Soft chartreuse core
  grad.addColorStop(0.55, 'rgba(163, 230, 53, 0.45)');
  grad.addColorStop(1.0, 'rgba(163, 230, 53, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(rad, rad, rad, 0, Math.PI * 2);
  ctx.fill();

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates low-poly butterfly wing geometry with hinge along X = 0.
 */
function createButterflyWingGeo(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // 5 vertices forming a delicate scalloped wing shape
  const positions = new Float32Array([
    0.0, 0.0, 0.0,     // 0: Root
    0.07, 0.06, -0.02, // 1: Forewing peak
    0.11, 0.03, 0.01,  // 2: Outer forewing margin
    0.08, -0.04, 0.03, // 3: Hindwing tip
    0.02, -0.05, 0.01, // 4: Inner margin
  ]);
  const uvs = new Float32Array([
    0.0, 0.5,
    0.6, 1.0,
    1.0, 0.7,
    0.8, 0.0,
    0.2, 0.0,
  ]);
  const indices = [
    0, 1, 2,
    0, 2, 3,
    0, 3, 4,
  ];
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates stylized low-poly bird mesh geometry (body + tail + beak).
 */
function createBirdBodyGeo(): THREE.BufferGeometry {
  const body = new THREE.ConeGeometry(0.065, 0.22, 6);
  body.rotateX(Math.PI * 0.5); // Align along Z
  body.scale(0.85, 0.85, 1.0);

  const head = new THREE.SphereGeometry(0.055, 6, 5);
  head.translate(0, 0.04, 0.09);

  const beak = new THREE.ConeGeometry(0.02, 0.055, 4);
  beak.rotateX(Math.PI * 0.5);
  beak.translate(0, 0.035, 0.145);

  const tail = new THREE.ConeGeometry(0.045, 0.16, 4);
  tail.scale(1.4, 0.2, 1.0);
  tail.rotateX(-Math.PI * 0.45);
  tail.translate(0, 0.015, -0.16);

  const merged = mergeGeometries([body, head, beak, tail]);
  body.dispose();
  head.dispose();
  beak.dispose();
  tail.dispose();
  return merged;
}

/**
 * Creates delta wing geometry for birds.
 */
function createBirdWingGeo(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    0.0, 0.0, 0.04,     // Root front
    0.0, 0.0, -0.06,    // Root back
    0.18, 0.03, -0.08,  // Wing tip
  ]);
  const uvs = new Float32Array([
    0.0, 1.0,
    0.0, 0.0,
    1.0, 0.5,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex([0, 1, 2, 0, 2, 1]);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates low-poly frog geometry.
 */
function createFrogBodyGeo(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.12, 7, 6);
  body.scale(1.2, 0.72, 1.35);

  const eyeL = new THREE.SphereGeometry(0.035, 5, 4);
  eyeL.translate(-0.065, 0.075, 0.07);

  const eyeR = new THREE.SphereGeometry(0.035, 5, 4);
  eyeR.translate(0.065, 0.075, 0.07);

  const hindL = new THREE.CylinderGeometry(0.03, 0.045, 0.16, 5);
  hindL.rotateZ(0.65);
  hindL.translate(-0.13, -0.02, -0.06);

  const hindR = new THREE.CylinderGeometry(0.03, 0.045, 0.16, 5);
  hindR.rotateZ(-0.65);
  hindR.translate(0.13, -0.02, -0.06);

  const merged = mergeGeometries([body, eyeL, eyeR, hindL, hindR]);
  body.dispose();
  eyeL.dispose();
  eyeR.dispose();
  hindL.dispose();
  hindR.dispose();
  return merged;
}

/**
 * Builds Phase F4: Enchanted Forest Wildlife, Ambient Life & Lighting System.
 * - Butterflies in glades, lake shoreline, and open woodland
 * - Small woodland birds crossing canopy openings & perching on branches
 * - Frogs near stream banks and lake shoreline
 * - Single occasional owl perched majestically in upper canopy
 * - Natural firefly particle system distributed by habitat
 * - Rare ambient woodland creature silhouettes
 */
export function createForestWildlifeSystem(): ForestWildlifeBundle {
  const tracker = new ResourceTracker();
  const group = new THREE.Group();
  group.name = 'PhaseF4_ForestWildlifeSystem';

  const rand = mulberry32(FOREST_SEED + 9421);

  // ============================================================================
  // 1. BUTTERFLIES (5 Clusters • 17 Butterflies Total)
  // ============================================================================
  const butterflyWingGeo = tracker.trackGeo(createButterflyWingGeo());
  const butterflyBodyGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.008, 0.012, 0.09, 5));
  butterflyBodyGeo.rotateX(Math.PI * 0.5);

  const butterflyMats = {
    gold: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fef08a'),
        emissive: new THREE.Color('#ca8a04'),
        emissiveIntensity: 0.35,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    ),
    cyan: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#bae6fd'),
        emissive: new THREE.Color('#0284c7'),
        emissiveIntensity: 0.42,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    ),
    violet: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e9d5ff'),
        emissive: new THREE.Color('#9333ea'),
        emissiveIntensity: 0.35,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    ),
    emerald: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#bbf7d0'),
        emissive: new THREE.Color('#16a34a'),
        emissiveIntensity: 0.35,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    ),
  };

  const butterflyBodyMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#292524'),
      roughness: 0.9,
    }),
  );

  const butterflyClusterCenters = [
    { lx: 45.5, lz: 10.5, type: 'gold', count: 3 },    // Garden/Forest entrance
    { lx: 51.5, lz: 4.8, type: 'cyan', count: 4 },     // Sunlit fern glade 1
    { lx: 48.0, lz: -18.5, type: 'cyan', count: 4 },   // Lake shoreline rushes
    { lx: 53.5, lz: 7.5, type: 'violet', count: 3 },   // Mushroom grove edge
    { lx: 83.0, lz: 26.5, type: 'emerald', count: 3 }, // Northern open woodland 1
    { lx: 93.5, lz: 36.5, type: 'gold', count: 3 },    // Northern open woodland 2
    { lx: 112.5, lz: 47.5, type: 'cyan', count: 2 },   // Heartwood Sanctuary calm pair
  ];

  const butterflies: ButterflyInstance[] = [];

  butterflyClusterCenters.forEach((cSpec, cIdx) => {
    const cW = castleLocalToWorld(cSpec.lx, cSpec.lz);
    const cY = getTerrainHeight(cW.x, cW.z);

    for (let b = 0; b < cSpec.count; b++) {
      const bGroup = new THREE.Group();
      bGroup.name = `Butterfly_${cIdx}_${b}`;

      const bMesh = new THREE.Mesh(butterflyBodyGeo, butterflyBodyMat);
      bGroup.add(bMesh);

      const mat =
        cSpec.type === 'gold'
          ? butterflyMats.gold
          : cSpec.type === 'cyan'
            ? butterflyMats.cyan
            : cSpec.type === 'violet'
              ? butterflyMats.violet
              : butterflyMats.emerald;

      // Left wing
      const leftWing = new THREE.Mesh(butterflyWingGeo, mat);
      leftWing.position.set(0.005, 0.01, 0);
      bGroup.add(leftWing);

      // Right wing (mirrored)
      const rightWingGeo = butterflyWingGeo.clone();
      rightWingGeo.scale(-1, 1, 1);
      const rightWing = new THREE.Mesh(rightWingGeo, mat);
      rightWing.position.set(-0.005, 0.01, 0);
      bGroup.add(rightWing);

      const rad = 0.6 + rand() * 1.8;
      const ang = rand() * Math.PI * 2;
      const bx = cW.x + Math.cos(ang) * rad;
      const bz = cW.z + Math.sin(ang) * rad;
      const by = getTerrainHeight(bx, bz) + 0.45 + rand() * 0.55;
      const anchor = new THREE.Vector3(bx, by, bz);

      bGroup.position.copy(anchor);
      group.add(bGroup);

      butterflies.push({
        group: bGroup,
        leftWing,
        rightWing,
        anchor,
        currentPos: anchor.clone(),
        phase: rand() * Math.PI * 2,
        flapSpeed: 14.0 + rand() * 5.0,
        driftRadius: 0.85 + rand() * 0.75,
        flightHeight: 0.35 + rand() * 0.45,
        colorType: cSpec.type,
        scatterTimer: 0,
      });
    }
  });

  // ============================================================================
  // 2. SMALL WOODLAND BIRDS (3 Pairs • 6 Birds Total)
  // ============================================================================
  const birdBodyGeo = tracker.trackGeo(createBirdBodyGeo());
  const birdWingGeo = tracker.trackGeo(createBirdWingGeo());

  const birdMats = {
    robin: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#573c24'),
        roughness: 0.78,
      }),
    ),
    finch: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#854d0e'),
        roughness: 0.75,
      }),
    ),
    tit: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1e3a8a'),
        roughness: 0.76,
      }),
    ),
  };

  const birdPairs = [
    // Pair 1: Forest Entry corridor Hero Tree branches
    {
      pA: { lx: 43.8, lz: 2.2, h: 5.4 },
      pB: { lx: 49.4, lz: 5.6, h: 6.2 },
      colorType: 'robin',
    },
    // Pair 2: Lake Shore alder -> Main corridor oak
    {
      pA: { lx: 47.2, lz: -15.5, h: 4.8 },
      pB: { lx: 54.8, lz: -0.6, h: 6.4 },
      colorType: 'tit',
    },
    // Pair 3: Giant Ancient Tree canopy -> Northern Plateau sentinel
    {
      pA: { lx: 71.0, lz: -0.2, h: 8.8 },
      pB: { lx: 80.5, lz: 18.2, h: 7.2 },
      colorType: 'finch',
    },
    // Pair 4: Northern Woodland canopy -> Hidden Spring hollow oak
    {
      pA: { lx: 88.5, lz: 30.0, h: 7.4 },
      pB: { lx: 96.5, lz: 16.5, h: 6.2 },
      colorType: 'robin',
    },
  ];

  const birds: WoodlandBirdInstance[] = [];

  birdPairs.forEach((pairSpec, pIdx) => {
    const wa = castleLocalToWorld(pairSpec.pA.lx, pairSpec.pA.lz);
    const wb = castleLocalToWorld(pairSpec.pB.lx, pairSpec.pB.lz);
    const posA = new THREE.Vector3(wa.x, getTerrainHeight(wa.x, wa.z) + pairSpec.pA.h, wa.z);
    const posB = new THREE.Vector3(wb.x, getTerrainHeight(wb.x, wb.z) + pairSpec.pB.h, wb.z);

    // Create 2 birds per pair (one at A, one at B)
    [posA, posB].forEach((startPos, bIdx) => {
      const bGroup = new THREE.Group();
      bGroup.name = `WoodlandBird_${pIdx}_${bIdx}`;

      const bMat =
        pairSpec.colorType === 'robin'
          ? birdMats.robin
          : pairSpec.colorType === 'tit'
            ? birdMats.tit
            : birdMats.finch;

      const bodyMesh = new THREE.Mesh(birdBodyGeo, bMat);
      bodyMesh.castShadow = true;
      bGroup.add(bodyMesh);

      // Left wing
      const leftWing = new THREE.Mesh(birdWingGeo, bMat);
      leftWing.position.set(0.04, 0.02, 0);
      bGroup.add(leftWing);

      // Right wing
      const rGeo = birdWingGeo.clone();
      rGeo.scale(-1, 1, 1);
      const rightWing = new THREE.Mesh(rGeo, bMat);
      rightWing.position.set(-0.04, 0.02, 0);
      bGroup.add(rightWing);

      bGroup.position.copy(startPos);
      bGroup.scale.setScalar(1.2);
      group.add(bGroup);

      birds.push({
        group: bGroup,
        leftWing,
        rightWing,
        perchA: posA,
        perchB: posB,
        targetPerch: bIdx === 0 ? 1 : 0,
        currentPos: startPos.clone(),
        isFlying: false,
        flightProgress: 0,
        flightDuration: 2.8 + rand() * 1.2,
        flightCurve: null,
        idleTimer: 8.0 + rand() * 14.0 + (bIdx * 5.0),
        lookYaw: rand() * Math.PI * 2,
        colorType: pairSpec.colorType,
      });
    });
  });

  // ============================================================================
  // 3. SMALL WOODLAND FROGS (6 Frogs: 3 Lake Shoreline, 3 Stream Banks)
  // ============================================================================
  const frogBodyGeo = tracker.trackGeo(createFrogBodyGeo());
  const frogThroatGeo = tracker.trackGeo(new THREE.SphereGeometry(0.045, 6, 5));
  frogThroatGeo.scale(1.2, 0.8, 1.0);
  frogThroatGeo.translate(0, -0.015, 0.08);

  const frogMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3f6212'),
      roughness: 0.55,
      metalness: 0.05,
    }),
  );

  const frogThroatMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#bef264'),
      roughness: 0.65,
    }),
  );

  const frogSpecs = [
    // Lake Shoreline (facing water at lx: 47.5, lz: -20.5)
    { lx: 46.8, lz: -19.0, waterDir: new THREE.Vector2(0.2, -0.9) },
    { lx: 48.4, lz: -21.6, waterDir: new THREE.Vector2(-0.4, 0.8) },
    { lx: 49.6, lz: -17.6, waterDir: new THREE.Vector2(-0.7, -0.7) },
    // Stream Banks (facing stream water)
    { lx: 57.5, lz: 2.8, waterDir: new THREE.Vector2(0.3, 0.9) },
    { lx: 59.8, lz: 4.2, waterDir: new THREE.Vector2(-0.4, -0.8) },
    { lx: 61.2, lz: -1.6, waterDir: new THREE.Vector2(0.8, 0.5) },
    // Hidden Pool / Spring Hollow (facing secluded spring at lx: 95.5, lz: 14.5)
    { lx: 94.0, lz: 15.8, waterDir: new THREE.Vector2(0.7, -0.6) },
    { lx: 97.2, lz: 13.4, waterDir: new THREE.Vector2(-0.8, 0.5) },
  ];

  const frogs: WoodlandFrogInstance[] = [];

  frogSpecs.forEach((fSpec, fIdx) => {
    const fW = castleLocalToWorld(fSpec.lx, fSpec.lz);
    const fY = getTerrainHeight(fW.x, fW.z) + 0.035;
    const homePos = new THREE.Vector3(fW.x, fY, fW.z);

    const fGroup = new THREE.Group();
    fGroup.name = `WoodlandFrog_${fIdx}`;
    fGroup.position.copy(homePos);
    fGroup.scale.setScalar(0.72);

    const bodyMesh = new THREE.Mesh(frogBodyGeo, frogMat);
    bodyMesh.castShadow = true;
    fGroup.add(bodyMesh);

    const throatMesh = new THREE.Mesh(frogThroatGeo, frogThroatMat);
    fGroup.add(throatMesh);

    const facingYaw = Math.atan2(fSpec.waterDir.x, fSpec.waterDir.y);
    fGroup.rotation.y = facingYaw;

    group.add(fGroup);

    frogs.push({
      group: fGroup,
      bodyMesh,
      throatMesh,
      homePos,
      currentPos: homePos.clone(),
      facingYaw,
      waterDir: fSpec.waterDir,
      isHopping: false,
      hopProgress: 0,
      hopStart: homePos.clone(),
      hopTarget: homePos.clone(),
      idleTimer: 6.0 + rand() * 10.0 + fIdx * 2.0,
    });
  });

  // ============================================================================
  // 4. OCCASIONAL OWL (Single Majestic Presence)
  // Perched on a high gnarled branch of the Giant Ancient Tree / Hero Tree 7
  // ============================================================================
  const owlLocalPos = { lx: 61.4, lz: 3.6, h: 6.4 };
  const owlW = castleLocalToWorld(owlLocalPos.lx, owlLocalPos.lz);
  const owlPos = new THREE.Vector3(
    owlW.x,
    getTerrainHeight(owlW.x, owlW.z) + owlLocalPos.h,
    owlW.z,
  );

  const owlGroup = new THREE.Group();
  owlGroup.name = 'OccasionalOwl';
  owlGroup.position.copy(owlPos);

  const owlFeatherMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38281d'),
      roughness: 0.88,
      metalness: 0.02,
    }),
  );

  const owlChestMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d6cbba'),
      roughness: 0.82,
    }),
  );

  const owlEyeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.65,
      roughness: 0.3,
    }),
  );

  // Owl Torso
  const owlBodyGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 0.52, 8));
  owlBodyGeo.translate(0, 0.26, 0);
  const owlBodyMesh = new THREE.Mesh(owlBodyGeo, owlFeatherMat);
  owlBodyMesh.castShadow = true;
  owlGroup.add(owlBodyMesh);

  // Soft cream chest bib
  const owlChestGeo = tracker.trackGeo(new THREE.BufferGeometry());
  const cPos = new Float32Array([
    -0.08, 0.42, 0.14,
    0.08, 0.42, 0.14,
    0.1, 0.18, 0.16,
    -0.1, 0.18, 0.16,
  ]);
  const cUvs = new Float32Array([
    0.0, 1.0,
    1.0, 1.0,
    1.0, 0.0,
    0.0, 0.0,
  ]);
  owlChestGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  owlChestGeo.setAttribute('uv', new THREE.BufferAttribute(cUvs, 2));
  owlChestGeo.setIndex([0, 2, 1, 0, 3, 2]);
  owlChestGeo.computeVertexNormals();
  const owlChestMesh = new THREE.Mesh(owlChestGeo, owlChestMat);
  owlGroup.add(owlChestMesh);

  // Folded wings
  [-0.14, 0.14].forEach((wx, wIdx) => {
    const wing = tracker.trackGeo(new THREE.ConeGeometry(0.12, 0.46, 5));
    wing.scale(0.5, 1.0, 1.2);
    wing.rotateZ((wIdx === 0 ? 1 : -1) * 0.12);
    wing.translate(wx, 0.22, -0.04);
    owlGroup.add(new THREE.Mesh(wing, owlFeatherMat));
  });

  // Owl Head Group (rotates smoothly up to ±80 degrees)
  const owlHeadGroup = new THREE.Group();
  owlHeadGroup.position.set(0, 0.52, 0);

  const owlHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.16, 8, 7));
  owlHeadGeo.scale(1.0, 0.95, 0.95);
  owlHeadGroup.add(new THREE.Mesh(owlHeadGeo, owlFeatherMat));

  // Horned Ear Tufts
  [-0.09, 0.09].forEach((ex) => {
    const tuft = tracker.trackGeo(new THREE.ConeGeometry(0.045, 0.14, 4));
    tuft.rotateZ(ex < 0 ? 0.35 : -0.35);
    tuft.translate(ex, 0.16, -0.02);
    owlHeadGroup.add(new THREE.Mesh(tuft, owlFeatherMat));
  });

  // Facial disc & Golden Glowing Eyes
  [-0.065, 0.065].forEach((eyx) => {
    const eyeDisc = tracker.trackGeo(new THREE.CircleGeometry(0.048, 8));
    eyeDisc.translate(eyx, 0.02, 0.148);
    owlHeadGroup.add(new THREE.Mesh(eyeDisc, owlChestMat));

    const eyeBall = tracker.trackGeo(new THREE.SphereGeometry(0.025, 6, 5));
    eyeBall.translate(eyx, 0.02, 0.155);
    owlHeadGroup.add(new THREE.Mesh(eyeBall, owlEyeMat));
  });

  // Beak
  const owlBeakGeo = tracker.trackGeo(new THREE.ConeGeometry(0.024, 0.065, 4));
  owlBeakGeo.rotateX(Math.PI * 0.55);
  owlBeakGeo.translate(0, -0.025, 0.17);
  owlHeadGroup.add(new THREE.Mesh(owlBeakGeo, owlFeatherMat));

  owlGroup.add(owlHeadGroup);
  // Orient owl slightly toward the approach trail (facing South-Southwest)
  owlGroup.rotation.y = 2.4;
  group.add(owlGroup);

  let owlLookYaw = 0;
  let owlTargetYaw = 0;
  let owlTurnTimer = 6.0;

  // ============================================================================
  // 5. NATURAL FIREFLIES (120 Motes Distributed Gradually Across Habitats)
  // ============================================================================
  const fireflyCount = 120;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflyColors = new Float32Array(fireflyCount * 3);

  interface FireflyData {
    baseX: number;
    baseY: number;
    baseZ: number;
    phase: number;
    speed: number;
    radiusX: number;
    radiusY: number;
    radiusZ: number;
    colorType: 'amber' | 'cyan' | 'lime';
  }

  const firefliesData: FireflyData[] = [];

  // Habitat zone allocations:
  // 1. Garden/Forest Transition: 8 motes (lx: 43..47)
  // 2. Main Forest Path Glades: 14 motes (lx: 49..55)
  // 3. Lake Shoreline: 22 motes (lx: 46..51, lz: -16..-22)
  // 4. Stream Banks & Waterfall: 18 motes (lx: 57..63, lz: -2..6)
  // 5. Mushroom Grove: 16 motes (lx: 52..56, lz: 6..10)
  // 6. Northern Open Woodland: 12 motes (lx: 78..98, lz: 22..40)
  // 7. Hidden Pool / Spring Hollow: 12 motes (lx: 92..99, lz: 11..18)
  // 8. Heartwood Sanctuary & Heartwood Tree: 18 motes (lx: 109..119, lz: 42..51)
  const zoneSpecs = [
    { count: 8, minLx: 43.0, maxLx: 47.0, minLz: 6.0, maxLz: 14.0, col: 'amber' as const },
    { count: 14, minLx: 49.0, maxLx: 55.0, minLz: -4.0, maxLz: 6.0, col: 'lime' as const },
    { count: 22, minLx: 45.5, maxLx: 50.5, minLz: -22.0, maxLz: -16.0, col: 'cyan' as const },
    { count: 18, minLx: 57.0, maxLx: 63.0, minLz: -2.0, maxLz: 6.0, col: 'cyan' as const },
    { count: 16, minLx: 52.0, maxLx: 56.5, minLz: 6.0, maxLz: 10.5, col: 'lime' as const },
    { count: 12, minLx: 78.0, maxLx: 98.0, minLz: 22.0, maxLz: 40.0, col: 'lime' as const },
    { count: 12, minLx: 92.5, maxLx: 98.5, minLz: 11.5, maxLz: 17.5, col: 'cyan' as const },
    { count: 18, minLx: 109.5, maxLx: 118.5, minLz: 42.0, maxLz: 50.5, col: 'cyan' as const },
  ];

  let fIdx = 0;
  zoneSpecs.forEach((z) => {
    for (let i = 0; i < z.count && fIdx < fireflyCount; i++) {
      const lx = z.minLx + rand() * (z.maxLx - z.minLx);
      const lz = z.minLz + rand() * (z.maxLz - z.minLz);
      const w = castleLocalToWorld(lx, lz);
      const wy = getTerrainHeight(w.x, w.z) + 0.35 + rand() * 1.6;

      fireflyPositions[fIdx * 3] = w.x;
      fireflyPositions[fIdx * 3 + 1] = wy;
      fireflyPositions[fIdx * 3 + 2] = w.z;

      // Color selection: Soft Chartreuse (#bef264), Warm Amber (#fef08a), Celestial Cyan (#67e8f9)
      const r = z.col === 'cyan' ? 0.42 : z.col === 'amber' ? 0.98 : 0.75;
      const g = z.col === 'cyan' ? 0.91 : z.col === 'amber' ? 0.92 : 0.95;
      const b = z.col === 'cyan' ? 0.98 : z.col === 'amber' ? 0.52 : 0.42;
      fireflyColors[fIdx * 3] = r;
      fireflyColors[fIdx * 3 + 1] = g;
      fireflyColors[fIdx * 3 + 2] = b;

      firefliesData.push({
        baseX: w.x,
        baseY: wy,
        baseZ: w.z,
        phase: rand() * Math.PI * 2,
        speed: 0.65 + rand() * 0.7,
        radiusX: 0.35 + rand() * 0.55,
        radiusY: 0.2 + rand() * 0.35,
        radiusZ: 0.35 + rand() * 0.55,
        colorType: z.col,
      });
      fIdx++;
    }
  });

  const fireflyGeo = tracker.trackGeo(new THREE.BufferGeometry());
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
  fireflyGeo.setAttribute('color', new THREE.BufferAttribute(fireflyColors, 3));

  const fireflyTex = createFireflySpriteTexture(tracker);
  const fireflyMat = tracker.trackMat(
    new THREE.PointsMaterial({
      map: fireflyTex ?? undefined,
      size: 0.24,
      transparent: true,
      opacity: 0.88,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  fireflyPoints.name = 'EnchantedForestFireflies';
  group.add(fireflyPoints);

  // ============================================================================
  // 6. RARE TINY WOODLAND CREATURES (2 Silhouettes in Edge Understory)
  // ============================================================================
  const tinyCreatureGeo = (() => {
    const b = new THREE.SphereGeometry(0.1, 6, 5);
    b.scale(0.85, 0.9, 1.2);
    const head = new THREE.SphereGeometry(0.065, 5, 4);
    head.translate(0, 0.08, 0.1);
    const earL = new THREE.ConeGeometry(0.025, 0.12, 4);
    earL.rotateX(-0.2);
    earL.translate(-0.03, 0.17, 0.08);
    const earR = earL.clone();
    earR.translate(0.06, 0, 0);

    const merged = mergeGeometries([b, head, earL, earR]);
    b.dispose();
    head.dispose();
    earL.dispose();
    earR.dispose();
    return merged;
  })();
  tracker.trackGeo(tinyCreatureGeo);

  const creatureMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#44403c'),
      roughness: 0.88,
    }),
  );

  const ambientCreatures: AmbientCreatureInstance[] = [
    {
      homeLx: 51.5,
      homeLz: -1.2,
      hideLx: 52.8,
      hideLz: -2.8,
    },
    {
      homeLx: 74.0,
      homeLz: 14.0,
      hideLx: 76.2,
      hideLz: 16.5,
    },
  ].map((cSpec, idx) => {
    const hw = castleLocalToWorld(cSpec.homeLx, cSpec.homeLz);
    const hideW = castleLocalToWorld(cSpec.hideLx, cSpec.hideLz);
    const hy = getTerrainHeight(hw.x, hw.z) + 0.08;
    const hideY = getTerrainHeight(hideW.x, hideW.z) + 0.08;

    const cGroup = new THREE.Group();
    cGroup.name = `TinyWoodlandCreature_${idx}`;
    const mesh = new THREE.Mesh(tinyCreatureGeo, creatureMat);
    mesh.castShadow = true;
    cGroup.add(mesh);

    const homePos = new THREE.Vector3(hw.x, hy, hw.z);
    const hidePos = new THREE.Vector3(hideW.x, hideY, hideW.z);
    cGroup.position.copy(homePos);
    group.add(cGroup);

    return {
      group: cGroup,
      homePos,
      hidePos,
      currentPos: homePos.clone(),
      isFleeing: false,
      fleeProgress: 0,
      facingYaw: 0,
    };
  });

  return {
    group,
    particleCount: fireflyCount,
    creatureCounts: {
      butterflies: butterflies.length,
      birds: birds.length,
      frogs: frogs.length,
      owls: 1,
      fireflies: fireflyCount,
      tinyCreatures: ambientCreatures.length,
    },

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
      audio: ForestAudioSynthesizer,
    ): void {
      // ------------------------------------------------------------------------
      // 1. UPDATE BUTTERFLIES
      // ------------------------------------------------------------------------
      butterflies.forEach((b) => {
        const distToPlayer = b.currentPos.distanceTo(playerWorldPos);

        // Player proximity scatter reaction
        if (distToPlayer < 3.2 && b.scatterTimer <= 0) {
          b.scatterTimer = 4.2; // Scatter for 4.2 seconds
        }

        if (b.scatterTimer > 0) {
          b.scatterTimer -= dt;
          // Scatter behavior: rapid fluttering and wider arc
          const scatterAlpha = THREE.MathUtils.clamp(b.scatterTimer / 4.2, 0, 1);
          const scatterRad = b.driftRadius * (1.0 + scatterAlpha * 1.8);
          const t = elapsedTime * (b.flapSpeed * 0.12) + b.phase;

          b.currentPos.x = b.anchor.x + Math.sin(t) * scatterRad;
          b.currentPos.z = b.anchor.z + Math.cos(t * 0.8) * scatterRad;
          b.currentPos.y = b.anchor.y + Math.sin(t * 1.5) * 0.45 + (scatterAlpha * 0.85);

          b.group.position.copy(b.currentPos);
          b.group.rotation.y = t + Math.PI * 0.5;

          const wingFlap = Math.sin(elapsedTime * (b.flapSpeed * 1.6) + b.phase) * 0.85;
          b.leftWing.rotation.y = wingFlap;
          b.rightWing.rotation.y = -wingFlap;
        } else {
          // Gentle normal drifting
          const t = elapsedTime * 0.85 + b.phase;
          b.currentPos.x = b.anchor.x + Math.sin(t) * b.driftRadius;
          b.currentPos.z = b.anchor.z + Math.cos(t * 0.72) * b.driftRadius;
          b.currentPos.y = b.anchor.y + Math.sin(t * 1.4) * b.flightHeight;

          b.group.position.copy(b.currentPos);
          b.group.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.72) * 0.72);

          const wingFlap = Math.sin(elapsedTime * b.flapSpeed + b.phase) * 0.68;
          b.leftWing.rotation.y = wingFlap;
          b.rightWing.rotation.y = -wingFlap;
        }
      });

      // ------------------------------------------------------------------------
      // 2. UPDATE WOODLAND BIRDS
      // ------------------------------------------------------------------------
      birds.forEach((bird) => {
        const distToPlayer = bird.currentPos.distanceTo(playerWorldPos);

        // Player proximity flight trigger
        if (!bird.isFlying && distToPlayer < 6.8) {
          bird.isFlying = true;
          bird.flightProgress = 0;
          audio.playWingFlutter(elapsedTime);
          audio.playBirdChirp(elapsedTime, distToPlayer);

          const targetPos = bird.targetPerch === 1 ? bird.perchB : bird.perchA;
          const midX = (bird.currentPos.x + targetPos.x) * 0.5;
          const midZ = (bird.currentPos.z + targetPos.z) * 0.5;
          const midY = Math.max(bird.currentPos.y, targetPos.y) + 2.2;
          bird.flightCurve = new THREE.CatmullRomCurve3([
            bird.currentPos.clone(),
            new THREE.Vector3(midX, midY, midZ),
            targetPos.clone(),
          ]);
        }

        if (bird.isFlying && bird.flightCurve) {
          bird.flightProgress += dt / bird.flightDuration;
          if (bird.flightProgress >= 1.0) {
            bird.flightProgress = 1.0;
            bird.isFlying = false;
            bird.targetPerch = bird.targetPerch === 1 ? 0 : 1;
            bird.currentPos.copy(bird.targetPerch === 1 ? bird.perchA : bird.perchB);
            bird.group.position.copy(bird.currentPos);
            bird.idleTimer = 10.0 + (bird.idleTimer % 8.0);
            bird.leftWing.rotation.z = 0;
            bird.rightWing.rotation.z = 0;
          } else {
            const p = bird.flightCurve.getPointAt(bird.flightProgress);
            const tan = bird.flightCurve.getTangentAt(bird.flightProgress);
            bird.currentPos.copy(p);
            bird.group.position.copy(p);
            bird.group.rotation.y = Math.atan2(tan.x, tan.z);

            // Flap wings rapidly during flight
            const flap = Math.sin(elapsedTime * 28.0) * 0.65;
            bird.leftWing.rotation.z = flap;
            bird.rightWing.rotation.z = -flap;
          }
        } else {
          // Perched state: periodic tail flick and head glance
          bird.idleTimer -= dt;
          if (bird.idleTimer <= 0) {
            // Chance to initiate autonomous crossing flight
            bird.isFlying = true;
            bird.flightProgress = 0;
            const targetPos = bird.targetPerch === 1 ? bird.perchB : bird.perchA;
            const midX = (bird.currentPos.x + targetPos.x) * 0.5;
            const midZ = (bird.currentPos.z + targetPos.z) * 0.5;
            const midY = Math.max(bird.currentPos.y, targetPos.y) + 2.4;
            bird.flightCurve = new THREE.CatmullRomCurve3([
              bird.currentPos.clone(),
              new THREE.Vector3(midX, midY, midZ),
              targetPos.clone(),
            ]);
            audio.playBirdChirp(elapsedTime, distToPlayer);
          } else {
            // Tiny perched glance
            const glance = Math.sin(elapsedTime * 1.8 + bird.perchA.x) * 0.18;
            bird.group.rotation.y = bird.lookYaw + glance;
            bird.leftWing.rotation.z = Math.sin(elapsedTime * 3.5) * 0.04;
            bird.rightWing.rotation.z = -Math.sin(elapsedTime * 3.5) * 0.04;
          }
        }
      });

      // ------------------------------------------------------------------------
      // 3. UPDATE WOODLAND FROGS
      // ------------------------------------------------------------------------
      frogs.forEach((frog) => {
        const distToPlayer = frog.currentPos.distanceTo(playerWorldPos);

        // Player approach triggers retreat hop toward water
        if (!frog.isHopping && distToPlayer < 3.2) {
          frog.isHopping = true;
          frog.hopProgress = 0;
          frog.hopStart.copy(frog.currentPos);
          // Hop in water direction
          const hopDist = 0.9 + (frog.homePos.x % 0.4);
          frog.hopTarget.set(
            frog.currentPos.x + frog.waterDir.x * hopDist,
            0,
            frog.currentPos.z + frog.waterDir.y * hopDist,
          );
          frog.hopTarget.y = getTerrainHeight(frog.hopTarget.x, frog.hopTarget.z) + 0.035;
          audio.playFrogCroak(elapsedTime, distToPlayer);
        }

        if (frog.isHopping) {
          frog.hopProgress += dt / 0.45; // 0.45s hop arc
          if (frog.hopProgress >= 1.0) {
            frog.hopProgress = 1.0;
            frog.isHopping = false;
            frog.currentPos.copy(frog.hopTarget);
            frog.group.position.copy(frog.currentPos);
            frog.idleTimer = 10.0 + (frog.homePos.z % 6.0);
          } else {
            const t = frog.hopProgress;
            const hopY = Math.sin(t * Math.PI) * 0.28;
            frog.currentPos.lerpVectors(frog.hopStart, frog.hopTarget, t);
            frog.group.position.set(frog.currentPos.x, frog.currentPos.y + hopY, frog.currentPos.z);
            frog.group.rotation.x = Math.sin(t * Math.PI * 2) * 0.25;
          }
        } else {
          // Idle throat sac breathing pulse
          const throatPulse = 1.0 + Math.sin(elapsedTime * 3.6 + frog.homePos.x) * 0.22;
          frog.throatMesh.scale.set(throatPulse, throatPulse, throatPulse);

          frog.idleTimer -= dt;
          if (frog.idleTimer <= 0) {
            // Autonomous tiny hop
            frog.isHopping = true;
            frog.hopProgress = 0;
            frog.hopStart.copy(frog.currentPos);
            // Hop slightly toward or along water margin
            const wanderAng = frog.facingYaw + (Math.sin(elapsedTime) * 0.4);
            const hopDist = 0.45;
            frog.hopTarget.set(
              frog.currentPos.x + Math.sin(wanderAng) * hopDist,
              0,
              frog.currentPos.z + Math.cos(wanderAng) * hopDist,
            );
            frog.hopTarget.y = getTerrainHeight(frog.hopTarget.x, frog.hopTarget.z) + 0.035;
          }
        }
      });

      // ------------------------------------------------------------------------
      // 4. UPDATE OCCASIONAL OWL
      // ------------------------------------------------------------------------
      const distToOwl = owlPos.distanceTo(playerWorldPos);

      // Distance audio hoot when player is within ~28m
      if (distToOwl < 28.0) {
        audio.playOwlHoot(elapsedTime, distToOwl);
      }

      owlTurnTimer -= dt;
      if (owlTurnTimer <= 0) {
        owlTurnTimer = 7.0 + Math.abs(Math.sin(elapsedTime * 0.5)) * 8.0;
        // Turn head left, right, or center
        const pick = (Math.sin(elapsedTime * 1.3) + 1.0) * 0.5;
        owlTargetYaw = (pick - 0.5) * 1.8; // Up to ±50 degrees
      }

      // If player is close (< 12m), owl tracks player head glance smoothly
      if (distToOwl < 12.0) {
        const dx = playerWorldPos.x - owlPos.x;
        const dz = playerWorldPos.z - owlPos.z;
        const playerAngle = Math.atan2(dx, dz);
        const relAngle = playerAngle - owlGroup.rotation.y;
        owlTargetYaw = THREE.MathUtils.clamp(relAngle, -1.2, 1.2);
      }

      owlLookYaw = THREE.MathUtils.lerp(owlLookYaw, owlTargetYaw, dt * 2.5);
      owlHeadGroup.rotation.y = owlLookYaw;

      // ------------------------------------------------------------------------
      // 5. UPDATE FIREFLIES (Organic Bioluminescent Drift & Phase Blinking)
      // ------------------------------------------------------------------------
      const posAttr = fireflyGeo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = fireflyGeo.getAttribute('color') as THREE.BufferAttribute;

      for (let i = 0; i < fireflyCount; i++) {
        const f = firefliesData[i];
        const t = elapsedTime * f.speed + f.phase;

        const fx = f.baseX + Math.sin(t * 0.8) * f.radiusX;
        const fy = f.baseY + Math.sin(t * 1.4) * f.radiusY;
        const fz = f.baseZ + Math.cos(t * 0.75) * f.radiusZ;

        // Subtle displacement away from walking player
        const distSq = (fx - playerWorldPos.x) ** 2 + (fz - playerWorldPos.z) ** 2;
        let pushX = 0;
        let pushZ = 0;
        if (distSq < 4.0) {
          const d = Math.sqrt(distSq) || 0.1;
          const push = (1.0 - d / 2.0) * 0.65;
          pushX = ((fx - playerWorldPos.x) / d) * push;
          pushZ = ((fz - playerWorldPos.z) / d) * push;
        }

        posAttr.setXYZ(i, fx + pushX, fy, fz + pushZ);

        // Realistic organic bioluminescent pulse
        const blinkRaw = Math.sin(elapsedTime * 2.4 + f.phase * 3.0);
        const blink = THREE.MathUtils.clamp(blinkRaw * 2.2 - 0.4, 0.0, 1.0);

        const baseR = f.colorType === 'cyan' ? 0.35 : f.colorType === 'amber' ? 0.98 : 0.72;
        const baseG = f.colorType === 'cyan' ? 0.88 : f.colorType === 'amber' ? 0.92 : 0.95;
        const baseB = f.colorType === 'cyan' ? 0.98 : f.colorType === 'amber' ? 0.45 : 0.35;

        colAttr.setXYZ(i, baseR * blink, baseG * blink, baseB * blink);
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // ------------------------------------------------------------------------
      // 6. UPDATE TINY AMBIENT CREATURES (Flee behind cover on approach)
      // ------------------------------------------------------------------------
      ambientCreatures.forEach((creature) => {
        const dist = creature.currentPos.distanceTo(playerWorldPos);
        if (!creature.isFleeing && dist < 4.2) {
          creature.isFleeing = true;
          creature.fleeProgress = 0;
        }

        if (creature.isFleeing) {
          creature.fleeProgress += dt * 1.4;
          if (creature.fleeProgress >= 1.0) {
            creature.fleeProgress = 1.0;
            creature.currentPos.copy(creature.hidePos);
            creature.group.position.copy(creature.hidePos);
            creature.group.visible = false; // Vanished behind rock / deep brush
          } else {
            const p = creature.fleeProgress;
            creature.currentPos.lerpVectors(creature.homePos, creature.hidePos, p);
            const hopY = Math.abs(Math.sin(p * Math.PI * 4)) * 0.12;
            creature.group.position.set(
              creature.currentPos.x,
              creature.currentPos.y + hopY,
              creature.currentPos.z,
            );
            const dirX = creature.hidePos.x - creature.homePos.x;
            const dirZ = creature.hidePos.z - creature.homePos.z;
            creature.group.rotation.y = Math.atan2(dirX, dirZ);
          }
        }
      });
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
