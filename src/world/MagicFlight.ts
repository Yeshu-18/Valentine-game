import * as THREE from 'three';
import { ResourceTracker } from './ProceduralKit';
import {
  BROOM_STAND_POS,
  CASTLE_KEEP_POS,
  CASTLE_TERRACE_POS,
  dampValue,
  easeInOutQuad,
  easeOutCubic,
  getTerrainHeight,
  mulberry32,
  smoothstep01,
} from './terrainMath';

export type BroomLifecycleState =
  | 'IDLE_AT_STAND'
  | 'MOUNTING'
  | 'FLYING'
  | 'RETURNING';

export interface MagicFlightBundle {
  group: THREE.Group;
  standWorldPos: THREE.Vector3;
  terraceWorldPos: THREE.Vector3;
  broomRoot: THREE.Group;
  broomVisual: THREE.Group;
  getState: () => BroomLifecycleState;
  isWithinStandProximity: (playerPos: THREE.Vector3) => boolean;
  getStandDistance: (playerPos: THREE.Vector3) => number;
  isOverCastleTerrace: (pos: THREE.Vector3) => boolean;
  startMounting: (playerPos: THREE.Vector3, playerYaw: number) => void;
  updateMounting: (
    dt: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
  ) => { completed: boolean; progress: number };
  syncFlyingPose: (
    broomPos: THREE.Vector3,
    yaw: number,
    pitch: number,
    roll: number,
    speed: number,
    dt: number,
  ) => void;
  startReturnToHome: (fromWorldPos: THREE.Vector3, fromYaw: number) => void;
  update: (dt: number, elapsedTime: number) => void;
  dispose: () => void;
}

const STAND_INTERACT_RADIUS = 3.2; // [E] Pick up Broom & Fly when within 3.2m
const MOUNT_DURATION = 0.85; // Smooth 0.85s lift & mount transition
const CRADLE_HEIGHT_OFFSET = 0.36; // Height of broom resting in the brass cradle above pedestal base
const CRADLE_PITCH_RAD = THREE.MathUtils.degToRad(20); // 20° diagonal resting angle in cradle

/**
 * Builds the procedural Magical Broom mesh:
 * - Dark polished curved walnut handle (1.4m length, tapering 0.022m -> 0.016m)
 * - Natural bristle bundle (0.45m length) with per-vertex organic straw noise & color variance
 * - Rich leather binding cuff (#4a2f1c) + brushed-brass rings and rider stirrups
 * Oriented along local +Z (front handle tip at +Z, bristles at -Z).
 */
