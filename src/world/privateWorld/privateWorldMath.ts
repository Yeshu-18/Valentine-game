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
  const ridgeEllipDist = Math.hypot((x - 4.0) / 1.45, (z - 144.0) / 0.82);
  if (ridgeEllipDist < 68.0) {
    const ridgeWeight = 1.0 - smoothstep(14.0, 68.0, ridgeEllipDist);
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
      const w = 1.0 - smoothstep(anchor.radius * 0.55, totalR, d);
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
    const saddleTargetY = THREE.MathUtils.lerp(11.8, 25.0, smoothstep(0.0, 1.0, tRidge));
    const distFromSaddle = Math.abs(x - saddleCenterX);
    if (distFromSaddle < 12.0) {
      const saddleW = (1.0 - smoothstep(3.5, 12.0, distFromSaddle)) * smoothstep(92.0, 102.0, z) * (1.0 - smoothstep(144.0, 149.0, z));
      height = THREE.MathUtils.lerp(height, saddleTargetY, saddleW * 0.72);
    }
  }

  // 7. Carve the Descending Hidden Cave Tunnel Floor Channel (Z: 109.8 -> 123.2, curving slightly toward Reserved Grotto)
  if (z >= 109.5 && z <= 124.0 && x >= 27.5 && x <= 40.5) {
    const tunnelT = THREE.MathUtils.clamp((z - 110.2) / 11.8, 0, 1);
    const tunnelCenterX = 35.0 - smoothstep(0.0, 1.0, tunnelT) * 2.4;
    const lateralDist = Math.abs(x - tunnelCenterX);
    if (lateralDist < 4.2) {
      const channelW =
        (1.0 - smoothstep(1.95, 4.2, lateralDist)) *
        smoothstep(109.5, 111.0, z) *
        (1.0 - smoothstep(122.0, 124.0, z));
      const stepRipple = Math.sin((z - 110.2) * 2.4) * 0.04;
      const targetTunnelFloorY =
        THREE.MathUtils.lerp(12.0, 9.15, tunnelT) + stepRipple;
      height = THREE.MathUtils.lerp(height, targetTunnelFloorY, channelW);
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
 * Evaluates whether (x, z) lies inside the walkable Hidden Cave descending tunnel corridor
 * (from the cave entrance threshold at Z = 109.8 down to the natural rockfall seal at Z = 120.9).
 */
export function getHiddenCaveTunnelFloorHeightAt(
  x: number,
  z: number,
): number | null {
  if (z < 109.6 || z > 121.2) return null;
  const tunnelT = THREE.MathUtils.clamp((z - 110.2) / 11.8, 0, 1);
  const tunnelCenterX = 35.0 - smoothstep(0.0, 1.0, tunnelT) * 2.4;
  const lateralDist = Math.abs(x - tunnelCenterX);
  if (lateralDist > 1.85) return null;

  const stepRipple = Math.sin((z - 110.2) * 2.4) * 0.035;
  return THREE.MathUtils.lerp(12.0, 9.22, tunnelT) + stepRipple;
}

/**
 * Checks whether (x, z) in Private World local coordinates is walkable by the player:
 * - Prevents walking into the surrounding ocean (h < minWalkableHeight)
 * - Allows walking onto the Arrival Shore wooden pier (x in [-2.2, +2.2], z in [-162, -144])
 * - Allows walking across the Reflective Pond stepping stones while preventing walking into the deep pond water
 * - Allows walking onto the Stargazing Deck, down the Hidden Cave descending tunnel (to the rockfall seal),
 *   and up the Northern Ridge lookout trail while blocking the sheer northern cliff drop-off.
 */
export function isPrivateWalkablePosition(x: number, z: number): boolean {
  if (
    x < PRIVATE_ISLAND_BOUNDS.minX ||
    x > PRIVATE_ISLAND_BOUNDS.maxX ||
    z < PRIVATE_ISLAND_BOUNDS.minZ ||
    z > PRIVATE_ISLAND_BOUNDS.maxZ
  ) {
    return false;
  }

  // Prevent walking past the sheer Northern Ridge sea-cliff brink
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

  // Allow walking down the Hidden Cave descending tunnel up to the rockfall seal (Z <= 120.9)
  if (getHiddenCaveTunnelFloorHeightAt(x, z) !== null) {
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
 * Returns the floor height for the player at (x, z), accounting for the wooden Arrival Pier,
 * the Reflective Pond stepping stones, the Stargazing Deck platform & steps, and the Hidden Cave descending tunnel.
 */
export function getPrivatePlayerGroundHeight(x: number, z: number): number {
  // 1. Inside the Hidden Cave descending tunnel (Z: 109.6 -> 121.2)
  const caveTunnelFloor = getHiddenCaveTunnelFloorHeightAt(x, z);
  if (caveTunnelFloor !== null) {
    return caveTunnelFloor;
  }

  const terrainH = getPrivateTerrainHeight(x, z);

  // 2. Wooden pier deck at Arrival Shore (x: -2.1..+2.1, z: -161.5..-144.0) sits at Y = 1.65m
  if (Math.abs(x) <= 2.1 && z >= -161.5 && z <= -144.0) {
    return Math.max(terrainH, 1.65);
  }

  // 3. Walkable stepping stones crossing the northern end of the Reflective Pond
  const stoneH = getPondSteppingStoneHeightAt(x, z);
  if (stoneH !== null) {
    return Math.max(terrainH, stoneH);
  }

  // 4. Stargazing Deck western stone approach steps (X: 132.5..135.8, Z: 32.5..37.5)
  if (x >= 132.5 && x <= 136.0 && Math.abs(z - 35.0) <= 2.8) {
    const stepT = THREE.MathUtils.clamp((x - 132.5) / 3.3, 0, 1);
    const steppedElev = THREE.MathUtils.lerp(18.0, 18.28, stepT);
    return Math.max(terrainH, steppedElev);
  }

  // 5. Stargazing Deck timber floorboards at (+145, +35, radius 9.4m) sit at Y = 18.28m
  if (Math.hypot(x - 145.0, z - 35.0) <= 9.35) {
    return Math.max(terrainH, 18.28);
  }

  return terrainH;
}

export function getPrivateRegionAtPosition(
  x: number,
  z: number,
): {
  id: string;
  name: string;
  subtitle: string;
} {
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
