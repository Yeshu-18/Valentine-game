import * as THREE from 'three';

/**
 * Global Mathematical Helpers:
 * - Units: metres, seconds, Y-up, dt in seconds
 * - Frame-rate-independent smoothing: α = 1 − e^(−k·dt), value += (target − value)·α
 * - Easing: smoothstep01(u) = u²(3 − 2u), easeOutCubic(u) = 1 − (1 − u)³
 * - Seeded RNG: mulberry32 deterministic generator
 */

export function dampAlpha(k: number, dt: number): number {
  return 1.0 - Math.exp(-k * dt);
}

export function dampValue(
  current: number,
  target: number,
  k: number,
  dt: number,
): number {
  return current + (target - current) * (1.0 - Math.exp(-k * dt));
}

export function smoothstep01(u: number): number {
  const c = THREE.MathUtils.clamp(u, 0, 1);
  return c * c * (3.0 - 2.0 * c);
}

export function easeOutCubic(u: number): number {
  const c = THREE.MathUtils.clamp(u, 0, 1);
  return 1.0 - Math.pow(1.0 - c, 3);
}

export function easeInOutQuad(u: number): number {
  const c = THREE.MathUtils.clamp(u, 0, 1);
  return c < 0.5 ? 2.0 * c * c : 1.0 - Math.pow(-2.0 * c + 2.0, 2) / 2.0;
}

/**
 * Deterministic Seeded RNG (mulberry32).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Locked Coordinates for the Ancient Realm Broom Travel Stand & Castle Landing Terrace:
 * - Broom Travel Stand: (-28.5, +26.0) on the Northwest Boulevard path near the Ancient Realm Signboard
 * - Castle Landing Terrace: (-74.0, +64.0) integrated into the NW mountain cliffside in front of the Castle (-85, +75)
 */
export const BROOM_STAND_POS = {
  x: -28.5,
  z: 26.0,
} as const;

export const CASTLE_TERRACE_POS = {
  x: -74.0,
  y: 27.2,
  z: 64.0,
  radius: 8.8,
} as const;

export const CASTLE_KEEP_POS = {
  x: -85.0,
  y: 28.0,
  z: 75.0,
} as const;

export const MYSTERY_BOX_POS = {
  x: -77.54,
  y: 27.2,
  z: 67.54,
} as const;

export const CASTLE_GATE_POS = {
  x: -80.08,
  y: 27.2,
  z: 70.08,
} as const;

const CASTLE_AXIS_COS = Math.SQRT1_2; // cos(-pi/4) = +0.70710678
const CASTLE_AXIS_SIN = -Math.SQRT1_2; // sin(-pi/4) = -0.70710678

/**
 * Converts world (x, z) into the Wizarding School local coordinate frame
 * anchored at CASTLE_GATE_POS (-80.08, +70.08) with rotation.y = -Math.PI / 4:
 * - localZ > 0 points Northwest straight through the Castle Gate into the Great Hall & Conservatory
 * - localX < 0 is the Right Wing (Book-Lover's Cathedral Library & Restricted Section)
 * - localX > 0 is the Left Wing (Potions Apothecary & Patronus Spell Circle)
 */
export function worldToCastleLocal(
  x: number,
  z: number,
): { localX: number; localZ: number } {
  const dx = x - CASTLE_GATE_POS.x;
  const dz = z - CASTLE_GATE_POS.z;
  return {
    localX: dx * CASTLE_AXIS_COS - dz * CASTLE_AXIS_SIN,
    localZ: dx * CASTLE_AXIS_SIN + dz * CASTLE_AXIS_COS,
  };
}

export function castleLocalToWorld(
  localX: number,
  localZ: number,
): { x: number; z: number } {
  return {
    x: CASTLE_GATE_POS.x + localX * CASTLE_AXIS_COS + localZ * CASTLE_AXIS_SIN,
    z: CASTLE_GATE_POS.z - localX * CASTLE_AXIS_SIN + localZ * CASTLE_AXIS_COS,
  };
}

/**
 * Deterministic master seed for the Deeper Enchanted Realm & Forest (Phase F1+).
 */
export const FOREST_SEED = 74291;

/**
 * Control points for the Phase F1 Enchanted Garden path in Wizarding School local coordinates (localX, localZ).
 * Starts flush at the Northeast Botanical Conservatory exit (localX = 10.6, localZ = 38.4, Y = 29.0m)
 * and winds ~39.5m through the 5 Phase F1 zones to the threshold of the Ancient Forest (localX = 40.2, localZ = 10.8).
 */
export const ENCHANTED_GARDEN_LOCAL_POINTS: ReadonlyArray<{
  localX: number;
  localZ: number;
  elevOffset: number;
}> = [
  { localX: 10.6, localZ: 38.4, elevOffset: 1.8 }, // s = 0.0m: Greenhouse Exit Threshold (Y = 29.0m)
  { localX: 14.5, localZ: 38.2, elevOffset: 1.78 }, // s ~ 3.9m: Zone 1 Symmetrical Exit Court
  { localX: 18.4, localZ: 37.8, elevOffset: 1.72 }, // s ~ 7.8m: Zone 1 -> Zone 2 Transition
  { localX: 23.8, localZ: 35.8, elevOffset: 1.54 }, // s ~ 13.6m: Zone 2 Topiary Garden
  { localX: 28.8, localZ: 32.0, elevOffset: 1.28 }, // s ~ 19.9m: Zone 3 Reactive Magical Plants
  { localX: 33.4, localZ: 26.2, elevOffset: 0.96 }, // s ~ 27.3m: Zone 4 Overgrown Transition
  { localX: 37.2, localZ: 19.0, elevOffset: 0.68 }, // s ~ 35.4m: Zone 5 Broken Path
  { localX: 40.2, localZ: 10.8, elevOffset: 0.45 }, // s ~ 44.1m: Ancient Forest Threshold (Y = 27.65m)
];

