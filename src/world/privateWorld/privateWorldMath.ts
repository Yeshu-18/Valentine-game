import * as THREE from 'three';

/**
 * PHASE 4.1 & 4.2: PRIVATE ROMANTIC WORLD — GEOGRAPHIC & MATHEMATICAL FOUNDATION
 *
 * Independent local coordinate frame for the Private Romantic World beyond the Special Gate:
 * - Island Footprint: 450m length (X: -225 to +225) × 350m width (Z: -175 to +175)
 * - Origin (0, 0, 0): Approximate island centre
 * - South is negative Z (-Z); North is positive Z (+Z)
 * - Y: Terrain elevation in metres (Sea level = 0.0m)
 */

export type ActiveWorldId = 'HEART_ISLAND' | 'PRIVATE_WORLD';

export const PRIVATE_WORLD_SEED = 20270214;

export const PRIVATE_ISLAND_BOUNDS = {
  lengthX: 450,
  widthZ: 350,
  minX: -225,
  maxX: 225,
  minZ: -175,
  maxZ: 175,
  waterLevel: 0.0,
  minWalkableHeight: 0.24,
} as const;

export interface PrivateWorldAnchor {
  id:
    | 'arrival-shore'
    | 'memory-garden'
    | 'reflective-pond'
    | 'stargazing-deck'
    | 'hidden-cave'
    | 'northern-ridge';
  name: string;
  subtitle: string;
  x: number;
  z: number;
  targetElevation: number;
  elevationRangeLabel: string;
  radius: number;
  blendRadius: number;
  debugColorHex: string;
  defaultFacingYaw: number;
}

/**
 * Locked Location Positions in Private World Local Coordinates (Section 4 & Addendum E).
 */
export const PRIVATE_WORLD_ANCHORS: Readonly<
  Record<
    | 'ARRIVAL_SHORE'
    | 'MEMORY_GARDEN'
    | 'REFLECTIVE_POND'
    | 'STARGAZING_DECK'
    | 'HIDDEN_CAVE_ENTRANCE'
    | 'NORTHERN_RIDGE',
    PrivateWorldAnchor
  >
> = {
  ARRIVAL_SHORE: {
    id: 'arrival-shore',
    name: 'Arrival Shore',
    subtitle: 'Southern Moonlit Beach & Special Gate Threshold',
    x: 0,
    z: -145,
    targetElevation: 1.65,
    elevationRangeLabel: '0 to +3m',
    radius: 16,
    blendRadius: 24,
    debugColorHex: '#fbbf24',
    defaultFacingYaw: 0, // Facing North (+Z) inland toward the island
  },
  MEMORY_GARDEN: {
    id: 'memory-garden',
    name: 'Memory Garden',
    subtitle: 'Secluded Moonlit Clearing & Ancient Specimen Grove',
    x: -35,
    z: -20,
    targetElevation: 7.5,
    elevationRangeLabel: '+4 to +12m',
    radius: 26,
    blendRadius: 28,
    debugColorHex: '#34d399',
    defaultFacingYaw: 0.35,
  },
  REFLECTIVE_POND: {
    id: 'reflective-pond',
    name: 'Reflective Pond',
    subtitle: 'Natural Moonlit Basin & Stepping-Stone Crossing',
    x: -5,
    z: 0,
    targetElevation: 5.0,
    elevationRangeLabel: '+5m',
    radius: 15,
    blendRadius: 18,
    debugColorHex: '#38bdf8',
    defaultFacingYaw: -0.45,
  },
  STARGAZING_DECK: {
    id: 'stargazing-deck',
    name: 'Stargazing Deck',
    subtitle: 'Eastern Elevated Headland Overlook',
    x: 145,
    z: 35,
    targetElevation: 18.0,
    elevationRangeLabel: '+18m',
    radius: 16,
    blendRadius: 34,
    debugColorHex: '#c084fc',
    defaultFacingYaw: Math.PI / 2, // Facing East (+X) toward the open sea
  },
  HIDDEN_CAVE_ENTRANCE: {
    id: 'hidden-cave',
    name: 'Hidden Cave Entrance',
    subtitle: 'Concealed Northern Ridge Opening & Descending Tunnel',
    x: 35,
    z: 110,
    targetElevation: 12.0,
    elevationRangeLabel: '+12m',
    radius: 14,
    blendRadius: 22,
    debugColorHex: '#f472b6',
    defaultFacingYaw: -0.18, // Facing the cave entrance
  },
  NORTHERN_RIDGE: {
    id: 'northern-ridge',
    name: 'Northern Ridge',
    subtitle: 'High Basalt Crag (+25m) Above Reserved Grotto Volume',
    x: 0,
    z: 145,
    targetElevation: 25.0,
    elevationRangeLabel: '+25m',
    radius: 24,
    blendRadius: 42,
    debugColorHex: '#60a5fa',
    defaultFacingYaw: Math.PI,
  },
} as const;

export const PRIVATE_WORLD_ANCHOR_LIST: readonly PrivateWorldAnchor[] = [
  PRIVATE_WORLD_ANCHORS.ARRIVAL_SHORE,
  PRIVATE_WORLD_ANCHORS.MEMORY_GARDEN,
  PRIVATE_WORLD_ANCHORS.REFLECTIVE_POND,
  PRIVATE_WORLD_ANCHORS.STARGAZING_DECK,
  PRIVATE_WORLD_ANCHORS.HIDDEN_CAVE_ENTRANCE,
  PRIVATE_WORLD_ANCHORS.NORTHERN_RIDGE,
];

/**
 * Reserved underground volume beneath the Northern Ridge for the future underground grotto phase.
 */
export const RESERVED_GROTTO_VOLUME = {
  minX: -32,
  maxX: 52,
  minY: 2.0,
  maxY: 14.5,
  minZ: 114,
  maxZ: 158,
  centerX: 10,
  centerY: 8.25,
  centerZ: 136,
} as const;

/**
 * Special Gate Arrival Anchor position at Arrival Shore (Private World local coordinates).
 * Pressing E within `interactRadius` returns the player to Heart Island.
 */
export const PRIVATE_ARRIVAL_GATE_POS = {
  x: 0.0,
  z: -148.5,
  interactRadius: 6.5,
} as const;

export function isNearPrivateReturnGate(x: number, z: number): boolean {
  return (
    Math.hypot(x - PRIVATE_ARRIVAL_GATE_POS.x, z - PRIVATE_ARRIVAL_GATE_POS.z) <=
    PRIVATE_ARRIVAL_GATE_POS.interactRadius
  );
}

/**
 * Deterministic Seeded RNG (mulberry32) isolated for the Private World.
 */
