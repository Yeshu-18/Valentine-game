import * as THREE from 'three';

/**
 * PRIVATE ROMANTIC WORLD — STARGAZING SANCTUARY & CONNECTED PROPOSAL GARDEN PENINSULA
 *
 * Unified analytic ground-height and walkability foundation:
 * 1. Stargazing Observatory Deck centered at (0, 0), deck surface Y = +3.48m, radius ~9.35m
 * 2. Western Return Portal Steps at (-10.5, 0.0), Y = +3.20m .. +3.48m
 * 3. Curved North-Eastern Garden Path (~18m long, ~2.4m wide) from (6.2, 6.2) to (22.0, 18.0)
 * 4. Open-Air Proposal Garden Clearing centered at (22.0, 18.0), meadow Y = +4.20m (~12m × 14m)
 * 5. Central Proposal Stage at (22.0, 18.0), stage surface Y = +4.36m
 */

export type ActiveWorldId = 'HEART_ISLAND' | 'PRIVATE_WORLD';

export const PRIVATE_WORLD_SEED = 20270214;

export const PRIVATE_ISLAND_BOUNDS = {
  lengthX: 76,
  widthZ: 72,
  minX: -22,
  maxX: 54,
  minZ: -22,
  maxZ: 50,
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

export const PROPOSAL_GARDEN_CENTER = {
  x: 22.0,
  z: 18.0,
  meadowY: 4.2,
  stageY: 4.36,
  radiusX: 6.8,
  radiusZ: 7.4,
  stageRadius: 2.65,
} as const;

const SANCTUARY_DECK_ANCHOR: PrivateWorldAnchor = {
  id: 'stargazing-deck',
  name: 'Stargazing Deck',
  subtitle: 'Moonlit Observatory · Follow the NE Lantern Path to the Proposal Garden',
  x: 0,
  z: 0,
  targetElevation: 3.48,
  elevationRangeLabel: '+3.5m',
  radius: 10,
  blendRadius: 5,
  debugColorHex: '#c084fc',
  defaultFacingYaw: Math.PI / 2,
};

const SANCTUARY_ARRIVAL_ANCHOR: PrivateWorldAnchor = {
  id: 'arrival-shore',
  name: 'Stargazing Deck',
  subtitle: 'Moonlit Observatory · Follow the NE Lantern Path to the Proposal Garden',
  x: -6.2,
  z: 0,
  targetElevation: 3.48,
  elevationRangeLabel: '+3.5m',
  radius: 10,
  blendRadius: 5,
  debugColorHex: '#fbbf24',
  defaultFacingYaw: Math.PI / 2,
};

const PROPOSAL_GARDEN_ANCHOR: PrivateWorldAnchor = {
  id: 'memory-garden',
  name: 'Proposal Garden',
  subtitle: 'Secluded Moonlit Meadow Overlooking the Horizon',
  x: PROPOSAL_GARDEN_CENTER.x,
  z: PROPOSAL_GARDEN_CENTER.z,
  targetElevation: PROPOSAL_GARDEN_CENTER.meadowY,
  elevationRangeLabel: '+4.2m',
  radius: 7.2,
  blendRadius: 5.5,
  debugColorHex: '#f472b6',
  defaultFacingYaw: 0.72, // Facing North-East toward the Proposal Stage & Horizon
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
  MEMORY_GARDEN: PROPOSAL_GARDEN_ANCHOR,
  REFLECTIVE_POND: PROPOSAL_GARDEN_ANCHOR,
  STARGAZING_DECK: SANCTUARY_DECK_ANCHOR,
  HIDDEN_CAVE_ENTRANCE: PROPOSAL_GARDEN_ANCHOR,
  NORTHERN_RIDGE: PROPOSAL_GARDEN_ANCHOR,
} as const;

export const PRIVATE_WORLD_ANCHOR_LIST: readonly PrivateWorldAnchor[] = [
  SANCTUARY_DECK_ANCHOR,
  PROPOSAL_GARDEN_ANCHOR,
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
 * Special Gate Return Portal position at the western steps of the Stargazing Deck.
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
): PathSamplePoint[] {
  const vecs = controlPoints.map((p) => new THREE.Vector3(p.x, p.elev, p.z));
  const curve = new THREE.CatmullRomCurve3(vecs, false, 'centripetal', 0.5);
  const pts = curve.getPoints(subdivisions);
  return pts.map((pt) => ({
    x: pt.x,
    z: pt.z,
    targetElevation: pt.y,
  }));
}

/**
 * Curved ~18m Stone-and-Timber Garden Path connecting the North-Eastern opening
 * of the Stargazing Deck ((6.0, 5.8), Y = 3.48m) to the Proposal Garden Clearing ((22.0, 18.0), Y = 4.20m).
 */
export const PROPOSAL_PATH_SAMPLES: readonly PathSamplePoint[] =
  buildSmoothPathSamples(
    [
      { x: 5.8, z: 5.6, elev: 3.48 }, // NE Opening of Stargazing Deck
      { x: 9.2, z: 8.8, elev: 3.62 }, // Gentle coastal neck transition
      { x: 13.0, z: 11.4, elev: 3.82 }, // Mid-peninsula curve
      { x: 16.8, z: 14.2, elev: 4.04 }, // Garden approach rise
      { x: 20.2, z: 16.8, elev: 4.2 }, // Proposal Garden southern threshold
      { x: 22.0, z: 18.0, elev: 4.2 }, // Proposal Garden center
    ],
    40,
  );

export const PRIVATE_PATH_ROUTES: readonly PrivatePathRoute[] = [
  {
    id: 'primary-route',
    name: 'Peninsula Path (Stargazing Deck → Proposal Garden)',
    halfWidth: 1.45,
    blendWidth: 4.6,
    debugColorHex: '#fbbf24',
    samples: PROPOSAL_PATH_SAMPLES,
  },
];

export interface PrivatePathEvaluation {
  weight: number;
  elevBlendWeight: number;
  minDist: number;
  targetElevation: number;
  closestRouteId: 'primary-route' | 'eastern-branch' | 'garden-loop' | null;
}

export function evaluatePrivatePathNetwork(
  x = 0,
  z = 0,
): PrivatePathEvaluation {
  let bestDist = Infinity;
  let bestElev = 3.48;

  for (let i = 0; i < PROPOSAL_PATH_SAMPLES.length - 1; i++) {
    const a = PROPOSAL_PATH_SAMPLES[i];
    const b = PROPOSAL_PATH_SAMPLES[i + 1];
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
      bestElev = THREE.MathUtils.lerp(a.targetElevation, b.targetElevation, t);
    }
  }

  const halfWidth = 1.45;
  const blendWidth = 4.6;
  if (bestDist > blendWidth) {
    return {
      weight: 0,
      elevBlendWeight: 0,
      minDist: bestDist,
      targetElevation: bestElev,
      closestRouteId: 'primary-route',
    };
  }

  const weight = 1.0 - smoothstep(halfWidth * 0.75, halfWidth * 1.35, bestDist);
  const elevBlendWeight = 1.0 - smoothstep(halfWidth, blendWidth, bestDist);

  return {
    weight,
    elevBlendWeight,
    minDist: bestDist,
    targetElevation: bestElev,
    closestRouteId: 'primary-route',
  };
}

