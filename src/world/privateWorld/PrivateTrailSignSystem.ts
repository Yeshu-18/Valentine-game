import * as THREE from 'three';
import { CircleCollider } from '../VegetationSystem';
import {
  PRIVATE_PATH_ROUTES,
  PrivatePathRoute,
  createPrivateSeededRng,
  getPrivateTerrainHeight,
  getPrivateTerrainNormal,
  privateNoise2D,
} from './privateWorldMath';

export type TrailDestinationId =
  | 'memory-garden'
  | 'stargazing-deck'
  | 'hidden-cave'
  | 'reflective-pond'
  | 'northern-ridge';

export interface TrailSignBoardEntry {
  destinationId: TrailDestinationId;
  label: string;
  routeDistanceMeters: number;
  boardYawRadians: number; // World yaw angle (+X = PI/2, +Z = 0) pointing along the outgoing route branch
  yOffset: number;
}

export interface TrailSignpostInfo {
  id: string;
  title: string;
  x: number;
  y: number;
  z: number;
  entries: TrailSignBoardEntry[];
}

export interface PrivateTrailSignSystemBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  signposts: TrailSignpostInfo[];
  computePlayerRouteDistanceTo: (
    playerX: number,
    playerZ: number,
    destinationId: TrailDestinationId,
  ) => number;
  getCaveJunctionGuidanceBoost: (
    playerX: number,
    playerZ: number,
    elementRouteIndex: number,
    elementArcS: number,
  ) => number;
  dispose: () => void;
}

interface RouteArcCache {
  route: PrivatePathRoute;
  cumLengths: number[];
  totalLength: number;
}

/**
 * Builds precomputed cumulative arc-length tables for each route in PRIVATE_PATH_ROUTES.
 */
function buildRouteArcCaches(): Record<
  'primary-route' | 'eastern-branch' | 'garden-loop',
  RouteArcCache
> {
  const map = {} as Record<
    'primary-route' | 'eastern-branch' | 'garden-loop',
    RouteArcCache
  >;

  for (let r = 0; r < PRIVATE_PATH_ROUTES.length; r++) {
    const route = PRIVATE_PATH_ROUTES[r];
    const cumLengths: number[] = [0];
    let total = 0;
    for (let i = 0; i < route.samples.length - 1; i++) {
      const a = route.samples[i];
      const b = route.samples[i + 1];
      total += Math.hypot(b.x - a.x, b.z - a.z);
      cumLengths.push(total);
    }
    map[route.id] = {
      route,
      cumLengths,
      totalLength: total,
    };
  }
  return map;
}

/**
 * Projects any world point (x, z) onto a specific route and returns its arc-length s (meters),
 * perpendicular distance, and outgoing tangent direction at that point.
 */
function projectPointOnRoute(
  cache: RouteArcCache,
  x: number,
  z: number,
): {
  arcS: number;
  dist: number;
  tangentX: number;
  tangentZ: number;
} {
  const pts = cache.route.samples;
  let bestDistSq = Infinity;
  let bestS = 0;
  let bestTx = 0;
  let bestTz = 1;

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
    const dSq = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      const segLen = Math.sqrt(lenSq);
      bestS = cache.cumLengths[i] + t * segLen;
      bestTx = abx / segLen;
      bestTz = abz / segLen;
    }
  }

  return {
    arcS: bestS,
    dist: Math.sqrt(bestDistSq),
    tangentX: bestTx,
    tangentZ: bestTz,
  };
}

/**
 * Samples a route at arc-length s (meters) and returns its position and forward unit tangent.
 */