export function createPrivateSeededRng(
  seed: number = PRIVATE_WORLD_SEED,
): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2DPrivate(ix: number, iz: number): number {
  let n =
    Math.imul(ix, 374761393) +
    Math.imul(iz, 668265263) +
    (PRIVATE_WORLD_SEED ^ 0x5bf03635);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function privateNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

  const a = hash2DPrivate(ix, iz);
  const b = hash2DPrivate(ix + 1, iz);
  const c = hash2DPrivate(ix, iz + 1);
  const d = hash2DPrivate(ix + 1, iz + 1);

  const v = a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  return v * 2.0 - 1.0;
}

export function privateFbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * privateNoise2D(x * frequency, z * frequency);
    maxAmp += amplitude;
    frequency *= 2.02;
    amplitude *= 0.5;
  }
  return value / maxAmp;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3.0 - 2.0 * t);
}

/**
 * Organic Reflective Pond Shoreline Signed Distance Function around (-5, 0):
 * - Returns < 0 inside the water surface, 0.0 at the shoreline, > 0 on dry land.
 * - Shapes an asymmetric, natural kidney-and-cove pond silhouette rather than a geometric circle.
 * - Includes a slightly narrower northern neck (around Z = +2.8m) crossed by walkable stepping stones.
 */
export const REFLECTIVE_POND_WATER_LEVEL = 4.74;

export interface PondSteppingStone {
  x: number;
  z: number;
  topY: number;
  radiusX: number;
  radiusZ: number;
  walkRadius: number;
  rotY: number;
}

export const REFLECTIVE_POND_STEPPING_STONES: readonly PondSteppingStone[] = [
  { x: -12.2, z: 2.3, topY: 4.86, radiusX: 0.92, radiusZ: 0.74, walkRadius: 1.15, rotY: 0.22 },
  { x: -10.3, z: 2.65, topY: 4.83, radiusX: 0.88, radiusZ: 0.72, walkRadius: 1.15, rotY: -0.15 },
  { x: -8.35, z: 2.95, topY: 4.82, radiusX: 0.94, radiusZ: 0.76, walkRadius: 1.18, rotY: 0.08 },
  { x: -6.35, z: 3.1, topY: 4.82, radiusX: 0.96, radiusZ: 0.78, walkRadius: 1.18, rotY: -0.12 },
  { x: -4.35, z: 3.05, topY: 4.82, radiusX: 0.92, radiusZ: 0.75, walkRadius: 1.18, rotY: 0.18 },
  { x: -2.4, z: 2.82, topY: 4.83, radiusX: 0.88, radiusZ: 0.72, walkRadius: 1.15, rotY: -0.2 },
  { x: -0.5, z: 2.45, topY: 4.86, radiusX: 0.94, radiusZ: 0.76, walkRadius: 1.15, rotY: 0.12 },
];

export function getReflectivePondShoreRadius(angleRad: number): number {
  // Base radius ~8.6m with multi-harmonic organic lobes and a slight pinch at the northern crossing
  const lobe1 = 1.05 * Math.cos(angleRad * 2.0 - 0.45);
  const lobe2 = 0.72 * Math.sin(angleRad * 3.0 + 0.85);
  const lobe3 = -0.42 * Math.cos(angleRad * 4.0 + 0.3);
  const lobe4 = 0.28 * Math.sin(angleRad * 5.0 - 1.1);
  // Pinch slightly along the northern stepping-stone crossing (angle ~ +0.8..+2.3 rad)
  const northPinch =
    Math.sin(angleRad) > 0.25 ? -0.95 * Math.pow(Math.sin(angleRad), 2) : 0.35;
  return 8.35 + lobe1 + lobe2 + lobe3 + lobe4 + northPinch;
}

export function getReflectivePondSignedDistance(x: number, z: number): number {
  const dx = (x - -5.2) / 1.14;
  const dz = (z - -0.3) / 0.94;
  const dist = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const shoreR =
    getReflectivePondShoreRadius(angle) +
    privateNoise2D(x * 0.22 + 3.1, z * 0.22 - 1.8) * 0.38;
  return dist - shoreR;
}

/**
 * Evaluates an organically shaped (non-circular) blend mask (0..1) for the Memory Garden clearing
 * around (-35, -20) and the connected central tree knoll (-19, +20).
 */
export function getMemoryGardenBlendWeight(x: number, z: number): number {
  const dx = x - -35.0;
  const dz = z - -20.0;
  const angle = Math.atan2(dz, dx);
  const organicRadius =
    25.5 +
    4.2 * Math.cos(angle * 2.0 + 0.6) +
    3.1 * Math.sin(angle * 3.0 - 0.8) +
    1.8 * Math.cos(angle * 5.0 + 1.2) +
    privateNoise2D(x * 0.08, z * 0.08) * 2.6;

  const dMain = Math.hypot(dx, dz);
  const wMain = 1.0 - smoothstep(organicRadius * 0.48, organicRadius, dMain);

  // Connected secondary lobe around the Central Tree Clearing knoll (-19, +20)
  const dxKnoll = x - -19.0;
  const dzKnoll = z - 20.0;
  const angKnoll = Math.atan2(dzKnoll, dxKnoll);
  const knollRadius =
    16.5 +
    2.4 * Math.sin(angKnoll * 2.0 - 0.4) +
    1.6 * Math.cos(angKnoll * 3.0 + 0.9);
  const dKnoll = Math.hypot(dxKnoll, dzKnoll);
  const wKnoll = 1.0 - smoothstep(knollRadius * 0.45, knollRadius, dKnoll);

  return Math.max(wMain, wKnoll * 0.85);
}

/**
 * Evaluates the irregular natural coastline mask for the 450m × 350m Private Romantic World island.
 */