export function evaluateEnchantedGardenLocalProximity(
  localX: number,
  localZ: number,
): {
  minDist: number;
  normalizedProgress: number;
  targetElevation: number;
} {
  let minDist = Infinity;
  let bestProg = 0;
  let bestElevOffset = 1.8;
  const segCount = ENCHANTED_GARDEN_LOCAL_POINTS.length - 1;

  for (let i = 0; i < segCount; i++) {
    const a = ENCHANTED_GARDEN_LOCAL_POINTS[i];
    const b = ENCHANTED_GARDEN_LOCAL_POINTS[i + 1];
    const abx = b.localX - a.localX;
    const abz = b.localZ - a.localZ;
    const lenSq = abx * abx + abz * abz;
    const t = THREE.MathUtils.clamp(
      ((localX - a.localX) * abx + (localZ - a.localZ) * abz) / lenSq,
      0,
      1,
    );
    const px = a.localX + t * abx;
    const pz = a.localZ + t * abz;
    const d = Math.hypot(localX - px, localZ - pz);
    if (d < minDist) {
      minDist = d;
      bestProg = (i + t) / segCount;
      bestElevOffset = THREE.MathUtils.lerp(a.elevOffset, b.elevOffset, t);
    }
  }

  return {
    minDist,
    normalizedProgress: bestProg,
    targetElevation: CASTLE_GATE_POS.y + bestElevOffset,
  };
}

/**
 * Control points for the Phase F2 Ancient Forest route in Wizarding School local coordinates (localX, localZ).
 * Begins seamlessly at Gate 2 (localX = 40.2, localZ = 10.8, Y = 27.65m) and winds ~44.4m through
 * dappled glades and root corridors to the Giant Ancient Tree knoll (localX = 72.5, localZ = 10.5, Y = 27.85m).
 */
export const ANCIENT_FOREST_LOCAL_POINTS: ReadonlyArray<{
  localX: number;
  localZ: number;
  elevOffset: number;
}> = [
  { localX: 40.2, localZ: 10.8, elevOffset: 0.45 }, // f = 0.00: Gate 2 Ancient Forest Threshold (Y = 27.65m)
  { localX: 44.8, localZ: 5.4, elevOffset: 0.22 }, // f = 0.17: F1->F2 Transition (Swallowed Garden Remnants)
  { localX: 50.2, localZ: 0.2, elevOffset: -0.12 }, // f = 0.33: First Sun-Dappled Forest Pocket (Glade 1)
  { localX: 55.8, localZ: -4.2, elevOffset: -0.45 }, // f = 0.50: Mossy Root-Corridor & Shallow Depression
  { localX: 61.6, localZ: -1.8, elevOffset: -0.15 }, // f = 0.67: Second Ancient Canopy Pocket (Glade 2)
  { localX: 67.2, localZ: 4.2, elevOffset: 0.25 }, // f = 0.83: Ascending Root-Arch Corridor
  { localX: 72.5, localZ: 10.5, elevOffset: 0.65 }, // f = 1.00: Giant Ancient Tree Knoll (Y = 27.85m)
];

export const GIANT_ANCIENT_TREE_LOCAL_POS = {
  localX: 72.5,
  localZ: 10.5,
} as const;

export const FOREST_LAKE_LOCAL_POS = {
  localX: 47.5,
  localZ: -20.5,
} as const;

export const HIDDEN_POOL_LOCAL_POS = {
  localX: 95.5,
  localZ: 14.5,
} as const;

export const HEARTWOOD_SANCTUARY_LOCAL_POS = {
  localX: 114.0,
  localZ: 46.0,
} as const;

/**
 * Control points for the Phase F5/F6 Northern Forest & Heartwood Sanctuary route in local coordinates.
 * Begins at the Giant Ancient Tree knoll (72.5, 10.5), winds through the Sun-Dappled Northern Woodland
 * glades, passes the side hollow to the Hidden Pool (95.5, 14.5), enters the Heartwood Sanctuary (114.0, 46.0),
 * and continues into the deep northern wilderness beyond (138.0, 64.0).
 */
export const NORTHERN_SANCTUARY_LOCAL_POINTS: ReadonlyArray<{
  localX: number;
  localZ: number;
  elevOffset: number;
}> = [
  { localX: 72.5, localZ: 10.5, elevOffset: 0.65 }, // Giant Ancient Tree Knoll
  { localX: 78.5, localZ: 21.0, elevOffset: 0.95 }, // First Sun-Dappled Northern Woodland Glade
  { localX: 86.0, localZ: 31.5, elevOffset: 1.25 }, // Open Negative-Space Glade & Hidden Pool Spur Junction
  { localX: 96.0, localZ: 39.0, elevOffset: 1.45 }, // Deepening Forest Transition (Moss & Roots)
  { localX: 105.5, localZ: 43.5, elevOffset: 1.60 }, // Sanctuary Threshold & Weathered Rune Stones
  { localX: 114.0, localZ: 46.0, elevOffset: 1.72 }, // The Heartwood Sanctuary & Heartwood Tree
  { localX: 126.0, localZ: 55.0, elevOffset: 1.98 }, // Deep Northern Wilderness Beyond Sanctuary
  { localX: 138.0, localZ: 64.0, elevOffset: 2.25 }, // Outer Ancient Forest Horizon Ridge
];