function sampleRouteAtArcS(
  cache: RouteArcCache,
  targetS: number,
): { x: number; z: number; tangentX: number; tangentZ: number } {
  const s = THREE.MathUtils.clamp(targetS, 0, cache.totalLength);
  const pts = cache.route.samples;
  for (let i = 0; i < pts.length - 1; i++) {
    const s0 = cache.cumLengths[i];
    const s1 = cache.cumLengths[i + 1];
    if (s <= s1 || i === pts.length - 2) {
      const segLen = Math.max(0.0001, s1 - s0);
      const t = THREE.MathUtils.clamp((s - s0) / segLen, 0, 1);
      const ax = pts[i].x;
      const az = pts[i].z;
      const bx = pts[i + 1].x;
      const bz = pts[i + 1].z;
      const dx = bx - ax;
      const dz = bz - az;
      return {
        x: ax + dx * t,
        z: az + dz * t,
        tangentX: dx / segLen,
        tangentZ: dz / segLen,
      };
    }
  }
  const last = pts[pts.length - 1];
  return { x: last.x, z: last.z, tangentX: 0, tangentZ: 1 };
}

/**
 * Generates a weathered dark-walnut wooden arrow sign texture with deeply carved
 * light-parchment lettering, subtle warm-amber drop shadow, and wood grain streaks.
 */