export function getPrivateIslandMask(x: number, z: number): number {
  const nx = x / 202.0;
  const nz = z / 158.0;

  const angle = Math.atan2(nz, nx);
  const harmonicLobes =
    0.08 * Math.cos(angle * 2.0 - 0.35) +
    0.065 * Math.sin(angle * 3.0 + 0.8) -
    0.045 * Math.cos(angle * 5.0 - 1.1);

  const baseDist = Math.hypot(nx, nz) - harmonicLobes;

  const coastalNoise =
    privateFbm2D(x * 0.016 + 3.7, z * 0.016 - 5.2, 4) * 0.14 +
    privateNoise2D(x * 0.048 - 1.9, z * 0.048 + 2.4) * 0.045;

  const shoreArrivalBoost =
    0.26 * (1.0 - smoothstep(12.0, 46.0, Math.hypot(x - 0, z - -142)));
  const easternHeadlandBoost =
    0.34 *
    (1.0 - smoothstep(18.0, 62.0, Math.hypot((x - 140) * 0.85, z - 35)));
  const northernRidgeBoost =
    0.28 *
    (1.0 - smoothstep(20.0, 64.0, Math.hypot((x - 10) * 0.8, z - 138)));
  const westernGardenBoost =
    0.18 * (1.0 - smoothstep(25.0, 75.0, Math.hypot(x - -55, z - -15)));

  const swCoveCarve =
    0.14 * (1.0 - smoothstep(10.0, 48.0, Math.hypot(x - -125, z - -105)));
  const nwCoveCarve =
    0.12 * (1.0 - smoothstep(12.0, 46.0, Math.hypot(x - -130, z - 108)));

  const outerBoundX = smoothstep(208.0, 224.0, Math.abs(x));
  const outerBoundZ = smoothstep(162.0, 174.0, Math.abs(z));
  const boundaryPenalty = (outerBoundX + outerBoundZ) * 0.65;

  return (
    1.0 -
    baseDist -
    coastalNoise +
    shoreArrivalBoost +
    easternHeadlandBoost +
    northernRidgeBoost +
    westernGardenBoost -
    swCoveCarve -
    nwCoveCarve -
    boundaryPenalty
  );
}

/**
 * Reusable Curved Path System (Section 6):
 * 1. PRIMARY_ROUTE: Arrival Shore (0, -145) -> Memory Garden (-35, -20) -> Hidden Cave Entrance (+35, +110)
 * 2. EASTERN_BRANCH: Memory Garden (-35, -20) -> Stargazing Deck (+145, +35)
 * 3. GARDEN_LOOP: Reflective Pond (-5, 0) -> Central Tree Clearing (-19, +20) -> Reconnects to Primary Route
 */
export interface PathSamplePoint {
  x: number;
  z: number;
  targetElevation: number;
}

export interface PrivatePathRoute {
  id: 'primary-route' | 'eastern-branch' | 'garden-loop';
  name: string;
  halfWidth: number;
  blendWidth: number;
  debugColorHex: string;
  samples: readonly PathSamplePoint[];
}

function buildSmoothPathSamples(
  controlPoints: ReadonlyArray<{ x: number; z: number; elev: number }>,
  subdivisions: number,
  closed = false,
): PathSamplePoint[] {
  const vecs = controlPoints.map((p) => new THREE.Vector3(p.x, p.elev, p.z));
  const curve = new THREE.CatmullRomCurve3(vecs, closed, 'centripetal', 0.5);
  const pts = curve.getPoints(subdivisions);
  return pts.map((pt) => ({
    x: pt.x,
    z: pt.z,
    targetElevation: pt.y,
  }));
}

export const PRIVATE_PATH_ROUTES: readonly PrivatePathRoute[] = [
  {
    id: 'primary-route',
    name: 'Primary Route (Arrival Shore → Memory Garden → Hidden Cave)',
    halfWidth: 2.3,
    blendWidth: 7.5,
    debugColorHex: '#fbbf24',
    samples: buildSmoothPathSamples(
      [
        { x: 0, z: -145, elev: 1.65 }, // Arrival Shore stone path start
        { x: -4, z: -118, elev: 3.1 }, // Gentle ascent above southern beach dunes
        { x: -16, z: -82, elev: 4.9 }, // Southern botanical approach
        { x: -29, z: -48, elev: 6.4 }, // Lower garden meadow bend
        { x: -35, z: -20, elev: 7.5 }, // Memory Garden clearing anchor
        { x: -30, z: 12, elev: 8.2 }, // North-west garden terrace
        { x: -14, z: 42, elev: 9.1 }, // Central-north junction
        { x: 8, z: 68, elev: 10.3 }, // Northern foothill trail
        { x: 24, z: 90, elev: 11.3 }, // Winding rocky approach
        { x: 35, z: 110, elev: 12.0 }, // Hidden Cave Entrance forecourt
      ],
      96,
      false,
    ),
  },
  {
    id: 'eastern-branch',
    name: 'Eastern Branch (Memory Garden → Stargazing Deck)',
    halfWidth: 2.0,
    blendWidth: 7.0,
    debugColorHex: '#c084fc',
    samples: buildSmoothPathSamples(
      [
        { x: -35, z: -20, elev: 7.5 }, // Starts at Memory Garden
        { x: -16, z: -18, elev: 6.4 }, // Passes south of Reflective Pond
        { x: 12, z: -12, elev: 6.8 }, // Eastern garden meadow
        { x: 44, z: -2, elev: 9.2 }, // Lower eastern hillside
        { x: 78, z: 10, elev: 12.4 }, // Mid-slope ocean vista rise
        { x: 112, z: 24, elev: 15.6 }, // Upper cliff ridge trail
        { x: 145, z: 35, elev: 18.0 }, // Stargazing Deck platform
      ],
      72,
      false,
    ),
  },
  {
    id: 'garden-loop',
    name: 'Garden Loop (Reflective Pond → Central Tree Clearing → Primary Route)',
    halfWidth: 1.85,
    blendWidth: 6.0,
    debugColorHex: '#38bdf8',
    samples: buildSmoothPathSamples(
      [
        { x: -35, z: -20, elev: 7.5 }, // Connects at Memory Garden
        { x: -18, z: -12, elev: 5.9 }, // West-south pond approach
        { x: -5, z: -11, elev: 5.15 }, // Southern rim of Reflective Pond (-5, 0)
        { x: 7, z: 0, elev: 5.15 }, // Eastern rim of Reflective Pond
        { x: -4, z: 12, elev: 5.3 }, // Northern rim of Reflective Pond
        { x: -19, z: 20, elev: 7.4 }, // Central Tree Clearing knoll
        { x: -30, z: 12, elev: 8.2 }, // Reconnects smoothly to Primary Route
      ],
      64,
      false,
    ),
  },
];

export interface PrivatePathEvaluation {
  weight: number; // 0..1 surface path visual weight
  elevBlendWeight: number; // 0..1 terrain height grading weight
  minDist: number;
  targetElevation: number;
  closestRouteId: 'primary-route' | 'eastern-branch' | 'garden-loop' | null;
}