export function evaluateNorthernSanctuaryLocalProximity(
  localX: number,
  localZ: number,
): {
  minDist: number;
  normalizedProgress: number;
  targetElevation: number;
} {
  let minDist = Infinity;
  let bestProg = 0;
  let bestElevOffset = 0.65;
  const segCount = NORTHERN_SANCTUARY_LOCAL_POINTS.length - 1;

  for (let i = 0; i < segCount; i++) {
    const a = NORTHERN_SANCTUARY_LOCAL_POINTS[i];
    const b = NORTHERN_SANCTUARY_LOCAL_POINTS[i + 1];
    const abx = b.localX - a.localX;
    const abz = b.localZ - a.localZ;
    const lenSq = abx * abx + abz * abz;
    const t = THREE.MathUtils.clamp(
      ((localX - a.localX) * abx + (localZ - a.localZ) * abz) / lenSq,
      0,
      1,
    );
    const px = a.localX + t * abx;
    const pz = a.localZ + t * abz;
    const d = Math.hypot(localX - px, localZ - pz);
    if (d < minDist) {
      minDist = d;
      bestProg = (i + t) / segCount;
      bestElevOffset = THREE.MathUtils.lerp(a.elevOffset, b.elevOffset, t);
    }
  }

  // Also evaluate proximity along the secluded side hollow toward the Hidden Pool (86.0, 31.5 -> 95.5, 14.5)
  const hpAx = 86.0;
  const hpAz = 31.5;
  const hpBx = HIDDEN_POOL_LOCAL_POS.localX;
  const hpBz = HIDDEN_POOL_LOCAL_POS.localZ;
  const hpAbx = hpBx - hpAx;
  const hpAbz = hpBz - hpAz;
  const hpLenSq = hpAbx * hpAbx + hpAbz * hpAbz;
  const hpT = THREE.MathUtils.clamp(
    ((localX - hpAx) * hpAbx + (localZ - hpAz) * hpAbz) / hpLenSq,
    0,
    1,
  );
  const hpPx = hpAx + hpT * hpAbx;
  const hpPz = hpAz + hpT * hpAbz;
  const hpDist = Math.hypot(localX - hpPx, localZ - hpPz);
  if (hpDist < minDist) {
    minDist = hpDist;
    bestProg = 0.35 + hpT * 0.15;
    bestElevOffset = THREE.MathUtils.lerp(1.25, 0.55, hpT);
  }

  return {
    minDist,
    normalizedProgress: bestProg,
    targetElevation: CASTLE_GATE_POS.y + bestElevOffset,
  };
}

export function evaluateAncientForestLocalProximity(
  localX: number,
  localZ: number,
): {
  minDist: number;
  normalizedProgress: number;
  targetElevation: number;
} {
  let minDist = Infinity;
  let bestProg = 0;
  let bestElevOffset = 0.45;
  const segCount = ANCIENT_FOREST_LOCAL_POINTS.length - 1;

  for (let i = 0; i < segCount; i++) {
    const a = ANCIENT_FOREST_LOCAL_POINTS[i];
    const b = ANCIENT_FOREST_LOCAL_POINTS[i + 1];
    const abx = b.localX - a.localX;
    const abz = b.localZ - a.localZ;
    const lenSq = abx * abx + abz * abz;
    const t = THREE.MathUtils.clamp(
      ((localX - a.localX) * abx + (localZ - a.localZ) * abz) / lenSq,
      0,
      1,
    );
    const px = a.localX + t * abx;
    const pz = a.localZ + t * abz;
    const d = Math.hypot(localX - px, localZ - pz);
    if (d < minDist) {
      minDist = d;
      bestProg = (i + t) / segCount;
      bestElevOffset = THREE.MathUtils.lerp(a.elevOffset, b.elevOffset, t);
    }
  }

  return {
    minDist,
    normalizedProgress: bestProg,
    targetElevation: CASTLE_GATE_POS.y + bestElevOffset,
  };
}

export interface ZonePlateau {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  radius: number;
  targetElevation: number;
  blendRadius: number;
}

export const ISLAND_BOUNDS = {
  width: 400,
  length: 420,
  minX: -195,
  maxX: 185,
  minZ: -175,
  maxZ: 235,
  waterLevel: 0.0,
  minWalkableHeight: 0.35,
};

export const ISLAND_ZONES: ZonePlateau[] = [
  {
    id: 'central-plaza',
    name: 'Central Plaza',
    subtitle: 'The Heart of the Dream World',
    x: 0,
    z: 0,
    radius: 35,
    targetElevation: 4.2,
    blendRadius: 24,
  },
  {
    id: 'crescent-lake',
    name: 'Aurora Lake Vista',
    subtitle: 'Northern Cleft Cove',
    x: 0,
    z: 55,
    radius: 22,
    targetElevation: 4.8,
    blendRadius: 22,
  },
  {
    id: 'magic-highlands',
    name: 'Enchanted Ancient Realm',
    subtitle: 'North-West Castle Highlands',
    x: -85,
    z: 75,
    radius: 36,
    targetElevation: 28.0,
    blendRadius: 40,
  },
  {
    id: 'brick-valley',
    name: 'Playful Brick District',
    subtitle: 'Western Brick-Built Valley',
    x: -80,
    z: 5,
    radius: 30,
    targetElevation: 8.2,
    blendRadius: 26,
  },
  {
    id: 'coaster-ridge',
    name: 'Spectacular Thrill Zone',
    subtitle: 'North-East Coaster Ridge',
    x: 85,
    z: 75,
    radius: 36,
    targetElevation: 12.5,
    blendRadius: 36,
  },
  {
    id: 'doll-hills',
    name: 'Pastel Dreamscape',
    subtitle: 'Eastern Fashion Boulevard',
    x: 80,
    z: 5,
    radius: 30,
    targetElevation: 10.0,
    blendRadius: 26,
  },
  {
    id: 'carnival-midway',
    name: 'Romantic Midway',
    subtitle: 'Southern Boardwalk Promenade',
    x: 0,
    z: -65,
    radius: 26,
    targetElevation: 3.2,
    blendRadius: 22,
  },
  {
    id: 'southern-tip',
    name: 'The Special Gate Threshold',
    subtitle: 'Southernmost Island Cape',
    x: 0,
    z: -120,
    radius: 16,
    targetElevation: 2.4,
    blendRadius: 16,
  },
];