function createCarvedSignBoardTexture(
  label: string,
  distanceMeters: number,
  maxAniso: number,
): THREE.CanvasTexture {
  const width = 512;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Weathered dark walnut wood base
  ctx.fillStyle = '#362519';
  ctx.fillRect(0, 0, width, height);

  // 2. Horizontal organic wood-grain streaks & weathered board bevels
  for (let y = 0; y < height; y += 2) {
    const n = privateNoise2D(y * 0.16, 4.2);
    const tone = Math.round(44 + n * 14);
    ctx.fillStyle = `rgb(${tone + 12}, ${tone}, ${Math.max(12, tone - 10)})`;
    ctx.fillRect(0, y, width, 2);
  }

  // Subtle carved border groove inset from edges
  ctx.strokeStyle = 'rgba(20, 13, 8, 0.85)';
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, width - 28, height - 28);

  // 3. Iron bolt rivet heads near both ends of the board
  for (const rx of [28, width - 48]) {
    for (const ry of [32, height - 32]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1917';
      ctx.fill();
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // 4. Engraved Destination Name & True Route Distance (`Memory Garden · 130m`)
  const distRounded = Math.max(5, Math.round(distanceMeters / 5) * 5);
  const fullText = `${label} · ${distRounded}m`;

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = '700 31px "Inter", "Georgia", serif';

  // Deep carved recess shadow
  ctx.fillStyle = 'rgba(10, 6, 3, 0.94)';
  ctx.fillText(fullText, width * 0.48 + 2, height * 0.5 + 3);

  // Warm parchment-ivory engraved fill with subtle golden warmth
  ctx.fillStyle = '#fdf3dc';
  ctx.fillText(fullText, width * 0.48, height * 0.5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a single 3D pointed wooden sign board geometry (length ~1.48m, height ~0.28m, thickness ~0.048m)
 * extending along +Z in its local space so `rotation.y = Math.atan2(dirX, dirZ)` points the arrow tip
 * directly along `(dirX, dirZ)`.
 */
function createPointedSignBoardGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // Extending from z_local = -0.12 (post overlap) to +1.34 (arrow tip)
  // In 2D shape coordinates: x = forward reach (-0.12 -> 1.34), y = vertical board height (-0.13 -> +0.13)
  shape.moveTo(-0.12, -0.13);
  shape.lineTo(1.08, -0.13);
  shape.lineTo(1.34, 0.0); // Carved arrow point
  shape.lineTo(1.08, 0.13);
  shape.lineTo(-0.12, 0.13);
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.048,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center extrusion thickness along X and orient forward reach along +Z
  geo.translate(0, 0, -0.024);
  geo.rotateY(-Math.PI / 2);

  // Normalize UVs on the side faces so the 512x128 text canvas maps left-to-right from the viewer's perspective:
  // - Looking at the -X face (nx < 0) from -X toward +X: viewer's left is -Z (uRaw=0) and viewer's right is +Z (uRaw=1) -> u = uRaw
  // - Looking at the +X face (nx > 0) from +X toward -X: viewer's left is +Z (uRaw=1) and viewer's right is -Z (uRaw=0) -> u = 1.0 - uRaw
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const nx = norm.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    if (Math.abs(nx) > 0.5) {
      const uRaw = (vz + 0.12) / 1.46;
      const u = nx < 0 ? uRaw : 1.0 - uRaw;
      const v = (vy + 0.14) / 0.28;
      uv.setXY(
        i,
        THREE.MathUtils.clamp(u, 0, 1),
        THREE.MathUtils.clamp(v, 0, 1),
      );
    } else {
      uv.setXY(i, 0.05, 0.08);
    }
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function createPrivateTrailSignSystem(
  maxAniso = 4,
): PrivateTrailSignSystemBundle {
  const group = new THREE.Group();
  group.name = 'PrivateWorld_WoodenTrailSignSystem';

  const colliders: CircleCollider[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // ============================================================================
  // 1. PRECOMPUTE TRUE CURVED PATH NETWORK ARC LENGTHS & JUNCTION DISTANCES
  // ============================================================================
  const routeCaches = buildRouteArcCaches();
  const primaryCache = routeCaches['primary-route'];
  const easternCache = routeCaches['eastern-branch'];
  const gardenLoopCache = routeCaches['garden-loop'];

  // Key Landmark & Junction Arc-Length Positions on the Curved Path Network:
  // - Memory Garden Junction (-35, -20) on primary-route
  const sGardenOnPrimary = projectPointOnRoute(primaryCache, -35.0, -20.0).arcS;
  // - Northern Foothill Junction (-30, +12) on primary-route (where garden-loop reconnects)
  const sFoothillOnPrimary = projectPointOnRoute(primaryCache, -30.0, 12.0).arcS;
  // - Cave Approach Saddle Split (24, +90) on primary-route
  const sCaveSplitOnPrimary = projectPointOnRoute(primaryCache, 24.0, 90.0).arcS;
  // - Hidden Cave Entrance (35, +110) at end of primary-route
  const sHiddenCaveOnPrimary = primaryCache.totalLength;
  // - Stargazing Deck (145, +35) at end of eastern-branch (starts at Memory Garden (-35, -20))
  const lenEasternBranch = easternCache.totalLength;
  // - Reflective Pond Southern Rim (-5, -11) along garden-loop from Memory Garden (-35, -20)
  const sPondOnGardenLoop = projectPointOnRoute(gardenLoopCache, -5.0, -11.0).arcS;
  const lenGardenLoop = gardenLoopCache.totalLength;
  // - Highland Ridge Saddle Trail from Cave Approach (24, 90) up to Northern Ridge (0, 145)
  const lenSaddleToNorthernRidge = (() => {
    let total = 0;
    let prevX = 24.0;
    let prevZ = 90.0;
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      const sx = 24.0 - 24.0 * t + Math.sin(t * Math.PI * 2.0) * 2.2;
      const sz = 90.0 + 55.0 * t;
      total += Math.hypot(sx - prevX, sz - prevZ);
      prevX = sx;
      prevZ = sz;
    }
    return total;
  })();

  /**
   * Computes true path-network distance (in meters) from any world position (x, z)
   * to a target destination by projecting onto the closest path route and summing
   * the curved path segments across junctions.
   */
  function computePlayerRouteDistanceTo(
    x: number,
    z: number,
    destinationId: TrailDestinationId,
  ): number {
    const pPrimary = projectPointOnRoute(primaryCache, x, z);
    const pEastern = projectPointOnRoute(easternCache, x, z);
    const pLoop = projectPointOnRoute(gardenLoopCache, x, z);

    // Determine which route the point is currently on
    let activeRoute: 'primary-route' | 'eastern-branch' | 'garden-loop' =
      'primary-route';
    let bestDist = pPrimary.dist;
    if (pEastern.dist < bestDist) {
      bestDist = pEastern.dist;
      activeRoute = 'eastern-branch';
    }
    if (pLoop.dist < bestDist) {
      bestDist = pLoop.dist;
      activeRoute = 'garden-loop';
    }

    // Distance from point to its nearest route centerline (off-path walk-in distance)
    const walkIn = Math.min(18.0, bestDist);

    // Compute arc-length position equivalent on primary-route (or branch offset)
    if (activeRoute === 'primary-route') {
      const s = pPrimary.arcS;
      switch (destinationId) {
        case 'memory-garden':
          return walkIn + Math.abs(sGardenOnPrimary - s);
        case 'stargazing-deck':
          return walkIn + Math.abs(sGardenOnPrimary - s) + lenEasternBranch;
        case 'hidden-cave':
          return walkIn + Math.abs(sHiddenCaveOnPrimary - s);
        case 'reflective-pond': {
          const viaSouthLoop =
            Math.abs(sGardenOnPrimary - s) + sPondOnGardenLoop;
          const viaNorthLoop =
            Math.abs(sFoothillOnPrimary - s) +
            (lenGardenLoop - sPondOnGardenLoop);
          return walkIn + Math.min(viaSouthLoop, viaNorthLoop);
        }
        case 'northern-ridge':
          return (
            walkIn +
            Math.abs(sCaveSplitOnPrimary - s) +
            lenSaddleToNorthernRidge
          );
      }
    } else if (activeRoute === 'eastern-branch') {
      const sEast = pEastern.arcS;
      switch (destinationId) {
        case 'stargazing-deck':
          return walkIn + Math.max(0, lenEasternBranch - sEast);
        case 'memory-garden':
          return walkIn + sEast;
        case 'hidden-cave':
          return (
            walkIn + sEast + (sHiddenCaveOnPrimary - sGardenOnPrimary)
          );
        case 'reflective-pond':
          return walkIn + sEast + sPondOnGardenLoop;
        case 'northern-ridge':
          return (
            walkIn +
            sEast +
            (sCaveSplitOnPrimary - sGardenOnPrimary) +
            lenSaddleToNorthernRidge
          );
      }
    } else {
      // On garden-loop (0 = Memory Garden (-35, -20), lenGardenLoop = Foothill Junction (-30, +12))
      const sLoop = pLoop.arcS;
      const distToGarden = sLoop;
      const distToFoothill = Math.max(0, lenGardenLoop - sLoop);
      switch (destinationId) {
        case 'reflective-pond':
          return walkIn + Math.abs(sPondOnGardenLoop - sLoop);
        case 'memory-garden':
          return (
            walkIn +
            Math.min(
              distToGarden,
              distToFoothill + (sFoothillOnPrimary - sGardenOnPrimary),
            )
          );
        case 'stargazing-deck':
          return walkIn + distToGarden + lenEasternBranch;
        case 'hidden-cave':
          return (
            walkIn +
            Math.min(
              distToFoothill + (sHiddenCaveOnPrimary - sFoothillOnPrimary),
              distToGarden + (sHiddenCaveOnPrimary - sGardenOnPrimary),
            )
          );
        case 'northern-ridge':
          return (
            walkIn +
            distToFoothill +
            (sCaveSplitOnPrimary - sFoothillOnPrimary) +
            lenSaddleToNorthernRidge
          );
      }
    }
  }

  /**
   * Computes the outgoing path tangent direction yaw (`Math.atan2(tx, tz)`) from a signpost
   * along a specific route branch so each wooden arrow board points naturally along the trail.
   */
  function getRouteDirectionYawAt(
    routeId: 'primary-route' | 'eastern-branch' | 'garden-loop',
    x: number,
    z: number,
    forwardAlongRoute = true,
  ): number {
    const cache = routeCaches[routeId];
    const proj = projectPointOnRoute(cache, x, z);
    const lookAheadS = THREE.MathUtils.clamp(
      proj.arcS + (forwardAlongRoute ? 6.5 : -6.5),
      0,
      cache.totalLength,
    );
    const sampleAhead = sampleRouteAtArcS(cache, lookAheadS);
    const sampleHere = sampleRouteAtArcS(cache, proj.arcS);
    const dx = sampleAhead.x - sampleHere.x;
    const dz = sampleAhead.z - sampleHere.z;
    if (Math.hypot(dx, dz) < 0.01) {
      const sign = forwardAlongRoute ? 1 : -1;
      return Math.atan2(proj.tangentX * sign, proj.tangentZ * sign);
    }
    return Math.atan2(dx, dz);
  }

  // ============================================================================
  // 2. SHARED WEATHERED WOOD, IRON HARDWARE, MOSS & MICRO-LANTERN MATERIALS
  // ============================================================================
  const walnutPostMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b281b'),
      roughness: 0.88,
      metalness: 0.04,
    }),
  );
  const ironFastenerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1f242b'),
      roughness: 0.46,
      metalness: 0.78,
    }),
  );
  const mossyBaseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d544c'),
      roughness: 0.88,
      metalness: 0.04,
    }),
  );
  const stoneCairnMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4b5361'),
      roughness: 0.84,
      metalness: 0.05,
    }),
  );
  const lanternAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fde68a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 1.5,
      roughness: 0.22,
    }),
  );
  const carvedArrowInlayMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f5ebd6'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.24,
      roughness: 0.48,
    }),
  );

  const postTimberGeo = trackGeo(
    new THREE.CylinderGeometry(0.115, 0.14, 2.55, 7),
  );
  postTimberGeo.translate(0, 1.275, 0);

  const postCapGeo = trackGeo(new THREE.ConeGeometry(0.165, 0.16, 7));
  postCapGeo.translate(0, 2.61, 0);

  const ironBandGeo = trackGeo(
    new THREE.CylinderGeometry(0.124, 0.124, 0.045, 10),
  );
  const baseStoneGeo = trackGeo(new THREE.DodecahedronGeometry(0.24, 1));
  const baseMossGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.52, 0.08, 8));
  const boardGeo = trackGeo(createPointedSignBoardGeometry());

  const lanternArmGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.04, 0.34));
  const lanternCageGeo = trackGeo(
    new THREE.CylinderGeometry(0.068, 0.055, 0.16, 6),
  );
  const lanternRoofGeo = trackGeo(new THREE.ConeGeometry(0.095, 0.07, 6));

  // ============================================================================
  // 3. BUILD THE FOUR HANDCRAFTED DIRECTIONAL SIGNPOSTS (A, B, C, D)
  //    Placed just beside the path edge so they never block walking movement
  // ============================================================================
  const signpostSpecs: Array<{
    id: string;
    title: string;
    x: number;
    z: number;
    hasLantern: boolean;
    boards: Array<{
      destinationId: TrailDestinationId;
      label: string;
      boardYaw: number;
      yOffset: number;
    }>;
  }> = [
    // Signpost A — Arrival Shore Path Start (beside right edge of Primary Route at (3.1, -136.5))
    {
      id: 'signpost-arrival-shore',
      title: 'Arrival Shore Trailhead Signpost',
      x: 3.1,
      z: -136.5,
      hasLantern: true,
      boards: [
        {
          destinationId: 'memory-garden',
          label: 'Memory Garden',
          boardYaw: getRouteDirectionYawAt('primary-route', 0, -136.5, true),
          yOffset: 2.22,
        },
        {
          destinationId: 'stargazing-deck',
          label: 'Stargazing Deck',
          boardYaw:
            getRouteDirectionYawAt('primary-route', 0, -136.5, true) + 0.18,
          yOffset: 1.9,
        },
        {
          destinationId: 'hidden-cave',
          label: 'Hidden Cave',
          boardYaw:
            getRouteDirectionYawAt('primary-route', 0, -136.5, true) + 0.06,
          yOffset: 1.58,
        },
      ],
    },
    // Signpost B — Memory Garden Junction (beside junction at (-31.4, -17.6))
    {
      id: 'signpost-memory-garden-junction',
      title: 'Memory Garden Route Junction Signpost',
      x: -31.4,
      z: -17.6,
      hasLantern: true,
      boards: [
        {
          destinationId: 'hidden-cave',
          label: 'Hidden Cave',
          boardYaw: getRouteDirectionYawAt(
            'primary-route',
            -35.0,
            -20.0,
            true,
          ),
          yOffset: 2.22,
        },
        {
          destinationId: 'stargazing-deck',
          label: 'Stargazing Deck',
          boardYaw: getRouteDirectionYawAt(
            'eastern-branch',
            -35.0,
            -20.0,
            true,
          ),
          yOffset: 1.9,
        },
        {
          destinationId: 'reflective-pond',
          label: 'Reflective Pond',
          boardYaw: getRouteDirectionYawAt(
            'garden-loop',
            -35.0,
            -20.0,
            true,
          ),
          yOffset: 1.58,
        },
      ],
    },
    // Signpost C — Northern Foothill Junction (where Garden Loop reconnects to Primary Route at (-26.6, +14.2))
    {
      id: 'signpost-northern-foothill-junction',
      title: 'Northern Foothill Junction Signpost',
      x: -26.6,
      z: 14.2,
      hasLantern: true,
      boards: [
        {
          destinationId: 'hidden-cave',
          label: 'Hidden Cave',
          boardYaw: getRouteDirectionYawAt('primary-route', -30.0, 12.0, true),
          yOffset: 2.16,
        },
        {
          destinationId: 'memory-garden',
          label: 'Memory Garden',
          boardYaw: getRouteDirectionYawAt(
            'primary-route',
            -30.0,
            12.0,
            false,
          ),
          yOffset: 1.82,
        },
      ],
    },
    // Signpost D — Cave Approach Split (where Highland Ridge Saddle splits from Primary Route at (21.2, +92.8))
    {
      id: 'signpost-cave-approach',
      title: 'Cave Approach & Northern Ridge Split Signpost',
      x: 21.2,
      z: 92.8,
      hasLantern: true,
      boards: [
        {
          destinationId: 'hidden-cave',
          label: 'Hidden Cave',
          boardYaw: getRouteDirectionYawAt('primary-route', 24.0, 90.0, true),
          yOffset: 2.16,
        },
        {
          destinationId: 'northern-ridge',
          label: 'Northern Ridge',
          boardYaw: Math.atan2(0.0 - 24.0, 145.0 - 90.0),
          yOffset: 1.82,
        },
      ],
    },
  ];

  const signposts: TrailSignpostInfo[] = [];
  const signRng = createPrivateSeededRng(20270214 ^ 0x51a9d30b);

  signpostSpecs.forEach((spec) => {
    const sy = getPrivateTerrainHeight(spec.x, spec.z);
    const spGroup = new THREE.Group();
    spGroup.name = `PrivateTrail_${spec.id}`;
    spGroup.position.set(spec.x, sy, spec.z);

    // Slight natural handcrafted lean
    spGroup.rotation.z = (signRng() - 0.5) * 0.035;
    spGroup.rotation.x = (signRng() - 0.5) * 0.035;

    // 1. Weathered Vertical Wooden Post + Carved Pyramid Cap
    const postMesh = new THREE.Mesh(postTimberGeo, walnutPostMat);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    const capMesh = new THREE.Mesh(postCapGeo, ironFastenerMat);
    capMesh.castShadow = true;
    spGroup.add(postMesh, capMesh);

    // 2. Mossy Stone Cairn Collar at Base
    const mossCollar = new THREE.Mesh(baseMossGeo, mossyBaseMat);
    mossCollar.position.y = 0.04;
    mossCollar.receiveShadow = true;
    spGroup.add(mossCollar);

    for (let b = 0; b < 4; b++) {
      const bang = (b / 4) * Math.PI * 2 + 0.35;
      const bStone = new THREE.Mesh(baseStoneGeo, stoneCairnMat);
      bStone.position.set(
        Math.cos(bang) * 0.24,
        0.11,
        Math.sin(bang) * 0.24,
      );
      bStone.scale.set(1.1, 0.72, 0.95);
      bStone.rotation.y = bang;
      bStone.castShadow = true;
      spGroup.add(bStone);
    }

    // 3. Directional Carved Arrow Boards with True Route Distances
    const entries: TrailSignBoardEntry[] = [];
    spec.boards.forEach((bCfg) => {
      const routeDist = computePlayerRouteDistanceTo(
        spec.x,
        spec.z,
        bCfg.destinationId,
      );
      const boardTex = trackTex(
        createCarvedSignBoardTexture(bCfg.label, routeDist, maxAniso),
      );
      const boardMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: boardTex,
          roughness: 0.78,
          metalness: 0.05,
        }),
      );

      const boardMesh = new THREE.Mesh(boardGeo, boardMat);
      boardMesh.position.set(0, bCfg.yOffset, 0);
      boardMesh.rotation.y = bCfg.boardYaw;
      boardMesh.castShadow = true;
      boardMesh.receiveShadow = true;
      spGroup.add(boardMesh);

      // Wrought-iron mounting collar band around post at board height
      const collar = new THREE.Mesh(ironBandGeo, ironFastenerMat);
      collar.position.set(0, bCfg.yOffset, 0);
      spGroup.add(collar);

      entries.push({
        destinationId: bCfg.destinationId,
        label: bCfg.label,
        routeDistanceMeters: routeDist,
        boardYawRadians: bCfg.boardYaw,
        yOffset: bCfg.yOffset,
      });
    });

    // 4. Subtle Warm Micro-Lantern Hanging From the Top Bracket
    if (spec.hasLantern) {
      const lanternGroup = new THREE.Group();
      lanternGroup.position.set(0, 2.46, 0);
      lanternGroup.rotation.y = spec.boards[0].boardYaw + Math.PI * 0.5;

      const arm = new THREE.Mesh(lanternArmGeo, ironFastenerMat);
      arm.position.set(0, 0, 0.16);
      const cage = new THREE.Mesh(lanternCageGeo, lanternAmberMat);
      cage.position.set(0, -0.1, 0.29);
      const roof = new THREE.Mesh(lanternRoofGeo, ironFastenerMat);
      roof.position.set(0, -0.01, 0.29);

      lanternGroup.add(arm, cage, roof);
      spGroup.add(lanternGroup);
    }

    group.add(spGroup);
    colliders.push({ x: spec.x, z: spec.z, radius: 0.38 });

    signposts.push({
      id: spec.id,
      title: spec.title,
      x: spec.x,
      y: sy,
      z: spec.z,
      entries,
    });
  });

  // ============================================================================
  // 4. REASSURANCE TRAIL MARKERS EVERY ~34m ALONG THE PRIMARY ROUTE
  //    Small handcrafted wooden trail posts with carved directional chevrons
  // ============================================================================
  const reassuranceArcPositions = [
    36.0, 72.0, 106.0, 174.0, 206.0, 238.0, 266.0,
  ];
  const markerPostGeo = trackGeo(
    new THREE.BoxGeometry(0.16, 0.88, 0.14),
  );
  markerPostGeo.translate(0, 0.44, 0);

  const markerCapGeo = trackGeo(new THREE.BoxGeometry(0.19, 0.06, 0.17));
  markerCapGeo.translate(0, 0.89, 0);

  const chevronBarGeo = trackGeo(new THREE.BoxGeometry(0.03, 0.16, 0.045));
  const _markerNormal = new THREE.Vector3();

  reassuranceArcPositions.forEach((arcS, idx) => {
    if (arcS >= primaryCache.totalLength - 12.0) return;
    const sample = sampleRouteAtArcS(primaryCache, arcS);
    // Place alternating left/right just outside the path edge (halfWidth + 0.95m)
    const side = idx % 2 === 0 ? 1 : -1;
    const normalX = -sample.tangentZ;
    const normalZ = sample.tangentX;
    const mx = sample.x + normalX * side * (primaryCache.route.halfWidth + 0.92);
    const mz = sample.z + normalZ * side * (primaryCache.route.halfWidth + 0.92);

    // Skip if too close to one of the 4 main signposts
    const nearMainSign = signposts.some(
      (sp) => Math.hypot(mx - sp.x, mz - sp.z) < 9.5,
    );
    if (nearMainSign) return;

    const my = getPrivateTerrainHeight(mx, mz);
    getPrivateTerrainNormal(mx, mz, _markerNormal);

    const markerGroup = new THREE.Group();
    markerGroup.name = `PrivateTrail_ReassuranceMarker_${idx + 1}`;
    markerGroup.position.set(mx, my, mz);
    // Orient marker so its face looks toward the path and its carved arrow points forward along the route
    const routeYaw = Math.atan2(sample.tangentX, sample.tangentZ);
    markerGroup.rotation.y = routeYaw;

    const post = new THREE.Mesh(markerPostGeo, walnutPostMat);
    post.castShadow = true;
    post.receiveShadow = true;
    const cap = new THREE.Mesh(markerCapGeo, ironFastenerMat);
    const moss = new THREE.Mesh(baseMossGeo, mossyBaseMat);
    moss.scale.set(0.68, 0.8, 0.68);
    moss.position.y = 0.03;

    // Carved luminous wood-inlay arrow chevron on both sides of the marker post pointing toward +Z (route forward)
    for (const faceSide of [-1, 1] as const) {
      const upperWing = new THREE.Mesh(chevronBarGeo, carvedArrowInlayMat);
      upperWing.position.set(faceSide * 0.082, 0.64, 0.01);
      upperWing.rotation.x = -0.68;

      const lowerWing = new THREE.Mesh(chevronBarGeo, carvedArrowInlayMat);
      lowerWing.position.set(faceSide * 0.082, 0.56, 0.01);
      lowerWing.rotation.x = 0.68;

      markerGroup.add(upperWing, lowerWing);
    }

    markerGroup.add(post, cap, moss);
    group.add(markerGroup);
    colliders.push({ x: mx, z: mz, radius: 0.26 });
  });

  // Precompute the arcS positions of Signposts B, C, and D along `primary-route` (routeIndex === 0)
  // so approaching a junction signpost gently brightens the outgoing path branch toward the Hidden Cave.
  const junctionSignArcs = [
    {
      x: -31.4,
      z: -17.6,
      arcS: sGardenOnPrimary,
    },
    {
      x: -26.6,
      z: 14.2,
      arcS: sFoothillOnPrimary,
    },
    {
      x: 21.2,
      z: 92.8,
      arcS: sCaveSplitOnPrimary,
    },
  ];

  return {
    group,
    colliders,
    signposts,
    computePlayerRouteDistanceTo,
    getCaveJunctionGuidanceBoost(
      playerX: number,
      playerZ: number,
      elementRouteIndex: number,
      elementArcS: number,
    ): number {
      // Only boost mushroom colonies on the primary route leading toward the Hidden Cave
      if (elementRouteIndex !== 0) return 0;

      let bestBoost = 0;
      for (let i = 0; i < junctionSignArcs.length; i++) {
        const junc = junctionSignArcs[i];
        const distToSign = Math.hypot(playerX - junc.x, playerZ - junc.z);
        if (distToSign < 11.5) {
          const signProx = 1.0 - THREE.MathUtils.smoothstep(distToSign, 3.0, 11.5);
          const forwardDeltaS = elementArcS - junc.arcS;
          // Brighten the first 24m of the outgoing branch toward the Hidden Cave
          if (forwardDeltaS >= -1.5 && forwardDeltaS <= 24.0) {
            const branchEnv = Math.sin(
              ((forwardDeltaS + 1.5) / 25.5) * Math.PI,
            );
            bestBoost = Math.max(bestBoost, signProx * branchEnv * 0.42);
          }
        }
      }
      return bestBoost;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
