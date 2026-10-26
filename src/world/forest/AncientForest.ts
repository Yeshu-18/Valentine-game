import * as THREE from 'three';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';
import {
  ResourceTracker,
  createBeveledBoxGeometry,
} from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  ANCIENT_FOREST_LOCAL_POINTS,
  FOREST_LAKE_LOCAL_POS,
  FOREST_SEED,
  GIANT_ANCIENT_TREE_LOCAL_POS,
  castleLocalToWorld,
  getTerrainHeight,
  mulberry32,
  worldToCastleLocal,
} from '../terrainMath';
import {
  ForestFloorSystemBundle,
  createForestFloorSystem,
} from './ForestFloorSystem';
import {
  ForestTreeSystemBundle,
  createForestTreeSystem,
} from './ForestTreeSystem';
import { ForestAudioSynthesizer } from './ForestAudio';
import {
  MushroomGroveBundle,
  createMushroomGrove,
} from './MushroomGrove';
import {
  AncientRuinsBundle,
  RuneStoneDialogueBanner,
  createAncientRuins,
} from './AncientRuins';
import {
  ForestStreamBundle,
  createForestStream,
} from './ForestStream';
import {
  GiantAncientTreeDetailBundle,
  createGiantAncientTreeDetail,
} from './GiantAncientTreeDetail';
import {
  ForestWildlifeBundle,
  createForestWildlifeSystem,
} from './ForestWildlifeSystem';
import {
  HeartwoodSanctuaryBundle,
  createHeartwoodSanctuarySystem,
} from './HeartwoodSanctuary';

export interface AncientForestBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  treeSystem: ForestTreeSystemBundle;
  floorSystem: ForestFloorSystemBundle;
  mushroomGrove: MushroomGroveBundle;
  ancientRuins: AncientRuinsBundle;
  forestStream: ForestStreamBundle;
  treeDetail: GiantAncientTreeDetailBundle;
  wildlifeSystem: ForestWildlifeBundle;
  heartwoodSanctuary: HeartwoodSanctuaryBundle;
  audio: ForestAudioSynthesizer;
  particleCount: number;
  dynamicLightCount: number;
  getRunePrompt: (playerWorldPos: THREE.Vector3) => {
    id?: 'f3_rune_stone' | 'f5_lake_photo';
    isNear: boolean;
    title: string;
    actionLabel: string;
  } | null;
  triggerRuneStone: (
    playerWorldPos: THREE.Vector3,
    elapsedTime: number,
  ) => boolean;
  isDialogueActive: () => boolean;
  isLakeMemoryActive: () => boolean;
  advanceDialogue: () => boolean;
  skipDialogue: () => boolean;
  getActiveBanner: () => (RuneStoneDialogueBanner & { photoUrl?: string }) | null;
  getCameraFocus: () => {
    active: boolean;
    camWorldPos: THREE.Vector3;
    lookWorldPos: THREE.Vector3;
    blendAlpha: number;
    playerTurnAlpha?: number;
    embraceAlpha?: number;
    kissAlpha?: number;
    targetPlayerYaw?: number;
  } | null;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

/**
 * Generates a soft vertical gradient texture for sunbeams filtering through the high forest canopy.
 */
function createSunbeamGradientTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 64;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const vFade = Math.sin(v * Math.PI) * Math.pow(1.0 - v * 0.65, 1.2);
    const hGrad = ctx.createLinearGradient(0, y, w, y);
    hGrad.addColorStop(0.0, 'rgba(255, 244, 214, 0.0)');
    hGrad.addColorStop(0.5, `rgba(255, 244, 214, ${(vFade * 0.14).toFixed(4)})`);
    hGrad.addColorStop(1.0, 'rgba(255, 244, 214, 0.0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, y, w, 1);
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Perturbs an IcosahedronGeometry organically for natural boundary crag boulders and moss mounds.
 */
function createCragBoulderGeometry(
  rx: number,
  ry: number,
  rz: number,
  irregularity: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, 2);
  const pos = geo.attributes.position;
  const freq = 2.6 + (seed % 4) * 0.4;
  const phase = seed * 1.41;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const wave =
      Math.sin(vx * freq + vy * 2.4 + phase) *
        Math.cos(vz * freq - vx * 1.8 - phase) *
        irregularity +
      Math.sin((vx + vz) * freq * 1.5 + phase) * (irregularity * 0.38);
    pos.setXYZ(
      i,
      (vx + (vx / len) * wave) * rx,
      (vy + (vy / len) * wave * 0.85) * ry,
      (vz + (vz / len) * wave) * rz,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a rich procedural woodland trail texture:
 * compacted dark forest earth in the center, mottled soil grain, subtle fine pebbles,
 * and soft mossy green-brown borders.
 */
function createWoodlandTrailTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. Base dark woodland earth
  ctx.fillStyle = '#38291a';
  ctx.fillRect(0, 0, w, h);

  // 2. Horizontal gradient for worn central tread & mossy edges
  const horizGrad = ctx.createLinearGradient(0, 0, w, 0);
  horizGrad.addColorStop(0.0, 'rgba(48, 66, 35, 0.92)'); // mossy edge
  horizGrad.addColorStop(0.18, 'rgba(64, 48, 30, 0.45)');
  horizGrad.addColorStop(0.5, 'rgba(38, 26, 16, 0.96)'); // dark compacted dirt centerline
  horizGrad.addColorStop(0.82, 'rgba(64, 48, 30, 0.45)');
  horizGrad.addColorStop(1.0, 'rgba(48, 66, 35, 0.92)'); // mossy edge
  ctx.fillStyle = horizGrad;
  ctx.fillRect(0, 0, w, h);

  // 3. Subtle organic dirt noise & pebble specks
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const grain = (Math.random() - 0.5) * 28;
    d[i] = Math.max(0, Math.min(255, d[i] + grain));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain * 0.9));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain * 0.7));
  }
  ctx.putImageData(imgData, 0, 0);

  // 4. Occasional small weathered pebbles
  ctx.fillStyle = 'rgba(142, 134, 120, 0.6)';
  for (let p = 0; p < 70; p++) {
    const px = Math.random() * w;
    const py = Math.random() * h;
    const pr = 0.9 + Math.random() * 2.1;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a smooth, terrain-conforming quad strip for a woodland path ribbon.
 */
function createWoodlandPathRibbonGeo(
  curve: THREE.Curve<THREE.Vector3>,
  segments: number,
  baseWidth: number,
  vRepeat = 12,
  widthFn?: (u: number) => number,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const _pt = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  const colFracs = [-0.5, -0.22, 0.22, 0.5];
  const colUvs = [0.0, 0.28, 0.72, 1.0];
  const colElevs = [0.024, 0.042, 0.042, 0.024];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, _pt);
    curve.getTangentAt(u, _tan).normalize();
    _right.crossVectors(_tan, _up).normalize();

    const w = widthFn ? widthFn(u) : baseWidth;
    const v = u * vRepeat;

    for (let c = 0; c < 4; c++) {
      const lat = _right.clone().multiplyScalar(colFracs[c] * w);
      const vx = _pt.x + lat.x;
      const vz = _pt.z + lat.z;
      const vy = getTerrainHeight(vx, vz) + colElevs[c];

      positions.push(vx, vy, vz);
      normals.push(0, 1, 0);
      uvs.push(colUvs[c], v);
    }
  }

  for (let i = 0; i < segments; i++) {
    const rowA = i * 4;
    const rowB = (i + 1) * 4;
    for (let c = 0; c < 3; c++) {
      const a = rowA + c;
      const b = rowA + c + 1;
      const d = rowB + c;
      const e = rowB + c + 1;

      indices.push(a, d, b);
      indices.push(b, d, e);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

/**
 * Creates a delicate glowing woodland guide mushroom/flower cluster for fairy-tale pathfinding.
 */
function createFairyGuideFloraGeo(): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.016, 0.022, 0.22, 6);
  stem.translate(0, 0.11, 0);
  const cap = new THREE.SphereGeometry(0.068, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
  cap.scale(1.0, 0.7, 1.0);
  cap.translate(0, 0.21, 0);
  return mergeGeometries([stem, cap]);
}

/**
 * Builds Phase F2: The Ancient Forest Foundation (`src/world/forest/AncientForest.ts`).
 * - Gradual F1 -> F2 transition (swallowed paving stones, half-buried masonry & broken planter shards)
 * - Winding natural woodland trail with root-arch corridors, sun-dappled glades & elevation variation
 * - Natural physical boundaries (mossy cliff boulders, fallen ancient trunks & tangled root barriers)
 * - Canopy-filtered sunlight shafts & 80 subtle floating forest dust motes
 * - Integrates `ForestTreeSystem` (10 Hero Trees + 56 Midground + 78 Background + 1 Giant Ancient Tree)
 *   and `ForestFloorSystem` (clustered Low/Medium/High understory).
 */
export function createAncientForestSystem(): AncientForestBundle {
  const group = new THREE.Group();
  group.name = 'PhaseF2_AncientForestSystem';

  const tracker = new ResourceTracker();
  const colliders: CircleCollider[] = [];
  const rand = mulberry32(FOREST_SEED + 1001);

  // Build world-space spline along ANCIENT_FOREST_LOCAL_POINTS
  const splineWorldPts = ANCIENT_FOREST_LOCAL_POINTS.map((pt) => {
    const w = castleLocalToWorld(pt.localX, pt.localZ);
    return new THREE.Vector3(w.x, getTerrainHeight(w.x, w.z), w.z);
  });
  const forestSpline = new THREE.CatmullRomCurve3(splineWorldPts);

  // Shared Natural Materials
  const swallowedStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8c857f'),
      roughness: 0.86,
      metalness: 0.03,
    }),
  );

  const cragRockMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#706b64'),
      roughness: 0.9,
      metalness: 0.03,
    }),
  );

  const deepMossMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3f6135'),
      roughness: 0.85,
      metalness: 0.0,
    }),
  );

  const fallenTrunkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#524032'),
      roughness: 0.88,
      metalness: 0.02,
    }),
  );

  const _pt = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  // ============================================================================
  // 1. COMPREHENSIVE CONTINUOUS WOODLAND PATHWAY & WAYFINDING SYSTEM
  //    - Continuous terrain-conforming earthen path ribbon (rich packed loam + mossy borders)
  //    - Full-length weathered stepping stones & flagstones from Gate 2 to Giant Tree Knoll
  //    - Flanking mossy border stones framing the walking tread
  //    - Dedicated spur trails to Mushroom Grove, Stream/Bridge/Ruins, and Northern Plateau
  //    - Subtle bioluminescent fairy guide flora along path edges for organic wayfinding
  // ============================================================================
  const trailRibbonGeos: THREE.BufferGeometry[] = [];
  const steppingStoneGeos: THREE.BufferGeometry[] = [];
  const borderStoneGeos: THREE.BufferGeometry[] = [];
  const borderMossGeos: THREE.BufferGeometry[] = [];
  const guideFloraGeos: THREE.BufferGeometry[] = [];
  const trailRootGeos: THREE.BufferGeometry[] = [];
  const swallowedRemnantGeos: THREE.BufferGeometry[] = [];

  const woodlandTrailMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: createWoodlandTrailTexture(tracker) ?? undefined,
      color: new THREE.Color('#58422d'),
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0,
    }),
  );

  const guideFloraMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#eab308'),
      emissiveIntensity: 0.58,
      roughness: 0.32,
    }),
  );

  // 1A. Spur Splines to Major Discoveries
  const mushroomSpurPts = [
    { lx: 50.2, lz: 0.2 },
    { lx: 51.6, lz: 2.8 },
    { lx: 53.2, lz: 5.8 },
    { lx: 54.5, lz: 8.5 },
  ].map((p) => {
    const w = castleLocalToWorld(p.lx, p.lz);
    return new THREE.Vector3(w.x, getTerrainHeight(w.x, w.z), w.z);
  });
  const mushroomSpurSpline = new THREE.CatmullRomCurve3(mushroomSpurPts);

  const streamRuinsSpurPts = [
    { lx: 55.8, lz: -4.2 },
    { lx: 57.8, lz: -6.8 },
    { lx: 60.2, lz: -9.8 },
    { lx: 61.6, lz: -11.2 },
    { lx: 62.8, lz: -12.4 },
  ].map((p) => {
    const w = castleLocalToWorld(p.lx, p.lz);
    return new THREE.Vector3(w.x, getTerrainHeight(w.x, w.z), w.z);
  });
  const streamRuinsSpurSpline = new THREE.CatmullRomCurve3(streamRuinsSpurPts);

  // Natural Dappled Fern Glade spur branching gently to the Lake Shoreline on the LEFT of the walkway
  const lakeShoreSpurPts = [
    { lx: 52.0, lz: -1.0 },
    { lx: 51.2, lz: -4.2 },
    { lx: 50.2, lz: -7.5 },
    { lx: 49.4, lz: -9.8 },
    { lx: 48.8, lz: -11.6 },
  ].map((p) => {
    const w = castleLocalToWorld(p.lx, p.lz);
    return new THREE.Vector3(w.x, getTerrainHeight(w.x, w.z), w.z);
  });
  const lakeShoreSpurSpline = new THREE.CatmullRomCurve3(lakeShoreSpurPts);

  // Extended northern trail continuing naturally beyond the Giant Ancient Tree deep into the northern plateau
  const northernPlateauSpurPts = [
    { lx: 70.8, lz: 7.2 },
    { lx: 72.5, lz: 10.5 },
    { lx: 75.2, lz: 16.5 },
    { lx: 78.8, lz: 24.0 },
    { lx: 82.5, lz: 32.5 },
    { lx: 86.5, lz: 42.0 },
  ].map((p) => {
    const w = castleLocalToWorld(p.lx, p.lz);
    return new THREE.Vector3(w.x, getTerrainHeight(w.x, w.z), w.z);
  });
  const northernPlateauSpurSpline = new THREE.CatmullRomCurve3(northernPlateauSpurPts);

  // 1B. Generate Continuous Path Ribbons (Earthen Trail Beds)
  trailRibbonGeos.push(
    createWoodlandPathRibbonGeo(
      forestSpline,
      72,
      2.35,
      18,
      (u) => THREE.MathUtils.lerp(2.45, 2.05, u),
    ),
  );
  trailRibbonGeos.push(
    createWoodlandPathRibbonGeo(mushroomSpurSpline, 22, 1.8, 5),
  );
  trailRibbonGeos.push(
    createWoodlandPathRibbonGeo(streamRuinsSpurSpline, 28, 1.85, 7),
  );
  trailRibbonGeos.push(
    createWoodlandPathRibbonGeo(lakeShoreSpurSpline, 24, 1.85, 6),
  );
  trailRibbonGeos.push(
    createWoodlandPathRibbonGeo(northernPlateauSpurSpline, 32, 1.8, 8),
  );

  // 1C. Populate Main Trunk Trail with Stepping Stones, Border Stones & Guide Flora
  const mainSteps = 56;
  for (let s = 0; s <= mainSteps; s++) {
    const u = s / mainSteps;
    forestSpline.getPointAt(u, _pt);
    forestSpline.getTangentAt(u, _tan).normalize();
    _right.crossVectors(_tan, _up).normalize();
    const yaw = Math.atan2(_tan.x, _tan.z);

    // Weathered flagstone / stepping stone along the walking centerline
    const isGateZone = u < 0.28;
    const isKnollZone = u > 0.72;
    const slabW = isGateZone
      ? 0.74 + rand() * 0.28
      : 0.62 + rand() * 0.26;
    const slabLen = isGateZone
      ? 0.52 + rand() * 0.24
      : 0.44 + rand() * 0.22;
    const cLat = (rand() - 0.5) * 0.38;
    const cwx = _pt.x + _right.x * cLat;
    const cwz = _pt.z + _right.z * cLat;
    const cwy = getTerrainHeight(cwx, cwz) + (isKnollZone ? 0.045 : 0.035);

    let stoneGeo: THREE.BufferGeometry;
    if (isGateZone) {
      stoneGeo = createBeveledBoxGeometry(slabW, 0.08, slabLen, 0.02);
      stoneGeo.rotateX((rand() - 0.5) * 0.06);
      stoneGeo.rotateZ((rand() - 0.5) * 0.06);
    } else {
      stoneGeo = createCragBoulderGeometry(
        slabW * 0.58,
        0.065,
        slabLen * 0.58,
        0.16,
        100 + s,
      );
    }
    stoneGeo.rotateY(yaw + (rand() - 0.5) * 0.24);
    stoneGeo.translate(cwx, cwy, cwz);
    steppingStoneGeos.push(stoneGeo);

    // Flanking mossy border stones framing the trail on alternating sides
    const bSide = s % 2 === 0 ? 1 : -1;
    const bLat = bSide * (1.18 + (rand() - 0.5) * 0.24);
    const bwx = _pt.x + _right.x * bLat;
    const bwz = _pt.z + _right.z * bLat;
    const bwy = getTerrainHeight(bwx, bwz);

    const bStone = createCragBoulderGeometry(
      0.34 + rand() * 0.18,
      0.2,
      0.34 + rand() * 0.18,
      0.2,
      s * 19 + (bSide > 0 ? 1 : 2),
    );
    bStone.translate(bwx, bwy + 0.06, bwz);
    borderStoneGeos.push(bStone);

    const bMoss = createCragBoulderGeometry(0.26, 0.11, 0.26, 0.18, s * 29);
    bMoss.translate(bwx, bwy + 0.16, bwz);
    borderMossGeos.push(bMoss);

    // Subtle fairy guide flora tucked beside border stones every 4 steps
    if (s % 4 === 1) {
      const floraGeo = createFairyGuideFloraGeo();
      const fLat = bLat + bSide * 0.22;
      const fwx = _pt.x + _right.x * fLat;
      const fwz = _pt.z + _right.z * fLat;
      const fwy = getTerrainHeight(fwx, fwz);
      floraGeo.rotateY(rand() * Math.PI * 2);
      floraGeo.translate(fwx, fwy, fwz);
      guideFloraGeos.push(floraGeo);
    }

    // Exposed roots crossing the trail edge at natural intervals
    if ((s === 8 || s === 18 || s === 29 || s === 41 || s === 50) && s % 2 === 0) {
      const rSide = bSide * -1;
      const p0x = _pt.x + _right.x * (rSide * 2.1);
      const p0z = _pt.z + _right.z * (rSide * 2.1);
      const p1x = _pt.x + _right.x * (rSide * 0.88) + _tan.x * 0.35;
      const p1z = _pt.z + _right.z * (rSide * 0.88) + _tan.z * 0.35;
      const p2x = _pt.x + _right.x * (rSide * 0.12) + _tan.x * 0.7;
      const p2z = _pt.z + _right.z * (rSide * 0.12) + _tan.z * 0.7;

      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(p0x, getTerrainHeight(p0x, p0z) + 0.14, p0z),
        new THREE.Vector3(p1x, getTerrainHeight(p1x, p1z) + 0.09, p1z),
        new THREE.Vector3(p2x, getTerrainHeight(p2x, p2z) - 0.02, p2z),
      ]);
      const rTube = new THREE.TubeGeometry(rootCurve, 8, 0.052, 6, false);
      trailRootGeos.push(rTube);
    }
  }

  // 1D. Populate Spur Trails (Mushroom Grove, Bridge/Ruins, Northern Plateau & Lake Shoreline)
  const spurs = [
    { spline: mushroomSpurSpline, steps: 14, seedOffset: 300 },
    { spline: streamRuinsSpurSpline, steps: 18, seedOffset: 400 },
    { spline: northernPlateauSpurSpline, steps: 22, seedOffset: 500 },
    { spline: lakeShoreSpurSpline, steps: 18, seedOffset: 600 },
  ];

  spurs.forEach((spur) => {
    for (let s = 1; s <= spur.steps; s++) {
      const u = s / spur.steps;
      spur.spline.getPointAt(u, _pt);
      spur.spline.getTangentAt(u, _tan).normalize();
      _right.crossVectors(_tan, _up).normalize();
      const yaw = Math.atan2(_tan.x, _tan.z);

      // Embedded stepping stone
      const sw = 0.54 + rand() * 0.22;
      const sl = 0.42 + rand() * 0.18;
      const stLat = (rand() - 0.5) * 0.3;
      const swx = _pt.x + _right.x * stLat;
      const swz = _pt.z + _right.z * stLat;
      const swy = getTerrainHeight(swx, swz) + 0.034;

      const sGeo = createCragBoulderGeometry(
        sw * 0.58,
        0.062,
        sl * 0.58,
        0.16,
        spur.seedOffset + s,
      );
      sGeo.rotateY(yaw + (rand() - 0.5) * 0.25);
      sGeo.translate(swx, swy, swz);
      steppingStoneGeos.push(sGeo);

      // Flanking border stone
      if (s % 2 === 0) {
        const bSide = s % 4 === 0 ? 1 : -1;
        const bLat = bSide * (0.92 + (rand() - 0.5) * 0.2);
        const bwx = _pt.x + _right.x * bLat;
        const bwz = _pt.z + _right.z * bLat;
        const bwy = getTerrainHeight(bwx, bwz);

        const bStone = createCragBoulderGeometry(
          0.3,
          0.18,
          0.3,
          0.18,
          spur.seedOffset + s * 13,
        );
        bStone.translate(bwx, bwy + 0.05, bwz);
        borderStoneGeos.push(bStone);

        const bMoss = createCragBoulderGeometry(0.24, 0.09, 0.24, 0.16, spur.seedOffset + s * 17);
        bMoss.translate(bwx, bwy + 0.14, bwz);
        borderMossGeos.push(bMoss);

        // Guide flora
        if (s % 4 === 0) {
          const fGeo = createFairyGuideFloraGeo();
          const fwx = _pt.x + _right.x * (bLat + bSide * 0.2);
          const fwz = _pt.z + _right.z * (bLat + bSide * 0.2);
          const fwy = getTerrainHeight(fwx, fwz);
          fGeo.rotateY(rand() * Math.PI * 2);
          fGeo.translate(fwx, fwy, fwz);
          guideFloraGeos.push(fGeo);
        }
      }
    }
  });

  // 1E. Tranquil Forest Lake Cove & Stony Shoreline (localX: 47.5, localZ: -20.5)
  // Situated on the LEFT of the main walkway in the natural valley depression
  const lakeCenterLocal = { lx: 47.5, lz: -20.5 };
  const lakeCenterW = castleLocalToWorld(lakeCenterLocal.lx, lakeCenterLocal.lz);
  const lakeElevation = getTerrainHeight(lakeCenterW.x, lakeCenterW.z) + 0.36;

  const lakeWaterGeo = tracker.trackGeo(new THREE.CircleGeometry(9.2, 28));
  lakeWaterGeo.rotateX(-Math.PI / 2);
  lakeWaterGeo.scale(1.22, 1.0, 0.95);
  lakeWaterGeo.translate(lakeCenterW.x, lakeElevation, lakeCenterW.z);

  const lakeWaterMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0d9488'),
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const lakeMesh = new THREE.Mesh(lakeWaterGeo, lakeWaterMat);
  lakeMesh.name = 'ForestLakeWater';
  lakeMesh.renderOrder = 1;
  lakeMesh.receiveShadow = true;
  group.add(lakeMesh);

  // Stony Shoreline (~14m walk) & Riverbank Rocks strictly along the outer water rim (never inside the lake)
  for (let sk = 0; sk < 18; sk++) {
    const sAng = -Math.PI * 0.45 + (sk / 17) * Math.PI * 1.1;
    const sRad = 9.65 + (rand() - 0.5) * 0.7;
    const sx = lakeCenterW.x + Math.sin(sAng) * sRad * 1.22;
    const sz = lakeCenterW.z + Math.cos(sAng) * sRad * 0.95;
    const sy = getTerrainHeight(sx, sz);

    const sBoulder = createCragBoulderGeometry(
      0.44 + rand() * 0.22,
      0.18,
      0.44 + rand() * 0.22,
      0.18,
      700 + sk,
    );
    sBoulder.translate(sx, sy + 0.06, sz);
    borderStoneGeos.push(sBoulder);

    if (sk % 2 === 0) {
      const sMoss = createCragBoulderGeometry(0.32, 0.1, 0.32, 0.16, 750 + sk);
      sMoss.translate(sx, sy + 0.16, sz);
      borderMossGeos.push(sMoss);
    }
  }

  // 1E. 3 Half-Buried Abandoned Garden Remnants near Gate 2
  const remnantUSpecs = [
    { u: 0.06, side: -1, lat: 2.35 },
    { u: 0.14, side: 1, lat: 2.65 },
    { u: 0.23, side: -1, lat: 2.95 },
  ];
  remnantUSpecs.forEach((rSpec, rIdx) => {
    forestSpline.getPointAt(rSpec.u, _pt);
    forestSpline.getTangentAt(rSpec.u, _tan).normalize();
    _right.crossVectors(_tan, _up).normalize();

    const rx = _pt.x + _right.x * rSpec.side * rSpec.lat;
    const rz = _pt.z + _right.z * rSpec.side * rSpec.lat;
    const ry = getTerrainHeight(rx, rz) - 0.12 - rIdx * 0.05;

    const brokenBlock = createBeveledBoxGeometry(0.62, 0.42, 0.54, 0.03);
    brokenBlock.rotateX(0.28 * rSpec.side);
    brokenBlock.rotateZ(-0.22);
    brokenBlock.rotateY(rIdx * 1.15);
    brokenBlock.translate(rx, ry + 0.16, rz);
    swallowedRemnantGeos.push(brokenBlock);

    const engulfMoss = createCragBoulderGeometry(
      0.48,
      0.24,
      0.44,
      0.26,
      500 + rIdx,
    );
    engulfMoss.translate(rx + 0.12, ry + 0.24, rz + 0.08);
    borderMossGeos.push(engulfMoss);
  });

  // Merge and Add All Trail Geometry Batches
  if (trailRibbonGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(trailRibbonGeos));
    trailRibbonGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, woodlandTrailMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (steppingStoneGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(steppingStoneGeos));
    steppingStoneGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, swallowedStoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (borderStoneGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(borderStoneGeos));
    borderStoneGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, cragRockMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (borderMossGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(borderMossGeos));
    borderMossGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, deepMossMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (guideFloraGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(guideFloraGeos));
    guideFloraGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, guideFloraMat);
    group.add(mesh);
  }

  if (trailRootGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(trailRootGeos));
    trailRootGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, fallenTrunkMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (swallowedRemnantGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(swallowedRemnantGeos));
    swallowedRemnantGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, swallowedStoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ============================================================================
  // 2. NATURAL PERIMETER BOUNDARIES (Mossy Crag Boulders & Fallen Ancient Trunks)
  //    Replaces artificial invisible walls with physical woodland barriers.
  // ============================================================================
  const boundaryBoulderGeos: THREE.BufferGeometry[] = [];
  const boundaryMossGeos: THREE.BufferGeometry[] = [];
  const boundaryTrunkGeos: THREE.BufferGeometry[] = [];

  for (let b = 0; b < 26; b++) {
    const u = (b + 0.5) / 26;
    forestSpline.getPointAt(u, _pt);
    forestSpline.getTangentAt(u, _tan).normalize();
    _right.crossVectors(_tan, _up).normalize();

    const side = b % 2 === 0 ? 1 : -1;
    // Expanded boundary distance following the broadened mountain shoulders (22m..32m from spine)
    const boundaryDist = 22.0 + (b % 3) * 3.4 + rand() * 2.2;
    const bx = _pt.x + _right.x * side * boundaryDist;
    const bz = _pt.z + _right.z * side * boundaryDist;

    // Never place perimeter boulders or fallen logs in or near the Forest Lake
    const bLocal = worldToCastleLocal(bx, bz);
    if (
      Math.hypot(
        (bLocal.localX - FOREST_LAKE_LOCAL_POS.localX) / 1.22,
        (bLocal.localZ - FOREST_LAKE_LOCAL_POS.localZ) / 0.95,
      ) < 14.5
    ) {
      continue;
    }

    const by = getTerrainHeight(bx, bz);

    const rx = 1.45 + rand() * 0.95;
    const ry = 1.15 + rand() * 0.85;
    const rz = 1.35 + rand() * 0.95;

    const boulder = createCragBoulderGeometry(rx, ry, rz, 0.25, 600 + b);
    boulder.rotateY(rand() * Math.PI * 2);
    boulder.translate(bx, by + ry * 0.35 - 0.25, bz);
    boundaryBoulderGeos.push(boulder);

    const mossCap = createCragBoulderGeometry(
      rx * 0.86,
      ry * 0.38,
      rz * 0.86,
      0.22,
      650 + b,
    );
    mossCap.translate(bx, by + ry * 0.72 - 0.15, bz);
    boundaryMossGeos.push(mossCap);

    colliders.push({ x: bx, z: bz, radius: Math.max(rx, rz) * 0.82 });

    // Every 3rd boundary point, add a heavy fallen ancient tree trunk bridging the perimeter
    if (b % 3 === 0) {
      const logLen = 4.6 + rand() * 1.8;
      const logR = 0.36 + rand() * 0.14;
      const logGeo = new THREE.CylinderGeometry(logR * 0.78, logR, logLen, 8);
      logGeo.rotateX(Math.PI / 2 + (rand() - 0.5) * 0.15);
      const logYaw = Math.atan2(_tan.x, _tan.z) + (rand() - 0.5) * 0.35;
      logGeo.rotateY(logYaw);

      const lx = bx + _tan.x * 1.8;
      const lz = bz + _tan.z * 1.8;
      const ly = getTerrainHeight(lx, lz);
      logGeo.translate(lx, ly + logR * 0.55, lz);
      boundaryTrunkGeos.push(logGeo);

      colliders.push({ x: lx, z: lz, radius: 1.35 });
    }
  }

  // Outer northern perimeter boulders are now placed beyond the Heartwood Sanctuary (localX: 104..146, localZ: 68..82)
  // in HeartwoodSanctuary.ts so the Sun-Dappled Northern Woodland, Hidden Pool & Sanctuary are seamlessly navigable.

  if (boundaryBoulderGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(boundaryBoulderGeos));
    boundaryBoulderGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, cragRockMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (boundaryMossGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(boundaryMossGeos));
    boundaryMossGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, deepMossMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (boundaryTrunkGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(boundaryTrunkGeos));
    boundaryTrunkGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, fallenTrunkMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ============================================================================
  // 3. CANOPY-FILTERED SUNLIGHT SHAFTS, 2 RESTRAINED GLADE FILL LIGHTS & 80 DUST MOTES
  // ============================================================================
  const sunbeamTex = createSunbeamGradientTexture(tracker);
  const sunbeamMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: sunbeamTex ?? undefined,
      color: new THREE.Color('#fff3d1'),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const shaftPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(3.2, 13.5));
  const shaftCrossGeo = (() => {
    const p1 = shaftPlaneGeo.clone();
    const p2 = shaftPlaneGeo.clone();
    p2.rotateY(Math.PI / 2);
    const merged = tracker.trackGeo(mergeGeometries([p1, p2]));
    p1.dispose();
    p2.dispose();
    return merged;
  })();

  const sunShaftU = [0.22, 0.34, 0.48, 0.66, 0.82, 0.95];
  const sunShaftMeshes: THREE.Mesh[] = [];
  sunShaftU.forEach((su, idx) => {
    forestSpline.getPointAt(su, _pt);
    const shaft = new THREE.Mesh(shaftCrossGeo, sunbeamMat);
    shaft.position.set(
      _pt.x + (idx % 2 === 0 ? 1.2 : -1.2),
      _pt.y + 6.4,
      _pt.z + (idx % 2 === 0 ? -0.8 : 0.8),
    );
    // Angle sun shafts softly along the golden-hour sun direction
    shaft.rotation.set(0.18, 0.65 + idx * 0.2, -0.14);
    group.add(shaft);
    sunShaftMeshes.push(shaft);
  });

  // Additional sun shafts for the Lake Shoreline, Northern Open Woodland, Hidden Pool & Heartwood Sanctuary
  const extraShaftLocals = [
    { lx: 48.5, lz: -18.0, yaw: 0.42 },  // Lake shoreline glade
    { lx: 79.0, lz: 22.0, yaw: 0.85 },   // Northern open woodland 1
    { lx: 86.0, lz: 34.0, yaw: 1.15 },   // Northern open woodland 2
    { lx: 95.5, lz: 14.5, yaw: 0.65 },   // Secluded Hidden Pool / Spring hollow
    { lx: 113.5, lz: 46.5, yaw: 0.95 },  // Heartwood Sanctuary clearing canopy opening
  ];
  extraShaftLocals.forEach((loc) => {
    const w = castleLocalToWorld(loc.lx, loc.lz);
    const wy = getTerrainHeight(w.x, w.z);
    const shaft = new THREE.Mesh(shaftCrossGeo, sunbeamMat);
    shaft.position.set(w.x, wy + 6.8, w.z);
    shaft.rotation.set(0.18, loc.yaw, -0.14);
    group.add(shaft);
    sunShaftMeshes.push(shaft);
  });

  // 6 Controlled Canopy-Filtered Environmental Focus PointLights (≤12 Dynamic PointLights Target)
  // Ensures readable pathways, glades, water edges, and wildlife without washing out atmosphere.
  // Light 1: Forest Entry / Garden-to-Forest Transition (warm golden sun filtering)
  const entryW = castleLocalToWorld(44.5, 10.5);
  const entryLight = new THREE.PointLight('#faedd0', 2.0, 24.0, 1.2);
  entryLight.position.set(entryW.x, getTerrainHeight(entryW.x, entryW.z) + 5.2, entryW.z);
  group.add(entryLight);

  // Light 2: Glade 1 (Fern Glade)
  const glade1Pt = forestSpline.getPointAt(0.34);
  const glade1Light = new THREE.PointLight('#f6e3ba', 2.8, 28.0, 1.2);
  glade1Light.position.set(glade1Pt.x, glade1Pt.y + 5.5, glade1Pt.z);
  group.add(glade1Light);

  // Light 3: Lake Shoreline (soft cool aquatic ambient fill illuminating water edge, rocks & frogs)
  const lakeShoreW = castleLocalToWorld(47.5, -19.5);
  const lakeShoreLight = new THREE.PointLight('#a5f3fc', 1.8, 22.0, 1.3);
  lakeShoreLight.position.set(lakeShoreW.x, getTerrainHeight(lakeShoreW.x, lakeShoreW.z) + 3.8, lakeShoreW.z);
  group.add(lakeShoreLight);

  // Light 4: Stream Bridge & Waterfall Crossing (sun-dappled cool-warm water gap)
  const streamW = castleLocalToWorld(58.5, 3.5);
  const streamBridgeLight = new THREE.PointLight('#fef08a', 1.8, 20.0, 1.3);
  streamBridgeLight.position.set(streamW.x, getTerrainHeight(streamW.x, streamW.z) + 4.2, streamW.z);
  group.add(streamBridgeLight);

  // Light 5: Giant Ancient Tree Knoll
  const giantKnollPt = forestSpline.getPointAt(0.96);
  const giantKnollLight = new THREE.PointLight('#f3dfb4', 2.6, 30.0, 1.2);
  giantKnollLight.position.set(
    giantKnollPt.x,
    giantKnollPt.y + 6.2,
    giantKnollPt.z,
  );
  group.add(giantKnollLight);

  // Light 6: Northern Open Woodland (sun-dappled negative space for future gameplay)
  const northW = castleLocalToWorld(82.5, 28.5);
  const northernPlateauLight = new THREE.PointLight('#fed7aa', 2.2, 28.0, 1.2);
  northernPlateauLight.position.set(northW.x, getTerrainHeight(northW.x, northW.z) + 6.0, northW.z);
  group.add(northernPlateauLight);

  // 80 Subtle Floating Woodland Dust Motes in the Filtered Sunbeams
  const dustCount = 80;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustBase: Array<{
    wx: number;
    wy: number;
    wz: number;
    phase: number;
    driftR: number;
  }> = [];

  for (let i = 0; i < dustCount; i++) {
    const u = (i + 0.5) / dustCount;
    forestSpline.getPointAt(u, _pt);
    const ang = rand() * Math.PI * 2;
    const rad = 0.8 + rand() * 5.2;
    const wx = _pt.x + Math.cos(ang) * rad;
    const wz = _pt.z + Math.sin(ang) * rad;
    const wy = getTerrainHeight(wx, wz) + 0.6 + rand() * 3.6;

    dustBase.push({
      wx,
      wy,
      wz,
      phase: rand() * Math.PI * 2,
      driftR: 0.25 + rand() * 0.45,
    });
    dustPositions[i * 3] = wx;
    dustPositions[i * 3 + 1] = wy;
    dustPositions[i * 3 + 2] = wz;
  }

  const dustGeo = tracker.trackGeo(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#fef3c7'),
      size: 0.09,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.name = 'AncientForestSunbeamDustMotes';
  group.add(dustPoints);

  // ============================================================================
  // 4. ATTACH LAYERED FOREST TREE SYSTEM & CLUSTERED FOREST FLOOR SYSTEM
  // ============================================================================
  const treeSystem = createForestTreeSystem();
  group.add(treeSystem.group);
  colliders.push(...treeSystem.colliders);

  const floorSystem = createForestFloorSystem();
  group.add(floorSystem.group);
  colliders.push(...floorSystem.colliders);

  // ============================================================================
  // 5. ATTACH PHASE F3 SYSTEMS: MUSHROOM GROVE, RUINS, STREAM & TREE DETAIL
  // ============================================================================
  const audio = new ForestAudioSynthesizer();

  const mushroomGrove = createMushroomGrove();
  group.add(mushroomGrove.group);
  colliders.push(...mushroomGrove.colliders);

  const ancientRuins = createAncientRuins();
  group.add(ancientRuins.group);
  colliders.push(...ancientRuins.colliders);

  const forestStream = createForestStream();
  group.add(forestStream.group);
  colliders.push(...forestStream.colliders);

  const treeDetail = createGiantAncientTreeDetail();
  group.add(treeDetail.group);
  colliders.push(...treeDetail.colliders);

  // ============================================================================
  // 6. ATTACH PHASE F4 WILDLIFE SYSTEM (Butterflies, Birds, Frogs, Owl, Fireflies)
  // ============================================================================
  const wildlifeSystem = createForestWildlifeSystem();
  group.add(wildlifeSystem.group);

  // ============================================================================
  // 7. ATTACH PHASE F5/F6 HEARTWOOD SANCTUARY, HIDDEN POOL & LAKE REVEAL SYSTEM
  // ============================================================================
  const heartwoodSanctuary = createHeartwoodSanctuarySystem();
  group.add(heartwoodSanctuary.group);
  colliders.push(...heartwoodSanctuary.colliders);

  return {
    group,
    colliders,
    treeSystem,
    floorSystem,
    mushroomGrove,
    ancientRuins,
    forestStream,
    treeDetail,
    wildlifeSystem,
    heartwoodSanctuary,
    audio,
    particleCount:
      dustCount +
      24 +
      20 +
      24 +
      18 +
      wildlifeSystem.particleCount +
      heartwoodSanctuary.particleCount, // Total 334 particles (budget <= 600)
    dynamicLightCount: 9 + heartwoodSanctuary.dynamicLightCount, // Total 10 dynamic PointLights <= 12

    getRunePrompt: (playerWorldPos: THREE.Vector3) => {
      const runePrompt = ancientRuins.getRunePrompt(playerWorldPos);
      if (runePrompt) {
        return { ...runePrompt, id: 'f3_rune_stone' as const };
      }
      const lakePrompt = heartwoodSanctuary.getLakePhotoPrompt(playerWorldPos);
      if (lakePrompt) {
        return { ...lakePrompt, id: 'f5_lake_photo' as const };
      }
      return null;
    },
    triggerRuneStone: (playerWorldPos: THREE.Vector3, elapsedTime: number) =>
      ancientRuins.triggerRuneStone(playerWorldPos, audio, elapsedTime) ||
      heartwoodSanctuary.triggerLakePhoto(playerWorldPos, audio, elapsedTime),
    isDialogueActive: () =>
      ancientRuins.isDialogueActive() ||
      heartwoodSanctuary.isLakePhotoActive(),
    isLakeMemoryActive: () => heartwoodSanctuary.isLakePhotoActive(),
    advanceDialogue: () => {
      if (heartwoodSanctuary.isLakePhotoActive()) {
        return heartwoodSanctuary.advanceLakePhoto();
      }
      return ancientRuins.advanceDialogue();
    },
    skipDialogue: () => {
      if (heartwoodSanctuary.isLakePhotoActive()) {
        audio.setLakeMemoryDucking(0.0);
        return heartwoodSanctuary.skipLakePhoto();
      }
      return ancientRuins.skipDialogue();
    },
    getActiveBanner: () =>
      heartwoodSanctuary.getLakePhotoBanner() ??
      ancientRuins.getActiveBanner(),
    getCameraFocus: () => heartwoodSanctuary.getLakeCameraFocus(),

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
    ): void {
      // 1. Update drifting woodland dust motes in the canopy sunbeams
      const posAttr = dustGeo.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      for (let i = 0; i < dustCount; i++) {
        const b = dustBase[i];
        const a = elapsedTime * 0.38 + b.phase;
        posAttr.setXYZ(
          i,
          b.wx + Math.cos(a) * b.driftR,
          b.wy + Math.sin(elapsedTime * 0.55 + b.phase) * 0.28,
          b.wz + Math.sin(a) * b.driftR,
        );
      }
      posAttr.needsUpdate = true;

      // 2. Subtle shimmer on canopy sun shafts
      sunbeamMat.opacity = 0.38 + Math.sin(elapsedTime * 0.9) * 0.05;

      // 3. Update F2 Tree & Floor systems
      treeSystem.update(elapsedTime);
      floorSystem.update(elapsedTime);

      // 4. Update F3 systems & audio
      mushroomGrove.update(dt, elapsedTime, playerWorldPos, audio);
      ancientRuins.update(dt, elapsedTime, playerWorldPos, audio);
      forestStream.update(dt, elapsedTime, playerWorldPos, audio);
      treeDetail.update(dt, elapsedTime);

      // 5. Update F4 Wildlife System (Butterflies, Birds, Frogs, Owl, Fireflies, Silhouettes)
      wildlifeSystem.update(dt, elapsedTime, playerWorldPos, audio);

      // 6. Update F5/F6 Heartwood Sanctuary, Hidden Pool & Lake Reveal System
      heartwoodSanctuary.update(dt, elapsedTime, playerWorldPos, audio);
    },

    dispose(): void {
      treeSystem.dispose();
      floorSystem.dispose();
      mushroomGrove.dispose();
      ancientRuins.dispose();
      forestStream.dispose();
      treeDetail.dispose();
      wildlifeSystem.dispose();
      heartwoodSanctuary.dispose();
      audio.dispose();
      tracker.dispose();
    },
  };
}