export function evaluatePrivatePathNetwork(
  x: number,
  z: number,
): PrivatePathEvaluation {
  // Fast bounding-box reject outside path corridor bounds
  if (x < -55 || x > 160 || z < -158 || z > 125) {
    return {
      weight: 0,
      elevBlendWeight: 0,
      minDist: Infinity,
      targetElevation: 0,
      closestRouteId: null,
    };
  }

  let bestDist = Infinity;
  let bestElev = 0;
  let bestHalfW = 2.0;
  let bestBlendW = 7.0;
  let bestRouteId: 'primary-route' | 'eastern-branch' | 'garden-loop' | null =
    null;

  for (let r = 0; r < PRIVATE_PATH_ROUTES.length; r++) {
    const route = PRIVATE_PATH_ROUTES[r];
    const pts = route.samples;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lenSq = abx * abx + abz * abz;
      if (lenSq < 0.0001) continue;
      const t = THREE.MathUtils.clamp(
        ((x - a.x) * abx + (z - a.z) * abz) / lenSq,
        0,
        1,
      );
      const px = a.x + t * abx;
      const pz = a.z + t * abz;
      const d = Math.hypot(x - px, z - pz);
      if (d < bestDist) {
        bestDist = d;
        bestElev = THREE.MathUtils.lerp(
          a.targetElevation,
          b.targetElevation,
          t,
        );
        bestHalfW = route.halfWidth;
        bestBlendW = route.blendWidth;
        bestRouteId = route.id;
      }
    }
  }

  if (bestDist > bestBlendW) {
    return {
      weight: 0,
      elevBlendWeight: 0,
      minDist: bestDist,
      targetElevation: bestElev,
      closestRouteId: bestRouteId,
    };
  }

  const weight = 1.0 - smoothstep(bestHalfW * 0.75, bestHalfW * 1.45, bestDist);
  const elevBlendWeight = 1.0 - smoothstep(bestHalfW, bestBlendW, bestDist);

  return {
    weight,
    elevBlendWeight,
    minDist: bestDist,
    targetElevation: bestElev,
    closestRouteId: bestRouteId,
  };
}

/**
 * Deterministic terrain elevation function `getPrivateTerrainHeight(x, z)` in Private World local coordinates.
 * Guarantees smooth elevation transitions across all 6 locked anchors, the organic Reflective Pond basin, and paths.
 */
export function getPrivateTerrainHeight(x: number, z: number): number {
  const mask = getPrivateIslandMask(x, z);

  if (mask < -0.26) {
    return -6.0;
  }

  const seabedFactor = smoothstep(-0.26, 0.0, mask);
  if (mask <= 0.0) {
    return THREE.MathUtils.lerp(-6.0, 0.0, seabedFactor);
  }

  const landFactor = smoothstep(0.0, 0.22, mask);

  // 1. Base rolling topography: gentle southern beach rising northward toward the +25m Northern Ridge
  const northGradient = smoothstep(-150.0, 145.0, z) * 9.5;
  const eastHighlandRise =
    smoothstep(25.0, 145.0, x) *
    (1.0 - smoothstep(170.0, 215.0, x)) *
    smoothstep(-75.0, 25.0, z) *
    (1.0 - smoothstep(95.0, 150.0, z)) *
    9.2;

  const macroHills =
    (privateFbm2D(x * 0.012 + 2.1, z * 0.012 - 1.7, 4) * 0.5 + 0.5) * 6.4;
  const microUndulation = privateNoise2D(x * 0.045, z * 0.045) * 0.48;

  let height =
    (1.4 + northGradient + eastHighlandRise + macroHills + microUndulation) *
    landFactor;

  // 2. Sculpt the Northern Rocky Ridge mass (crowning at +25m around (0, +145))
  //    Also ensures a solid >= +16.5m..+25.5m geological overburden above RESERVED_GROTTO_VOLUME (maxY = 14.5m)
  const ridgeEllipDist = Math.hypot((x - 8.0) / 1.55, (z - 140.0) / 0.88);
  if (ridgeEllipDist < 74.0) {
    const ridgeWeight = 1.0 - smoothstep(16.0, 74.0, ridgeEllipDist);
    const cragDetail =
      privateFbm2D(x * 0.045 + 5.1, z * 0.045 - 3.3, 3) * 1.85;
    height = THREE.MathUtils.lerp(
      height,
      PRIVATE_WORLD_ANCHORS.NORTHERN_RIDGE.targetElevation + cragDetail,
      ridgeWeight,
    );
  }

  // 3. Blend all 6 Locked Location Anchors smoothly into the terrain
  for (let i = 0; i < PRIVATE_WORLD_ANCHOR_LIST.length; i++) {
    const anchor = PRIVATE_WORLD_ANCHOR_LIST[i];
    const d = Math.hypot(x - anchor.x, z - anchor.z);
    const totalR = anchor.radius + anchor.blendRadius;
    if (d < totalR) {
      let w = 1.0 - smoothstep(anchor.radius * 0.55, totalR, d);
      // For Hidden Cave Entrance (35, 110), flatten the southern approach forecourt (z <= 112),
      // while allowing the mountain brow north of the arch (z > 113) to rise over the grotto ceiling.
      if (anchor.id === 'hidden-cave' && z > 111.5) {
        w *= 1.0 - smoothstep(111.5, 117.5, z);
      }
      const subtleDetail =
        anchor.id === 'arrival-shore' ||
        anchor.id === 'stargazing-deck' ||
        anchor.id === 'hidden-cave'
          ? 0.0
          : privateNoise2D(x * 0.035, z * 0.035) * 0.24 * (1.0 - w * 0.65);
      height = THREE.MathUtils.lerp(
        height,
        anchor.targetElevation + subtleDetail,
        w,
      );
    }
  }

  // 4. Carve the organic Reflective Pond basin around (-5, 0):
  //    Shoreline sits at ~4.80m..5.05m; inner pond bed dips smoothly to ~3.72m beneath the +4.74m water surface
  const pondSignedDist = getReflectivePondSignedDistance(x, z);
  if (pondSignedDist < 3.2) {
    const basinDip = 1.0 - smoothstep(-4.8, 2.2, pondSignedDist);
    // Slightly shallower along the northern stepping-stone crossing (Z ~ +2.2..+3.8)
    const isCrossingBand =
      z > 1.4 && z < 4.4 && x > -13.0 && x < 0.5 ? 0.32 : 0.0;
    height -= basinDip * (1.28 - isCrossingBand);
  }

  // 5. Grade the Connected Curved Path Network smoothly into the terrain
  const pathEval = evaluatePrivatePathNetwork(x, z);
  if (pathEval.elevBlendWeight > 0.001) {
    // Do not overwrite the inner Reflective Pond water basin
    const pondGuard = smoothstep(-0.4, 2.8, pondSignedDist);
    height = THREE.MathUtils.lerp(
      height,
      pathEval.targetElevation,
      pathEval.elevBlendWeight * 0.88 * pondGuard,
    );
  }

  // 6. Natural Highland Ridge Saddle connecting Hidden Cave approach (26, 98) to Northern Ridge Lookout (0, 143, +25m)
  if (x >= -18.0 && x <= 34.0 && z >= 92.0 && z <= 149.0) {
    const tRidge = THREE.MathUtils.clamp((z - 96.0) / 47.0, 0, 1);
    const saddleCenterX = THREE.MathUtils.lerp(26.0, 0.0, tRidge);
    const saddleTargetY = THREE.MathUtils.lerp(
      11.8,
      25.0,
      smoothstep(0.0, 1.0, tRidge),
    );
    const distFromSaddle = Math.abs(x - saddleCenterX);
    if (distFromSaddle < 12.0) {
      const saddleW =
        (1.0 - smoothstep(3.5, 12.0, distFromSaddle)) *
        smoothstep(92.0, 102.0, z) *
        (1.0 - smoothstep(144.0, 149.0, z));
      height = THREE.MathUtils.lerp(height, saddleTargetY, saddleW * 0.72);
    }
  }

  // 6b. Protective Overburden Guarantee above RESERVED_GROTTO_VOLUME (X: -32..52, Z: 115..158)
  //     Ensures surface terrain stays >= +16.4m above the maxY = 14.5m grotto ceiling everywhere outside the cave mouth
  if (
    x >= RESERVED_GROTTO_VOLUME.minX - 4.0 &&
    x <= RESERVED_GROTTO_VOLUME.maxX + 4.0 &&
    z >= 114.5 &&
    z <= RESERVED_GROTTO_VOLUME.maxZ + 3.0
  ) {
    const inCaveEntranceThroat =
      z < 118.0 && Math.abs(x - 34.5) < 5.2
        ? 1.0 - smoothstep(112.5, 118.0, z)
        : 0.0;
    const overburdenMask =
      smoothstep(RESERVED_GROTTO_VOLUME.minX - 4.0, RESERVED_GROTTO_VOLUME.minX + 3.0, x) *
      (1.0 - smoothstep(RESERVED_GROTTO_VOLUME.maxX - 3.0, RESERVED_GROTTO_VOLUME.maxX + 4.0, x)) *
      smoothstep(114.5, 120.5, z) *
      (1.0 - smoothstep(RESERVED_GROTTO_VOLUME.maxZ - 2.0, RESERVED_GROTTO_VOLUME.maxZ + 3.0, z)) *
      (1.0 - inCaveEntranceThroat);
    const minSurfaceY =
      16.8 +
      smoothstep(116.0, 142.0, z) * 3.8 +
      privateNoise2D(x * 0.06, z * 0.06) * 0.65;
    if (height < minSurfaceY && overburdenMask > 0.001) {
      height = THREE.MathUtils.lerp(height, minSurfaceY, overburdenMask);
    }
  }

  // 7. Carve the Outer Hidden Cave Threshold Channel (Z: 109.2 -> 116.5) so the player walks smoothly under the arch
  if (z >= 109.2 && z <= 117.2 && x >= 28.0 && x <= 40.5) {
    const tunnelT = THREE.MathUtils.clamp((z - 110.0) / 16.5, 0, 1);
    const tunnelCenterX = 35.0 - smoothstep(0.0, 1.0, tunnelT) * 8.0;
    const lateralDist = Math.abs(x - tunnelCenterX);
    if (lateralDist < 4.2) {
      const channelW =
        (1.0 - smoothstep(2.0, 4.2, lateralDist)) *
        smoothstep(109.2, 110.6, z) *
        (1.0 - smoothstep(114.8, 117.2, z));
      const targetFloorY = THREE.MathUtils.lerp(
        12.0,
        3.95,
        smoothstep(0.0, 1.0, tunnelT),
      );
      height = THREE.MathUtils.lerp(height, targetFloorY, channelW);
    }
  }

  // 8. Gentle shoreline beach taper so the southern beach (0, -145) meets the sea at 0.0m naturally
  const shoreTaper = smoothstep(0.0, 0.085, mask);
  return height * shoreTaper;
}

