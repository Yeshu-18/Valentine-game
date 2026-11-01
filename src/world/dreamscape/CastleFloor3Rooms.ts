import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';

export type Floor3ActiveCameraMode = 'none' | 'heart_gallery';

export interface Floor3CameraState {
  active: boolean;
  mode: Floor3ActiveCameraMode;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  isSitting: boolean;
  seatWorldPos?: THREE.Vector3;
  seatYaw?: number;
}

export interface GalleryFrameInfo {
  index: number;
  title: string;
  sub: string;
  hasCustomImage: boolean;
  customImageSrc?: string;
}

export interface CastleFloor3RoomsBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  partitionMeshes: THREE.Mesh[];
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  getActiveRoomCaption: () => string | null;
  setAvatarCallbacks: (cbs: {
    setActivityPose: (pose: any) => void;
    resetNeutralPose: () => void;
  }) => void;
  interact: (playerPos: THREE.Vector3) => boolean;
  handleKeyAction: (code: string) => boolean;
  applyLookDelta: (yawDelta: number, pitchDelta: number) => void;
  exitActiveCameraMode: (playerPos?: THREE.Vector3) => void;
  getCameraState: () => Floor3CameraState;
  setGalleryFrameImage: (frameIndex: number, imageSrc: string) => void;
  getGalleryFrames: () => readonly GalleryFrameInfo[];
  isPlayerOnIceRink: (playerPos: THREE.Vector3) => boolean;
  triggerSkatingJump: () => void;
  update: (
    delta: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
    inputKeys?: Set<string>,
  ) => void;
}

interface GalleryMemory {
  title: string;
  subtitle: string;
  quote: string;
  skyTop: string;
  skyBottom: string;
  accentColor: string;
  customImage: HTMLImageElement | null;
  customImageUrl: string | null;
}

type PuppyBehaviorState = 'REST' | 'WANDER' | 'PLAY' | 'FOLLOW_PLAYER';

interface PuppyNpc {
  name: string;
  personality: 'energetic' | 'curious' | 'sleepy' | 'playful';
  root: THREE.Group;
  headPivot: THREE.Group;
  tailPivot: THREE.Group;
  legFL: THREE.Group;
  legFR: THREE.Group;
  legBL: THREE.Group;
  legBR: THREE.Group;
  state: PuppyBehaviorState;
  stateTimer: number;
  lx: number;
  lz: number;
  targetLx: number;
  targetLz: number;
  homeLx: number;
  homeLz: number;
  yaw: number;
  speed: number;
  hopPhase: number;
  barkSparkleBoost: number;
}

const GALLERY_STORAGE_KEY_PREFIX = 'heart_island_gallery_frame_v1_';

// Module-scope scratch matrix & vectors (Zero Per-Frame Allocations)
const _dummy = new THREE.Object3D();
const _scratchDir = new THREE.Vector2();

function buildExtrudedHeartGeometry(
  tracker: ResourceTracker,
  scale = 1.0,
  depth = 0.14,
  bevelThickness = 0.04,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const s = scale;
  shape.moveTo(0, -0.45 * s);
  shape.bezierCurveTo(-0.55 * s, -0.1 * s, -0.58 * s, 0.42 * s, -0.28 * s, 0.48 * s);
  shape.bezierCurveTo(-0.1 * s, 0.52 * s, 0, 0.34 * s, 0, 0.22 * s);
  shape.bezierCurveTo(0, 0.34 * s, 0.1 * s, 0.52 * s, 0.28 * s, 0.48 * s);
  shape.bezierCurveTo(0.58 * s, 0.42 * s, 0.55 * s, -0.1 * s, 0, -0.45 * s);

  const geo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(shape, {
      depth: depth * s,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: bevelThickness * s,
      bevelThickness: bevelThickness * s,
    }),
  );
  geo.center();
  return geo;
}

/**
 * FLOOR 3: THE HEART & PLAY WING (Elev +10.25m)
 * Strict Spatial Hierarchy:
 *   1. HEART GALLERY (Largest — East & South-East Grand Wing, lx: +4.8..+15.0, lz: -15.0..+7.8, ~232 m²)
 *   2. ICE SKATING PALACE (Second-Largest — West Grand Wing, lx: -15.0..-3.8, lz: -15.0..+4.2, ~215 m²)
 *   3. PUPPY PLAY AREA (Third-Largest — South-Central Garden Playground, lx: -3.8..+4.8, lz: -15.0..-4.2, ~93 m²)
 *   4. PET SALON (Fourth/Smallest — North-West Luxury Miniature Suite, lx: -15.0..-9.6, lz: +4.5..+14.8, ~55 m²)
 * Connected by the open Central Royal Promenade (`lx: -3.8..+4.8, lz: -4.2..+14.8`) with zero dead ends.
 */
