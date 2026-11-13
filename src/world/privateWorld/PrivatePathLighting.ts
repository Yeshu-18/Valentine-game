import * as THREE from 'three';
import {
  PRIVATE_PATH_ROUTES,
  PrivatePathRoute,
  RESERVED_GROTTO_VOLUME,
  createPrivateSeededRng,
  evaluatePrivatePathNetwork,
  getPrivateTerrainHeight,
  getPrivateTerrainNormal,
  getReflectivePondSignedDistance,
} from './privateWorldMath';

export interface PrivatePathLightingTelemetry {
  activeRouteId: string;
  activeRouteName: string;
  nearestPathDist: number;
  arcDistanceMeters: number;
  routeTotalLengthMeters: number;
  waveLeadMeters: number;
  activeGlowingStones: number;
  totalEmbeddedStones: number;
}

export interface PrivatePathLightingBundle {
  group: THREE.Group;
  debugGroup: THREE.Group;
  update: (
    delta: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
  ) => void;
  reset: () => void;
  getTelemetry: () => PrivatePathLightingTelemetry;
  dispose: () => void;
}

interface PrecomputedPathSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  abx: number;
  abz: number;
  lenSq: number;
  len: number;
  startS: number;
  endS: number;
  tangentX: number;
  tangentZ: number;
}

interface RouteRuntimeState {
  route: PrivatePathRoute;
  segments: PrecomputedPathSegment[];
  totalLength: number;
  proximityWeight: number; // 0..1 smoothed proximity to path
  nearestDist: number;
  currentArcS: number;
  smoothedArcS: number;
  smoothedForwardSpeed: number;
  waveLeadOffset: number;
  closestWorldX: number;
  closestWorldZ: number;
  hasInitializedArc: boolean;
}

interface GroundedMushroomElement {
  routeIndex: number; // 0..2 for path-side mushrooms, -1 for surrounding land mushrooms
  arcS: number;
  side: -1 | 1;
  x: number;
  y: number;
  z: number;
  activation: number; // 0..1 magical glow state triggered while walking
  colorFamily: 0 | 1 | 2; // 0 = Warm Teal (#2dd4bf), 1 = Amber-Gold (#fbbf24), 2 = Soft Violet (#c084fc)
  phaseOffset: number;
}

const _normalVec = new THREE.Vector3();
const _tangentVec = new THREE.Vector3();
const _bitangentVec = new THREE.Vector3();
const _rotMatrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _posVec = new THREE.Vector3();
const _scaleVec = new THREE.Vector3();
const _instanceMatrix = new THREE.Matrix4();
const _tempColor = new THREE.Color();

/**
 * Builds a custom sculpted 3D mushroom cap profile using LatheGeometry
 * positioned atop a unit-scaled mushroom stem (cap base at y=0.38, apex at y=0.64).
 */
function createMushroomCapGeometry(): THREE.LatheGeometry {
  const profilePoints = [
    new THREE.Vector2(0.08, 0.38), // Inner gill attachment around stem
    new THREE.Vector2(0.38, 0.36), // Underside gill skirt
    new THREE.Vector2(0.46, 0.41), // Flared outer cap rim
    new THREE.Vector2(0.41, 0.49), // Lower dome curve
    new THREE.Vector2(0.26, 0.58), // Upper dome curve
    new THREE.Vector2(0.09, 0.63), // Crown shoulder
    new THREE.Vector2(0.0, 0.65), // Top center apex
  ];
  const geo = new THREE.LatheGeometry(profilePoints, 12);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a tapered organic mushroom stem anchored at y=0 (ground contact) up to y=0.42.
 */
function createMushroomStemGeometry(): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(0.075, 0.125, 0.42, 8);
  geo.translate(0, 0.21, 0);
  geo.computeVertexNormals();
  return geo;
}