const _privateNormal = new THREE.Vector3();

export function getPrivateTerrainNormal(
  x: number,
  z: number,
  target: THREE.Vector3 = _privateNormal,
): THREE.Vector3 {
  const eps = 0.5;
  const hL = getPrivateTerrainHeight(x - eps, z);
  const hR = getPrivateTerrainHeight(x + eps, z);
  const hD = getPrivateTerrainHeight(x, z - eps);
  const hU = getPrivateTerrainHeight(x, z + eps);

  target.set(hL - hR, 2.0 * eps, hD - hU).normalize();
  return target;
}

/**
 * Checks whether (x, z) is on one of the walkable stepping stones crossing the Reflective Pond.
 */
export function getPondSteppingStoneHeightAt(
  x: number,
  z: number,
): number | null {
  for (let i = 0; i < REFLECTIVE_POND_STEPPING_STONES.length; i++) {
    const st = REFLECTIVE_POND_STEPPING_STONES[i];
    const d = Math.hypot(x - st.x, z - st.z);
    if (d <= st.walkRadius) {
      return st.topY;
    }
  }
  return null;
}

/**
 * Returns the 0-based index of the Reflective Pond stepping stone at (x, z), or -1 if not on a stone.
 */
export function getPondSteppingStoneIndexAt(x: number, z: number): number {
  for (let i = 0; i < REFLECTIVE_POND_STEPPING_STONES.length; i++) {
    const st = REFLECTIVE_POND_STEPPING_STONES[i];
    if (Math.hypot(x - st.x, z - st.z) <= st.walkRadius) {
      return i;
    }
  }
  return -1;
}

// ============================================================================
// PHASE 4.4: THE HIDDEN GROTTO — SPATIAL LAYOUT & UNDERGROUND NAVIGATION MATH
// All coordinates strictly inside RESERVED_GROTTO_VOLUME:
//   X: [-32, +52], Z: [114, 158], Y: [2.0, 14.5]
// ============================================================================

export const GROTTO_LAKE_WATER_LEVEL = 3.15;
export const GROTTO_LAKE_BED_ELEVATION = 2.15;

export const GROTTO_CENTRAL_ISLAND = {
  x: 6.0,
  z: 137.5,
  radius: 6.8,
  flatRadius: 4.5,
  topY: 3.85,
  rimY: 3.42,
} as const;

export const GROTTO_WATERFALL_CHAMBER = {
  x: -16.5,
  z: 150.5,
  ledgeY: 11.8,
  poolY: GROTTO_LAKE_WATER_LEVEL,
  width: 5.2,
} as const;

export const GROTTO_BIOLUM_GARDEN = {
  x: -11.5,
  z: 126.5,
  radiusX: 13.5,
  radiusZ: 6.8,
  baseY: 3.78,
} as const;

