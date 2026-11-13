import * as THREE from 'three';

/**
 * PRIVATE ROMANTIC WORLD — STARGAZING SANCTUARY MATHEMATICAL FOUNDATION
 *
 * Compact, serene moonlit Stargazing Sanctuary island surrounded by calm night water:
 * - Sanctuary Island centered at (0, 0, 0), radius ~15m
 * - Stargazing Deck platform surface at Y = 3.48m
 * - Special Gate Return Portal at the western steps (-10.5, 0.0)
 */

export type ActiveWorldId = 'HEART_ISLAND' | 'PRIVATE_WORLD';

export const PRIVATE_WORLD_SEED = 20270214;

export const PRIVATE_ISLAND_BOUNDS = {
  lengthX: 44,
  widthZ: 44,
  minX: -22,
  maxX: 22,
  minZ: -22,
  maxZ: 22,
  waterLevel: 0.0,
  minWalkableHeight: 0.35,
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

const SANCTUARY_DECK_ANCHOR: PrivateWorldAnchor = {
  id: 'stargazing-deck',
  name: 'Stargazing Sanctuary',
  subtitle: 'Moonlit Observatory Under the I LOVE YOU Constellations',
  x: 0,
  z: 0,
  targetElevation: 3.2,
  elevationRangeLabel: '+3.5m',
  radius: 11,
  blendRadius: 6,
  debugColorHex: '#c084fc',
  defaultFacingYaw: Math.PI / 2,
};

const SANCTUARY_ARRIVAL_ANCHOR: PrivateWorldAnchor = {
  id: 'arrival-shore',
  name: 'Stargazing Sanctuary',
  subtitle: 'Moonlit Observatory Under the I LOVE YOU Constellations',
  x: -6.2,
  z: 0,
  targetElevation: 3.48,
  elevationRangeLabel: '+3.5m',
  radius: 11,
  blendRadius: 6,
  debugColorHex: '#fbbf24',
  defaultFacingYaw: Math.PI / 2, // Facing East (+X) toward telescope, loveseat & starry sky
};

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
  ARRIVAL_SHORE: SANCTUARY_ARRIVAL_ANCHOR,
  MEMORY_GARDEN: SANCTUARY_DECK_ANCHOR,
  REFLECTIVE_POND: SANCTUARY_DECK_ANCHOR,
  STARGAZING_DECK: SANCTUARY_DECK_ANCHOR,
  HIDDEN_CAVE_ENTRANCE: SANCTUARY_DECK_ANCHOR,
  NORTHERN_RIDGE: SANCTUARY_DECK_ANCHOR,
} as const;

export const PRIVATE_WORLD_ANCHOR_LIST: readonly PrivateWorldAnchor[] = [
  SANCTUARY_DECK_ANCHOR,
];

export const RESERVED_GROTTO_VOLUME = {
  minX: -10,
  maxX: 10,
  minY: -10,
  maxY: -5,
  minZ: -10,
  maxZ: 10,
  centerX: 0,
  centerY: -7.5,
  centerZ: 0,
} as const;

/**
 * Special Gate Return Portal position at the western steps of the Stargazing Sanctuary.
 */
export const PRIVATE_ARRIVAL_GATE_POS = {
  x: -10.5,
  z: 0.0,
  interactRadius: 3.4,
} as const;

export function isNearPrivateReturnGate(x: number, z: number): boolean {
  return (
    Math.hypot(x - PRIVATE_ARRIVAL_GATE_POS.x, z - PRIVATE_ARRIVAL_GATE_POS.z) <=
    PRIVATE_ARRIVAL_GATE_POS.interactRadius
  );
}

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

export const REFLECTIVE_POND_WATER_LEVEL = -10.0;

export interface PondSteppingStone {
  x: number;
  z: number;
  topY: number;
  radiusX: number;
  radiusZ: number;
  walkRadius: number;
  rotY: number;
}

export const REFLECTIVE_POND_STEPPING_STONES: readonly PondSteppingStone[] = [];

export function getReflectivePondShoreRadius(_angleRad?: number): number {
  return 0;
}

export function getReflectivePondSignedDistance(x: number, z: number): number {
  return Math.hypot(x, z) + 100.0;
}

export function getMemoryGardenBlendWeight(_x?: number, _z?: number): number {
  return 0;
}

/**
 * Compact circular stone-and-moss sanctuary islet mask centered at (0, 0).
 */
export function getPrivateIslandMask(x: number, z: number): number {
  const r = Math.hypot(x / 14.8, z / 13.8);
  const noise = privateNoise2D(x * 0.14, z * 0.14) * 0.04;
  return 1.0 - r + noise;
}

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

export const PRIVATE_PATH_ROUTES: readonly PrivatePathRoute[] = [];

export interface PrivatePathEvaluation {
  weight: number;
  elevBlendWeight: number;
  minDist: number;
  targetElevation: number;
  closestRouteId: 'primary-route' | 'eastern-branch' | 'garden-loop' | null;
}

export function evaluatePrivatePathNetwork(
  _x?: number,
  _z?: number,
): PrivatePathEvaluation {
  return {
    weight: 0,
    elevBlendWeight: 0,
    minDist: Infinity,
    targetElevation: 3.2,
    closestRouteId: null,
  };
}

/**
 * Compact Stargazing Sanctuary islet elevation at (x, z).
 */