/**
 * Evaluates normalized distance to the oval Proposal Garden clearing at (22.0, 18.0).
 * Returns <= 1.0 inside the ~13.6m × 14.8m clearing.
 */
export function getProposalGardenNormalizedDist(x: number, z: number): number {
  const dx = x - PROPOSAL_GARDEN_CENTER.x;
  const dz = z - PROPOSAL_GARDEN_CENTER.z;
  // Rotate clearing axis slightly (+38 deg) to align with the NE peninsula
  const cosA = Math.cos(0.66);
  const sinA = Math.sin(0.66);
  const lx = dx * cosA + dz * sinA;
  const lz = -dx * sinA + dz * cosA;
  return Math.hypot(
    lx / PROPOSAL_GARDEN_CENTER.radiusX,
    lz / PROPOSAL_GARDEN_CENTER.radiusZ,
  );
}

/**
 * Unified analytic terrain elevation function `getPrivateTerrainHeight(x, z)` covering:
 * - Stargazing Sanctuary islet centered at (0, 0) (plateau Y = 3.20m, deck surface Y = 3.48m)
 * - Curved North-Eastern Peninsula & Path rising smoothly from Y = 3.48m to Y = 4.20m
 * - Proposal Garden Clearing centered at (22.0, 18.0) (plateau Y = 4.20m)
 */