export function createMagicalBroomMesh(tracker: ResourceTracker): THREE.Group {
  const broomMeshGroup = new THREE.Group();
  const rng = mulberry32(14022026);

  // 1. Dark Polished Curved Walnut Handle (1.4m)
  const handleGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.016, 0.023, 1.4, 14, 24, false),
  );
  handleGeo.rotateX(Math.PI / 2); // Align cylinder along Z axis (-0.7 to +0.7)
  handleGeo.translate(0, 0, 0.25); // Span z from -0.45m (binding) to +0.95m (front tip)

  const hPos = handleGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < hPos.count; i++) {
    const z = hPos.getZ(i);
    const u = THREE.MathUtils.clamp((z + 0.45) / 1.4, 0, 1);
    const archCurve = 0.038 * u * (1.0 - u) * 4.0;
    hPos.setY(i, hPos.getY(i) + archCurve * 0.72);
    hPos.setX(i, hPos.getX(i) + Math.sin(u * Math.PI * 2.0) * 0.008);
  }
  handleGeo.computeVertexNormals();

  const walnutHandleMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2e1d12'),
      roughness: 0.26,
      metalness: 0.06,
    }),
  );
  const handleMesh = new THREE.Mesh(handleGeo, walnutHandleMat);
  handleMesh.castShadow = true;
  broomMeshGroup.add(handleMesh);

  // Brass finial tip at the front of the walnut handle
  const finialGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.018, 0.065, 12),
  );
  finialGeo.rotateX(Math.PI / 2);
  finialGeo.translate(0, 0.004, 0.98);
  const brassMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b08d57'),
      metalness: 0.88,
      roughness: 0.36,
    }),
  );
  const finialMesh = new THREE.Mesh(finialGeo, brassMat);
  broomMeshGroup.add(finialMesh);

  // 2. Natural Bristle Bundle (0.45m length, cone tapering 0.032 -> 0.115, 24 radial segments)
  const bristleGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.032, 0.115, 0.45, 24, 10, false),
  );
  bristleGeo.rotateX(Math.PI / 2);
  bristleGeo.translate(0, 0, -0.64); // Spans z from -0.415m to -0.865m

  const bPos = bristleGeo.attributes.position as THREE.BufferAttribute;
  const bColors = new Float32Array(bPos.count * 3);
  const baseStraw = new THREE.Color('#b9985a');
  const tempColor = new THREE.Color();

  for (let i = 0; i < bPos.count; i++) {
    const vx = bPos.getX(i);
    const vy = bPos.getY(i);
    const vz = bPos.getZ(i);
    const angle = Math.atan2(vy, vx);
    const tailFactor = THREE.MathUtils.clamp((-0.415 - vz) / 0.45, 0, 1);
    const radialNoise =
      1.0 +
      (Math.sin(angle * 7.0 + vz * 14.0) * 0.045 +
        (rng() * 2.0 - 1.0) * 0.05) *
        (0.35 + 0.65 * tailFactor);

    bPos.setX(i, vx * radialNoise);
    bPos.setY(i, vy * radialNoise - tailFactor * tailFactor * 0.018);

    const cVar = 1.0 + (rng() * 2.0 - 1.0) * 0.06;
    tempColor.copy(baseStraw).multiplyScalar(cVar);
    bColors[i * 3] = tempColor.r;
    bColors[i * 3 + 1] = tempColor.g;
    bColors[i * 3 + 2] = tempColor.b;
  }
  bristleGeo.setAttribute('color', new THREE.BufferAttribute(bColors, 3));
  bristleGeo.computeVertexNormals();

  const bristleMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.02,
    }),
  );
  const bristleMesh = new THREE.Mesh(bristleGeo, bristleMat);
  bristleMesh.castShadow = true;
  broomMeshGroup.add(bristleMesh);

  // 3. Leather Binding & Brushed-Brass Trim Rings
  const bindingGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.036, 0.038, 0.12, 16),
  );
  bindingGeo.rotateX(Math.PI / 2);
  bindingGeo.translate(0, 0, -0.42);
  const bindingMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a2f1c'),
      roughness: 0.68,
      metalness: 0.04,
    }),
  );
  const bindingMesh = new THREE.Mesh(bindingGeo, bindingMat);
  bindingMesh.castShadow = true;
  broomMeshGroup.add(bindingMesh);

  const ringGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.04, 0.0065, 10, 24),
  );
  const ringFront = new THREE.Mesh(ringGeo, brassMat);
  ringFront.position.set(0, 0, -0.37);
  const ringBack = new THREE.Mesh(ringGeo, brassMat);
  ringBack.position.set(0, 0, -0.47);
  broomMeshGroup.add(ringFront, ringBack);

  // Brushed-brass stirrup footrests
  const stirrupGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.006, 0.006, 0.22, 8),
  );
  const stirrupL = new THREE.Mesh(stirrupGeo, brassMat);
  stirrupL.position.set(-0.07, -0.1, 0.08);
  stirrupL.rotation.z = 0.35;
  const stirrupR = new THREE.Mesh(stirrupGeo, brassMat);
  stirrupR.position.set(0.07, -0.1, 0.08);
  stirrupR.rotation.z = -0.35;
  broomMeshGroup.add(stirrupL, stirrupR);

  return broomMeshGroup;
}

/**
 * Creates the Ancient Realm Broom Travel Stand & Return-to-Home Flight Lifecycle System.
 * - Placed at (-28.5, +26.0) along the Northwest Boulevard path near the Ancient Realm Signboard.
 * - Manages the 4-state lifecycle: 'IDLE_AT_STAND' -> 'MOUNTING' -> 'FLYING' -> 'RETURNING' -> 'IDLE_AT_STAND'.
 */