export const GROTTO_SECONDARY_VIEWPOINT = {
  x: 17.5,
  z: 148.2,
  radiusX: 6.2,
  radiusZ: 4.4,
  topY: 5.65,
} as const;

export const GROTTO_STONE_BRIDGE = {
  startX: 27.5,
  startZ: 129.0,
  startY: 3.95,
  endX: 19.5,
  endZ: 146.5,
  endY: 5.65,
  archCrownBoost: 1.18,
  halfWidth: 1.85,
} as const;

export interface GrottoSteppingStoneSpec {
  x: number;
  z: number;
  topY: number;
  walkRadius: number;
  scaleX: number;
  scaleZ: number;
  rotY: number;
}

/**
 * Six wide, walkable natural basalt stepping stones leading from the southern cavern shore
 * (18.8, 126.8) across the Underground Lake onto the Central Discovery Island (8.5, 132.2).
 */
export const GROTTO_ISLAND_STEPPING_STONES: readonly GrottoSteppingStoneSpec[] = [
  { x: 18.2, z: 127.4, topY: 3.58, walkRadius: 1.55, scaleX: 1.42, scaleZ: 1.24, rotY: 0.35 },
  { x: 16.3, z: 128.4, topY: 3.42, walkRadius: 1.52, scaleX: 1.36, scaleZ: 1.18, rotY: -0.22 },
  { x: 14.4, z: 129.3, topY: 3.36, walkRadius: 1.52, scaleX: 1.38, scaleZ: 1.22, rotY: 0.48 },
  { x: 12.5, z: 130.2, topY: 3.38, walkRadius: 1.52, scaleX: 1.34, scaleZ: 1.2, rotY: -0.41 },
  { x: 10.7, z: 131.1, topY: 3.46, walkRadius: 1.52, scaleX: 1.38, scaleZ: 1.22, rotY: 0.19 },
  { x: 9.0, z: 132.1, topY: 3.62, walkRadius: 1.58, scaleX: 1.46, scaleZ: 1.28, rotY: -0.28 },
];

/**
 * Evaluates the centerline and floor height of the Descending Entrance Tunnel
 * connecting the Hidden Cave Entrance (35.0, 110.0, Y = 12.0m) down into the
 * southeastern Main Cavern threshold (27.0, 126.5, Y = 3.95m).
 */
export function getHiddenCaveTunnelFloorHeightAt(
  x: number,
  z: number,
): number | null {
  if (z < 109.5 || z > 126.8) return null;
  const tunnelT = THREE.MathUtils.clamp((z - 110.0) / 16.5, 0, 1);
  const smoothT = smoothstep(0.0, 1.0, tunnelT);
  const tunnelCenterX = 35.0 - smoothT * 8.0;
  // Tunnel gradually widens from 2.15m half-width to 4.1m as it opens into the cavern
  const maxHalfWidth = THREE.MathUtils.lerp(2.15, 4.1, smoothstep(0.6, 1.0, tunnelT));
  const lateralDist = Math.abs(x - tunnelCenterX);
  if (lateralDist > maxHalfWidth) return null;

  const stepRipple = Math.sin((z - 110.0) * 2.1) * 0.03 * (1.0 - tunnelT * 0.5);
  return THREE.MathUtils.lerp(12.0, 3.95, smoothT) + stepRipple;
}

/**
 * Evaluates the Natural Stone Bridge spanning the eastern arm of the Underground Lake
 * from (27.5, 129.0, Y = 3.95m) to the Secondary Rock Viewpoint at (19.5, 146.5, Y = 5.65m).
 */
export function getGrottoStoneBridgeHeightAt(
  x: number,
  z: number,
): number | null {
  if (z < 128.0 || z > 147.5 || x < 16.5 || x > 31.5) return null;
  const t = THREE.MathUtils.clamp(
    (z - GROTTO_STONE_BRIDGE.startZ) /
      (GROTTO_STONE_BRIDGE.endZ - GROTTO_STONE_BRIDGE.startZ),
    0,
    1,
  );
  const archCurveX =
    THREE.MathUtils.lerp(GROTTO_STONE_BRIDGE.startX, GROTTO_STONE_BRIDGE.endX, t) +
    Math.sin(t * Math.PI) * 1.45;
  const lateralDist = Math.abs(x - archCurveX);
  if (lateralDist > GROTTO_STONE_BRIDGE.halfWidth) return null;

  const baseRampY = THREE.MathUtils.lerp(
    GROTTO_STONE_BRIDGE.startY,
    GROTTO_STONE_BRIDGE.endY,
    smoothstep(0.0, 1.0, t),
  );
  const archBump = Math.sin(t * Math.PI) * GROTTO_STONE_BRIDGE.archCrownBoost;
  const stoneMicro = Math.sin(z * 1.8 + x * 1.2) * 0.025;
  return baseRampY + archBump + stoneMicro;
}

/**
 * Evaluates whether (x, z) is on one of the 6 stepping stones leading to the Central Discovery Island.
 */
export function getGrottoSteppingStoneHeightAt(
  x: number,
  z: number,
): number | null {
  for (let i = 0; i < GROTTO_ISLAND_STEPPING_STONES.length; i++) {
    const st = GROTTO_ISLAND_STEPPING_STONES[i];
    if (Math.hypot(x - st.x, z - st.z) <= st.walkRadius) {
      return st.topY;
    }
  }
  return null;
}

/**
 * Signed distance function for the Underground Lake water body (Y = 3.15m):
 * Returns < 0 inside the water basin, > 0 on the surrounding cavern shore shelves.
 */
export function getGrottoLakeSignedDistance(x: number, z: number): number {
  const cx = 4.5;
  const cz = 139.2;
  const dx = (x - cx) / 26.5;
  const dz = (z - cz) / 11.8;
  const angle = Math.atan2(dz, dx);
  const organicLobe =
    1.0 +
    0.12 * Math.sin(angle * 2.0 + 0.4) +
    0.08 * Math.cos(angle * 3.0 - 0.9) +
    0.05 * Math.sin(angle * 5.0 + 1.1);
  return (Math.hypot(dx, dz) - organicLobe) * 14.5;
}

/**
 * Returns the exact walkable floor elevation inside the Underground Grotto (or null if over deep water / solid wall).
 */