export function getPrivateTerrainHeight(x: number, z: number): number {
  // 1. Stargazing Sanctuary Islet plateau factor around (0, 0)
  const distDeck = Math.hypot(x, z);
  const deckPlateau = 1.0 - smoothstep(10.0, 16.2, distDeck);

  // 2. Proposal Garden Peninsula plateau factor around (22.0, 18.0)
  const gardenNormDist = getProposalGardenNormalizedDist(x, z);
  const gardenPlateau = 1.0 - smoothstep(0.88, 1.52, gardenNormDist);

  // 3. Curved Peninsula Path Spine factor
  const pathEval = evaluatePrivatePathNetwork(x, z);
  const peninsulaSpine = 1.0 - smoothstep(1.6, 5.2, pathEval.minDist);

  const combinedLand = Math.max(deckPlateau, gardenPlateau, peninsulaSpine);
  if (combinedLand <= 0.001) {
    return -4.5;
  }

  // Blend target land elevation smoothly between Deck (3.20m), Path (3.48m..4.20m), and Proposal Garden (4.20m)
  let landTargetY = 3.2;
  if (peninsulaSpine > 0.01) {
    landTargetY = THREE.MathUtils.lerp(
      landTargetY,
      pathEval.targetElevation,
      peninsulaSpine,
    );
  }
  if (gardenPlateau > 0.01) {
    landTargetY = THREE.MathUtils.lerp(
      landTargetY,
      PROPOSAL_GARDEN_CENTER.meadowY,
      gardenPlateau,
    );
  }

  const micro =
    privateNoise2D(x * 0.18, z * 0.18) * 0.06 * (1.0 - Math.max(deckPlateau, gardenPlateau) * 0.85);
  return THREE.MathUtils.lerp(-4.5, landTargetY, combinedLand) + micro;
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

/**
 * Walkability check across the Stargazing Deck, Western Portal Steps,
 * Curved Peninsula Path, and Proposal Garden Clearing.
 */
export function isPrivateWalkablePosition(
  x: number,
  z: number,
  _currentY?: number,
): boolean {
  // 1. Western return portal approach steps (-12.2 <= x <= -8.0, |z| <= 2.8)
  if (x >= -12.2 && x <= -8.0 && Math.abs(z) <= 2.8) {
    return true;
  }

  // 2. Stargazing Sanctuary circular deck & rim (radius 10.6m around (0, 0))
  if (Math.hypot(x, z) <= 10.6) {
    return true;
  }

  // 3. Curved Peninsula Path corridor (half-width 1.85m along PROPOSAL_PATH_SAMPLES)
  const pathEval = evaluatePrivatePathNetwork(x, z);
  if (pathEval.minDist <= 1.85) {
    return true;
  }

  // 4. Proposal Garden Clearing (~12m × 14m oval around (22.0, 18.0))
  if (getProposalGardenNormalizedDist(x, z) <= 1.04) {
    return true;
  }

  return false;
}

/**
 * Unified player ground-height evaluator matching the visual geometry of:
 * - Western Return Portal Steps (Y = 3.20m .. 3.48m)
 * - Stargazing Deck Timber Platform (Y = 3.48m)
 * - Curved Peninsula Path Pavers (Y = 3.48m .. 4.20m)
 * - Proposal Garden Meadow (Y = 4.20m) & Central Proposal Stage (Y = 4.36m)
 */
export function getPrivatePlayerGroundHeight(
  x: number,
  z: number,
  _currentY?: number,
): number {
  const terrainH = getPrivateTerrainHeight(x, z);

  // 1. Western stone approach steps & portal threshold (X: -12.2 .. -8.5, |Z| <= 2.8)
  if (x >= -12.2 && x <= -8.5 && Math.abs(z) <= 2.8) {
    const stepT = THREE.MathUtils.clamp((x - -11.5) / 3.0, 0, 1);
    const steppedElev = THREE.MathUtils.lerp(3.2, 3.48, stepT);
    return Math.max(terrainH, steppedElev);
  }

  // 2. Main Stargazing Deck timber floorboards (radius 9.35m around (0, 0)) sit at Y = 3.48m
  if (Math.hypot(x, z) <= 9.35) {
    return Math.max(terrainH, 3.48);
  }

  // 3. Central Proposal Stage platform at (22.0, 18.0) (radius 2.65m, surface Y = 4.36m)
  const distStage = Math.hypot(
    x - PROPOSAL_GARDEN_CENTER.x,
    z - PROPOSAL_GARDEN_CENTER.z,
  );
  if (distStage <= PROPOSAL_GARDEN_CENTER.stageRadius + 0.45) {
    const stageStepT =
      1.0 -
      smoothstep(
        PROPOSAL_GARDEN_CENTER.stageRadius - 0.15,
        PROPOSAL_GARDEN_CENTER.stageRadius + 0.45,
        distStage,
      );
    const stageY = THREE.MathUtils.lerp(
      PROPOSAL_GARDEN_CENTER.meadowY,
      PROPOSAL_GARDEN_CENTER.stageY,
      stageStepT,
    );
    return Math.max(terrainH, stageY);
  }

  // 4. Proposal Garden Clearing meadow floor (Y = 4.20m)
  if (getProposalGardenNormalizedDist(x, z) <= 1.05) {
    return Math.max(terrainH, PROPOSAL_GARDEN_CENTER.meadowY);
  }

  // 5. Curved Peninsula Path surface (smoothly graded from 3.48m to 4.20m)
  const pathEval = evaluatePrivatePathNetwork(x, z);
  if (pathEval.minDist <= 2.1) {
    return Math.max(terrainH, pathEval.targetElevation);
  }

  return Math.max(terrainH, 3.2);
}

export function getPrivateRegionAtPosition(
  x = 0,
  z = 0,
  _currentY?: number,
): {
  id: string;
  name: string;
  subtitle: string;
} {
  if (getProposalGardenNormalizedDist(x, z) <= 1.15) {
    return {
      id: 'proposal-garden',
      name: 'Proposal Garden',
      subtitle: 'Secluded Moonlit Meadow Overlooking the Horizon',
    };
  }
  const pathEval = evaluatePrivatePathNetwork(x, z);
  if (pathEval.minDist <= 2.4 && Math.hypot(x, z) > 9.4) {
    return {
      id: 'proposal-garden-path',
      name: 'Moonlit Garden Path',
      subtitle: 'Curved Lantern Walk Toward the Proposal Clearing',
    };
  }
  return {
    id: 'stargazing-deck',
    name: 'Stargazing Deck',
    subtitle: 'Look Through the Telescope or Follow the NE Lantern Path',
  };
}

// Compatibility exports for unused legacy modules
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
export function getPrivateIslandMask(x: number, z: number): number {
  return getPrivateTerrainHeight(x, z) > 0 ? 1 : -1;
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