export function getPrivateTerrainHeight(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  if (dist > 18.5) {
    return -4.5;
  }
  const plateau = 1.0 - smoothstep(10.2, 16.5, dist);
  const micro =
    privateNoise2D(x * 0.18, z * 0.18) * 0.08 * (1.0 - plateau * 0.8);
  return THREE.MathUtils.lerp(-4.5, 3.2, plateau) + micro;
}

const _privateNormal = new THREE.Vector3();

export function getPrivateTerrainNormal(
  x: number,
  z: number,
  target: THREE.Vector3 = _privateNormal,
): THREE.Vector3 {
  const eps = 0.35;
  const hL = getPrivateTerrainHeight(x - eps, z);
  const hR = getPrivateTerrainHeight(x + eps, z);
  const hD = getPrivateTerrainHeight(x, z - eps);
  const hU = getPrivateTerrainHeight(x, z + eps);

  target.set(hL - hR, 2.0 * eps, hD - hU).normalize();
  return target;
}

export function getPondSteppingStoneHeightAt(
  _x?: number,
  _z?: number,
): number | null {
  return null;
}

export function getPondSteppingStoneIndexAt(_x?: number, _z?: number): number {
  return -1;
}

export const GROTTO_LAKE_WATER_LEVEL = -10.0;
export const GROTTO_LAKE_BED_ELEVATION = -12.0;

export const GROTTO_CENTRAL_ISLAND = {
  x: 3.5,
  z: 73.5,
  radius: 5.5,
  flatRadius: 3.8,
  topY: 3.85,
  rimY: 3.42,
} as const;

export const GROTTO_WATERFALL_CHAMBER = {
  x: -11.5,
  z: 82.5,
  ledgeY: 11.2,
  poolY: GROTTO_LAKE_WATER_LEVEL,
  width: 4.5,
} as const;

export const GROTTO_BIOLUM_GARDEN = {
  x: -8.5,
  z: 66.5,
  radiusX: 9.5,
  radiusZ: 5.2,
  baseY: 3.72,
} as const;

export const GROTTO_SECONDARY_VIEWPOINT = {
  x: 11.5,
  z: 81.5,
  radiusX: 5.0,
  radiusZ: 3.6,
  topY: 5.45,
} as const;

export const GROTTO_STONE_BRIDGE = {
  startX: 15.5,
  startZ: 68.0,
  startY: 3.85,
  endX: 12.5,
  endZ: 80.0,
  endY: 5.45,
  archCrownBoost: 1.05,
  halfWidth: 1.75,
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

export const GROTTO_ISLAND_STEPPING_STONES: readonly GrottoSteppingStoneSpec[] =
  [];

export function getHiddenCaveTunnelFloorHeightAt(
  _x?: number,
  _z?: number,
): number | null {
  return null;
}

export function getGrottoStoneBridgeHeightAt(
  _x?: number,
  _z?: number,
): number | null {
  return null;
}

export function getGrottoSteppingStoneHeightAt(
  _x?: number,
  _z?: number,
): number | null {
  return null;
}

export function getGrottoSteppingStoneIndexAt(
  _x?: number,
  _z?: number,
): number {
  return -1;
}

export function getGrottoLakeSignedDistance(
  _x?: number,
  _z?: number,
): number {
  return 100.0;
}

export function getGrottoWalkableGroundHeightAt(
  _x?: number,
  _z?: number,
): number | null {
  return null;
}

export function getGrottoCeilingHeightAt(_x?: number, _z?: number): number {
  return 50.0;
}

export function isPositionInUndergroundGrotto(
  _x?: number,
  _z?: number,
  _currentY?: number,
): boolean {
  return false;
}

/**
 * Walkability check on the Stargazing Sanctuary deck and western portal steps.
 */
export function isPrivateWalkablePosition(
  x: number,
  z: number,
  _currentY?: number,
): boolean {
  // Western return portal approach steps (-12.2 <= x <= -8.5, |z| <= 2.8)
  if (x >= -12.2 && x <= -8.0 && Math.abs(z) <= 2.8) {
    return true;
  }
  // Circular timber-and-stone Stargazing Sanctuary deck (radius 9.2m) + surrounding stone rim (radius 11.2m)
  return Math.hypot(x, z) <= 11.2;
}

/**
 * Exact floor elevation for the player on the Stargazing Sanctuary deck (`Y = 3.48m`)
 * and western portal steps (`Y = 3.20m .. 3.48m`).
 */
export function getPrivatePlayerGroundHeight(
  x: number,
  z: number,
  _currentY?: number,
): number {
  const terrainH = getPrivateTerrainHeight(x, z);

  // Western stone approach steps & portal threshold (X: -12.2 .. -8.5, |Z| <= 2.8)
  if (x >= -12.2 && x <= -8.5 && Math.abs(z) <= 2.8) {
    const stepT = THREE.MathUtils.clamp((x - -11.5) / 3.0, 0, 1);
    const steppedElev = THREE.MathUtils.lerp(3.2, 3.48, stepT);
    return Math.max(terrainH, steppedElev);
  }

  // Main Stargazing Deck timber floorboards (radius 9.35m around (0, 0)) sit at Y = 3.48m
  if (Math.hypot(x, z) <= 9.35) {
    return Math.max(terrainH, 3.48);
  }

  return Math.max(terrainH, 3.2);
}

export function getPrivateRegionAtPosition(
  _x?: number,
  _z?: number,
  _currentY?: number,
): {
  id: string;
  name: string;
  subtitle: string;
} {
  return {
    id: 'stargazing-deck',
    name: 'Stargazing Sanctuary',
    subtitle: 'Look Around the Night Sky to Connect I LOVE YOU',
  };
}