export function createMagicFlightSystem(): MagicFlightBundle {
  const group = new THREE.Group();
  group.name = 'AncientRealmMagicFlightSystem';

  const tracker = new ResourceTracker();

  // 1. Travel Stand World Position on the NW Boulevard Path (-28.5, +26.0)
  const standX = BROOM_STAND_POS.x;
  const standZ = BROOM_STAND_POS.z;
  const standY = getTerrainHeight(standX, standZ);
  const standWorldPos = new THREE.Vector3(standX, standY, standZ);

  const terraceWorldPos = new THREE.Vector3(
    CASTLE_TERRACE_POS.x,
    CASTLE_TERRACE_POS.y,
    CASTLE_TERRACE_POS.z,
  );

  // Orientation pointing along the NW Boulevard toward the Castle (-85, +75)
  const standCradleYaw = Math.atan2(
    CASTLE_KEEP_POS.x - standX,
    CASTLE_KEEP_POS.z - standZ,
  );

  // ============================================================================
  // A. WEATHERED STONE TRAVEL STAND & BRASS CRADLE AT (-28.5, +26.0)
  // ============================================================================
  const standGroup = new THREE.Group();
  standGroup.position.copy(standWorldPos);
  group.add(standGroup);

  const weatheredStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8a7f72'),
      roughness: 0.88,
      metalness: 0.04,
    }),
  );
  const darkBasaltMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4c465e'),
      roughness: 0.82,
      metalness: 0.06,
    }),
  );
  const mutedBrassMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b08d57'),
      metalness: 0.88,
      roughness: 0.38,
    }),
  );
  const arcaneRuneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#a78bfa'),
      emissive: new THREE.Color('#7c3aed'),
      emissiveIntensity: 0.48,
      roughness: 0.35,
    }),
  );

  // Grounding cobblestone plinth pad (levels the stand into the NW mountain slope)
  const plinthGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.86, 1.02, 0.34, 24),
  );
  plinthGeo.translate(0, -0.09, 0);
  const plinthMesh = new THREE.Mesh(plinthGeo, darkBasaltMat);
  plinthMesh.receiveShadow = true;
  plinthMesh.castShadow = true;
  standGroup.add(plinthMesh);

  // Weathered circular stone pedestal (~1.0m diameter = r=0.5m, 0.22m high)
  const pedGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.5, 0.52, 0.22, 32),
  );
  pedGeo.translate(0, 0.11, 0);
  const pedMesh = new THREE.Mesh(pedGeo, weatheredStoneMat);
  pedMesh.castShadow = true;
  pedMesh.receiveShadow = true;
  standGroup.add(pedMesh);

  // Muted brushed-brass edge trim ring
  const brassTrimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.5, 0.012, 12, 48),
  );
  brassTrimGeo.rotateX(Math.PI / 2);
  brassTrimGeo.translate(0, 0.22, 0);
  const brassTrimMesh = new THREE.Mesh(brassTrimGeo, mutedBrassMat);
  standGroup.add(brassTrimMesh);

  // Subtle engraved arcane ring detail (r = 0.38m) + 8 radial rune grooves
  const arcaneRingGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.38, 0.007, 8, 40),
  );
  arcaneRingGeo.rotateX(Math.PI / 2);
  arcaneRingGeo.translate(0, 0.221, 0);
  const arcaneRingMesh = new THREE.Mesh(arcaneRingGeo, arcaneRuneMat);
  standGroup.add(arcaneRingMesh);

  const runeGrooveGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.032, 0.004, 0.085),
  );
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI * 2) / 8;
    const rune = new THREE.Mesh(runeGrooveGeo, arcaneRuneMat);
    rune.position.set(Math.sin(ang) * 0.38, 0.221, Math.cos(ang) * 0.38);
    rune.rotation.y = ang;
    standGroup.add(rune);
  }

  // Two Brushed-Brass Forked Cradle Stands oriented along standCradleYaw
  const cradleHolderGroup = new THREE.Group();
  cradleHolderGroup.rotation.y = standCradleYaw;
  standGroup.add(cradleHolderGroup);

  const stemGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.014, 0.02, 0.13, 10),
  );
  stemGeo.translate(0, 0.065, 0);
  const forkTineGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.008, 0.011, 0.06, 8),
  );
  forkTineGeo.translate(0, 0.03, 0);

  const cradleStandOffsets = [
    { z: -0.18, stemH: 0.12 },
    { z: 0.22, stemH: 0.25 },
  ];
  cradleStandOffsets.forEach(({ z, stemH }) => {
    const forkGroup = new THREE.Group();
    forkGroup.position.set(0, 0.22, z);

    const stem = new THREE.Mesh(stemGeo, mutedBrassMat);
    stem.scale.y = stemH / 0.13;
    forkGroup.add(stem);

    const tineL = new THREE.Mesh(forkTineGeo, mutedBrassMat);
    tineL.position.set(-0.012, stemH - 0.01, 0);
    tineL.rotation.z = 0.42;

    const tineR = new THREE.Mesh(forkTineGeo, mutedBrassMat);
    tineR.position.set(0.012, stemH - 0.01, 0);
    tineR.rotation.z = -0.42;

    forkGroup.add(tineL, tineR);
    cradleHolderGroup.add(forkGroup);
  });

  // Subtle Accompanying Stone Lantern Post beside the Travel Stand (grounds it visually on the trail)
  const postGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.065, 0.09, 1.55, 8),
  );
  postGeo.translate(0, 0.775, 0);
  const lanternPost = new THREE.Mesh(postGeo, darkBasaltMat);
  lanternPost.position.set(0.72, 0, -0.35);
  lanternPost.castShadow = true;
  standGroup.add(lanternPost);

  const lanternCapGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.13, 10, 10),
  );
  const warmBulbMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fff3d6'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.55,
      roughness: 0.25,
    }),
  );
  const lanternBulb = new THREE.Mesh(lanternCapGeo, warmBulbMat);
  lanternBulb.position.set(0.72, 1.62, -0.35);
  standGroup.add(lanternBulb);

  // Restrained Pedestal Lighting:
  // 1) Tiny cool violet/cyan magical glow around pedestal (restrained, no blinding bloom)
  const pedestalGlowLight = new THREE.PointLight('#8fd8ff', 0.42, 3.2, 1.8);
  pedestalGlowLight.position.set(0, 0.42, 0);
  standGroup.add(pedestalGlowLight);

  // 2) Subtle warm spotlight from above
  const warmSpotLight = new THREE.SpotLight(
    '#ffdfa8',
    0.72,
    7.5,
    Math.PI / 4.5,
    0.65,
    1.5,
  );
  warmSpotLight.position.set(0.7, 3.2, -0.4);
  warmSpotLight.target.position.set(0, 0.25, 0);
  standGroup.add(warmSpotLight);
  standGroup.add(warmSpotLight.target);

  // ============================================================================
  // B. REUSABLE WORLD BROOM OBJECT & SPARKLE PARTICLE POOL
  // ============================================================================
  const broomRoot = new THREE.Group();
  broomRoot.name = 'ReusableWorldFlyingBroom';
  const standCradleWorldPos = new THREE.Vector3(
    standX,
    standY + CRADLE_HEIGHT_OFFSET,
    standZ,
  );
  broomRoot.position.copy(standCradleWorldPos);
  broomRoot.rotation.set(0, standCradleYaw, 0);
  group.add(broomRoot);

  const broomVisual = createMagicalBroomMesh(tracker);
  broomVisual.rotation.x = -CRADLE_PITCH_RAD; // Tip elevated 20° above horizontal in cradle
  broomRoot.add(broomVisual);

  // Magical Sparkle Particle Pool (shared by pickup burst, flight trail, and return-to-home arc)
  const PARTICLE_COUNT = 56;
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleVelocities: THREE.Vector3[] = [];
  const particleAges = new Float32Array(PARTICLE_COUNT);
  const particleLifetimes = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePositions[i * 3 + 1] = -999;
    particleVelocities.push(new THREE.Vector3());
    particleAges[i] = 99;
    particleLifetimes[i] = 1.0;
  }

  const particleGeo = tracker.trackGeo(new THREE.BufferGeometry());
  particleGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(particlePositions, 3),
  );
  const particleMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#ffd87a'),
      size: 0.14,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const particlePoints = new THREE.Points(particleGeo, particleMat);
  particlePoints.frustumCulled = false;
  group.add(particlePoints);

  let nextParticleIdx = 0;
  function spawnSparkleMote(
    origin: THREE.Vector3,
    vx: number,
    vy: number,
    vz: number,
    lifetime: number,
  ) {
    const idx = nextParticleIdx;
    nextParticleIdx = (nextParticleIdx + 1) % PARTICLE_COUNT;
    particlePositions[idx * 3] = origin.x + (Math.random() - 0.5) * 0.18;
    particlePositions[idx * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.18;
    particlePositions[idx * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.18;
    particleVelocities[idx].set(vx, vy, vz);
    particleAges[idx] = 0;
    particleLifetimes[idx] = lifetime;
  }

  function triggerSparkleBurst(origin: THREE.Vector3, count = 28) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = 0.7 + Math.random() * 1.6;
      spawnSparkleMote(
        origin,
        Math.cos(theta) * speed,
        0.9 + Math.random() * 1.4,
        Math.sin(theta) * speed,
        0.55 + Math.random() * 0.45,
      );
    }
    (particleGeo.attributes.position as THREE.BufferAttribute).needsUpdate =
      true;
  }

  // ============================================================================
  // C. BROOM LIFECYCLE STATE MACHINE
  // ============================================================================
  let state: BroomLifecycleState = 'IDLE_AT_STAND';
  let mountTimer = 0;
  const mountStartPos = new THREE.Vector3();
  let mountStartYaw = standCradleYaw;

  // Return-to-Home Arc State
  let returnTimer = 0;
  let returnDuration = 3.2;
  const returnP0 = new THREE.Vector3();
  const returnP1 = new THREE.Vector3();
  const returnP2 = new THREE.Vector3();
  const returnP3 = new THREE.Vector3();
  const _bezPos = new THREE.Vector3();
  const _bezNext = new THREE.Vector3();
  const _tailPos = new THREE.Vector3();
  let trailSpawnAccum = 0;

  function evalCubicBezier(
    u: number,
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const t = THREE.MathUtils.clamp(u, 0, 1);
    const mt = 1.0 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    out.set(
      mt2 * mt * p0.x +
        3 * mt2 * t * p1.x +
        3 * mt * t2 * p2.x +
        t2 * t * p3.x,
      mt2 * mt * p0.y +
        3 * mt2 * t * p1.y +
        3 * mt * t2 * p2.y +
        t2 * t * p3.y,
      mt2 * mt * p0.z +
        3 * mt2 * t * p1.z +
        3 * mt * t2 * p2.z +
        t2 * t * p3.z,
    );
    return out;
  }

  return {
    group,
    standWorldPos,
    terraceWorldPos,
    broomRoot,
    broomVisual,

    getState() {
      return state;
    },

    getStandDistance(playerPos: THREE.Vector3): number {
      return Math.hypot(
        playerPos.x - standWorldPos.x,
        playerPos.z - standWorldPos.z,
      );
    },

    isWithinStandProximity(playerPos: THREE.Vector3): boolean {
      if (state !== 'IDLE_AT_STAND') return false;
      const d = Math.hypot(
        playerPos.x - standWorldPos.x,
        playerPos.z - standWorldPos.z,
      );
      return d <= STAND_INTERACT_RADIUS;
    },

    isOverCastleTerrace(pos: THREE.Vector3): boolean {
      return (
        Math.hypot(
          pos.x - CASTLE_TERRACE_POS.x,
          pos.z - CASTLE_TERRACE_POS.z,
        ) <=
        CASTLE_TERRACE_POS.radius + 1.5
      );
    },

    startMounting(playerPos: THREE.Vector3, _playerYaw: number) {
      state = 'MOUNTING';
      mountTimer = 0;
      mountStartPos.copy(broomRoot.position);
      mountStartYaw = broomRoot.rotation.y;
      triggerSparkleBurst(broomRoot.position, 32);
    },

    updateMounting(
      dt: number,
      playerPos: THREE.Vector3,
      playerYaw: number,
    ): { completed: boolean; progress: number } {
      mountTimer += dt;
      const u = THREE.MathUtils.clamp(mountTimer / MOUNT_DURATION, 0, 1);
      const eased = easeOutCubic(u);

      // Lift and glide broom from stand cradle to the player's riding height
      const targetX = playerPos.x;
      const targetY = playerPos.y + 0.58 + Math.sin(u * Math.PI) * 0.25;
      const targetZ = playerPos.z;

      broomRoot.position.set(
        THREE.MathUtils.lerp(mountStartPos.x, targetX, eased),
        THREE.MathUtils.lerp(mountStartPos.y, targetY, eased),
        THREE.MathUtils.lerp(mountStartPos.z, targetZ, eased),
      );

      // Shortest-angle yaw interpolation to align with player facing direction
      let dYaw = playerYaw - mountStartYaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      broomRoot.rotation.set(0, mountStartYaw + dYaw * eased, 0);

      // Level out the broom from its 20° diagonal resting pitch to horizontal flight pose
      broomVisual.rotation.set(
        THREE.MathUtils.lerp(-CRADLE_PITCH_RAD, 0, eased),
        0,
        0,
      );

      if (u >= 1.0) {
        state = 'FLYING';
        return { completed: true, progress: 1.0 };
      }
      return { completed: false, progress: u };
    },

    syncFlyingPose(
      broomPos: THREE.Vector3,
      yaw: number,
      pitch: number,
      roll: number,
      speed: number,
      dt: number,
    ) {
      state = 'FLYING';
      broomRoot.position.copy(broomPos);
      broomRoot.rotation.set(0, yaw, 0);
      broomVisual.rotation.set(pitch, 0, roll);

      // Subtle trailing motes from the bristle tail while cruising/boosting
      trailSpawnAccum += dt * (4.0 + Math.abs(speed) * 0.9);
      while (trailSpawnAccum >= 1.0) {
        trailSpawnAccum -= 1.0;
        _tailPos
          .set(0, 0, -0.78)
          .applyEuler(broomVisual.rotation)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
          .add(broomPos);
        spawnSparkleMote(
          _tailPos,
          (Math.random() - 0.5) * 0.4,
          0.15 + Math.random() * 0.35,
          (Math.random() - 0.5) * 0.4,
          0.45 + Math.random() * 0.35,
        );
      }
    },

    startReturnToHome(fromWorldPos: THREE.Vector3, _fromYaw: number) {
      state = 'RETURNING';
      returnTimer = 0;

      returnP0.copy(fromWorldPos);
      returnP3.copy(standCradleWorldPos);

      const dx = returnP3.x - returnP0.x;
      const dz = returnP3.z - returnP0.z;
      const horizDist = Math.hypot(dx, dz);
      const dirX = horizDist > 0.01 ? dx / horizDist : 0;
      const dirZ = horizDist > 0.01 ? dz / horizDist : 1;
      // Perpendicular lateral vector for a graceful banking curve in the sky
      const perpX = -dirZ;
      const perpZ = dirX;

      const maxEndpointY = Math.max(returnP0.y, returnP3.y);
      const arcLift = THREE.MathUtils.clamp(horizDist * 0.28, 6.5, 22.0);
      const lateralSweep = THREE.MathUtils.clamp(horizDist * 0.16, 2.2, 12.0);

      // P1: Lifts upward and banks out from the dismount spot
      returnP1.set(
        returnP0.x + dirX * (horizDist * 0.25) + perpX * lateralSweep,
        maxEndpointY + arcLift * 0.72,
        returnP0.z + dirZ * (horizDist * 0.25) + perpZ * lateralSweep,
      );

      // P2: High sweeping approach descending toward the Ancient Realm Travel Stand
      returnP2.set(
        returnP0.x + dirX * (horizDist * 0.72) + perpX * (lateralSweep * 0.45),
        maxEndpointY + arcLift,
        returnP0.z + dirZ * (horizDist * 0.72) + perpZ * (lateralSweep * 0.45),
      );

      returnDuration = THREE.MathUtils.clamp(horizDist / 19.0, 2.2, 4.8);
      triggerSparkleBurst(fromWorldPos, 24);
    },

    update(dt: number, elapsedTime: number) {
      // 1. Pulse the subtle pedestal glow light & runes when broom is at stand or returning
      const pulse = 0.82 + 0.18 * Math.sin(elapsedTime * 1.8);
      pedestalGlowLight.intensity =
        (state === 'IDLE_AT_STAND' ? 0.45 : 0.26) * pulse;
      arcaneRuneMat.emissiveIntensity =
        (state === 'IDLE_AT_STAND' ? 0.52 : 0.28) * pulse;

      // 2. State-specific Broom animation
      if (state === 'IDLE_AT_STAND') {
        const hoverBob = Math.sin(elapsedTime * 2.4) * 0.025;
        const gentleRock = Math.sin(elapsedTime * 2.4 + 1.0) * 0.022;
        broomRoot.position.set(
          standCradleWorldPos.x,
          standCradleWorldPos.y + hoverBob,
          standCradleWorldPos.z,
        );
        broomRoot.rotation.set(0, standCradleYaw, 0);
        broomVisual.rotation.set(-CRADLE_PITCH_RAD + gentleRock, 0, 0);
      } else if (state === 'RETURNING') {
        returnTimer += dt;
        const rawU = THREE.MathUtils.clamp(returnTimer / returnDuration, 0, 1);
        const u = easeInOutQuad(rawU);

        evalCubicBezier(u, returnP0, returnP1, returnP2, returnP3, _bezPos);
        const uNext = Math.min(1.0, u + 0.02);
        evalCubicBezier(
          uNext,
          returnP0,
          returnP1,
          returnP2,
          returnP3,
          _bezNext,
        );

        // Ensure mid-flight arc clears underlying mountain terrain
        const groundSample = getTerrainHeight(_bezPos.x, _bezPos.z);
        const safetyBlend = Math.sin(rawU * Math.PI);
        _bezPos.y = Math.max(
          _bezPos.y,
          groundSample + 0.36 + safetyBlend * 2.8,
        );

        broomRoot.position.copy(_bezPos);

        // Compute flight tangent & smoothly blend into cradle resting pose near arrival
        const tx = _bezNext.x - _bezPos.x;
        const ty = _bezNext.y - _bezPos.y;
        const tz = _bezNext.z - _bezPos.z;
        const hLen = Math.hypot(tx, tz);

        const flightYaw =
          hLen > 0.0001 ? Math.atan2(tx, tz) : standCradleYaw;
        const flightPitch =
          hLen > 0.0001
            ? THREE.MathUtils.clamp(-Math.atan2(ty, hLen), -0.65, 0.65)
            : -CRADLE_PITCH_RAD;

        const settleWeight = smoothstep01((rawU - 0.78) / 0.22);

        let dYaw = standCradleYaw - flightYaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        const blendedYaw = flightYaw + dYaw * settleWeight;

        const blendedPitch = THREE.MathUtils.lerp(
          flightPitch,
          -CRADLE_PITCH_RAD,
          settleWeight,
        );
        const bankRoll =
          Math.sin(rawU * Math.PI) * 0.34 * (1.0 - settleWeight);

        broomRoot.rotation.set(0, blendedYaw, 0);
        broomVisual.rotation.set(blendedPitch, 0, bankRoll);

        // Emit subtle sparkle trail along the return flight path
        trailSpawnAccum += dt * 18.0;
        while (trailSpawnAccum >= 1.0) {
          trailSpawnAccum -= 1.0;
          spawnSparkleMote(
            _bezPos,
            (Math.random() - 0.5) * 0.5,
            0.2 + Math.random() * 0.4,
            (Math.random() - 0.5) * 0.5,
            0.6 + Math.random() * 0.4,
          );
        }

        if (rawU >= 1.0) {
          state = 'IDLE_AT_STAND';
          broomRoot.position.copy(standCradleWorldPos);
          broomRoot.rotation.set(0, standCradleYaw, 0);
          broomVisual.rotation.set(-CRADLE_PITCH_RAD, 0, 0);
          triggerSparkleBurst(standCradleWorldPos, 18);
        }
      }

      // 3. Advance Sparkle Motes
      let anyActive = false;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (particleAges[i] < particleLifetimes[i]) {
          particleAges[i] += dt;
          if (particleAges[i] >= particleLifetimes[i]) {
            particlePositions[i * 3 + 1] = -999;
          } else {
            const v = particleVelocities[i];
            particlePositions[i * 3] += v.x * dt;
            particlePositions[i * 3 + 1] += v.y * dt;
            particlePositions[i * 3 + 2] += v.z * dt;
            v.y = dampValue(v.y, 0.1, 2.0, dt);
            anyActive = true;
          }
        }
      }
      if (anyActive) {
        (
          particleGeo.attributes.position as THREE.BufferAttribute
        ).needsUpdate = true;
      }
    },

    dispose() {
      tracker.dispose();
    },
  };
}