function hash2D(ix: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + 1442695041;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function noise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  const v = a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  return v * 2.0 - 1.0;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, z * frequency);
    maxAmp += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value / maxAmp;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Evaluates the organic Heart Island landmass mask.
 * Positive inside the island (0 at shoreline, up to ~1 inland), negative in the ocean.
 * Preserves the Northern Cleft Cove at Aurora Lake (0, +74) and the Southern Cape at (0, -120).
 */
export function getHeartIslandMask(x: number, z: number): number {
  const v = (z + 34.0) / 106.0;
  const southTaper = v < 0 ? 1.0 - Math.min(0.28, -v * 0.24) : 1.0;
  const u = x / (138.0 * southTaper);
  const lobeLift = Math.pow(u * u + 0.0035, 0.34) * 0.82;
  const dv = v - lobeLift;
  const heartDistSq = u * u + dv * dv;

  const tipSymmetryGuard =
    smoothstep(14, 42, Math.hypot(x, z + 128)) *
    smoothstep(14, 38, Math.hypot(x, z - 68));
  const coastalWobble =
    (fbm2D(x * 0.022 + 4.1, z * 0.022 - 2.7, 3) * 0.11 +
      noise2D(x * 0.065, z * 0.065) * 0.035) *
    (0.3 + 0.7 * tipSymmetryGuard);

  // Broadened Northwest Enchanted Forest Highland lobe extension (broadening north & west toward coastline, strictly away from Aurora Lake)
  const forestLobeX =
    smoothstep(-188, -96, x) * (1.0 - smoothstep(-20, -10, x));
  const forestLobeZ = smoothstep(56, 84, z) * (1.0 - smoothstep(218, 242, z));
  const forestHighlandBoost = forestLobeX * forestLobeZ * 0.68;

  return 1.0 - Math.sqrt(heartDistSq) - coastalWobble + forestHighlandBoost;
}

/**
 * The 6 major radial theme-park boulevards radiating from Central Plaza (0, 0).
 */
export const PLAZA_RADIAL_SPOKES: Array<{
  id: string;
  label: string;
  directionLabel: string;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  accentColor: string;
}> = [
  {
    id: 'north-aurora',
    label: 'Aurora Lake',
    directionLabel: 'NORTH',
    ax: 0,
    az: 24,
    bx: 0,
    bz: 54,
    accentColor: '#38bdf8',
  },
  {
    id: 'nw-magic',
    label: 'Ancient Realm',
    directionLabel: 'NORTHWEST',
    ax: -17,
    az: 17,
    bx: -82,
    bz: 72,
    accentColor: '#8b5cf6',
  },
  {
    id: 'west-brick',
    label: 'Brick District',
    directionLabel: 'WEST',
    ax: -24,
    az: 2,
    bx: -78,
    bz: 5,
    accentColor: '#f59e0b',
  },
  {
    id: 'ne-coaster',
    label: 'Thrill Zone',
    directionLabel: 'NORTHEAST',
    ax: 17,
    az: 17,
    bx: 82,
    bz: 72,
    accentColor: '#f43f5e',
  },
  {
    id: 'east-doll',
    label: 'Fashion World',
    directionLabel: 'EAST',
    ax: 24,
    az: 2,
    bx: 78,
    bz: 5,
    accentColor: '#f472b6',
  },
  {
    id: 'south-midway',
    label: 'Romantic Midway',
    directionLabel: 'SOUTH',
    ax: 0,
    az: -24,
    bx: 0,
    bz: -65,
    accentColor: '#fb7185',
  },
];

/**
 * Distance to the theme-park boulevard & scenic path network.
 * Returns 0..1 where 1 is the paved center of a boulevard or trail.
 */
export function getPathWeight(x: number, z: number): number {
  const rCenter = Math.hypot(x, z);
  const ringDist = Math.abs(rCenter - 24.0);

  const segments: Array<[number, number, number, number]> = [
    [0, 24, 0, 54], // North: Crescent Lake Overlook
    [-17, 17, -74, 64], // NW: Ancient Realm Mountain Trail to Castle Landing Terrace
    [-74, 64, -85, 75], // NW: Castle Landing Terrace to Castle Keep
    [-24, 2, -78, 5], // West: Brick World
    [17, 17, 82, 72], // NE: Roller Coaster / Theme Park
    [24, 2, 78, 5], // East: Doll / Fashion World
    [0, -24, 0, -65], // South: Couple Games Midway
    [0, -65, 0, -118], // Far South: Special Gate Cape
    [-78, 5, -74, 64], // West-to-NW connector
    [78, 5, 82, 70], // East-to-NE connector
    [-74, 64, -20, 56], // NW-to-North connector
    [75, 65, 20, 56], // NE-to-North connector
  ];

  let minDist = ringDist;

  // Keep the NW Ancient Realm approach path direct and crisp near the Broom Stand & Terrace
  const isNwCorridor = x < -14 && z > 14;
  const curveWave =
    rCenter > 27 && !isNwCorridor ? Math.sin(rCenter * 0.085) * 2.2 : 0;
  const sampleX = x + curveWave * (z / (rCenter + 1));
  const sampleZ = z - curveWave * (x / (rCenter + 1));

  for (let i = 0; i < segments.length; i++) {
    const [ax, az, bx, bz] = segments[i];
    const abx = bx - ax;
    const abz = bz - az;
    const abLenSq = abx * abx + abz * abz;
    const t = THREE.MathUtils.clamp(
      ((sampleX - ax) * abx + (sampleZ - az) * abz) / abLenSq,
      0,
      1,
    );
    const px = ax + t * abx;
    const pz = az + t * abz;
    const d = Math.hypot(sampleX - px, sampleZ - pz);
    if (d < minDist) minDist = d;
  }

  return 1.0 - smoothstep(2.4, 4.8, minDist);
}