export function getGrottoWalkableGroundHeightAt(
  x: number,
  z: number,
): number | null {
  // 1. Descending Entrance Tunnel (Z: 109.5 -> 126.8)
  const tunnelH = getHiddenCaveTunnelFloorHeightAt(x, z);
  if (tunnelH !== null && z <= 125.2) {
    return tunnelH;
  }

  // Must lie inside the cavern horizontal envelope within RESERVED_GROTTO_VOLUME
  if (
    x < RESERVED_GROTTO_VOLUME.minX + 2.5 ||
    x > RESERVED_GROTTO_VOLUME.maxX - 2.5 ||
    z < 118.5 ||
    z > RESERVED_GROTTO_VOLUME.maxZ - 3.5
  ) {
    return tunnelH;
  }

  // 2. Natural Stone Bridge spanning the eastern lake arm (overrides lake water underneath!)
  const bridgeH = getGrottoStoneBridgeHeightAt(x, z);
  if (bridgeH !== null) {
    return bridgeH;
  }

  // 3. Central Discovery Island (center (6.0, 137.5), radius 6.8m)
  const distIsland = Math.hypot(
    x - GROTTO_CENTRAL_ISLAND.x,
    z - GROTTO_CENTRAL_ISLAND.z,
  );
  if (distIsland <= GROTTO_CENTRAL_ISLAND.radius) {
    const rimT = smoothstep(
      GROTTO_CENTRAL_ISLAND.flatRadius,
      GROTTO_CENTRAL_ISLAND.radius,
      distIsland,
    );
    return THREE.MathUtils.lerp(
      GROTTO_CENTRAL_ISLAND.topY,
      GROTTO_CENTRAL_ISLAND.rimY,
      rimT,
    );
  }

  // 4. Stepping-Stone Approach from Southern Shore to Central Discovery Island
  const stepStoneH = getGrottoSteppingStoneHeightAt(x, z);
  if (stepStoneH !== null) {
    return stepStoneH;
  }

  // 5. Secondary Rock Viewpoint Ledge on the Northeastern Cavern Wall (X: 10.5..24.0, Z: 145.0..153.5)
  const vpDx = (x - GROTTO_SECONDARY_VIEWPOINT.x) / GROTTO_SECONDARY_VIEWPOINT.radiusX;
  const vpDz = (z - GROTTO_SECONDARY_VIEWPOINT.z) / GROTTO_SECONDARY_VIEWPOINT.radiusZ;
  if (Math.hypot(vpDx, vpDz) <= 1.05) {
    const ripple = privateNoise2D(x * 0.18, z * 0.18) * 0.08;
    return GROTTO_SECONDARY_VIEWPOINT.topY + ripple;
  }

  // 6. Southern Arrival Shore, Eastern Bridge Abutment & Southwestern Bioluminescent Garden Terraces
  const lakeDist = getGrottoLakeSignedDistance(x, z);
  // Prevent walking into the deep Underground Lake water (lakeDist < -0.25)
  if (lakeDist < -0.25) {
    return null;
  }

  // Walkable Southern & Southwestern Shore Belt (Z: 119.5..135.5, X: -26.5..+33.5)
  if (z >= 119.5 && z <= 135.5 && x >= -26.5 && x <= 33.5) {
    // Blend smoothly from tunnel exit (27, 126, Y = 3.95m) across the southern shore and Bioluminescent Garden
    const gardenSlope = smoothstep(130.0, 121.0, z) * 0.42;
    const westTerrace = smoothstep(0.0, -22.0, x) * 0.35;
    const micro = privateNoise2D(x * 0.14, z * 0.14) * 0.06;
    const shoreY = 3.68 + gardenSlope + westTerrace + micro;
    if (tunnelH !== null) {
      const blendT = smoothstep(123.5, 126.5, z);
      return THREE.MathUtils.lerp(tunnelH, shoreY, blendT);
    }
    return shoreY;
  }

  return tunnelH;
}

/**
 * Returns the vaulted cavern ceiling height at (x, z) inside the Hidden Grotto
 * so the third-person camera stays cleanly inside the cavern below the rock roof.
 */
export function getGrottoCeilingHeightAt(x: number, z: number): number {
  if (z < 123.5) {
    const tunnelFloor = getHiddenCaveTunnelFloorHeightAt(x, z) ?? 9.0;
    return tunnelFloor + 3.95;
  }
  const dx = (x - RESERVED_GROTTO_VOLUME.centerX) / 40.0;
  const dz = (z - RESERVED_GROTTO_VOLUME.centerZ) / 21.0;
  const dome = Math.max(0.0, 1.0 - (dx * dx + dz * dz) * 0.38);
  return 11.2 + dome * 2.85; // ~11.2m at walls up to ~14.05m at central vault (<= 14.5m maxY)
}

/**
 * Determines whether a player at (x, z, currentY) is currently in the underground tunnel or Hidden Grotto
 * rather than on the outdoor Northern Ridge surface above (+17m..+25m).
 */
export function isPositionInUndergroundGrotto(
  x: number,
  z: number,
  currentY?: number,
): boolean {
  if (z < 109.6) return false;
  if (currentY !== undefined) {
    if (currentY < 13.6 && z >= 110.2) {
      return true;
    }
    return false;
  }
  return getHiddenCaveTunnelFloorHeightAt(x, z) !== null && z <= 116.5;
}

/**
 * Checks whether (x, z) in Private World local coordinates is walkable by the player:
 * - Supports both outdoor surface exploration and underground Hidden Grotto exploration (when currentY < 13.6m).
 */
export function isPrivateWalkablePosition(
  x: number,
  z: number,
  currentY?: number,
): boolean {
  if (
    x < PRIVATE_ISLAND_BOUNDS.minX ||
    x > PRIVATE_ISLAND_BOUNDS.maxX ||
    z < PRIVATE_ISLAND_BOUNDS.minZ ||
    z > PRIVATE_ISLAND_BOUNDS.maxZ
  ) {
    return false;
  }

  // If the player is underground inside the Hidden Cave tunnel or Hidden Grotto (currentY < 13.6m),
  // validate strictly against the underground grotto walkable surfaces (tunnel, shore, garden, bridge, stepping stones, island, viewpoint).
  if (isPositionInUndergroundGrotto(x, z, currentY)) {
    return getGrottoWalkableGroundHeightAt(x, z) !== null;
  }

  // Allow entering the Hidden Cave tunnel from the outdoor forecourt (Z: 109.6..115.0)
  if (z >= 109.6 && z <= 115.0 && getHiddenCaveTunnelFloorHeightAt(x, z) !== null) {
    return true;
  }

  // Prevent walking past the sheer Northern Ridge sea-cliff brink on the outdoor surface
  if (z > 150.2) {
    return false;
  }

  // Allow walking out onto the Southern Arrival Pier (x: -2.0..+2.0, z: -161..-143)
  if (Math.abs(x) <= 2.0 && z >= -161.0 && z <= -142.0) {
    return true;
  }

  // Allow walking across the Reflective Pond stepping stones
  if (getPondSteppingStoneHeightAt(x, z) !== null) {
    return true;
  }

  // Prevent walking into the deep Reflective Pond water interior
  const pondSignedDist = getReflectivePondSignedDistance(x, z);
  if (pondSignedDist < -0.45) {
    return false;
  }

  const h = getPrivateTerrainHeight(x, z);
  if (h < PRIVATE_ISLAND_BOUNDS.minWalkableHeight) {
    return false;
  }

  // Always walkable on the 3 connected paths
  const pathEval = evaluatePrivatePathNetwork(x, z);
  if (pathEval.minDist <= 3.8) {
    return true;
  }

  // Always walkable on the Stargazing Deck, Arrival Shore, Memory Garden, Hidden Cave forecourt, and Northern Ridge Lookout
  if (
    Math.hypot(x - 145, z - 35) <= 14.5 ||
    Math.hypot(x - 0, z - -145) <= 15.0 ||
    Math.hypot(x - -35, z - -20) <= 24.0 ||
    Math.hypot(x - 35, z - 110) <= 11.5 ||
    Math.hypot(x - 0, z - 143) <= 12.5
  ) {
    return true;
  }

  // Walkable along the highland saddle trail between Hidden Cave forecourt (26, 98) and Northern Ridge Lookout (0, 143)
  if (z >= 94.0 && z <= 146.0) {
    const tRidge = THREE.MathUtils.clamp((z - 96.0) / 47.0, 0, 1);
    const saddleCenterX = THREE.MathUtils.lerp(26.0, 0.0, tRidge);
    if (Math.abs(x - saddleCenterX) <= 6.5) {
      return true;
    }
  }

  const normal = getPrivateTerrainNormal(x, z);
  return normal.y >= 0.52;
}