export function createPrivatePathLightingSystem(): PrivatePathLightingBundle {
  const group = new THREE.Group();
  group.name = 'PrivateGroundedBiolumMushroomGroup';

  const debugGroup = new THREE.Group();
  debugGroup.name = 'PrivatePathLighting_DebugGroup';
  debugGroup.visible = false;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // ============================================================================
  // 1. PRECOMPUTE ARC-LENGTH PARAMETERIZED PATH SEGMENTS FOR ALL 3 ROUTES
  // ============================================================================
  const routeStates: RouteRuntimeState[] = PRIVATE_PATH_ROUTES.map((route) => {
    const segments: PrecomputedPathSegment[] = [];
    let accumLength = 0;
    const pts = route.samples;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lenSq = abx * abx + abz * abz;
      const len = Math.sqrt(lenSq);
      if (len < 0.001) continue;

      segments.push({
        ax: a.x,
        az: a.z,
        bx: b.x,
        bz: b.z,
        abx,
        abz,
        lenSq,
        len,
        startS: accumLength,
        endS: accumLength + len,
        tangentX: abx / len,
        tangentZ: abz / len,
      });
      accumLength += len;
    }

    return {
      route,
      segments,
      totalLength: accumLength,
      proximityWeight: 0,
      nearestDist: Infinity,
      currentArcS: 0,
      smoothedArcS: 0,
      smoothedForwardSpeed: 0,
      waveLeadOffset: 0,
      closestWorldX: pts[0].x,
      closestWorldZ: pts[0].z,
      hasInitializedArc: false,
    };
  });

  function sampleRouteAtArcLength(
    rState: RouteRuntimeState,
    targetS: number,
  ): {
    x: number;
    z: number;
    tangentX: number;
    tangentZ: number;
  } {
    const clampedS = THREE.MathUtils.clamp(targetS, 0, rState.totalLength);
    const segs = rState.segments;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (clampedS <= seg.endS || i === segs.length - 1) {
        const localT =
          seg.len > 0.0001
            ? THREE.MathUtils.clamp((clampedS - seg.startS) / seg.len, 0, 1)
            : 0;
        return {
          x: seg.ax + seg.abx * localT,
          z: seg.az + seg.abz * localT,
          tangentX: seg.tangentX,
          tangentZ: seg.tangentZ,
        };
      }
    }
    const last = segs[segs.length - 1];
    return {
      x: last.bx,
      z: last.bz,
      tangentX: last.tangentX,
      tangentZ: last.tangentZ,
    };
  }

  // ============================================================================
  // 2. GENERATE FIXED GROUNDED BIOLUMINESCENT MUSHROOM COLONIES & LAND MOSS PADS
  //    (Planted along both sides of all pathways AND across the surrounding land)
  // ============================================================================
  const rng = createPrivateSeededRng(20270214 ^ 0x7f4a7c15);

  const mushroomInstances: GroundedMushroomElement[] = [];
  const capMatrices: THREE.Matrix4[] = [];
  const stemMatrices: THREE.Matrix4[] = [];

  const groundMossRings: GroundedMushroomElement[] = [];
  const mossRingMatrices: THREE.Matrix4[] = [];

  function addMushroomColony(
    centerX: number,
    centerZ: number,
    routeIdx: number,
    arcS: number,
    side: -1 | 1,
    colonyColorFamily: 0 | 1 | 2,
    mushroomsInColony: number,
  ) {
    // Exclude Stargazing Deck timber platform, Hidden Cave interior tunnel floor, and Northern Ridge summit rock slab
    if (
      Math.hypot(centerX - 72.0, centerZ - 18.0) < 10.2 ||
      (centerZ > 55.4 && centerZ < 65.5 && Math.abs(centerX - 16.5) < 4.2) ||
      Math.hypot(centerX, centerZ - 73.5) < 4.8
    ) {
      return;
    }

    const centerY = getPrivateTerrainHeight(centerX, centerZ);
    if (
      centerY < 0.65 ||
      getReflectivePondSignedDistance(centerX, centerZ) < 0.45
    ) {
      return;
    }

    // 1. Add a Grounded Bioluminescent Moss / Mycelium Pad flush with the land underneath the colony
    getPrivateTerrainNormal(centerX, centerZ, _normalVec);
    const ringYaw = rng() * Math.PI * 2;
    _tangentVec.set(Math.sin(ringYaw), 0, Math.cos(ringYaw)).normalize();
    _bitangentVec.crossVectors(_normalVec, _tangentVec).normalize();
    _tangentVec.crossVectors(_bitangentVec, _normalVec).normalize();
    _rotMatrix.makeBasis(_bitangentVec, _normalVec, _tangentVec);
    _quat.setFromRotationMatrix(_rotMatrix);

    const ringRadius = 0.68 + rng() * 0.52;
    _posVec.set(centerX, centerY + 0.022, centerZ);
    _scaleVec.set(ringRadius, 0.035, ringRadius * (0.82 + rng() * 0.34));
    _instanceMatrix.compose(_posVec, _quat, _scaleVec);

    const colonyPhase = rng() * Math.PI * 2;
    groundMossRings.push({
      routeIndex: routeIdx,
      arcS,
      side,
      x: centerX,
      y: centerY + 0.022,
      z: centerZ,
      activation: 0,
      colorFamily: colonyColorFamily,
      phaseOffset: colonyPhase,
    });
    mossRingMatrices.push(_instanceMatrix.clone());

    // 2. Plant 2 to 3 fixed 3D mushrooms in the colony with varied height, cap width, and natural lean
    for (let m = 0; m < mushroomsInColony; m++) {
      const ang = (m / mushroomsInColony) * Math.PI * 2 + rng() * 0.85;
      const dist = m === 0 ? 0.06 * rng() : 0.22 + rng() * 0.34;
      const mx = centerX + Math.cos(ang) * dist;
      const mz = centerZ + Math.sin(ang) * dist;
      const my = getPrivateTerrainHeight(mx, mz);

      getPrivateTerrainNormal(mx, mz, _normalVec);
      // Slight organic tilt away from colony center
      _normalVec.x += Math.cos(ang) * 0.14;
      _normalVec.z += Math.sin(ang) * 0.14;
      _normalVec.normalize();

      const mYaw = rng() * Math.PI * 2;
      _tangentVec.set(Math.sin(mYaw), 0, Math.cos(mYaw)).normalize();
      _bitangentVec.crossVectors(_normalVec, _tangentVec).normalize();
      _tangentVec.crossVectors(_bitangentVec, _normalVec).normalize();
      _rotMatrix.makeBasis(_bitangentVec, _normalVec, _tangentVec);
      _quat.setFromRotationMatrix(_rotMatrix);

      // Primary specimen mushroom in center is taller; companion mushrooms are smaller
      const sizeScale =
        m === 0 ? 0.92 + rng() * 0.48 : 0.54 + rng() * 0.42;
      const heightScale = sizeScale * (0.9 + rng() * 0.32);
      const capSpread = sizeScale * (0.95 + rng() * 0.35);

      _posVec.set(mx, my - 0.015, mz);
      _scaleVec.set(capSpread, heightScale, capSpread);
      _instanceMatrix.compose(_posVec, _quat, _scaleVec);

      const mColorFamily =
        m === 2
          ? (((colonyColorFamily + 1) % 3) as 0 | 1 | 2)
          : colonyColorFamily;

      mushroomInstances.push({
        routeIndex: routeIdx,
        arcS,
        side,
        x: mx,
        y: my,
        z: mz,
        activation: 0,
        colorFamily: mColorFamily,
        phaseOffset: colonyPhase + m * 0.45,
      });
      capMatrices.push(_instanceMatrix.clone());
      stemMatrices.push(_instanceMatrix.clone());
    }
  }

  // 2A. Plant Paired Left & Right Mushroom Colonies Along All 3 Pathways
  routeStates.forEach((rState, routeIdx) => {
    const halfW = rState.route.halfWidth;
    const stepMeters = 2.0;
    let stepIdx = 0;

    for (let s = 1.4; s < rState.totalLength - 1.1; s += stepMeters) {
      stepIdx++;
      const sample = sampleRouteAtArcLength(rState, s);
      const normalX = -sample.tangentZ;
      const normalZ = sample.tangentX;

      for (const side of [-1, 1] as const) {
        const lat = side * (halfW + 0.36 + rng() * 1.25);
        const along = (rng() - 0.5) * 0.55;
        const cx = sample.x + normalX * lat + sample.tangentX * along;
        const cz = sample.z + normalZ * lat + sample.tangentZ * along;

        const colorFam = ((stepIdx + (side === 1 ? 1 : 0)) % 3) as 0 | 1 | 2;
        const count = rng() < 0.55 ? 3 : 2;
        addMushroomColony(cx, cz, routeIdx, s, side, colorFam, count);
      }
    }
  });

  // 2A-bis. Plant Paired Mushroom Colonies Along the Highland Ridge Saddle Trail ((13, 49) -> (0, 72))
  // and Flanking the Hidden Cave Entrance Threshold (+18, +53.5..+57)
  const ridgeDirX = -13.0 / Math.hypot(-13.0, 23.0);
  const ridgeDirZ = 23.0 / Math.hypot(-13.0, 23.0);
  const ridgeNormalX = -ridgeDirZ;
  const ridgeNormalZ = ridgeDirX;
  for (let step = 0; step < 12; step++) {
    const t = (step + 0.5) / 12;
    const baseX = 13.0 - 13.0 * t + Math.sin(t * Math.PI * 2.0) * 1.3;
    const baseZ = 49.0 + 23.0 * t;
    for (const side of [-1, 1] as const) {
      const lat = side * (2.3 + rng() * 1.2);
      const cx = baseX + ridgeNormalX * lat;
      const cz = baseZ + ridgeNormalZ * lat;
      const colorFam = ((step + (side === 1 ? 1 : 0)) % 3) as 0 | 1 | 2;
      addMushroomColony(cx, cz, -1, 0, side, colorFam, rng() < 0.5 ? 3 : 2);
    }
  }

  // Subtle Bioluminescent Mushroom Clusters Flanking the Hidden Cave Entrance Arch & Outer Threshold
  const caveEntranceColonies: Array<{ x: number; z: number; color: 0 | 1 | 2 }> = [
    { x: 14.5, z: 53.5, color: 0 },
    { x: 21.5, z: 53.4, color: 2 },
    { x: 14.9, z: 55.1, color: 2 },
    { x: 21.1, z: 55.0, color: 0 },
    { x: 15.4, z: 56.6, color: 1 },
    { x: 20.6, z: 56.5, color: 0 },
  ];
  caveEntranceColonies.forEach((col, idx) => {
    addMushroomColony(
      col.x,
      col.z,
      -1,
      0,
      idx % 2 === 0 ? -1 : 1,
      col.color,
      3,
    );
  });

  // 2B. Plant Fixed Land Mushroom Colonies Across the Memory Garden, Pond Banks & Surrounding Meadow
  const LAND_COLONY_CANDIDATES = 180;
  for (let i = 0; i < LAND_COLONY_CANDIDATES; i++) {
    let lx = 0;
    let lz = 0;
    if (i < 110) {
      // Concentrated in the Memory Garden, Reflective Pond glade, and central basin
      const ang = rng() * Math.PI * 2;
      const rad = 3.5 + Math.pow(rng(), 0.75) * 42.0;
      lx = -12.0 + Math.cos(ang) * rad;
      lz = -4.0 + Math.sin(ang) * rad;
    } else {
      // Scattered across the broader walkable island land
      lx = (rng() - 0.5) * 160.0;
      lz = (rng() - 0.5) * 135.0;
    }

    // Skip reserved grotto volume, pier, deck, cave forecourt, or middle of paths
    if (
      lx >= RESERVED_GROTTO_VOLUME.minX - 2 &&
      lx <= RESERVED_GROTTO_VOLUME.maxX + 2 &&
      lz >= RESERVED_GROTTO_VOLUME.minZ - 2 &&
      lz <= RESERVED_GROTTO_VOLUME.maxZ + 2
    ) {
      continue;
    }
    if (
      (Math.abs(lx) < 5.0 && lz < -71.0) ||
      Math.hypot(lx - 72, lz - 18) < 11.0 ||
      Math.hypot(lx - 18, lz - 56) < 8.5
    ) {
      continue;
    }

    const pathEval = evaluatePrivatePathNetwork(lx, lz);
    if (pathEval.minDist < 2.4) continue; // Keep path centers clean

    const ly = getPrivateTerrainHeight(lx, lz);
    if (ly < 1.1 || ly > 20.5) continue;

    const colorFam = (i % 3) as 0 | 1 | 2;
    addMushroomColony(lx, lz, -1, 0, 1, colorFam, rng() < 0.5 ? 3 : 2);
  }

  // ============================================================================
  // 3. BUILD INSTANCED MESHES FOR MUSHROOM CAPS, STEMS & GROUND MOSS RINGS
  // ============================================================================
  const createReactiveBiolumMaterial = (
    baseColorHex: string,
    roughness: number,
    emissiveBoost: number,
  ) => {
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColorHex),
        roughness,
        metalness: 0.05,
      }),
    );

    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        #ifdef USE_INSTANCING_COLOR
          vec3 glowExcess = max(vec3(0.0), vColor.rgb - vec3(0.14, 0.16, 0.18));
          totalEmissiveRadiance += glowExcess * ${emissiveBoost.toFixed(2)};
        #endif
        `,
      );
    };
    return mat;
  };

  // 3A. Bioluminescent Mushroom Caps InstancedMesh
  const capGeo = trackGeo(createMushroomCapGeometry());
  const capMat = createReactiveBiolumMaterial('#ffffff', 0.36, 3.6);
  const capInstMesh = new THREE.InstancedMesh(
    capGeo,
    capMat,
    Math.max(1, mushroomInstances.length),
  );
  capInstMesh.name = 'PrivateLand_BiolumMushroomCaps';
  capInstMesh.castShadow = true;
  capInstMesh.receiveShadow = true;

  // 3B. Mushroom Stems InstancedMesh
  const stemGeo = trackGeo(createMushroomStemGeometry());
  const stemMat = createReactiveBiolumMaterial('#e5e0d5', 0.68, 1.85);
  const stemInstMesh = new THREE.InstancedMesh(
    stemGeo,
    stemMat,
    Math.max(1, mushroomInstances.length),
  );
  stemInstMesh.name = 'PrivateLand_BiolumMushroomStems';
  stemInstMesh.receiveShadow = true;

  for (let i = 0; i < mushroomInstances.length; i++) {
    capInstMesh.setMatrixAt(i, capMatrices[i]);
    capInstMesh.setColorAt(i, new THREE.Color('#2a323d'));
    stemInstMesh.setMatrixAt(i, stemMatrices[i]);
    stemInstMesh.setColorAt(i, new THREE.Color('#3b3834'));
  }
  capInstMesh.instanceMatrix.needsUpdate = true;
  if (capInstMesh.instanceColor) capInstMesh.instanceColor.needsUpdate = true;
  capInstMesh.computeBoundingSphere();
  group.add(capInstMesh);

  stemInstMesh.instanceMatrix.needsUpdate = true;
  if (stemInstMesh.instanceColor) stemInstMesh.instanceColor.needsUpdate = true;
  stemInstMesh.computeBoundingSphere();
  group.add(stemInstMesh);

  // 3C. Grounded Bioluminescent Land Moss Rings beneath Mushroom Colonies
  const mossRingGeo = trackGeo(new THREE.CylinderGeometry(0.82, 0.98, 1.0, 9));
  const mossRingMat = createReactiveBiolumMaterial('#ffffff', 0.78, 2.95);
  const mossRingInstMesh = new THREE.InstancedMesh(
    mossRingGeo,
    mossRingMat,
    Math.max(1, groundMossRings.length),
  );
  mossRingInstMesh.name = 'PrivateLand_GlowingGroundMossRings';
  mossRingInstMesh.receiveShadow = true;

  for (let i = 0; i < groundMossRings.length; i++) {
    mossRingInstMesh.setMatrixAt(i, mossRingMatrices[i]);
    mossRingInstMesh.setColorAt(i, new THREE.Color('#1f3834'));
  }
  mossRingInstMesh.instanceMatrix.needsUpdate = true;
  if (mossRingInstMesh.instanceColor) {
    mossRingInstMesh.instanceColor.needsUpdate = true;
  }
  mossRingInstMesh.computeBoundingSphere();
  group.add(mossRingInstMesh);

  // ============================================================================
  // 4. PAIRED LEFT & RIGHT GROUND FOLLOWER LIGHTS (Warm Teal & Amber-Violet)
  // ============================================================================
  const leftSideLight = new THREE.PointLight(0x2dd4bf, 0.0, 18.0, 1.45);
  leftSideLight.name = 'PrivatePath_LeftMushroomGroundLight';
  leftSideLight.castShadow = false;
  leftSideLight.userData.skipAtmosphereCull = true;
  group.add(leftSideLight);

  const rightSideLight = new THREE.PointLight(0xfbbf24, 0.0, 18.0, 1.45);
  rightSideLight.name = 'PrivatePath_RightMushroomGroundLight';
  rightSideLight.castShadow = false;
  rightSideLight.userData.skipAtmosphereCull = true;
  group.add(rightSideLight);

  // ============================================================================
  // 5. DEV-ONLY DEBUG MARKERS (Closest Point on Path & Travelling Wave Front)
  // ============================================================================
  const debugNearestGeo = trackGeo(new THREE.RingGeometry(0.7, 1.0, 24));
  debugNearestGeo.rotateX(-Math.PI / 2);
  const debugNearestMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#38bdf8'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    }),
  );
  const debugNearestMarker = new THREE.Mesh(debugNearestGeo, debugNearestMat);
  debugNearestMarker.name = 'DebugPath_NearestPlayerProjection';
  debugGroup.add(debugNearestMarker);

  const debugWaveGeo = trackGeo(new THREE.RingGeometry(1.1, 1.5, 24));
  debugWaveGeo.rotateX(-Math.PI / 2);
  const debugWaveMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fbbf24'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    }),
  );
  const debugWaveMarker = new THREE.Mesh(debugWaveGeo, debugWaveMat);
  debugWaveMarker.name = 'DebugPath_ForwardIlluminationWave';
  debugGroup.add(debugWaveMarker);

  // Confirmed 3-Color Bioluminescent Mushroom Palette:
  // 0 = Warm Teal (#2dd4bf -> #5eead4), 1 = Amber-Gold (#fbbf24 -> #fde68a), 2 = Soft Violet (#c084fc -> #e9d5ff)
  const cDormantCapTeal = new THREE.Color('#213d3b');
  const cActiveCapTeal = new THREE.Color('#2dd4bf');
  const cPeakCapTeal = new THREE.Color('#67e8f9');

  const cDormantCapAmber = new THREE.Color('#3d3222');
  const cActiveCapAmber = new THREE.Color('#fbbf24');
  const cPeakCapAmber = new THREE.Color('#fef08a');

  const cDormantCapViolet = new THREE.Color('#322642');
  const cActiveCapViolet = new THREE.Color('#c084fc');
  const cPeakCapViolet = new THREE.Color('#f3e8ff');

  const cDormantStem = new THREE.Color('#3b3935');
  const cActiveStemTeal = new THREE.Color('#99f6e4');
  const cActiveStemAmber = new THREE.Color('#fde68a');
  const cActiveStemViolet = new THREE.Color('#e9d5ff');

  const cDormantMossRing = new THREE.Color('#1f3834');

  let primaryActiveRouteIdx = 0;
  let activeGlowingMushroomsCount = 0;
  let walkingActivity = 0; // 0..1 smooth walking factor (lights up while walking, fades when stopped)

  // Junction Signpost Arc-S Coordinates on `primary-route` (routeIndex === 0):
  // Approaching Signpost B (-15.8, -8.8), Signpost C (-13.2, 7.2), or Signpost D (10.5, 47.2)
  // gently brightens the outgoing path branch toward the Hidden Cave.
  const JUNCTION_SIGN_ARCS = [
    { x: -15.8, z: -8.8, arcS: 68.5 },
    { x: -13.2, z: 7.2, arcS: 85.0 },
    { x: 10.5, z: 47.2, arcS: 134.0 },
  ];

  function evaluateCaveJunctionGuidance(
    el: GroundedMushroomElement,
    playerPos: THREE.Vector3,
    elapsedTime: number,
  ): number {
    if (el.routeIndex !== 0) return 0.0;
    let bestBoost = 0.0;
    for (let j = 0; j < JUNCTION_SIGN_ARCS.length; j++) {
      const junc = JUNCTION_SIGN_ARCS[j];
      const dSign = Math.hypot(playerPos.x - junc.x, playerPos.z - junc.z);
      if (dSign < 11.5) {
        const signProx =
          1.0 - THREE.MathUtils.smoothstep(dSign, 2.8, 11.5);
        const forwardDelta = el.arcS - junc.arcS;
        if (forwardDelta >= -1.5 && forwardDelta <= 24.5) {
          const env = Math.sin(((forwardDelta + 1.5) / 26.0) * Math.PI);
          const pulse =
            0.84 +
            0.16 *
              Math.sin(
                elapsedTime * 3.2 - forwardDelta * 0.45 + el.phaseOffset,
              );
          bestBoost = Math.max(bestBoost, signProx * env * pulse * 0.56);
        }
      }
    }
    return bestBoost;
  }

  function evaluateMushroomExcitation(
    el: GroundedMushroomElement,
    playerPos: THREE.Vector3,
    playerSpeed: number,
    walkFactor: number,
    elapsedTime: number,
  ): number {
    const junctionBoost = evaluateCaveJunctionGuidance(
      el,
      playerPos,
      elapsedTime,
    );

    if (walkFactor <= 0.004) {
      return junctionBoost;
    }

    // 1. Direct land proximity around Harsha as she walks across any part of the island
    const dx = el.x - playerPos.x;
    const dz = el.z - playerPos.z;
    const directDistSq = dx * dx + dz * dz;
    const localLandHalo = Math.exp(-directDistSq / (2.0 * 7.2 * 7.2));

    // If this is an off-path land mushroom colony, excite it via local walking radius
    if (el.routeIndex < 0) {
      const landRipple =
        0.82 +
        0.18 *
          Math.sin(
            elapsedTime * 3.6 - Math.sqrt(directDistSq) * 0.6 + el.phaseOffset,
          );
      return localLandHalo * landRipple * walkFactor;
    }

    // 2. Path-side mushroom colonies: combine local halo + forward-sweeping sideways wave along the path
    const rState = routeStates[el.routeIndex];
    if (rState.proximityWeight <= 0.004) {
      return Math.max(junctionBoost, localLandHalo * walkFactor);
    }

    const deltaS = el.arcS - rState.smoothedArcS;
    const dirSign =
      Math.abs(rState.smoothedForwardSpeed) > 0.12
        ? Math.sign(rState.smoothedForwardSpeed)
        : 1.0;
    const signedForwardS = deltaS * dirSign;

    // Forward-moving wave along both sides of the path
    const waveCenter = rState.waveLeadOffset * dirSign;
    const waveDelta = el.arcS - (rState.smoothedArcS + waveCenter);
    const waveWidth = 5.2 + Math.min(4.0, playerSpeed * 0.55);
    const forwardWave =
      Math.exp(-(waveDelta * waveDelta) / (2.0 * waveWidth * waveWidth)) *
      (0.82 + 0.18 * Math.min(1.0, playerSpeed / 5.0));

    // Synchronized left/right sideways corridor (-3.0m behind to +16.5m ahead while walking)
    let sidewaysCorridor = 0;
    if (signedForwardS >= -3.0 && signedForwardS <= 16.5) {
      const corridorT = (signedForwardS + 3.0) / 19.5;
      const travelingRipple =
        0.78 +
        0.22 *
          Math.sin(
            elapsedTime * 4.0 - signedForwardS * 0.65 + el.phaseOffset * 0.3,
          );
      sidewaysCorridor = Math.sin(corridorT * Math.PI) * 0.94 * travelingRipple;
    }

    const pathExcitation =
      Math.max(forwardWave, sidewaysCorridor) * rState.proximityWeight;
    return Math.max(
      junctionBoost,
      Math.max(localLandHalo, pathExcitation) * walkFactor,
    );
  }


  return {
    group,
    debugGroup,
    update(
      delta: number,
      elapsedTime: number,
      playerPos: THREE.Vector3,
      playerVel: THREE.Vector3,
    ) {
      const dt = Math.min(Math.max(delta, 0.001), 0.1);
      const playerSpeed = Math.hypot(playerVel.x, playerVel.z);

      // Update smooth walking activity (0 when stopped, ramps to 1 while walking)
      const isWalkingNow = playerSpeed > 0.2;
      const targetWalk = isWalkingNow
        ? THREE.MathUtils.clamp((playerSpeed - 0.12) / 2.0, 0.42, 1.0)
        : 0.0;
      const walkRate = isWalkingNow ? 7.0 : 1.75;
      walkingActivity +=
        (targetWalk - walkingActivity) * (1.0 - Math.exp(-dt * walkRate));

      // 1. Project player onto each of the 3 routes and update smooth route states
      let bestRouteIdx = 0;
      let minRouteDist = Infinity;

      for (let r = 0; r < routeStates.length; r++) {
        const rState = routeStates[r];
        const segs = rState.segments;

        let bestDistSq = Infinity;
        let bestArcS = rState.currentArcS;
        let bestTangentX = 0;
        let bestTangentZ = 1;
        let bestProjX = rState.closestWorldX;
        let bestProjZ = rState.closestWorldZ;

        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          const t = THREE.MathUtils.clamp(
            ((playerPos.x - seg.ax) * seg.abx +
              (playerPos.z - seg.az) * seg.abz) /
              seg.lenSq,
            0,
            1,
          );
          const px = seg.ax + t * seg.abx;
          const pz = seg.az + t * seg.abz;
          const dx = playerPos.x - px;
          const dz = playerPos.z - pz;
          const dSq = dx * dx + dz * dz;

          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestArcS = seg.startS + t * seg.len;
            bestTangentX = seg.tangentX;
            bestTangentZ = seg.tangentZ;
            bestProjX = px;
            bestProjZ = pz;
          }
        }

        const bestDist = Math.sqrt(bestDistSq);
        rState.nearestDist = bestDist;
        rState.currentArcS = bestArcS;
        rState.closestWorldX = bestProjX;
        rState.closestWorldZ = bestProjZ;

        if (bestDist < minRouteDist) {
          minRouteDist = bestDist;
          bestRouteIdx = r;
        }

        const targetProx =
          1.0 -
          THREE.MathUtils.smoothstep(
            bestDist,
            rState.route.halfWidth + 2.0,
            rState.route.halfWidth + 11.5,
          );
        const proxAlpha =
          1.0 -
          Math.exp(-dt * (targetProx > rState.proximityWeight ? 6.5 : 2.0));
        rState.proximityWeight +=
          (targetProx - rState.proximityWeight) * proxAlpha;

        if (!rState.hasInitializedArc || rState.proximityWeight < 0.02) {
          rState.smoothedArcS = bestArcS;
          rState.hasInitializedArc = true;
        } else {
          const arcAlpha = 1.0 - Math.exp(-dt * 8.0);
          rState.smoothedArcS += (bestArcS - rState.smoothedArcS) * arcAlpha;
        }

        const rawForwardSpeed =
          playerVel.x * bestTangentX + playerVel.z * bestTangentZ;
        const velAlpha = 1.0 - Math.exp(-dt * 5.5);
        rState.smoothedForwardSpeed +=
          (rawForwardSpeed - rState.smoothedForwardSpeed) * velAlpha;

        const speedMag = Math.abs(rState.smoothedForwardSpeed);
        if (speedMag > 0.2) {
          const sweepCycle = (elapsedTime * 1.4) % 1.0;
          const targetLead =
            3.5 +
            Math.min(7.5, speedMag * 0.9) +
            sweepCycle * (4.8 + Math.min(3.5, speedMag * 0.4));
          rState.waveLeadOffset = THREE.MathUtils.lerp(
            rState.waveLeadOffset,
            targetLead,
            1.0 - Math.exp(-dt * 6.5),
          );
        } else {
          rState.waveLeadOffset = THREE.MathUtils.lerp(
            rState.waveLeadOffset,
            0.0,
            1.0 - Math.exp(-dt * 3.5),
          );
        }
      }

      primaryActiveRouteIdx = bestRouteIdx;

      // 2. Update Fixed Mushroom Caps & Stems (Warm Teal, Amber-Gold, Soft Violet)
      const riseAlpha = 1.0 - Math.exp(-dt / 0.16);
      const decayAlpha = 1.0 - Math.exp(-dt / 2.6);
      let glowingCount = 0;

      for (let i = 0; i < mushroomInstances.length; i++) {
        const el = mushroomInstances[i];
        const targetExcitation = evaluateMushroomExcitation(
          el,
          playerPos,
          playerSpeed,
          walkingActivity,
          elapsedTime,
        );

        if (targetExcitation > el.activation) {
          el.activation += (targetExcitation - el.activation) * riseAlpha;
        } else {
          el.activation += (targetExcitation - el.activation) * decayAlpha;
        }

        // Subtle baseline twilight visibility (0.12) + bright walking bioluminescence
        const breathe =
          0.92 + 0.08 * Math.sin(elapsedTime * 2.8 + el.phaseOffset);
        const totalLevel = THREE.MathUtils.clamp(
          0.12 + el.activation * 0.88 * breathe,
          0,
          1,
        );

        if (el.activation > 0.14) {
          glowingCount++;
        }

        // Cap color by family: 0 = Warm Teal, 1 = Amber-Gold, 2 = Soft Violet
        const dormantCap =
          el.colorFamily === 0
            ? cDormantCapTeal
            : el.colorFamily === 1
              ? cDormantCapAmber
              : cDormantCapViolet;
        const activeCap =
          el.colorFamily === 0
            ? cActiveCapTeal
            : el.colorFamily === 1
              ? cActiveCapAmber
              : cActiveCapViolet;
        const peakCap =
          el.colorFamily === 0
            ? cPeakCapTeal
            : el.colorFamily === 1
              ? cPeakCapAmber
              : cPeakCapViolet;

        _tempColor
          .copy(dormantCap)
          .lerp(activeCap, Math.min(1.0, totalLevel * 1.25));
        if (totalLevel > 0.6) {
          _tempColor.lerp(peakCap, (totalLevel - 0.6) / 0.4);
        }
        capInstMesh.setColorAt(i, _tempColor);

        // Stem softly conducts the cap's bioluminescent hue
        const activeStem =
          el.colorFamily === 0
            ? cActiveStemTeal
            : el.colorFamily === 1
              ? cActiveStemAmber
              : cActiveStemViolet;
        _tempColor.copy(cDormantStem).lerp(activeStem, totalLevel * 0.78);
        stemInstMesh.setColorAt(i, _tempColor);
      }

      if (capInstMesh.instanceColor) {
        capInstMesh.instanceColor.needsUpdate = true;
      }
      if (stemInstMesh.instanceColor) {
        stemInstMesh.instanceColor.needsUpdate = true;
      }

      // 3. Update Grounded Bioluminescent Land Moss Rings beneath Mushroom Colonies
      for (let i = 0; i < groundMossRings.length; i++) {
        const ring = groundMossRings[i];
        const targetExcitation = evaluateMushroomExcitation(
          ring,
          playerPos,
          playerSpeed,
          walkingActivity,
          elapsedTime,
        );

        if (targetExcitation > ring.activation) {
          ring.activation += (targetExcitation - ring.activation) * riseAlpha;
        } else {
          ring.activation += (targetExcitation - ring.activation) * decayAlpha;
        }

        const ringLevel = THREE.MathUtils.clamp(
          0.08 + ring.activation * 0.92,
          0,
          1,
        );
        const activeRingTint =
          ring.colorFamily === 0
            ? cActiveCapTeal
            : ring.colorFamily === 1
              ? cActiveCapAmber
              : cActiveCapViolet;

        _tempColor
          .copy(cDormantMossRing)
          .lerp(activeRingTint, Math.pow(ringLevel, 0.85));
        mossRingInstMesh.setColorAt(i, _tempColor);
      }
      if (mossRingInstMesh.instanceColor) {
        mossRingInstMesh.instanceColor.needsUpdate = true;
      }

      activeGlowingMushroomsCount = glowingCount;

      // 4. Update Paired Ground-Level Follower PointLights (Illuminate land & mushrooms while walking)
      const activeRoute = routeStates[primaryActiveRouteIdx];
      const activeDir =
        Math.abs(activeRoute.smoothedForwardSpeed) > 0.12
          ? Math.sign(activeRoute.smoothedForwardSpeed)
          : 1.0;

      if (activeRoute.proximityWeight > 0.15) {
        const leadArc =
          activeRoute.smoothedArcS +
          activeRoute.waveLeadOffset * activeDir * 0.45;
        const waveSample = sampleRouteAtArcLength(activeRoute, leadArc);
        const sideNormalX = -waveSample.tangentZ;
        const sideNormalZ = waveSample.tangentX;
        const sideLightOffset = activeRoute.route.halfWidth + 0.95;

        const leftX = waveSample.x - sideNormalX * sideLightOffset;
        const leftZ = waveSample.z - sideNormalZ * sideLightOffset;
        const leftY = getPrivateTerrainHeight(leftX, leftZ) + 0.95;

        const rightX = waveSample.x + sideNormalX * sideLightOffset;
        const rightZ = waveSample.z + sideNormalZ * sideLightOffset;
        const rightY = getPrivateTerrainHeight(rightX, rightZ) + 0.95;

        const lightLerp = 1.0 - Math.exp(-dt * 7.5);
        leftSideLight.position.lerp(
          _posVec.set(leftX, leftY, leftZ),
          lightLerp,
        );
        rightSideLight.position.lerp(
          _posVec.set(rightX, rightY, rightZ),
          lightLerp,
        );
      } else {
        // When walking off-path across the land, keep the ground lights flanking Harsha's left and right
        const lightLerp = 1.0 - Math.exp(-dt * 7.5);
        const ly = getPrivateTerrainHeight(playerPos.x - 2.2, playerPos.z) + 0.95;
        const ry = getPrivateTerrainHeight(playerPos.x + 2.2, playerPos.z) + 0.95;
        leftSideLight.position.lerp(
          _posVec.set(playerPos.x - 2.2, ly, playerPos.z),
          lightLerp,
        );
        rightSideLight.position.lerp(
          _posVec.set(playerPos.x + 2.2, ry, playerPos.z),
          lightLerp,
        );
      }

      const groundGlowIntensity =
        walkingActivity * (2.65 + 0.35 * Math.sin(elapsedTime * 3.0));
      leftSideLight.intensity = groundGlowIntensity;
      rightSideLight.intensity = groundGlowIntensity;
      leftSideLight.visible = groundGlowIntensity > 0.02;
      rightSideLight.visible = groundGlowIntensity > 0.02;

      // 5. Update Dev-Only Debug Projection & Wave-Front Rings
      if (debugGroup.visible) {
        const nearY = getPrivateTerrainHeight(
          activeRoute.closestWorldX,
          activeRoute.closestWorldZ,
        );
        debugNearestMarker.position.set(
          activeRoute.closestWorldX,
          nearY + 0.18,
          activeRoute.closestWorldZ,
        );

        const fullWaveSample = sampleRouteAtArcLength(
          activeRoute,
          activeRoute.smoothedArcS + activeRoute.waveLeadOffset * activeDir,
        );
        const fullWaveY = getPrivateTerrainHeight(
          fullWaveSample.x,
          fullWaveSample.z,
        );
        debugWaveMarker.position.set(
          fullWaveSample.x,
          fullWaveY + 0.22,
          fullWaveSample.z,
        );
      }
    },
    reset() {
      walkingActivity = 0;
      for (let r = 0; r < routeStates.length; r++) {
        routeStates[r].proximityWeight = 0;
        routeStates[r].smoothedForwardSpeed = 0;
        routeStates[r].waveLeadOffset = 0;
        routeStates[r].hasInitializedArc = false;
      }
      for (let i = 0; i < mushroomInstances.length; i++) {
        mushroomInstances[i].activation = 0;
      }
      for (let i = 0; i < groundMossRings.length; i++) {
        groundMossRings[i].activation = 0;
      }
      leftSideLight.intensity = 0;
      rightSideLight.intensity = 0;
      activeGlowingMushroomsCount = 0;
    },
    getTelemetry(): PrivatePathLightingTelemetry {
      const rState = routeStates[primaryActiveRouteIdx];
      return {
        activeRouteId: rState.route.id,
        activeRouteName: rState.route.name,
        nearestPathDist: rState.nearestDist,
        arcDistanceMeters: rState.smoothedArcS,
        routeTotalLengthMeters: rState.totalLength,
        waveLeadMeters: rState.waveLeadOffset,
        activeGlowingStones: activeGlowingMushroomsCount,
        totalEmbeddedStones: mushroomInstances.length,
      };
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