/**
 * Checks whether (x, z) lies inside a protected visual sightline corridor
 * between the Central Plaza and the 6 major zone landmarks so trees frame vistas without blocking them.
 * Explicitly widens the Northwest Ancient Realm sightline from the Signboard & Broom Stand up to the Castle (-85, +75)
 * and clears the entire Wizarding School Great Hall, Library, Potions Wing, Conservatory, and Enchanted Garden footprint.
 */
export function isInsideSightlineCorridor(x: number, z: number): boolean {
  // Protect the Broom Travel Stand clearing (-28.5, +26.0) and Castle Landing Terrace (-74, +64)
  if (Math.hypot(x - BROOM_STAND_POS.x, z - BROOM_STAND_POS.z) < 9.5) {
    return true;
  }
  if (Math.hypot(x - CASTLE_TERRACE_POS.x, z - CASTLE_TERRACE_POS.z) < 15.0) {
    return true;
  }

  // Protect the Wizarding School Great Hall, Library/Potions Wings, Conservatory & Village Vista
  const { localX, localZ } = worldToCastleLocal(x, z);
  if (localZ >= -4.0 && localZ <= 68.0 && Math.abs(localX) <= 28.0) {
    return true;
  }

  // Protect the Phase F1 Enchanted Garden & Topiary Walk so generic random trees don't spawn inside the curated garden
  if (localX >= 8.0 && localX <= 46.5 && localZ >= 4.0 && localZ <= 46.0) {
    const gardenProx = evaluateEnchantedGardenLocalProximity(localX, localZ);
    if (gardenProx.minDist < 12.2) {
      return true;
    }
  }

  // Protect the Phase F2–F6 Ancient Forest basin, Hidden Pool & Heartwood Sanctuary
  if (localX >= 36.0 && localX <= 165.0 && localZ >= -38.0 && localZ <= 105.0) {
    const forestProx = evaluateAncientForestLocalProximity(localX, localZ);
    const northProx = evaluateNorthernSanctuaryLocalProximity(localX, localZ);
    if (forestProx.minDist < 48.0 || northProx.minDist < 48.0) {
      return true;
    }
  }

  for (let i = 0; i < PLAZA_RADIAL_SPOKES.length; i++) {
    const s = PLAZA_RADIAL_SPOKES[i];
    const abx = s.bx - s.ax;
    const abz = s.bz - s.az;
    const abLenSq = abx * abx + abz * abz;
    const t = THREE.MathUtils.clamp(
      ((x - s.ax) * abx + (z - s.az) * abz) / abLenSq,
      0,
      1,
    );
    const px = s.ax + t * abx;
    const pz = s.az + t * abz;
    // Extra-wide dramatic sightline corridor on the NW Ancient Realm spoke (spokeIdx === 1)
    const maxCorridorW = i === 1 ? 18.0 : 13.5;
    const minCorridorW = i === 1 ? 9.5 : 7.5;
    const corridorHalfWidth = THREE.MathUtils.lerp(minCorridorW, maxCorridorW, t);
    if (Math.hypot(x - px, z - pz) < corridorHalfWidth) {
      return true;
    }
  }
  return false;
}

/**
 * Deterministic terrain elevation function `getTerrainHeight(x, z)` in meters.
 * Sea level is Y = 0.0m.
 */