/**
 * Returns the floor height for the player at (x, z), accounting for the underground Hidden Grotto
 * (when currentY < 13.6m), the wooden Arrival Pier, the Reflective Pond stepping stones,
 * the Stargazing Deck platform & steps, and the Hidden Cave descending tunnel.
 */
export function getPrivatePlayerGroundHeight(
  x: number,
  z: number,
  currentY?: number,
): number {
  // 1. If player is inside the underground Hidden Grotto or descending tunnel
  if (isPositionInUndergroundGrotto(x, z, currentY)) {
    const grottoH = getGrottoWalkableGroundHeightAt(x, z);
    if (grottoH !== null) {
      return grottoH;
    }
  }

  // 2. Outer Hidden Cave tunnel mouth threshold (Z: 109.6 -> 115.5)
  if (z >= 109.6 && z <= 115.5) {
    const caveTunnelFloor = getHiddenCaveTunnelFloorHeightAt(x, z);
    if (caveTunnelFloor !== null && (currentY === undefined || currentY < 14.2)) {
      return caveTunnelFloor;
    }
  }

  const terrainH = getPrivateTerrainHeight(x, z);

  // 3. Wooden pier deck at Arrival Shore (x: -2.1..+2.1, z: -161.5..-144.0) sits at Y = 1.65m
  if (Math.abs(x) <= 2.1 && z >= -161.5 && z <= -144.0) {
    return Math.max(terrainH, 1.65);
  }

  // 4. Walkable stepping stones crossing the northern end of the Reflective Pond
  const stoneH = getPondSteppingStoneHeightAt(x, z);
  if (stoneH !== null) {
    return Math.max(terrainH, stoneH);
  }

  // 5. Stargazing Deck western stone approach steps (X: 132.5..135.8, Z: 32.5..37.5)
  if (x >= 132.5 && x <= 136.0 && Math.abs(z - 35.0) <= 2.8) {
    const stepT = THREE.MathUtils.clamp((x - 132.5) / 3.3, 0, 1);
    const steppedElev = THREE.MathUtils.lerp(18.0, 18.28, stepT);
    return Math.max(terrainH, steppedElev);
  }

  // 6. Stargazing Deck timber floorboards at (+145, +35, radius 9.4m) sit at Y = 18.28m
  if (Math.hypot(x - 145.0, z - 35.0) <= 9.35) {
    return Math.max(terrainH, 18.28);
  }

  return terrainH;
}

export function getPrivateRegionAtPosition(
  x: number,
  z: number,
  currentY?: number,
): {
  id: string;
  name: string;
  subtitle: string;
} {
  // Underground Hidden Grotto sub-region detection
  if (isPositionInUndergroundGrotto(x, z, currentY) && z > 121.0) {
    if (
      Math.hypot(x - GROTTO_CENTRAL_ISLAND.x, z - GROTTO_CENTRAL_ISLAND.z) <=
      GROTTO_CENTRAL_ISLAND.radius + 2.5
    ) {
      return {
        id: 'grotto-central-island',
        name: 'Central Discovery Island',
        subtitle: 'Secluded Sanctuary in the Underground Lake',
      };
    }
    if (getGrottoStoneBridgeHeightAt(x, z) !== null) {
      return {
        id: 'grotto-stone-bridge',
        name: 'Natural Stone Bridge',
        subtitle: 'Subterranean Arch Overlooking the Grotto Lake',
      };
    }
    if (
      Math.hypot(
        x - GROTTO_SECONDARY_VIEWPOINT.x,
        z - GROTTO_SECONDARY_VIEWPOINT.z,
      ) <= 7.5
    ) {
      return {
        id: 'grotto-secondary-viewpoint',
        name: 'Grotto Overlook Ledge',
        subtitle: 'Elevated Cavern Viewpoint Across the Waterfall & Island',
      };
    }
    if (x < 2.0 && z < 136.5) {
      return {
        id: 'grotto-biolum-garden',
        name: 'Bioluminescent Cavern Garden',
        subtitle: 'Luminous Subterranean Flora & Mineral Terraces',
      };
    }
    return {
      id: 'hidden-grotto-cavern',
      name: 'The Hidden Grotto',
      subtitle: 'Vast Subterranean Cavern & Midnight-Sapphire Lake',
    };
  }

  let closest: PrivateWorldAnchor = PRIVATE_WORLD_ANCHORS.MEMORY_GARDEN;
  let minD = Infinity;

  for (let i = 0; i < PRIVATE_WORLD_ANCHOR_LIST.length; i++) {
    const a = PRIVATE_WORLD_ANCHOR_LIST[i];
    const d = Math.hypot(x - a.x, z - a.z);
    if (d < a.radius + 14.0 && d < minD) {
      minD = d;
      closest = a;
    }
  }

  if (minD < Infinity) {
    return {
      id: closest.id,
      name: closest.name,
      subtitle: closest.subtitle,
    };
  }

  return {
    id: 'private-island-wilds',
    name: 'Private Romantic Island',
    subtitle: 'Moonlit Botanical Sanctuary Beyond the Special Gate',
  };
}