export function createCastleFloor3Rooms(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
): CastleFloor3RoomsBundle {
  const group = new THREE.Group();
  group.name = 'CastleFloor3HeartAndPlayWing';
  const colliders: CircleCollider[] = [];
  const partitionMeshes: THREE.Mesh[] = [];

  const y0 = 10.25; // Floor 3 Slab Top Surface
  const floor3WorldY = baseY + y0;

  let avatarCallbacks: {
    setActivityPose: (pose: any) => void;
    resetNeutralPose: () => void;
  } | null = null;

  let audioCtx: AudioContext | null = null;
  const playChime = (freq1 = 523.25, freq2 = 659.25) => {
    try {
      if (!audioCtx && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) audioCtx = new AudioCtx();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, now);
      osc.frequency.exponentialRampToValueAtTime(freq2, now + 0.18);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Ignore audio fallback
    }
  };

  const registerLocalCollider = (lx: number, lz: number, radius: number, height = 3.2) => {
    colliders.push({ x: originX + lx, z: originZ + lz, radius, y: floor3WorldY, height });
  };

  // ==========================================================================
  // SHARED LUXURY MATERIALS (Pearl, Blush Pink, Champagne Gold, Crystal Ice, Pastel Mint)
  // ==========================================================================
  const galleryRoseMarbleMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fce7f3'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.08,
      roughness: 0.16,
      metalness: 0.08,
    }),
  );
  const crystalArchMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.28,
      transmission: 0.55,
      opacity: 0.92,
      transparent: true,
      roughness: 0.08,
      metalness: 0.1,
      ior: 1.48,
    }),
  );
  const floatingHeartCrystalMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.52,
      transmission: 0.62,
      opacity: 0.95,
      transparent: true,
      roughness: 0.06,
      metalness: 0.15,
      clearcoat: 1.0,
      ior: 1.52,
    }),
  );
  const iceSurfaceMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e0f2fe'),
      emissive: new THREE.Color('#c4b5fd'),
      emissiveIntensity: 0.16,
      roughness: 0.05,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transmission: 0.28,
      transparent: true,
      opacity: 0.9,
      ior: 1.31,
    }),
  );
  const iceCrystalBarrierMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f0f9ff'),
      emissive: new THREE.Color('#a5b4fc'),
      emissiveIntensity: 0.22,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.78,
    }),
  );
  const iceFountainHeartMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f5d0fe'),
      emissive: new THREE.Color('#c084fc'),
      emissiveIntensity: 0.46,
      roughness: 0.06,
      metalness: 0.12,
      transmission: 0.58,
      transparent: true,
      opacity: 0.92,
    }),
  );
  const pastelLawnMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d1fae5'),
      emissive: new THREE.Color('#6ee7b7'),
      emissiveIntensity: 0.06,
      roughness: 0.68,
      metalness: 0.02,
    }),
  );
  const pastelHedgeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#a7f3d0'),
      emissive: new THREE.Color('#34d399'),
      emissiveIntensity: 0.05,
      roughness: 0.72,
      metalness: 0.02,
    }),
  );
  const puppyCreamMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef3c7'),
      roughness: 0.55,
      metalness: 0.02,
    }),
  );
  const puppySnowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffdf9'),
      roughness: 0.52,
      metalness: 0.02,
    }),
  );
  const puppyBlushMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fde2e4'),
      roughness: 0.55,
      metalness: 0.02,
    }),
  );
  const puppyCaramelMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f5d0a9'),
      roughness: 0.55,
      metalness: 0.02,
    }),
  );
  const puppyEyeNoseMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#292524'),
      roughness: 0.22,
      metalness: 0.1,
    }),
  );
  const bubbleIridescentMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fdf4ff'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.35,
      roughness: 0.05,
      metalness: 0.08,
      transmission: 0.7,
      transparent: true,
      opacity: 0.75,
    }),
  );

  // ==========================================================================
  // 0. CENTRAL ROYAL PROMENADE & ARCHITECTURAL WAYFINDING
  //    Connects F2->F3 Stair Arrival (lx: 7.5, lz: 13.8), Elevator Lobby (lx: 0, lz: 5.85),
  //    F3->F4 Stair Bottom Landing (lx: -7.5, lz: 5.5), and all 4 Wing Entrances!
  // ==========================================================================
  const promenadeRunnerGeo = tracker.trackGeo(new THREE.BoxGeometry(3.4, 0.018, 15.6));
  const promenadeRunner = new THREE.Mesh(promenadeRunnerGeo, galleryRoseMarbleMat);
  promenadeRunner.position.set(0.5, y0 + 0.009, 2.2);
  promenadeRunner.receiveShadow = true;
  group.add(promenadeRunner);

  const promenadeTrimGeo = tracker.trackGeo(new THREE.BoxGeometry(3.52, 0.014, 15.72));
  const promenadeTrim = new THREE.Mesh(promenadeTrimGeo, mats.champagneGold);
  promenadeTrim.position.set(0.5, y0 + 0.006, 2.2);
  group.add(promenadeTrim);

  // Helper to build elegant Palace Archways with Pearl Columns, Gold Trim & Subtle Crystal Heart Crest (Zero Giant Floating Text Signs)
  const buildPalacePortalArch = (
    cx: number,
    cz: number,
    width: number,
    height: number,
    rotY: number,
    crestMat: THREE.Material = crystalArchMat,
  ) => {
    const portal = new THREE.Group();
    portal.position.set(cx, y0, cz);
    portal.rotation.y = rotY;

    const halfW = width * 0.5;
    const colGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.26, height, 16));
    colGeo.translate(0, height * 0.5, 0);
    const baseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.35, 0.24, 16));
    baseGeo.translate(0, 0.12, 0);
    const capGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.34, 0.25, 0.24, 16));
    capGeo.translate(0, height - 0.12, 0);

    [-halfW, halfW].forEach((px) => {
      const col = new THREE.Mesh(colGeo, mats.pearlWhite);
      col.position.set(px, 0, 0);
      const base = new THREE.Mesh(baseGeo, mats.champagneGold);
      base.position.set(px, 0, 0);
      const cap = new THREE.Mesh(capGeo, mats.champagneGold);
      cap.position.set(px, 0, 0);
      portal.add(col, base, cap);
    });

    // Overhead crystal & gold arch lintel
    const lintelGeo = tracker.trackGeo(new THREE.BoxGeometry(width + 0.65, 0.34, 0.44));
    const lintel = new THREE.Mesh(lintelGeo, mats.pearlWhite);
    lintel.position.set(0, height + 0.15, 0);
    const lintelGoldGeo = tracker.trackGeo(new THREE.BoxGeometry(width + 0.72, 0.08, 0.48));
    const lintelGold = new THREE.Mesh(lintelGoldGeo, mats.champagneGold);
    lintelGold.position.set(0, height + 0.34, 0);
    portal.add(lintel, lintelGold);

    const archCurveGeo = tracker.trackGeo(
      new THREE.TorusGeometry(halfW, 0.11, 10, 28, Math.PI),
    );
    const archCurve = new THREE.Mesh(archCurveGeo, crestMat);
    archCurve.position.set(0, height, 0);
    portal.add(archCurve);

    // Subtle sculpted crystal heart crest at the crown of the arch
    const crestHeartGeo = buildExtrudedHeartGeometry(tracker, 0.42, 0.14, 0.03);
    const crestHeart = new THREE.Mesh(crestHeartGeo, crestMat);
    crestHeart.position.set(0, height + 0.56, 0);
    portal.add(crestHeart);

    group.add(portal);
  };

  // ==========================================================================
  // 1. HEART GALLERY (PRIORITY #1 — LARGEST SPACE ON FLOOR 3)
  //    East & South-East Grand Wing: lx in [+4.8, +15.0], lz in [-15.0, +7.8] (~232 m²)
  // ==========================================================================
  const heartGalleryGroup = new THREE.Group();
  heartGalleryGroup.name = 'HeartGalleryWing';
  group.add(heartGalleryGroup);

  // Rose-marble gallery floor inlay covering the East Grand Wing
  const galleryFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(9.8, 0.02, 22.2));
  const galleryFloor = new THREE.Mesh(galleryFloorGeo, galleryRoseMarbleMat);
  galleryFloor.position.set(9.9, y0 + 0.01, -3.5);
  galleryFloor.receiveShadow = true;
  heartGalleryGroup.add(galleryFloor);

  // Heart Gallery West Colonnade Wall segments at lx = +4.8 with two wide grand archways:
  //   - Primary Grand Crystal Entrance Archway at lz = +1.5 (width 3.6m, lz: -0.3..+3.3)
  //   - South Promenade Archway at lz = -9.5 (width 3.2m, lz: -11.1..-7.9)
  const buildGalleryWallSegment = (minZ: number, maxZ: number) => {
    const len = maxZ - minZ;
    const midZ = (minZ + maxZ) * 0.5;
    const wallGeo = tracker.trackGeo(new THREE.BoxGeometry(0.36, 4.2, len));
    const wall = new THREE.Mesh(wallGeo, mats.pearlWhite);
    wall.position.set(4.8, y0 + 2.1, midZ);
    wall.receiveShadow = true;
    const wainscotGeo = tracker.trackGeo(new THREE.BoxGeometry(0.4, 0.14, len + 0.04));
    const wainscot = new THREE.Mesh(wainscotGeo, mats.champagneGold);
    wainscot.position.set(4.8, y0 + 0.07, midZ);
    const corniceGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 0.16, len + 0.04));
    const cornice = new THREE.Mesh(corniceGeo, mats.champagneGold);
    cornice.position.set(4.8, y0 + 4.18, midZ);
    heartGalleryGroup.add(wall, wainscot, cornice);
    partitionMeshes.push(wall);
  };
  buildGalleryWallSegment(-15.0, -11.1);
  buildGalleryWallSegment(-7.9, -0.3);
  buildGalleryWallSegment(3.3, 7.8);

  // North Gallery Colonnade Wall at lz = +7.8 (lx: 4.8..15.0, with 2.8m open portal at lx: 10.2..13.0)
  [
    { x1: 4.8, x2: 10.2 },
    { x1: 13.0, x2: 15.0 },
  ].forEach(({ x1, x2 }) => {
    const w = x2 - x1;
    const mx = (x1 + x2) * 0.5;
    const nWallGeo = tracker.trackGeo(new THREE.BoxGeometry(w, 4.2, 0.36));
    const nWall = new THREE.Mesh(nWallGeo, mats.pearlWhite);
    nWall.position.set(mx, y0 + 2.1, 7.8);
    const nTrimGeo = tracker.trackGeo(new THREE.BoxGeometry(w + 0.04, 0.14, 0.4));
    const nTrim = new THREE.Mesh(nTrimGeo, mats.champagneGold);
    nTrim.position.set(mx, y0 + 0.07, 7.8);
    heartGalleryGroup.add(nWall, nTrim);
    partitionMeshes.push(nWall);
  });

  // Grand Entrance Portals into the Heart Gallery
  buildPalacePortalArch(4.8, 1.5, 3.6, 3.85, Math.PI / 2, floatingHeartCrystalMat);
  buildPalacePortalArch(4.8, -9.5, 3.2, 3.65, Math.PI / 2, crystalArchMat);
  buildPalacePortalArch(11.6, 7.8, 2.8, 3.65, 0, crystalArchMat);

  // --- CENTRAL MEMORY COURT & FLOATING CRYSTAL HEART CENTERPIECE (lx = 9.6, lz = -3.5) ---
  const courtCenterX = 9.6;
  const courtCenterZ = -3.5;

  const courtFloorRingOuterGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.5, 3.55, 0.028, 40));
  const courtFloorRingOuter = new THREE.Mesh(courtFloorRingOuterGeo, mats.pearlWhite);
  courtFloorRingOuter.position.set(courtCenterX, y0 + 0.018, courtCenterZ);
  const courtGoldRingGeo = tracker.trackGeo(new THREE.TorusGeometry(3.52, 0.036, 10, 48));
  courtGoldRingGeo.rotateX(Math.PI / 2);
  const courtGoldRing = new THREE.Mesh(courtGoldRingGeo, mats.champagneGold);
  courtGoldRing.position.set(courtCenterX, y0 + 0.034, courtCenterZ);
  const courtInnerRoseGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.15, 2.2, 0.034, 36));
  const courtInnerRose = new THREE.Mesh(courtInnerRoseGeo, mats.blushRoseMarble);
  courtInnerRose.position.set(courtCenterX, y0 + 0.022, courtCenterZ);
  heartGalleryGroup.add(courtFloorRingOuter, courtGoldRing, courtInnerRose);

  // Circular Pearl & Champagne-Gold Pedestal beneath the Floating Crystal Heart
  const heartPedestalBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.92, 1.08, 0.36, 28));
  heartPedestalBaseGeo.translate(0, 0.18, 0);
  const heartPedestalColGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.62, 0.74, 0.72, 24));
  heartPedestalColGeo.translate(0, 0.68, 0);
  const heartPedestalCrownGeo = tracker.trackGeo(new THREE.TorusGeometry(0.76, 0.045, 10, 32));
  heartPedestalCrownGeo.rotateX(Math.PI / 2);
  heartPedestalCrownGeo.translate(0, 1.04, 0);

  const heartPedestalGroup = new THREE.Group();
  heartPedestalGroup.position.set(courtCenterX, y0, courtCenterZ);
  heartPedestalGroup.add(
    new THREE.Mesh(heartPedestalBaseGeo, mats.pearlWhite),
    new THREE.Mesh(heartPedestalColGeo, mats.blushRoseMarble),
    new THREE.Mesh(heartPedestalCrownGeo, mats.champagneGold),
  );
  heartGalleryGroup.add(heartPedestalGroup);
  registerLocalCollider(courtCenterX, courtCenterZ, 1.12, 2.8);

  // Rotating Floating Crystal Heart Sculpture above the Central Memory Court Pedestal
  const floatingCrystalHeartPivot = new THREE.Group();
  floatingCrystalHeartPivot.position.set(courtCenterX, y0 + 2.05, courtCenterZ);
  const mainFloatingHeartGeo = buildExtrudedHeartGeometry(tracker, 1.35, 0.24, 0.06);
  const mainFloatingHeartMesh = new THREE.Mesh(mainFloatingHeartGeo, floatingHeartCrystalMat);
  const floatingHeartHaloGeo = tracker.trackGeo(new THREE.TorusGeometry(0.95, 0.024, 10, 36));
  const floatingHeartHalo = new THREE.Mesh(floatingHeartHaloGeo, mats.champagneGold);
  floatingCrystalHeartPivot.add(mainFloatingHeartMesh, floatingHeartHalo);
  heartGalleryGroup.add(floatingCrystalHeartPivot);

  // Restrained Instanced Crystal Light Motes orbiting the Floating Crystal Heart (Zero Dynamic Lights)
  const HEART_MOTE_COUNT = 18;
  const heartMoteGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.055, 0));
  const heartMoteInstanced = new THREE.InstancedMesh(
    heartMoteGeo,
    mats.warmLanternGlow,
    HEART_MOTE_COUNT,
  );
  heartMoteInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heartGalleryGroup.add(heartMoteInstanced);

  // Two Velvet Viewing Settees on the North & South edges of the Central Memory Court (outside the 2.8m+ viewing path)
  const setteeGeo = tracker.trackGeo(new THREE.BoxGeometry(1.75, 0.44, 0.62));
  const setteeTrimGeo = tracker.trackGeo(new THREE.BoxGeometry(1.82, 0.08, 0.68));
  [-7.2, 0.2].forEach((sz) => {
    const settee = new THREE.Mesh(setteeGeo, mats.velvetPlum);
    settee.position.set(7.6, y0 + 0.22, sz);
    const trim = new THREE.Mesh(setteeTrimGeo, mats.champagneGold);
    trim.position.set(7.6, y0 + 0.04, sz);
    heartGalleryGroup.add(settee, trim);
    registerLocalCollider(7.6, sz, 0.68, 0.9);
  });

  // --- 5 DEDICATED ARCHITECTURAL MEMORY EXHIBITS (Preserving all 5 Memories & Custom Photo Persistence) ---
  const galleryMemories: GalleryMemory[] = [
    {
      title: 'First Starlight Kiss',
      subtitle: 'Central Plaza Fountain · Memory I',
      quote: '"Every star in the sky paused to watch us."',
      skyTop: '#3b0764',
      skyBottom: '#f472b6',
      accentColor: '#fde047',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'The Crag Magic Flight',
      subtitle: 'Above Heart Island · Memory II',
      quote: '"I want you beside me across every horizon."',
      skyTop: '#1e1b4b',
      skyBottom: '#ec4899',
      accentColor: '#38bdf8',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'The Royal Ballroom Waltz',
      subtitle: 'Pastel Dream Castle · Memory III',
      quote: '"Two hearts spinning in golden candlelight."',
      skyTop: '#831843',
      skyBottom: '#fbcfe8',
      accentColor: '#facc15',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Sunset at the Gazebo',
      subtitle: 'Enchanted Rose Garden · Memory IV',
      quote: '"Where every petal whispers your name, Harsha."',
      skyTop: '#701a75',
      skyBottom: '#fda4af',
      accentColor: '#fde047',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Two Hearts, One Light',
      subtitle: 'Aurora Underground Lake · Memory V',
      quote: '"Forever ours, written in crystal and starlight."',
      skyTop: '#0f172a',
      skyBottom: '#c084fc',
      accentColor: '#67e8f9',
      customImage: null,
      customImageUrl: null,
    },
  ];

  const galleryCanvases: HTMLCanvasElement[] = [];
  const galleryTextures: THREE.CanvasTexture[] = [];
  const galleryFrameHalos: THREE.MeshStandardMaterial[] = [];

  const drawGalleryCanvas = (idx: number, isHighlighted: boolean) => {
    const canvas = galleryCanvases[idx];
    const tex = galleryTextures[idx];
    const mem = galleryMemories[idx];
    if (!canvas || !tex || !mem) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 512, 384);

    if (mem.customImage) {
      const img = mem.customImage;
      const scale = Math.max(512 / img.width, 384 / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (512 - dw) * 0.5, (384 - dh) * 0.5, dw, dh);

      const bottomGrad = ctx.createLinearGradient(0, 220, 0, 384);
      bottomGrad.addColorStop(0, 'rgba(15, 23, 42, 0.0)');
      bottomGrad.addColorStop(1, 'rgba(80, 7, 36, 0.86)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, 220, 512, 164);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, 384);
      grad.addColorStop(0, mem.skyTop);
      grad.addColorStop(1, mem.skyBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 384);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      for (let s = 0; s < 28; s++) {
        const sx = ((s * 97 + idx * 53) % 460) + 26;
        const sy = ((s * 61 + idx * 29) % 190) + 24;
        ctx.beginPath();
        ctx.arc(sx, sy, (s % 3) + 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(256, 152);
      ctx.fillStyle = mem.accentColor;
      ctx.shadowColor = mem.accentColor;
      ctx.shadowBlur = isHighlighted ? 26 : 14;
      ctx.font = 'bold 74px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', 0, 0);
      ctx.restore();
    }

    ctx.strokeStyle = isHighlighted ? '#fde047' : '#fbcfe8';
    ctx.lineWidth = isHighlighted ? 12 : 7;
    ctx.strokeRect(14, 14, 484, 356);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(26, 26, 460, 332);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText(mem.subtitle.toUpperCase(), 256, 268);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 31px Georgia, serif';
    ctx.fillText(mem.title, 256, 306);

    ctx.fillStyle = '#fce7f3';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText(mem.quote, 256, 342);

    tex.needsUpdate = true;
  };

  // Each of the 5 memories is presented in its own architectural exhibit niche around the Heart Gallery
  // with >= 2.8m clear viewing plaza in front of every exhibit!
  interface GalleryExhibitPlacement {
    lx: number;
    lz: number;
    rotY: number;
    camDist: number;
    isHeroExhibit?: boolean;
  }

  const exhibitPlacements: GalleryExhibitPlacement[] = [
    // Exhibit 1: North-East Royal Alcove (angled toward the North-East promenade & court)
    { lx: 13.5, lz: 5.2, rotY: -Math.PI * 0.35, camDist: 2.85 },
    // Exhibit 2: Upper East Niche (facing West into the gallery promenade)
    { lx: 14.3, lz: 0.6, rotY: -Math.PI * 0.5, camDist: 2.85 },
    // Exhibit 3: Central Grand Apse Hero Exhibit (directly opposite the Floating Crystal Heart)
    { lx: 14.35, lz: -3.5, rotY: -Math.PI * 0.5, camDist: 3.05, isHeroExhibit: true },
    // Exhibit 4: Lower East Niche (facing West into the gallery promenade)
    { lx: 14.3, lz: -7.6, rotY: -Math.PI * 0.5, camDist: 2.85 },
    // Exhibit 5: South-East Grand Alcove (facing North toward the Central Memory Court)
    { lx: 10.6, lz: -14.2, rotY: Math.PI, camDist: 2.95 },
  ];

  const nicheBackGeo = tracker.trackGeo(new THREE.BoxGeometry(2.75, 3.55, 0.24));
  const nichePedestalGeo = tracker.trackGeo(new THREE.BoxGeometry(2.35, 0.56, 0.62));
  const nicheColumnGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.17, 3.35, 14));
  const nicheArchGeo = tracker.trackGeo(new THREE.TorusGeometry(1.22, 0.08, 10, 26, Math.PI));
  const frameOuterGeo = tracker.trackGeo(new THREE.BoxGeometry(2.26, 1.72, 0.1));
  const frameCanvasGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.04, 1.52));
  const spotlightConeGeo = tracker.trackGeo(new THREE.ConeGeometry(0.85, 2.2, 18, 1, true));

  const spotlightBeamMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fdf2f8'),
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  for (let i = 0; i < galleryMemories.length; i++) {
    const p = exhibitPlacements[i];
    const scaleMult = p.isHeroExhibit ? 1.12 : 1.0;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    galleryCanvases.push(canvas);

    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    galleryTextures.push(tex);

    drawGalleryCanvas(i, i === 0);

    const exhibitGroup = new THREE.Group();
    exhibitGroup.position.set(p.lx, y0, p.lz);
    exhibitGroup.rotation.y = p.rotY;
    exhibitGroup.scale.setScalar(scaleMult);

    // Architectural Backing Niche & Velvet Pedestal
    const nicheBack = new THREE.Mesh(nicheBackGeo, mats.pearlWhite);
    nicheBack.position.set(0, 1.85, -0.14);
    const nichePedestal = new THREE.Mesh(nichePedestalGeo, mats.blushRoseMarble);
    nichePedestal.position.set(0, 0.28, 0.12);
    const pedestalGoldTrim = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(2.42, 0.06, 0.68)),
      mats.champagneGold,
    );
    pedestalGoldTrim.position.set(0, 0.56, 0.12);
    exhibitGroup.add(nicheBack, nichePedestal, pedestalGoldTrim);

    // Twin Pearl & Gold Side Pilasters + Crystal Arch Header
    [-1.22, 1.22].forEach((cx) => {
      const col = new THREE.Mesh(nicheColumnGeo, mats.pearlWhite);
      col.position.set(cx, 1.72, 0.06);
      exhibitGroup.add(col);
    });
    const archHeader = new THREE.Mesh(nicheArchGeo, crystalArchMat);
    archHeader.position.set(0, 3.35, 0.08);
    const archHeart = new THREE.Mesh(
      buildExtrudedHeartGeometry(tracker, 0.34, 0.12, 0.03),
      mats.champagneGold,
    );
    archHeart.position.set(0, 3.68, 0.12);
    exhibitGroup.add(archHeader, archHeart);

    // Ornate Crystal & Champagne-Gold Memory Frame
    const haloMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fde047'),
        emissive: new THREE.Color('#f472b6'),
        emissiveIntensity: i === 0 ? 0.92 : 0.32,
        roughness: 0.2,
        metalness: 0.68,
      }),
    );
    galleryFrameHalos.push(haloMat);

    const frameOuter = new THREE.Mesh(frameOuterGeo, haloMat);
    frameOuter.position.set(0, 1.92, 0.04);
    const artMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide }),
    );
    const artMesh = new THREE.Mesh(frameCanvasGeo, artMat);
    artMesh.position.set(0, 1.92, 0.1);

    // Soft overhead architectural spotlight cone (emissive volumetric cone, zero dynamic light cost)
    const spotBeam = new THREE.Mesh(spotlightConeGeo, spotlightBeamMat);
    spotBeam.position.set(0, 2.75, 0.35);
    spotBeam.rotation.x = 0.22;

    exhibitGroup.add(frameOuter, artMesh, spotBeam);
    heartGalleryGroup.add(exhibitGroup);
  }

  const applySavedGalleryImage = (frameIndex: number, imageSrc: string, persist = true) => {
    if (frameIndex < 0 || frameIndex >= galleryMemories.length) return;
    if (!imageSrc || !imageSrc.trim()) {
      galleryMemories[frameIndex].customImage = null;
      galleryMemories[frameIndex].customImageUrl = null;
      if (persist) {
        try {
          window.localStorage.removeItem(`${GALLERY_STORAGE_KEY_PREFIX}${frameIndex}`);
        } catch {
          // Ignore storage restrictions
        }
      }
      drawGalleryCanvas(frameIndex, true);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      galleryMemories[frameIndex].customImage = img;
      galleryMemories[frameIndex].customImageUrl = imageSrc;
      if (persist) {
        try {
          window.localStorage.setItem(`${GALLERY_STORAGE_KEY_PREFIX}${frameIndex}`, imageSrc);
        } catch {
          // Ignore quota issues
        }
      }
      drawGalleryCanvas(frameIndex, true);
    };
    img.src = imageSrc;
  };

  if (typeof window !== 'undefined') {
    for (let i = 0; i < galleryMemories.length; i++) {
      try {
        const saved = window.localStorage.getItem(`${GALLERY_STORAGE_KEY_PREFIX}${i}`);
        if (saved) {
          applySavedGalleryImage(i, saved, false);
        }
      } catch {
        // Ignore storage restrictions
      }
    }
  }

  // ==========================================================================
  // 2. ICE SKATING PALACE (PRIORITY #2 — SECOND-LARGEST SPACE ON FLOOR 3)
  //    West Grand Wing: lx in [-15.0, -3.8], lz in [-15.0, +4.2] (~215 m²)
  //    Elongated Oval Ice Rink centered at (lx = -9.4, lz = -5.4), rx = 3.4m, rz = 6.2m (6.8m × 12.4m)
  //    Surrounded by a >= 2.5m clear pearl-marble walking promenade!
  // ==========================================================================
  const icePalaceGroup = new THREE.Group();
  icePalaceGroup.name = 'IceSkatingPalaceWing';
  group.add(icePalaceGroup);

  const rinkCenterX = -9.4;
  const rinkCenterZ = -5.4;
  const rinkRadiusX = 3.4;
  const rinkRadiusZ = 6.2;

  // Open Colonnade Portal framing the Ice Skating Palace from the Central Royal Promenade
  buildPalacePortalArch(-3.8, -5.4, 3.8, 3.85, Math.PI / 2, iceFountainHeartMat);

  // Luminous Sub-Ice Pattern Canvas (Snowflakes, Crystal Filigree & Twin Hearts under the translucent ice)
  const createIceSubPatternTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(256, 512, 30, 256, 512, 500);
      grad.addColorStop(0, '#f0f9ff');
      grad.addColorStop(0.55, '#e0f2fe');
      grad.addColorStop(1, '#ede9fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 1024);

      // Subtle skating figure-eight & center ice medallion rings
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(256, 512, 210, 440, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(256, 360, 125, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(256, 664, 125, 0, Math.PI * 2);
      ctx.stroke();

      // Center ice heart & snowflake motifs
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(236, 72, 153, 0.35)';
      ctx.font = 'bold 96px Georgia, serif';
      ctx.fillText('♡', 256, 512);

      ctx.fillStyle = 'rgba(125, 211, 252, 0.65)';
      ctx.font = '44px Georgia, serif';
      const flakes = [
        [256, 210],
        [256, 814],
        [145, 360],
        [367, 360],
        [145, 664],
        [367, 664],
      ];
      flakes.forEach(([fx, fy]) => ctx.fillText('❄', fx, fy));
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const iceSubTex = createIceSubPatternTexture();
  const iceSubBaseMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({ map: iceSubTex }),
  );

  // Oval Sub-Ice Pattern Base + Translucent Reflective Ice Top Sheet
  const rinkSubGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.0, 1.0, 0.022, 48));
  rinkSubGeo.scale(rinkRadiusX, 1, rinkRadiusZ);
  const rinkSubMesh = new THREE.Mesh(rinkSubGeo, iceSubBaseMat);
  rinkSubMesh.position.set(rinkCenterX, y0 + 0.012, rinkCenterZ);

  const rinkIceGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.0, 1.0, 0.032, 48));
  rinkIceGeo.scale(rinkRadiusX, 1, rinkRadiusZ);
  const rinkIceMesh = new THREE.Mesh(rinkIceGeo, iceSurfaceMat);
  rinkIceMesh.position.set(rinkCenterX, y0 + 0.026, rinkCenterZ);
  rinkIceMesh.receiveShadow = true;

  // Champagne-Gold & Pearl Outer Rink Curb
  const rinkCurbGeo = tracker.trackGeo(new THREE.TorusGeometry(1.0, 0.045, 10, 56));
  rinkCurbGeo.rotateX(Math.PI / 2);
  rinkCurbGeo.scale(rinkRadiusX + 0.06, 1, rinkRadiusZ + 0.06);
  const rinkCurb = new THREE.Mesh(rinkCurbGeo, mats.champagneGold);
  rinkCurb.position.set(rinkCenterX, y0 + 0.04, rinkCenterZ);
  icePalaceGroup.add(rinkSubMesh, rinkIceMesh, rinkCurb);

  // Low Crystal Rink Barrier & Champagne-Gold Handrail with Open East Promenade Gate (lz: -6.8..-4.0) & South Gate
  const RINK_SEGMENTS = 36;
  const barrierPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.068, 0.86, 10));
  barrierPostGeo.translate(0, 0.43, 0);
  const barrierFinialGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.08, 0));
  barrierFinialGeo.translate(0, 0.9, 0);

  for (let s = 0; s < RINK_SEGMENTS; s++) {
    const a0 = (s / RINK_SEGMENTS) * Math.PI * 2;
    const a1 = ((s + 1) / RINK_SEGMENTS) * Math.PI * 2;
    const aMid = (a0 + a1) * 0.5;
    const mx = rinkCenterX + Math.cos(aMid) * rinkRadiusX;
    const mz = rinkCenterZ + Math.sin(aMid) * rinkRadiusZ;

    // Leave open 2.8m East Gate (facing Royal Promenade) and 2.4m South Gate
    const isEastGate = mx > rinkCenterX + 1.8 && mz >= -6.85 && mz <= -3.95;
    const isSouthGate = mz < rinkCenterZ - 4.8 && mx >= -10.6 && mx <= -8.2;
    if (isEastGate || isSouthGate) continue;

    const x0 = rinkCenterX + Math.cos(a0) * rinkRadiusX;
    const z0 = rinkCenterZ + Math.sin(a0) * rinkRadiusZ;
    const x1 = rinkCenterX + Math.cos(a1) * rinkRadiusX;
    const z1 = rinkCenterZ + Math.sin(a1) * rinkRadiusZ;
    const segLen = Math.hypot(x1 - x0, z1 - z0);
    const segYaw = Math.atan2(x1 - x0, z1 - z0);

    const panelGeo = tracker.trackGeo(new THREE.BoxGeometry(0.05, 0.68, segLen + 0.02));
    const panel = new THREE.Mesh(panelGeo, iceCrystalBarrierMat);
    panel.position.set(mx, y0 + 0.4, mz);
    panel.rotation.y = segYaw;

    const railGeo = tracker.trackGeo(new THREE.BoxGeometry(0.09, 0.06, segLen + 0.04));
    const rail = new THREE.Mesh(railGeo, mats.champagneGold);
    rail.position.set(mx, y0 + 0.78, mz);
    rail.rotation.y = segYaw;
    icePalaceGroup.add(panel, rail);

    if (s % 2 === 0) {
      const post = new THREE.Mesh(barrierPostGeo, mats.pearlWhite);
      post.position.set(x0, y0, z0);
      const finial = new THREE.Mesh(barrierFinialGeo, mats.champagneGold);
      finial.position.set(x0, y0, z0);
      icePalaceGroup.add(post, finial);
    }
  }

  // --- CRYSTAL HEART FOUNTAIN CENTERPIECE AT NORTH END OF THE ICE RINK (lx = -9.4, lz = +1.35) ---
  const fountainX = -9.4;
  const fountainZ = 1.45;
  const iceFountainGroup = new THREE.Group();
  iceFountainGroup.position.set(fountainX, y0, fountainZ);

  const fBasinGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.45, 1.62, 0.42, 28));
  fBasinGeo.translate(0, 0.21, 0);
  const fRimGeo = tracker.trackGeo(new THREE.TorusGeometry(1.5, 0.055, 10, 36));
  fRimGeo.rotateX(Math.PI / 2);
  fRimGeo.translate(0, 0.42, 0);
  const fTierGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.72, 0.95, 0.68, 24));
  fTierGeo.translate(0, 0.72, 0);
  iceFountainGroup.add(
    new THREE.Mesh(fBasinGeo, mats.pearlWhite),
    new THREE.Mesh(fRimGeo, mats.champagneGold),
    new THREE.Mesh(fTierGeo, iceCrystalBarrierMat),
  );

  const iceFountainHeartPivot = new THREE.Group();
  iceFountainHeartPivot.position.set(0, 1.75, 0);
  const iceFountainHeartMesh = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 1.15, 0.22, 0.05),
    iceFountainHeartMat,
  );
  iceFountainHeartPivot.add(iceFountainHeartMesh);
  iceFountainGroup.add(iceFountainHeartPivot);
  icePalaceGroup.add(iceFountainGroup);
  registerLocalCollider(fountainX, fountainZ, 1.55, 2.8);

  // Instanced Crystal-Ice Fountain Droplets & Rink Shimmer Motes (Zero Per-Frame Allocations)
  const ICE_DROPLET_COUNT = 22;
  const iceDropletGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.05, 0));
  const iceDropletInstanced = new THREE.InstancedMesh(
    iceDropletGeo,
    iceFountainHeartMat,
    ICE_DROPLET_COUNT,
  );
  iceDropletInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  icePalaceGroup.add(iceDropletInstanced);

  // Two Skate-Side Velvet Viewing Benches along the West Outer Promenade (outside the 2.5m walking lane)
  [-3.2, -7.8].forEach((bz) => {
    const skateBench = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(0.58, 0.44, 1.65)),
      mats.softLavender,
    );
    skateBench.position.set(-14.35, y0 + 0.22, bz);
    const benchGold = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(0.64, 0.07, 1.72)),
      mats.champagneGold,
    );
    benchGold.position.set(-14.35, y0 + 0.04, bz);
    icePalaceGroup.add(skateBench, benchGold);
    registerLocalCollider(-14.35, bz, 0.62, 0.9);
  });

  // ==========================================================================
  // 3. PUPPY PLAY AREA (PRIORITY #3 — THIRD-LARGEST SPACE ON FLOOR 3)
  //    South-Central Open Garden Playground: lx in [-3.8, +4.8], lz in [-15.0, -4.2] (~93 m²)
  //    Open Central Puppy Play Lawn + 5 Perimeter Activity Zones + 4 Animated Puppy NPCs
  // ==========================================================================
  const puppyPlayGroup = new THREE.Group();
  puppyPlayGroup.name = 'PuppyPlayAreaWing';
  group.add(puppyPlayGroup);

  const playCenterX = 0.5;
  const playCenterZ = -9.6;

  // Open Garden Archway framing the entrance from the Central Royal Promenade (lz = -4.2)
  buildPalacePortalArch(0.5, -4.2, 3.8, 3.65, 0, mats.champagneGold);

  // Soft Pastel Grass Lawn with Champagne-Gold Garden Border
  const lawnGeo = tracker.trackGeo(new THREE.BoxGeometry(7.8, 0.026, 9.8));
  const lawnMesh = new THREE.Mesh(lawnGeo, pastelLawnMat);
  lawnMesh.position.set(playCenterX, y0 + 0.013, playCenterZ);
  lawnMesh.receiveShadow = true;
  const lawnBorderGeo = tracker.trackGeo(new THREE.BoxGeometry(8.0, 0.018, 10.0));
  const lawnBorder = new THREE.Mesh(lawnBorderGeo, mats.champagneGold);
  lawnBorder.position.set(playCenterX, y0 + 0.008, playCenterZ);
  puppyPlayGroup.add(lawnMesh, lawnBorder);

  // Low Pastel Garden Hedging along the West & South edges (leaving wide promenade & gallery openings)
  const lowHedgeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 0.52, 2.8));
  [-6.4, -12.4].forEach((hz) => {
    const westHedge = new THREE.Mesh(lowHedgeGeo, pastelHedgeMat);
    westHedge.position.set(-3.55, y0 + 0.26, hz);
    puppyPlayGroup.add(westHedge);
  });

  // Paw-Print Stepping Stones & Tiny Pastel Garden Flowers on the Lawn (Flush on y0 + 0.028m)
  const pawPadMainGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.16, 0.17, 0.016, 14));
  const pawToeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.065, 0.07, 0.018, 10));
  const pawPositions: Array<[number, number, number]> = [
    [0.5, -5.2, 0.1],
    [0.2, -6.3, -0.15],
    [0.6, -7.4, 0.12],
    [0.3, -8.5, -0.08],
    [0.5, -9.6, 0.05],
  ];
  pawPositions.forEach(([px, pz, rot]) => {
    const pawGroup = new THREE.Group();
    pawGroup.position.set(px, y0 + 0.028, pz);
    pawGroup.rotation.y = rot;
    pawGroup.add(new THREE.Mesh(pawPadMainGeo, mats.champagneGold));
    [-0.12, 0, 0.12].forEach((tx, idx) => {
      const toe = new THREE.Mesh(pawToeGeo, mats.blushRoseMarble);
      toe.position.set(tx, 0.002, -0.18 - (idx === 1 ? 0.04 : 0));
      pawGroup.add(toe);
    });
    puppyPlayGroup.add(pawGroup);
  });

  // --- PERIMETER ACTIVITY ZONE 1: CURVED PASTEL TUNNEL (lx = -2.35, lz = -7.4) ---
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(-2.35, y0, -7.4);
  tunnelGroup.rotation.y = 0.28;
  const tunnelTubeGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.52, 0.52, 1.65, 20, 1, true, 0, Math.PI),
  );
  tunnelTubeGeo.rotateZ(Math.PI * 0.5);
  tunnelTubeGeo.rotateY(Math.PI * 0.5);
  const tunnelMesh = new THREE.Mesh(tunnelTubeGeo, mats.blushRoseMarble);
  tunnelMesh.position.y = 0.04;
  [-0.8, 0, 0.8].forEach((tz) => {
    const archRib = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(0.53, 0.035, 8, 20, Math.PI)),
      mats.champagneGold,
    );
    archRib.position.set(0, 0.04, tz);
    tunnelGroup.add(archRib);
  });
  tunnelGroup.add(tunnelMesh);
  puppyPlayGroup.add(tunnelGroup);

  // --- PERIMETER ACTIVITY ZONE 2: MINI CLIMBABLE / PLAY RAMP (lx = +3.2, lz = -7.4) ---
  const rampGroup = new THREE.Group();
  rampGroup.position.set(3.2, y0, -7.4);
  rampGroup.rotation.y = -0.25;
  const rampPlatform = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.82, 0.36, 0.82)),
    mats.pearlWhite,
  );
  rampPlatform.position.set(0, 0.18, 0);
  const rampSlopeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.76, 0.06, 1.05));
  [-0.78, 0.78].forEach((rz, idx) => {
    const slope = new THREE.Mesh(rampSlopeGeo, mats.softLavender);
    slope.position.set(0, 0.18, rz);
    slope.rotation.x = idx === 0 ? 0.34 : -0.34;
    rampGroup.add(slope);
  });
  rampGroup.add(rampPlatform);
  puppyPlayGroup.add(rampGroup);

  // --- PERIMETER ACTIVITY ZONE 3: INTERACTIVE BALL AREA (lx = +2.6, lz = -11.8) ---
  const playBalls: Array<{
    mesh: THREE.Mesh;
    homeLx: number;
    homeLz: number;
    lx: number;
    lz: number;
    vx: number;
    vz: number;
  }> = [];
  const ballGeo = tracker.trackGeo(new THREE.SphereGeometry(0.16, 16, 14));
  const ballConfigs = [
    { lx: 2.3, lz: -11.4, mat: mats.velvetPlum },
    { lx: 2.9, lz: -12.1, mat: mats.champagneGold },
    { lx: 1.9, lz: -12.3, mat: mats.softLavender },
  ];
  ballConfigs.forEach((bc) => {
    const m = new THREE.Mesh(ballGeo, bc.mat);
    m.position.set(bc.lx, y0 + 0.17, bc.lz);
    m.castShadow = true;
    puppyPlayGroup.add(m);
    playBalls.push({
      mesh: m,
      homeLx: bc.lx,
      homeLz: bc.lz,
      lx: bc.lx,
      lz: bc.lz,
      vx: 0,
      vz: 0,
    });
  });

  // --- PERIMETER ACTIVITY ZONE 4: TOY GARDEN (lx = -2.35, lz = -11.8) ---
  const toyGardenGroup = new THREE.Group();
  toyGardenGroup.position.set(-2.35, y0, -11.8);
  const ringToyGeo = tracker.trackGeo(new THREE.TorusGeometry(0.16, 0.045, 10, 20));
  ringToyGeo.rotateX(Math.PI / 2);
  const ringToy1 = new THREE.Mesh(ringToyGeo, mats.velvetPlum);
  ringToy1.position.set(0.2, 0.05, 0.1);
  const ringToy2 = new THREE.Mesh(ringToyGeo, mats.champagneGold);
  ringToy2.position.set(-0.25, 0.05, -0.2);
  // Crystal garden flower sprouts
  const crystalSproutGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.14, 0));
  [-0.35, 0.35].forEach((sx, sIdx) => {
    const sprout = new THREE.Mesh(crystalSproutGeo, floatingHeartCrystalMat);
    sprout.position.set(sx, 0.22, sIdx === 0 ? 0.35 : -0.35);
    toyGardenGroup.add(sprout);
  });
  toyGardenGroup.add(ringToy1, ringToy2);
  puppyPlayGroup.add(toyGardenGroup);

  // --- PERIMETER ACTIVITY ZONE 5: COZY REST ZONE (lx = +0.5, lz = -13.65) ---
  const restBedOuterGeo = tracker.trackGeo(new THREE.TorusGeometry(0.52, 0.14, 12, 24));
  restBedOuterGeo.rotateX(Math.PI / 2);
  const restBedCushionGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 20));
  [-0.75, 0.75].forEach((bx, idx) => {
    const bedGroup = new THREE.Group();
    bedGroup.position.set(playCenterX + bx, y0 + 0.08, -13.65);
    const bolster = new THREE.Mesh(
      restBedOuterGeo,
      idx === 0 ? mats.blushRoseMarble : mats.softLavender,
    );
    const cushion = new THREE.Mesh(restBedCushionGeo, mats.pearlWhite);
    bedGroup.add(bolster, cushion);
    puppyPlayGroup.add(bedGroup);
  });

  // --- 4 EXPRESSIVE PROCEDURAL PUPPY NPCs (Bella, Mochi, Rosie, Coco) ---
  const puppyBodyGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.14, 0.24, 8, 12));
  puppyBodyGeo.rotateX(Math.PI / 2);
  const puppyHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.145, 14, 12));
  const puppySnoutGeo = tracker.trackGeo(new THREE.SphereGeometry(0.075, 10, 10));
  puppySnoutGeo.scale(1.0, 0.82, 1.25);
  const puppyEarGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.042, 0.11, 6, 8));
  const puppyLegGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.038, 0.12, 6, 8));
  puppyLegGeo.translate(0, -0.08, 0);
  const puppyTailGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.028, 0.12, 6, 8));
  puppyTailGeo.translate(0, 0.07, 0);
  const puppyEyeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.022, 8, 8));
  const puppyBowGeo = buildExtrudedHeartGeometry(tracker, 0.11, 0.05, 0.015);

  const createPuppyModel = (coatMat: THREE.Material, bowMat: THREE.Material) => {
    const root = new THREE.Group();

    const body = new THREE.Mesh(puppyBodyGeo, coatMat);
    body.position.set(0, 0.24, 0);
    body.castShadow = true;
    root.add(body);

    // Satin Collar Bow
    const collarBow = new THREE.Mesh(puppyBowGeo, bowMat);
    collarBow.position.set(0, 0.28, 0.17);
    root.add(collarBow);

    // Head Pivot
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.34, 0.18);
    const headMesh = new THREE.Mesh(puppyHeadGeo, coatMat);
    const snoutMesh = new THREE.Mesh(puppySnoutGeo, coatMat);
    snoutMesh.position.set(0, -0.03, 0.12);
    const noseMesh = new THREE.Mesh(puppyEyeGeo, puppyEyeNoseMat);
    noseMesh.position.set(0, -0.01, 0.2);
    const eyeL = new THREE.Mesh(puppyEyeGeo, puppyEyeNoseMat);
    eyeL.position.set(-0.055, 0.03, 0.125);
    const eyeR = new THREE.Mesh(puppyEyeGeo, puppyEyeNoseMat);
    eyeR.position.set(0.055, 0.03, 0.125);

    const earL = new THREE.Mesh(puppyEarGeo, coatMat);
    earL.position.set(-0.13, -0.01, 0.02);
    earL.rotation.z = 0.28;
    const earR = new THREE.Mesh(puppyEarGeo, coatMat);
    earR.position.set(0.13, -0.01, 0.02);
    earR.rotation.z = -0.28;

    headPivot.add(headMesh, snoutMesh, noseMesh, eyeL, eyeR, earL, earR);
    root.add(headPivot);

    // Wagging Tail Pivot
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.29, -0.18);
    const tailMesh = new THREE.Mesh(puppyTailGeo, coatMat);
    tailMesh.rotation.x = -0.55;
    tailPivot.add(tailMesh);
    root.add(tailPivot);

    // 4 Animated Leg Pivots
    const makeLeg = (x: number, z: number) => {
      const lp = new THREE.Group();
      lp.position.set(x, 0.18, z);
      lp.add(new THREE.Mesh(puppyLegGeo, coatMat));
      root.add(lp);
      return lp;
    };
    const legFL = makeLeg(-0.08, 0.11);
    const legFR = makeLeg(0.08, 0.11);
    const legBL = makeLeg(-0.08, -0.11);
    const legBR = makeLeg(0.08, -0.11);

    return { root, headPivot, tailPivot, legFL, legFR, legBL, legBR };
  };

  const puppies: PuppyNpc[] = [];
  const puppySpecs: Array<{
    name: string;
    personality: PuppyNpc['personality'];
    coat: THREE.Material;
    bow: THREE.Material;
    lx: number;
    lz: number;
    initialState: PuppyBehaviorState;
  }> = [
    {
      name: 'Bella',
      personality: 'energetic',
      coat: puppyCreamMat,
      bow: mats.velvetPlum,
      lx: 0.4,
      lz: -8.6,
      initialState: 'PLAY',
    },
    {
      name: 'Mochi',
      personality: 'curious',
      coat: puppySnowMat,
      bow: mats.champagneGold,
      lx: -0.9,
      lz: -9.8,
      initialState: 'WANDER',
    },
    {
      name: 'Rosie',
      personality: 'sleepy',
      coat: puppyBlushMat,
      bow: mats.champagneGold,
      lx: -0.25,
      lz: -13.5,
      initialState: 'REST',
    },
    {
      name: 'Coco',
      personality: 'playful',
      coat: puppyCaramelMat,
      bow: mats.softLavender,
      lx: 1.6,
      lz: -10.8,
      initialState: 'PLAY',
    },
  ];

  puppySpecs.forEach((spec, idx) => {
    const model = createPuppyModel(spec.coat, spec.bow);
    model.root.position.set(spec.lx, y0, spec.lz);
    puppyPlayGroup.add(model.root);
    puppies.push({
      name: spec.name,
      personality: spec.personality,
      ...model,
      state: spec.initialState,
      stateTimer: 3.5 + idx * 1.4,
      lx: spec.lx,
      lz: spec.lz,
      targetLx: spec.lx,
      targetLz: spec.lz,
      homeLx: spec.lx,
      homeLz: spec.lz,
      yaw: idx * 1.2,
      speed: spec.personality === 'energetic' ? 1.55 : 1.15,
      hopPhase: idx * 1.5,
      barkSparkleBoost: 0,
    });
  });

  // ==========================================================================
  // 4. PET SALON (PRIORITY #4 — SMALLEST COMPACT LUXURY SUITE ON FLOOR 3)
  //    North-West Luxury Suite: lx in [-15.0, -9.6], lz in [+4.5, +14.8] (~55 m²)
  //    West of F3->F4 Staircase (`lx: -9.2..-5.8`), connected via 2.6m Archway at (-12.3, y0, +4.5)
  // ==========================================================================
  const petSalonGroup = new THREE.Group();
  petSalonGroup.name = 'PetSalonWing';
  group.add(petSalonGroup);

  // Boutique Lavender & Pearl Floor Carpet inside Pet Salon
  const salonFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(5.1, 0.02, 9.9));
  const salonFloor = new THREE.Mesh(salonFloorGeo, galleryRoseMarbleMat);
  salonFloor.position.set(-12.3, y0 + 0.01, 9.65);
  salonFloor.receiveShadow = true;
  petSalonGroup.add(salonFloor);

  // Pet Salon Partition Walls:
  //   - South Wall at lz = +4.5 with 2.6m open archway at lx in [-13.6, -11.0]
  //   - East Wall at lx = -9.6 separating Pet Salon from F3->F4 West Staircase
  [
    { x1: -15.0, x2: -13.6, z: 4.5 },
    { x1: -11.0, x2: -9.6, z: 4.5 },
  ].forEach(({ x1, x2, z }) => {
    const w = x2 - x1;
    const mx = (x1 + x2) * 0.5;
    const sWall = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(w, 4.1, 0.34)),
      mats.pearlWhite,
    );
    sWall.position.set(mx, y0 + 2.05, z);
    const sTrim = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(w + 0.04, 0.14, 0.38)),
      mats.champagneGold,
    );
    sTrim.position.set(mx, y0 + 0.07, z);
    petSalonGroup.add(sWall, sTrim);
    partitionMeshes.push(sWall);
  });

  const salonEastWall = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.34, 4.1, 10.3)),
    mats.pearlWhite,
  );
  salonEastWall.position.set(-9.6, y0 + 2.05, 9.65);
  const salonEastTrim = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.38, 0.14, 10.34)),
    mats.champagneGold,
  );
  salonEastTrim.position.set(-9.6, y0 + 0.07, 9.65);
  petSalonGroup.add(salonEastWall, salonEastTrim);
  partitionMeshes.push(salonEastWall);

  // Pet Salon Entrance Portal Archway at (-12.3, y0, +4.5)
  buildPalacePortalArch(-12.3, 4.5, 2.6, 3.55, 0, crystalArchMat);

  // --- STATION 1: MAIN GROOMING TABLE (lx = -12.3, lz = +9.6) ---
  const groomX = -12.3;
  const groomZ = 9.6;
  const groomTableGroup = new THREE.Group();
  groomTableGroup.position.set(groomX, y0, groomZ);

  const groomBase = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.55, 0.65, 0.12, 24)),
    mats.champagneGold,
  );
  groomBase.position.y = 0.06;
  const groomPillar = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.22, 0.72, 20)),
    mats.pearlWhite,
  );
  groomPillar.position.y = 0.42;
  const groomTop = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.78, 0.78, 0.09, 28)),
    mats.blushRoseMarble,
  );
  groomTop.position.y = 0.82;
  const groomRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.79, 0.03, 8, 32)).rotateX(Math.PI / 2),
    mats.champagneGold,
  );
  groomRim.position.y = 0.84;

  // Champagne-gold overhead grooming arch bar with hanging crystal heart
  const groomArm = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.62, 0.024, 8, 24, Math.PI)),
    mats.champagneGold,
  );
  groomArm.position.set(0, 0.85, 0);
  const groomHangingHeart = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.2, 0.08, 0.02),
    floatingHeartCrystalMat,
  );
  groomHangingHeart.position.set(0, 1.32, 0);

  // Salon Puppy "Lulu" being pampered on the Grooming Table
  const salonPuppyModel = createPuppyModel(puppySnowMat, floatingHeartCrystalMat);
  salonPuppyModel.root.position.set(0, 0.86, 0);
  groomTableGroup.add(
    groomBase,
    groomPillar,
    groomTop,
    groomRim,
    groomArm,
    groomHangingHeart,
    salonPuppyModel.root,
  );
  petSalonGroup.add(groomTableGroup);
  registerLocalCollider(groomX, groomZ, 0.82, 1.8);

  // --- STATION 2: LUXURY PET BATH WITH WARM BUBBLES (lx = -13.95, lz = +12.8) ---
  const bathGroup = new THREE.Group();
  bathGroup.position.set(-13.95, y0, 12.8);
  const tubBody = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.68, 0.56, 0.56, 24)),
    mats.pearlWhite,
  );
  tubBody.scale.set(1.0, 1.0, 1.35);
  tubBody.position.y = 0.32;
  const tubGoldRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.68, 0.04, 10, 28)).rotateX(Math.PI / 2),
    mats.champagneGold,
  );
  tubGoldRim.scale.set(1.0, 1.35, 1.0);
  tubGoldRim.position.y = 0.6;
  const tubWater = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 24)),
    iceSurfaceMat,
  );
  tubWater.scale.set(1.0, 1.0, 1.32);
  tubWater.position.y = 0.54;
  const faucetPipe = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 10)),
    mats.champagneGold,
  );
  faucetPipe.position.set(-0.55, 0.72, 0);
  bathGroup.add(tubBody, tubGoldRim, tubWater, faucetPipe);
  petSalonGroup.add(bathGroup);
  registerLocalCollider(-13.95, 12.8, 0.85, 1.4);

  // Animated Iridescent Bath & Grooming Bubbles (InstancedMesh, Zero Per-Frame Allocations)
  const SALON_BUBBLE_COUNT = 20;
  const bubbleSphereGeo = tracker.trackGeo(new THREE.SphereGeometry(0.065, 10, 10));
  const salonBubbleInstanced = new THREE.InstancedMesh(
    bubbleSphereGeo,
    bubbleIridescentMat,
    SALON_BUBBLE_COUNT,
  );
  salonBubbleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  petSalonGroup.add(salonBubbleInstanced);

  // --- STATION 3: STYLING VANITY STATION (Mirror, Brushes, Combs, Ribbons at lx = -14.2, lz = +7.4) ---
  const stylingGroup = new THREE.Group();
  stylingGroup.position.set(-14.2, y0, 7.4);
  stylingGroup.rotation.y = Math.PI / 2;

  const vanityCounter = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.65, 0.78, 0.56)),
    mats.pearlWhite,
  );
  vanityCounter.position.set(0, 0.39, 0);
  const vanityTop = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.74, 0.06, 0.62)),
    mats.champagneGold,
  );
  vanityTop.position.set(0, 0.8, 0);
  const heartMirrorFrame = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.92, 0.08, 0.025),
    mats.champagneGold,
  );
  heartMirrorFrame.position.set(0, 1.52, -0.2);
  const heartMirrorGlass = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.76, 0.09, 0.015),
    iceSurfaceMat,
  );
  heartMirrorGlass.position.set(0, 1.52, -0.18);

  // Miniature Brushes, Combs, Ribbons & Bows on the Styling Vanity
  const brushHandleGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 0.03, 0.08));
  [-0.45, -0.18, 0.18, 0.45].forEach((vx, idx) => {
    const prop = new THREE.Mesh(
      idx < 2 ? brushHandleGeo : puppyBowGeo,
      idx % 2 === 0 ? mats.velvetPlum : mats.champagneGold,
    );
    prop.position.set(vx, 0.86, 0.06);
    stylingGroup.add(prop);
  });
  stylingGroup.add(vanityCounter, vanityTop, heartMirrorFrame, heartMirrorGlass);
  petSalonGroup.add(stylingGroup);
  registerLocalCollider(-14.2, 7.4, 0.68, 2.0);

  // --- STATION 4: WAITING AREA PET BEDS (lx = -10.45, lz = +6.8 & +8.1) ---
  [6.7, 8.0].forEach((wz, idx) => {
    const waitBed = new THREE.Group();
    waitBed.position.set(-10.45, y0 + 0.08, wz);
    waitBed.add(
      new THREE.Mesh(restBedOuterGeo, idx === 0 ? mats.softLavender : mats.blushRoseMarble),
      new THREE.Mesh(restBedCushionGeo, mats.pearlWhite),
    );
    petSalonGroup.add(waitBed);
  });

  // --- STATION 5: CARE COUNTER (Miniature Grooming Bottles, Folded Towels, Small Bowls, Crystal Containers at lx = -10.45, lz = +12.2) ---
  const careCounterGroup = new THREE.Group();
  careCounterGroup.position.set(-10.45, y0, 12.2);
  careCounterGroup.rotation.y = -Math.PI / 2;

  const careCabinet = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.85, 0.82, 0.56)),
    mats.pearlWhite,
  );
  careCabinet.position.set(0, 0.41, 0);
  const careTop = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.92, 0.06, 0.62)),
    mats.champagneGold,
  );
  careTop.position.set(0, 0.85, 0);

  // Miniature shampoo/perfume bottles, folded pastel towels, and crystal treat containers
  const miniBottleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.22, 12));
  [-0.65, -0.45, -0.25].forEach((bx, bIdx) => {
    const bottle = new THREE.Mesh(
      miniBottleGeo,
      bIdx === 1 ? floatingHeartCrystalMat : mats.champagneGold,
    );
    bottle.position.set(bx, 0.99, 0);
    careCounterGroup.add(bottle);
  });
  // Folded pastel towel stack
  const towelGeo = tracker.trackGeo(new THREE.BoxGeometry(0.32, 0.06, 0.26));
  [0, 1, 2].forEach((tIdx) => {
    const towel = new THREE.Mesh(
      towelGeo,
      tIdx % 2 === 0 ? mats.blushRoseMarble : mats.pearlWhite,
    );
    towel.position.set(0.18, 0.91 + tIdx * 0.062, 0);
    careCounterGroup.add(towel);
  });
  // Crystal treat jar + twin gold pet bowls at base
  const crystalJar = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 14)),
    crystalArchMat,
  );
  crystalJar.position.set(0.62, 1.01, 0);
  const petBowlGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.11, 0.08, 16));
  [-0.35, 0.35].forEach((bwx) => {
    const bowl = new THREE.Mesh(petBowlGeo, mats.champagneGold);
    bowl.position.set(bwx, 0.04, 0.48);
    careCounterGroup.add(bowl);
  });

  careCounterGroup.add(careCabinet, careTop, crystalJar);
  petSalonGroup.add(careCounterGroup);
  registerLocalCollider(-10.45, 12.2, 0.68, 1.6);

  // ==========================================================================
  // INTERACTION, SKATING, PUPPY PLAY & CAMERA STATE MACHINE
  // ==========================================================================
  let activeMode: Floor3ActiveCameraMode = 'none';
  let lookYawOffset = 0.0;
  let lookPitchOffset = 0.0;
  let currentGalleryIndex = 0;
  let gallerySwitchCooldown = 0.0;
  let isSkatingExplicitlyActive = false;
  let skatingJumpSpinBoost = 0.0;
  let puppyPlayCelebrationTimer = 0.0;
  let salonGroomCelebrationTimer = 0.0;

  const camState: Floor3CameraState = {
    active: false,
    mode: 'none',
    camWorldPos: new THREE.Vector3(),
    lookWorldPos: new THREE.Vector3(),
    blendAlpha: 0.0,
    isSitting: false,
  };

  const isOnFloor3 = (playerPos: THREE.Vector3) =>
    Math.abs(playerPos.y - floor3WorldY) <= 2.35;

  const isPointInsideIceRink = (lx: number, lz: number): boolean => {
    const dx = (lx - rinkCenterX) / (rinkRadiusX - 0.15);
    const dz = (lz - rinkCenterZ) / (rinkRadiusZ - 0.15);
    return dx * dx + dz * dz <= 1.0;
  };

  const isPlayerOnIceRink = (playerPos: THREE.Vector3): boolean => {
    if (!isOnFloor3(playerPos)) return false;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;
    return isPointInsideIceRink(lx, lz);
  };

  const findNearestGalleryExhibitIndex = (lx: number, lz: number): { index: number; dist: number } => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < exhibitPlacements.length; i++) {
      const p = exhibitPlacements[i];
      const d = Math.hypot(lx - p.lx, lz - p.lz);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return { index: bestIdx, dist: bestDist };
  };

  const getNearestZoneInteraction = (
    playerPos: THREE.Vector3,
  ): 'heart_gallery' | 'ice_palace' | 'puppy_play' | 'pet_salon' | null => {
    if (!isOnFloor3(playerPos)) return null;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;

    // 1. Heart Gallery (East & South-East Wing: lx >= 4.2, lz in [-15.0, +7.8])
    if (lx >= 4.2 && lz <= 8.0) {
      const nearestEx = findNearestGalleryExhibitIndex(lx, lz);
      const distCourt = Math.hypot(lx - courtCenterX, lz - courtCenterZ);
      if (nearestEx.dist <= 4.5 || distCourt <= 4.2) {
        return 'heart_gallery';
      }
    }

    // 2. Pet Salon (North-West Suite: lx <= -9.2, lz >= 4.0)
    if (lx <= -9.2 && lz >= 4.0) {
      if (Math.hypot(lx - groomX, lz - groomZ) <= 3.6) {
        return 'pet_salon';
      }
    }

    // 3. Ice Skating Palace (West Wing: lx <= -3.5, lz <= 4.2)
    if (lx <= -3.5 && lz <= 4.2) {
      const normDist = Math.hypot(
        (lx - rinkCenterX) / (rinkRadiusX + 1.8),
        (lz - rinkCenterZ) / (rinkRadiusZ + 1.8),
      );
      if (normDist <= 1.08) {
        return 'ice_palace';
      }
    }

    // 4. Puppy Play Area (South-Central Garden: lx in [-4.0, +4.8], lz <= -4.0)
    if (lx >= -4.0 && lx <= 4.8 && lz <= -4.0) {
      if (Math.hypot(lx - playCenterX, lz - playCenterZ) <= 5.4) {
        return 'puppy_play';
      }
    }

    return null;
  };

  const selectGalleryFrame = (index: number) => {
    const nextIdx =
      ((index % galleryMemories.length) + galleryMemories.length) %
      galleryMemories.length;
    currentGalleryIndex = nextIdx;
    for (let i = 0; i < galleryMemories.length; i++) {
      const isSel = i === currentGalleryIndex;
      drawGalleryCanvas(i, isSel);
      if (galleryFrameHalos[i]) {
        galleryFrameHalos[i].emissiveIntensity = isSel ? 1.05 : 0.28;
      }
    }
    playChime(587.33 + nextIdx * 65, 880 + nextIdx * 90);
  };

  const exitActiveCameraMode = () => {
    if (activeMode === 'none') return;
    activeMode = 'none';
    camState.active = false;
    camState.mode = 'none';
    camState.blendAlpha = 0.0;
    camState.isSitting = false;
    camState.seatWorldPos = undefined;
    camState.seatYaw = undefined;
    lookYawOffset = 0.0;
    lookPitchOffset = 0.0;
    avatarCallbacks?.resetNeutralPose();
    playChime(523.25, 392.0);
  };

  const triggerPuppyPlayAction = (playerPos: THREE.Vector3) => {
    puppyPlayCelebrationTimer = 7.5;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;

    // Give the interactive pastel play balls a gentle playful bounce across the lawn
    for (let b = 0; b < playBalls.length; b++) {
      const ball = playBalls[b];
      const ang = (b / playBalls.length) * Math.PI * 2 + Math.random() * 0.6;
      ball.vx = Math.cos(ang) * 2.2;
      ball.vz = Math.sin(ang) * 2.2;
    }

    // Transition all 4 puppies into excited PLAY / FOLLOW_PLAYER states
    for (let p = 0; p < puppies.length; p++) {
      const pup = puppies[p];
      pup.state = p % 2 === 0 ? 'FOLLOW_PLAYER' : 'PLAY';
      pup.stateTimer = 6.5;
      pup.barkSparkleBoost = 1.0;
      pup.targetLx = THREE.MathUtils.clamp(lx + Math.cos(p * 1.57) * 1.25, -2.8, 3.6);
      pup.targetLz = THREE.MathUtils.clamp(lz + Math.sin(p * 1.57) * 1.25, -13.8, -5.2);
    }

    playChime(659.25, 987.77);
    return true;
  };

  const triggerPetSalonGroomAction = () => {
    salonGroomCelebrationTimer = 5.5;
    playChime(783.99, 1046.5);
    return true;
  };

  return {
    group,
    colliders,
    partitionMeshes,

    setAvatarCallbacks: (cbs) => {
      avatarCallbacks = cbs;
    },

    getActiveRoomCaption: () => {
      if (activeMode === 'heart_gallery') {
        return galleryMemories[currentGalleryIndex]?.quote ?? null;
      }
      return null;
    },

    getProximityPrompt: (playerPos: THREE.Vector3) => {
      if (activeMode === 'heart_gallery') {
        const mem = galleryMemories[currentGalleryIndex];
        return `Heart Gallery (${currentGalleryIndex + 1}/5: ${mem.title}) · [1-5 / A/D] Switch · [E] Exit`;
      }

      if (isPlayerOnIceRink(playerPos)) {
        return 'Ice Palace · [Space] Spin Jump · [E] Exit Ice';
      }

      const zone = getNearestZoneInteraction(playerPos);
      if (zone === 'heart_gallery') {
        return 'Heart Gallery · [E] View Memory';
      }
      if (zone === 'ice_palace') {
        return 'Ice Palace · [E] Enter Ice';
      }
      if (zone === 'puppy_play') {
        return 'Puppy Play Area · [E] Play';
      }
      if (zone === 'pet_salon') {
        return 'Pet Salon · [E] Groom';
      }
      return null;
    },

    interact: (playerPos: THREE.Vector3) => {
      if (activeMode !== 'none') {
        exitActiveCameraMode();
        return true;
      }

      // If currently on the Ice Rink, pressing [E] cleanly steps onto the East Promenade Gate
      if (isPlayerOnIceRink(playerPos)) {
        isSkatingExplicitlyActive = false;
        playerPos.x = originX - 5.1;
        playerPos.z = originZ - 5.4;
        playChime(587.33, 440.0);
        return true;
      }

      const zone = getNearestZoneInteraction(playerPos);
      if (!zone) return false;

      if (zone === 'heart_gallery') {
        const lx = playerPos.x - originX;
        const lz = playerPos.z - originZ;
        const nearest = findNearestGalleryExhibitIndex(lx, lz);
        activeMode = 'heart_gallery';
        camState.active = true;
        camState.mode = 'heart_gallery';
        camState.blendAlpha = 0.0;
        camState.isSitting = false;
        camState.seatWorldPos = undefined;
        camState.seatYaw = undefined;
        lookYawOffset = 0.0;
        lookPitchOffset = 0.0;
        selectGalleryFrame(nearest.index);
        return true;
      }

      if (zone === 'ice_palace') {
        isSkatingExplicitlyActive = true;
        playerPos.x = originX - 7.4;
        playerPos.z = originZ - 5.4;
        playChime(659.25, 880.0);
        return true;
      }

      if (zone === 'puppy_play') {
        return triggerPuppyPlayAction(playerPos);
      }

      if (zone === 'pet_salon') {
        return triggerPetSalonGroomAction();
      }

      return false;
    },

    handleKeyAction: (code: string) => {
      if (activeMode !== 'heart_gallery') return false;
      if (code === 'Digit1' || code === 'Numpad1') {
        selectGalleryFrame(0);
        return true;
      }
      if (code === 'Digit2' || code === 'Numpad2') {
        selectGalleryFrame(1);
        return true;
      }
      if (code === 'Digit3' || code === 'Numpad3') {
        selectGalleryFrame(2);
        return true;
      }
      if (code === 'Digit4' || code === 'Numpad4') {
        selectGalleryFrame(3);
        return true;
      }
      if (code === 'Digit5' || code === 'Numpad5') {
        selectGalleryFrame(4);
        return true;
      }
      if (code === 'ArrowRight' || code === 'KeyD') {
        selectGalleryFrame(currentGalleryIndex + 1);
        return true;
      }
      if (code === 'ArrowLeft' || code === 'KeyA') {
        selectGalleryFrame(currentGalleryIndex - 1);
        return true;
      }
      return false;
    },

    applyLookDelta: (yawDelta: number, pitchDelta: number) => {
      if (activeMode === 'none') return;
      lookYawOffset = THREE.MathUtils.clamp(lookYawOffset - yawDelta, -0.75, 0.75);
      lookPitchOffset = THREE.MathUtils.clamp(lookPitchOffset - pitchDelta, -0.42, 0.45);
    },

    exitActiveCameraMode,

    getCameraState: () => camState,

    setGalleryFrameImage: (frameIndex: number, imageSrc: string) => {
      applySavedGalleryImage(frameIndex, imageSrc, true);
    },

    getGalleryFrames: () =>
      galleryMemories.map((m, idx) => ({
        index: idx,
        title: m.title,
        sub: m.subtitle,
        hasCustomImage: Boolean(m.customImageUrl),
        customImageSrc: m.customImageUrl ?? undefined,
      })),

    isPlayerOnIceRink,

    triggerSkatingJump: () => {
      skatingJumpSpinBoost = 1.0;
      playChime(783.99, 1174.66);
    },

    update: (
      delta: number,
      elapsedTime: number,
      playerPos: THREE.Vector3,
      inputKeys?: Set<string>,
    ) => {
      const distToCastle = Math.hypot(playerPos.x - originX, playerPos.z - originZ);
      if (distToCastle > 60.0) return;

      if (gallerySwitchCooldown > 0) {
        gallerySwitchCooldown = Math.max(0, gallerySwitchCooldown - delta);
      }
      if (skatingJumpSpinBoost > 0) {
        skatingJumpSpinBoost = Math.max(0, skatingJumpSpinBoost - delta * 1.4);
      }
      if (puppyPlayCelebrationTimer > 0) {
        puppyPlayCelebrationTimer = Math.max(0, puppyPlayCelebrationTimer - delta);
      }
      if (salonGroomCelebrationTimer > 0) {
        salonGroomCelebrationTimer = Math.max(0, salonGroomCelebrationTimer - delta);
      }

      // 1. Animate Heart Gallery Floating Crystal Heart & Orbiting Light Motes
      floatingCrystalHeartPivot.position.y =
        y0 + 2.05 + Math.sin(elapsedTime * 1.8) * 0.12;
      floatingCrystalHeartPivot.rotation.y = elapsedTime * 0.65;
      floatingHeartHalo.rotation.x = Math.sin(elapsedTime * 1.2) * 0.35;
      floatingHeartHalo.rotation.z = elapsedTime * 0.45;

      for (let m = 0; m < HEART_MOTE_COUNT; m++) {
        const ang = elapsedTime * 0.75 + (m / HEART_MOTE_COUNT) * Math.PI * 2;
        const r = 1.15 + Math.sin(elapsedTime * 1.5 + m) * 0.32;
        const my = y0 + 1.45 + ((elapsedTime * 0.45 + m * 0.19) % 1.65);
        _dummy.position.set(
          courtCenterX + Math.cos(ang) * r,
          my,
          courtCenterZ + Math.sin(ang) * r,
        );
        _dummy.rotation.set(elapsedTime + m, elapsedTime * 0.8, 0);
        const s = 0.65 + Math.sin(elapsedTime * 3.0 + m) * 0.35;
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        heartMoteInstanced.setMatrixAt(m, _dummy.matrix);
      }
      heartMoteInstanced.instanceMatrix.needsUpdate = true;

      // 2. Animate Ice Skating Palace Crystal Heart Fountain & Ascending Ice Droplets
      const rinkActiveBoost = isSkatingExplicitlyActive || isPlayerOnIceRink(playerPos) ? 1.35 : 1.0;
      iceFountainHeartPivot.position.y = 1.75 + Math.sin(elapsedTime * 2.1) * 0.08;
      iceFountainHeartPivot.rotation.y =
        elapsedTime * (0.55 + skatingJumpSpinBoost * 2.5);

      for (let d = 0; d < ICE_DROPLET_COUNT; d++) {
        const cycle = (elapsedTime * 0.62 * rinkActiveBoost + d * 0.17) % 1.0;
        const arcR = 0.25 + cycle * 1.05;
        const ang = (d / ICE_DROPLET_COUNT) * Math.PI * 2 + elapsedTime * 0.4;
        const dy = y0 + 0.55 + Math.sin(cycle * Math.PI) * 1.45;
        _dummy.position.set(
          fountainX + Math.cos(ang) * arcR,
          dy,
          fountainZ + Math.sin(ang) * arcR,
        );
        _dummy.rotation.set(elapsedTime * 1.5, ang, 0);
        _dummy.scale.setScalar(0.6 + (1.0 - cycle) * 0.55);
        _dummy.updateMatrix();
        iceDropletInstanced.setMatrixAt(d, _dummy.matrix);
      }
      iceDropletInstanced.instanceMatrix.needsUpdate = true;

      // 3. Animate Puppy Play Area Interactive Balls & 4 Puppy NPCs (REST -> WANDER -> PLAY -> FOLLOW_PLAYER)
      const playerLx = playerPos.x - originX;
      const playerLz = playerPos.z - originZ;
      const isPlayerInPuppyGarden =
        isOnFloor3(playerPos) &&
        playerLx >= -3.8 &&
        playerLx <= 4.8 &&
        playerLz >= -15.0 &&
        playerLz <= -4.2;

      // Update rolling play balls
      for (let b = 0; b < playBalls.length; b++) {
        const ball = playBalls[b];
        if (Math.abs(ball.vx) > 0.01 || Math.abs(ball.vz) > 0.01) {
          ball.lx += ball.vx * delta;
          ball.lz += ball.vz * delta;
          ball.vx *= Math.exp(-2.4 * delta);
          ball.vz *= Math.exp(-2.4 * delta);

          if (ball.lx < -2.6 || ball.lx > 3.5) {
            ball.vx = -ball.vx * 0.75;
            ball.lx = THREE.MathUtils.clamp(ball.lx, -2.6, 3.5);
          }
          if (ball.lz < -13.4 || ball.lz > -5.4) {
            ball.vz = -ball.vz * 0.75;
            ball.lz = THREE.MathUtils.clamp(ball.lz, -13.4, -5.4);
          }
          ball.mesh.position.set(
            ball.lx,
            y0 + 0.17 + Math.abs(Math.sin(elapsedTime * 8.0 + b)) * 0.08 * Math.hypot(ball.vx, ball.vz),
            ball.lz,
          );
          ball.mesh.rotation.x += ball.vz * delta * 4.0;
          ball.mesh.rotation.z -= ball.vx * delta * 4.0;
        }
      }

      // Update 4 Puppy NPCs
      for (let p = 0; p < puppies.length; p++) {
        const pup = puppies[p];
        pup.stateTimer -= delta;
        if (pup.barkSparkleBoost > 0) {
          pup.barkSparkleBoost = Math.max(0, pup.barkSparkleBoost - delta * 0.6);
        }

        if (pup.stateTimer <= 0) {
          if (isPlayerInPuppyGarden && (pup.personality === 'energetic' || pup.personality === 'curious')) {
            pup.state = 'FOLLOW_PLAYER';
            pup.stateTimer = 4.5 + p * 0.8;
          } else if (pup.state === 'REST') {
            pup.state = 'WANDER';
            pup.stateTimer = 4.0 + p * 0.9;
            pup.targetLx = playCenterX + Math.sin(elapsedTime * 1.3 + p * 2.1) * 2.2;
            pup.targetLz = playCenterZ + Math.cos(elapsedTime * 1.1 + p * 1.7) * 2.6;
          } else if (pup.state === 'WANDER') {
            pup.state = 'PLAY';
            pup.stateTimer = 4.2 + p * 0.7;
            const targetBall = playBalls[p % playBalls.length];
            pup.targetLx = targetBall.lx;
            pup.targetLz = targetBall.lz;
          } else {
            pup.state = pup.personality === 'sleepy' ? 'REST' : 'WANDER';
            pup.stateTimer = 3.8 + p;
            pup.targetLx = pup.homeLx;
            pup.targetLz = pup.homeLz;
          }
        }

        if (pup.state === 'FOLLOW_PLAYER' && isPlayerInPuppyGarden) {
          const offsetAng = (p / puppies.length) * Math.PI * 2 + elapsedTime * 0.35;
          pup.targetLx = THREE.MathUtils.clamp(playerLx + Math.cos(offsetAng) * 1.35, -2.6, 3.4);
          pup.targetLz = THREE.MathUtils.clamp(playerLz + Math.sin(offsetAng) * 1.35, -13.6, -5.2);
        }

        _scratchDir.set(pup.targetLx - pup.lx, pup.targetLz - pup.lz);
        const distToTarget = _scratchDir.length();
        const isMoving = pup.state !== 'REST' && distToTarget > 0.14;

        if (isMoving) {
          _scratchDir.divideScalar(distToTarget);
          const stepSpeed =
            pup.speed * (pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0 ? 1.35 : 1.0);
          pup.lx = THREE.MathUtils.clamp(pup.lx + _scratchDir.x * stepSpeed * delta, -2.8, 3.5);
          pup.lz = THREE.MathUtils.clamp(pup.lz + _scratchDir.y * stepSpeed * delta, -13.8, -5.0);

          const desiredYaw = Math.atan2(_scratchDir.x, _scratchDir.y);
          let yawDiff = desiredYaw - pup.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          pup.yaw += yawDiff * Math.min(1, delta * 8.0);
        } else if (isPlayerInPuppyGarden) {
          // Turn head gently toward player when nearby
          const toPlayerYaw = Math.atan2(playerLx - pup.lx, playerLz - pup.lz);
          let hDiff = toPlayerYaw - pup.yaw;
          while (hDiff > Math.PI) hDiff -= Math.PI * 2;
          while (hDiff < -Math.PI) hDiff += Math.PI * 2;
          pup.headPivot.rotation.y = THREE.MathUtils.clamp(hDiff * 0.55, -0.55, 0.55);
        }

        const wagSpeed = pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0 ? 14.0 : 7.5;
        pup.tailPivot.rotation.z = Math.sin(elapsedTime * wagSpeed + p) * 0.45;

        if (isMoving || pup.state === 'PLAY') {
          const trot = elapsedTime * 11.0 + p * 1.5;
          const legSwing = Math.sin(trot) * 0.48;
          pup.legFL.rotation.x = legSwing;
          pup.legBR.rotation.x = legSwing;
          pup.legFR.rotation.x = -legSwing;
          pup.legBL.rotation.x = -legSwing;
          const hopY =
            pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0
              ? Math.abs(Math.sin(trot * 0.85)) * 0.09
              : 0;
          pup.root.position.set(pup.lx, y0 + hopY, pup.lz);
          pup.headPivot.rotation.x = Math.sin(trot * 0.5) * 0.12;
        } else {
          // Resting / sitting pose
          pup.legFL.rotation.x = 0;
          pup.legFR.rotation.x = 0;
          pup.legBL.rotation.x = -0.35;
          pup.legBR.rotation.x = -0.35;
          pup.root.position.set(pup.lx, y0 - 0.03, pup.lz);
          pup.headPivot.rotation.x = Math.sin(elapsedTime * 1.8 + p) * 0.06;
        }
        pup.root.rotation.y = pup.yaw;
      }

      // 4. Animate Pet Salon Puppy "Lulu" & Floating Iridescent Bath Bubbles
      const salonSpinRate = salonGroomCelebrationTimer > 0 ? 2.8 : 0.45;
      salonPuppyModel.root.rotation.y = Math.sin(elapsedTime * salonSpinRate) * 0.65;
      salonPuppyModel.tailPivot.rotation.z = Math.sin(elapsedTime * 10.5) * 0.42;
      salonPuppyModel.headPivot.rotation.z = Math.sin(elapsedTime * 2.4) * 0.12;

      const bubbleBoost = salonGroomCelebrationTimer > 0 ? 1.6 : 1.0;
      for (let b = 0; b < SALON_BUBBLE_COUNT; b++) {
        const bCycle = (elapsedTime * 0.38 * bubbleBoost + b * 0.19) % 1.0;
        const isGroomSparkle = salonGroomCelebrationTimer > 0 && b % 2 === 0;
        const baseX = isGroomSparkle ? groomX : -13.95;
        const baseZ = isGroomSparkle ? groomZ : 12.8;
        const baseY = isGroomSparkle ? y0 + 0.95 : y0 + 0.58;
        const bAng = b * 1.3 + elapsedTime * 0.8;
        const bRad = (isGroomSparkle ? 0.55 : 0.46) * (0.4 + bCycle * 0.7);
        _dummy.position.set(
          baseX + Math.cos(bAng) * bRad,
          baseY + bCycle * 1.25,
          baseZ + Math.sin(bAng) * bRad,
        );
        _dummy.scale.setScalar((1.0 - bCycle * 0.65) * (isGroomSparkle ? 1.15 : 0.9));
        _dummy.updateMatrix();
        salonBubbleInstanced.setMatrixAt(b, _dummy.matrix);
      }
      salonBubbleInstanced.instanceMatrix.needsUpdate = true;

      // 5. Update Heart Gallery Inspection Camera if active
      if (activeMode === 'heart_gallery') {
        if (inputKeys && gallerySwitchCooldown <= 0) {
          if (inputKeys.has('KeyD') || inputKeys.has('ArrowRight')) {
            selectGalleryFrame(currentGalleryIndex + 1);
            gallerySwitchCooldown = 0.28;
          } else if (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft')) {
            selectGalleryFrame(currentGalleryIndex - 1);
            gallerySwitchCooldown = 0.28;
          }
        }

        camState.blendAlpha = Math.min(1.0, camState.blendAlpha + delta * 2.6);
        const ex = exhibitPlacements[currentGalleryIndex];
        const normalX = Math.sin(ex.rotY);
        const normalZ = Math.cos(ex.rotY);
        const camWx = originX + ex.lx + normalX * ex.camDist;
        const camWz = originZ + ex.lz + normalZ * ex.camDist;
        const lookWx = originX + ex.lx;
        const lookWz = originZ + ex.lz;

        camState.camWorldPos.set(camWx, floor3WorldY + 1.85, camWz);
        camState.lookWorldPos.set(
          lookWx + Math.sin(lookYawOffset) * 1.1,
          floor3WorldY + 1.92 + Math.sin(lookPitchOffset) * 0.8,
          lookWz + Math.cos(lookYawOffset) * 0.35,
        );
      }
    },
  };
}