export function getTerrainHeight(x: number, z: number): number {
  const { localX, localZ } = worldToCastleLocal(x, z);

  // Seamless flat floor inside the Wizarding School Great Hall, Library Wing, Potions Wing & Conservatory
  if (localZ >= -2.5 && localZ <= 24.8 && Math.abs(localX) <= 19.2) {
    return CASTLE_GATE_POS.y;
  }
  if (localZ > 24.2 && localZ <= 41.8 && Math.abs(localX) <= 11.0) {
    const stairProgress = smoothstep(24.2, 29.2, localZ);
    return CASTLE_GATE_POS.y + stairProgress * 1.8;
  }

  const mask = getHeartIslandMask(x, z);

  if (mask < -0.25) {
    return -5.5;
  }

  const landFactor = smoothstep(0.0, 0.24, mask);
  const seabedFactor = smoothstep(-0.22, 0.0, mask);

  if (mask <= 0) {
    return THREE.MathUtils.lerp(-5.5, 0.0, seabedFactor);
  }

  const macroHills =
    (fbm2D(x * 0.011 + 1.3, z * 0.011 + 2.9, 4) * 0.5 + 0.5) * 9.5;
  const microDetail = noise2D(x * 0.055, z * 0.055) * 0.65;

  let height = (2.2 + macroHills + microDetail) * landFactor;

  // Blend in the 8 regional zone plateaus & highlands
  for (let i = 0; i < ISLAND_ZONES.length; i++) {
    const zone = ISLAND_ZONES[i];
    const dist = Math.hypot(x - zone.x, z - zone.z);
    const totalR = zone.radius + zone.blendRadius;
    if (dist < totalR) {
      const plateauWeight = 1.0 - smoothstep(zone.radius * 0.55, totalR, dist);
      const isFlatCore =
        zone.id === 'central-plaza' || zone.id === 'carnival-midway';
      const zoneMicro = isFlatCore
        ? 0
        : noise2D(x * 0.04, z * 0.04) * 0.4 * (1.0 - plateauWeight * 0.7);
      height = THREE.MathUtils.lerp(
        height,
        zone.targetElevation + zoneMicro,
        plateauWeight,
      );
    }
  }

  // Guarantee the Romantic Midway boardwalk core (around 0, -65) is level at 3.20m
  const distFromMidway = Math.hypot(x, z + 65);
  if (distFromMidway < 30) {
    const midwayFlatWeight = 1.0 - smoothstep(22.0, 30.0, distFromMidway);
    height = THREE.MathUtils.lerp(height, 3.2, midwayFlatWeight);
  }

  // Smooth walkable ascent ramps
  const ramps: Array<[number, number, number, number, number, number]> = [
    [-80, 10, -84, 68, 8.2, 27.8], // West Valley -> NW Highlands
    [-22, 22, -74, 64, 4.2, CASTLE_TERRACE_POS.y], // Central Plaza NW Spoke -> Castle Landing Terrace
    [22, 22, 78, 68, 4.2, 12.5], // Central Plaza NE Spoke -> NE Coaster Ridge
  ];

  for (let i = 0; i < ramps.length; i++) {
    const [ax, az, bx, bz, elevA, elevB] = ramps[i];
    const rAbx = bx - ax;
    const rAbz = bz - az;
    const rLenSq = rAbx * rAbx + rAbz * rAbz;
    const rt = THREE.MathUtils.clamp(
      ((x - ax) * rAbx + (z - az) * rAbz) / rLenSq,
      0,
      1,
    );
    const rDist = Math.hypot(x - (ax + rt * rAbx), z - (az + rt * rAbz));
    if (rDist < 17) {
      const rampWeight = 1.0 - smoothstep(5.5, 17, rDist);
      const rampElev = THREE.MathUtils.lerp(elevA, elevB, smoothstep(0, 1, rt));
      height = THREE.MathUtils.lerp(height, rampElev, rampWeight * 0.88);
    }
  }

  // Level terrace shelf at the Castle Landing Terrace (-74, +64) and Castle Gate Causeway (-81, +71) at Y = 27.2m
  // so the player can land on the terrace deck and walk seamlessly to the Mystery Box and Castle Gate
  const dTerrace = Math.hypot(
    x - CASTLE_TERRACE_POS.x,
    z - CASTLE_TERRACE_POS.z,
  );
  const dGate = Math.hypot(x - CASTLE_GATE_POS.x, z - CASTLE_GATE_POS.z);
  const minTerraceDist = Math.min(dTerrace, dGate + 3.8);
  if (minTerraceDist < CASTLE_TERRACE_POS.radius + 6.5) {
    const tWeight =
      1.0 -
      smoothstep(
        CASTLE_TERRACE_POS.radius - 0.5,
        CASTLE_TERRACE_POS.radius + 6.5,
        minTerraceDist,
      );
    height = THREE.MathUtils.lerp(height, CASTLE_TERRACE_POS.y, tWeight);
  }

  // Guarantee the Central Plaza architectural core (radius <= 30m) is level at 4.20m
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter < 36) {
    const flatWeight = 1.0 - smoothstep(28.5, 36.0, distFromCenter);
    height = THREE.MathUtils.lerp(height, 4.2, flatWeight);
  }

  const shoreTaper = smoothstep(0.0, 0.09, mask);
  let finalHeight = height * shoreTaper;

  // Seamless Highland Shelf for the Phase F1 Enchanted Garden & Phase F2–F6 Ancient Forest & Heartwood Sanctuary
  if (localX >= 8.0 && localX <= 165.0 && localZ >= -38.0 && localZ <= 105.0) {
    const gardenProx = evaluateEnchantedGardenLocalProximity(localX, localZ);
    const forestProx = evaluateAncientForestLocalProximity(localX, localZ);
    const northProx = evaluateNorthernSanctuaryLocalProximity(localX, localZ);

    const activeForestProx =
      northProx.minDist < forestProx.minDist && localX > 70.0
        ? northProx
        : forestProx;

    if (gardenProx.minDist <= activeForestProx.minDist && localX < 45.0) {
      if (gardenProx.minDist < 20.0) {
        const gardenWeight = 1.0 - smoothstep(8.8, 20.0, gardenProx.minDist);
        finalHeight = THREE.MathUtils.lerp(
          finalHeight,
          gardenProx.targetElevation,
          gardenWeight,
        );
      }
    } else if (activeForestProx.minDist < 52.0) {
      const forestWeight = 1.0 - smoothstep(28.0, 52.0, activeForestProx.minDist);
      // Subtle organic forest-floor micro-undulations and natural boundary banks (fades in smoothly past Gate 2)
      const forestDepthFade = smoothstep(
        0.06,
        0.28,
        localX > 70.0 ? 1.0 : activeForestProx.normalizedProgress,
      );
      const naturalFloorWave =
        (noise2D(x * 0.09 + 3.7, z * 0.09 - 1.9) * 0.22 +
          noise2D(x * 0.18 - 2.1, z * 0.18 + 4.3) * 0.08) *
        forestDepthFade;

      // Secluded Hidden Pool / Spring basin depression at (localX: 95.5, localZ: 14.5)
      const distToHiddenPool = Math.hypot(
        localX - HIDDEN_POOL_LOCAL_POS.localX,
        localZ - HIDDEN_POOL_LOCAL_POS.localZ,
      );
      const hiddenPoolDepression =
        distToHiddenPool < 6.8
          ? -0.38 * (1.0 - smoothstep(1.8, 6.5, distToHiddenPool))
          : 0.0;

      // Forest Lake Cove (localX: 47.5, localZ: -20.5): level the surrounding shoreline shelf
      // and carve a clean lake-bed depression so terrain never rises through the water or photo
      const lakeEllipDist = Math.hypot(
        (localX - FOREST_LAKE_LOCAL_POS.localX) / 1.18,
        (localZ - FOREST_LAKE_LOCAL_POS.localZ) / 0.95,
      );
      const lakeCalmFactor =
        lakeEllipDist < 16.5
          ? smoothstep(9.2, 16.5, lakeEllipDist)
          : 1.0;
      const lakeBasinDepression =
        lakeEllipDist < 9.2
          ? -0.46 * (1.0 - smoothstep(5.2, 9.0, lakeEllipDist))
          : 0.0;

      // Heartwood Sanctuary subtle leveling & gentle root-mound rise under the Heartwood Tree (115.2, 46.5)
      const distToSanctuary = Math.hypot(
        localX - HEARTWOOD_SANCTUARY_LOCAL_POS.localX,
        localZ - HEARTWOOD_SANCTUARY_LOCAL_POS.localZ,
      );
      const distToHeartwoodTree = Math.hypot(localX - 115.2, localZ - 46.5);
      const distToSanctuaryPool = Math.hypot(localX - 111.8, localZ - 48.2);
      const sanctuaryMoundLift =
        distToHeartwoodTree < 4.5
          ? 0.28 * (1.0 - smoothstep(0.8, 4.2, distToHeartwoodTree))
          : 0.0;
      const sanctuaryPoolDip =
        distToSanctuaryPool < 4.2
          ? -0.26 * (1.0 - smoothstep(1.2, 4.0, distToSanctuaryPool))
          : 0.0;
      const sanctuaryCalmFactor =
        distToSanctuary < 15.0
          ? 1.0 - 0.65 * (1.0 - smoothstep(6.0, 15.0, distToSanctuary))
          : 1.0;

      const combinedCalmFactor = sanctuaryCalmFactor * lakeCalmFactor;
      const bankRise =
        smoothstep(12.0, 28.0, activeForestProx.minDist) *
        1.05 *
        forestDepthFade *
        combinedCalmFactor;
      const lakeShoreTargetElev = CASTLE_GATE_POS.y - 0.12;
      const baseForestElev = THREE.MathUtils.lerp(
        lakeShoreTargetElev,
        activeForestProx.targetElevation,
        lakeCalmFactor,
      );
      const targetForestElev =
        baseForestElev +
        naturalFloorWave * combinedCalmFactor +
        bankRise +
        lakeBasinDepression +
        hiddenPoolDepression +
        sanctuaryMoundLift +
        sanctuaryPoolDip;
      const effectiveForestWeight = Math.max(
        forestWeight,
        1.0 - smoothstep(10.5, 16.5, lakeEllipDist),
      );
      finalHeight = THREE.MathUtils.lerp(
        finalHeight,
        targetForestElev,
        effectiveForestWeight,
      );
    }
  }

  return finalHeight;
}

const _tempNormal = new THREE.Vector3();

export function getTerrainNormal(
  x: number,
  z: number,
  target: THREE.Vector3 = _tempNormal,
): THREE.Vector3 {
  const eps = 0.45;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);

  target.set(hL - hR, 2.0 * eps, hD - hU).normalize();
  return target;
}

export function isWalkablePosition(x: number, z: number): boolean {
  if (
    x < ISLAND_BOUNDS.minX ||
    x > ISLAND_BOUNDS.maxX ||
    z < ISLAND_BOUNDS.minZ ||
    z > ISLAND_BOUNDS.maxZ
  ) {
    return false;
  }

  // Always walkable inside the Wizarding School Great Hall, Library Wing, Potions Wing, & Conservatory
  const { localX, localZ } = worldToCastleLocal(x, z);
  if (localZ >= -2.5 && localZ <= 24.8 && Math.abs(localX) <= 18.6) {
    return true;
  }
  if (localZ >= 24.2 && localZ <= 41.2 && Math.abs(localX) <= 11.0) {
    return true;
  }

  // Always walkable along the Phase F1 Enchanted Garden & Broken Path corridor
  if (localX >= 9.5 && localX <= 45.0 && localZ >= 4.0 && localZ <= 45.0) {
    const gardenProx = evaluateEnchantedGardenLocalProximity(localX, localZ);
    if (gardenProx.minDist <= 8.5) {
      return true;
    }
  }

  // Always walkable inside the Phase F2–F6 Ancient Forest, Lake Cove, Hidden Pool & Heartwood Sanctuary
  if (localX >= 38.0 && localX <= 152.0 && localZ >= -28.0 && localZ <= 86.0) {
    const forestProx = evaluateAncientForestLocalProximity(localX, localZ);
    const northProx = evaluateNorthernSanctuaryLocalProximity(localX, localZ);
    if (forestProx.minDist <= 24.0 || northProx.minDist <= 24.0) {
      return true;
    }
  }

  const h = getTerrainHeight(x, z);
  if (h < ISLAND_BOUNDS.minWalkableHeight) {
    return false;
  }
  // Always walkable on the Castle Landing Terrace, Mystery Box Plinth area, & Castle Gate Causeway
  if (
    Math.hypot(x - CASTLE_TERRACE_POS.x, z - CASTLE_TERRACE_POS.z) <=
      CASTLE_TERRACE_POS.radius + 3.5 ||
    Math.hypot(x - CASTLE_GATE_POS.x, z - CASTLE_GATE_POS.z) <= 5.5
  ) {
    return true;
  }
  const normal = getTerrainNormal(x, z);
  return normal.y >= 0.52;
}

export function getRegionAtPosition(x: number, z: number): {
  id: string;
  name: string;
  subtitle: string;
} {
  const { localX, localZ } = worldToCastleLocal(x, z);

  // Phase F5/F6: The Heartwood Sanctuary
  if (
    Math.hypot(
      localX - HEARTWOOD_SANCTUARY_LOCAL_POS.localX,
      localZ - HEARTWOOD_SANCTUARY_LOCAL_POS.localZ,
    ) <= 16.5
  ) {
    return {
      id: 'heartwood-sanctuary',
      name: 'The Heartwood Sanctuary',
      subtitle: 'Sacred Northern Clearing • The Heartwood Tree',
    };
  }

  // Phase F5/F6: The Hidden Pool / Spring
  if (
    Math.hypot(
      localX - HIDDEN_POOL_LOCAL_POS.localX,
      localZ - HIDDEN_POOL_LOCAL_POS.localZ,
    ) <= 10.5
  ) {
    return {
      id: 'hidden-forest-pool',
      name: 'The Hidden Spring',
      subtitle: 'Secluded Northern Hollow • Quiet Woodland Waters',
    };
  }

  // Phase F5/F6: The Unexpected Lake Reveal / Forest Lake Cove
  if (
    Math.hypot(
      localX - FOREST_LAKE_LOCAL_POS.localX,
      localZ - FOREST_LAKE_LOCAL_POS.localZ,
    ) <= 13.5
  ) {
    return {
      id: 'enchanted-forest-lake',
      name: 'Mirror Lake Cove',
      subtitle: 'Hidden Woodland Shore • Tranquil Forest Waters',
    };
  }

  // Phase F5/F6: Sun-Dappled Northern Woodland beyond the Giant Ancient Tree
  if (localX > 76.5 && localX <= 152.0 && localZ >= 12.0 && localZ <= 86.0) {
    const northProx = evaluateNorthernSanctuaryLocalProximity(localX, localZ);
    if (northProx.minDist <= 24.0) {
      return {
        id: 'northern-enchanted-forest',
        name: 'The Hidden Northern Forest',
        subtitle: 'Sun-Dappled Ancient Woodland • Beyond the Giant Tree',
      };
    }
  }

  // Phase F2: The Ancient Forest & Giant Ancient Tree Sanctuary
  if (localX > 40.5 && localX <= 84.0 && localZ >= -24.0 && localZ <= 26.0) {
    const forestProx = evaluateAncientForestLocalProximity(localX, localZ);
    if (forestProx.minDist <= 18.0) {
      if (forestProx.normalizedProgress >= 0.78) {
        return {
          id: 'ancient-forest-giant-tree',
          name: 'The Giant Ancient Tree',
          subtitle: 'Heart of the Old Woodland • Ancient Sanctuary',
        };
      }
      return {
        id: 'ancient-enchanted-forest',
        name: 'The Ancient Forest',
        subtitle: 'Deep Enchanted Woodland • Beyond the Old Garden',
      };
    }
  }

  // Phase F1: Enchanted Garden, Topiary Walk, Reactive Flora & Overgrown Broken Path
  if (localX > 11.0 && localX <= 45.0 && localZ >= 4.0 && localZ <= 45.0) {
    const gardenProx = evaluateEnchantedGardenLocalProximity(localX, localZ);
    if (gardenProx.minDist <= 10.5) {
      if (gardenProx.normalizedProgress >= 0.58) {
        return {
          id: 'enchanted-garden-overgrown',
          name: 'Overgrown Garden Edge',
          subtitle: 'Neglected Conservatory Path • Threshold of the Wilds',
        };
      }
      return {
        id: 'enchanted-topiary-garden',
        name: 'Enchanted Topiary Garden',
        subtitle: 'Botanical Grounds • Living Topiaries & Reactive Flora',
      };
    }
  }

  if (localZ >= 0.2 && localZ <= 41.5 && Math.abs(localX) <= 19.0) {
    if (localZ >= 25.0) {
      return {
        id: 'wizarding-conservatory',
        name: 'Enchanted Conservatory & Frog Pond',
        subtitle: 'Grand Staircase • Botanical Greenhouse',
      };
    }
    if (localX < -8.2) {
      return {
        id: 'wizarding-library',
        name: 'Cathedral Library & Restricted Section',
        subtitle: "Book-Lover's Sanctuary • Mirror of Desire",
      };
    }
    if (localX > 8.2) {
      return {
        id: 'wizarding-potions',
        name: 'Potions Apothecary & Patronus Circle',
        subtitle: 'Left Wing Sanctuary • Amortentia & Expecto Patronum',
      };
    }
    return {
      id: 'wizarding-great-hall',
      name: 'The Great Hall of Harsha',
      subtitle: 'Enchanted Starry Atrium • Wizarding Sanctuary',
    };
  }

  if (
    Math.hypot(x - CASTLE_TERRACE_POS.x, z - CASTLE_TERRACE_POS.z) <=
      CASTLE_TERRACE_POS.radius + 4.0 ||
    Math.hypot(x - CASTLE_GATE_POS.x, z - CASTLE_GATE_POS.z) <= 6.0
  ) {
    return {
      id: 'castle-landing-terrace',
      name: 'Castle Landing Terrace',
      subtitle: 'Enchanted Ancient Realm • Courtyard Overlook',
    };
  }

  let closestZone = ISLAND_ZONES[0];
  let minDistance = Infinity;

  for (let i = 0; i < ISLAND_ZONES.length; i++) {
    const zItem = ISLAND_ZONES[i];
    const d = Math.hypot(x - zItem.x, z - zItem.z);
    if (d < zItem.radius + zItem.blendRadius * 0.7 && d < minDistance) {
      minDistance = d;
      closestZone = zItem;
    }
  }

  if (minDistance < Infinity) {
    return {
      id: closestZone.id,
      name: closestZone.name,
      subtitle: closestZone.subtitle,
    };
  }

  const h = getTerrainHeight(x, z);
  if (h < 2.2) {
    return {
      id: 'coastline',
      name: 'Golden Shoreline',
      subtitle: 'Coastal Beaches & Coves',
    };
  }
  return {
    id: 'wilds',
    name: 'Emerald Foothills',
    subtitle: 'Heart Island Wilderness',
  };
}
