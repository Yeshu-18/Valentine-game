import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  AvatarActivityPose,
  OUTFIT_PALETTE_PRESETS,
} from '../PlayerCharacter';
import { DreamCastleMaterials } from './CastleMaterials';

export type Floor2ActiveCameraMode =
  | 'none'
  | 'wardrobe_styling'
  | 'pop_stage'
  | 'dance_studio'
  | 'beauty_vanity';

export interface Floor2CameraState {
  active: boolean;
  mode: Floor2ActiveCameraMode;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  isSitting: boolean;
  seatWorldPos?: THREE.Vector3;
  seatYaw?: number;
}

export interface Floor2AvatarCallbacks {
  setOutfitPalette: (presetIndex: number) => string;
  cycleHairColor: () => string;
  toggleTiara: () => boolean;
  setActivityPose: (pose: AvatarActivityPose) => void;
  getAppearanceSummary: () => {
    outfitName: string;
    hairName: string;
    tiaraVisible: boolean;
  };
}

export interface DanceSongDef {
  title: string;
  genre: string;
  beatInterval: number;
  vibeColor: string;
  ringColor: string;
  leadNotes: number[];
  bassNotes: number[];
}

export const DANCE_SONGS: readonly DanceSongDef[] = [
  {
    title: 'Barbie Dream Pop',
    genre: 'Sparkle Dance Synth',
    beatInterval: 0.32,
    vibeColor: '#f472b6',
    ringColor: '#ec4899',
    leadNotes: [523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 1046.5, 880.0],
    bassNotes: [130.81, 164.81, 196.0, 164.81],
  },
  {
    title: 'Starlight Ballroom Waltz',
    genre: 'Romantic 3/4 Classical',
    beatInterval: 0.44,
    vibeColor: '#c084fc',
    ringColor: '#a855f7',
    leadNotes: [392.0, 493.88, 587.33, 783.99, 659.25, 587.33],
    bassNotes: [98.0, 146.83, 196.0],
  },
  {
    title: 'Pastel Sunset R&B',
    genre: 'Smooth Romantic Groove',
    beatInterval: 0.38,
    vibeColor: '#fb7185',
    ringColor: '#f43f5e',
    leadNotes: [329.63, 392.0, 440.0, 493.88, 587.33, 440.0],
    bassNotes: [82.41, 110.0, 146.83, 110.0],
  },
  {
    title: 'Bubblegum Heart Electro',
    genre: 'High Energy Synthpop',
    beatInterval: 0.26,
    vibeColor: '#38bdf8',
    ringColor: '#0ea5e9',
    leadNotes: [440.0, 523.25, 659.25, 698.46, 783.99, 880.0, 1046.5, 783.99],
    bassNotes: [110.0, 87.31, 130.81, 98.0],
  },
  {
    title: "Mandu's Love Serenade",
    genre: 'Gentle Acoustic Romance',
    beatInterval: 0.48,
    vibeColor: '#fde047',
    ringColor: '#eab308',
    leadNotes: [587.33, 739.99, 880.0, 987.77, 1174.66, 880.0],
    bassNotes: [146.83, 110.0, 98.0, 110.0],
  },
];

export const MANUAL_DANCE_MOVES: Record<
  string,
  { key: string; name: string; pose: AvatarActivityPose; freq: number }
> = {
  KeyW: { key: 'W', name: 'High Reach & Graceful Leap ✦', pose: 'manual_dance_w', freq: 783.99 },
  KeyA: { key: 'A', name: 'Left Hip Sway & Ribbon Sweep ♡', pose: 'manual_dance_a', freq: 659.25 },
  KeyS: { key: 'S', name: 'Low Curtsy & Floor Dip ♕', pose: 'manual_dance_s', freq: 523.25 },
  KeyD: { key: 'D', name: 'Right Hip Sway & Ribbon Sweep ♡', pose: 'manual_dance_d', freq: 659.25 },
  KeyF: { key: 'F', name: 'Front Heart Claps & Pop ♪', pose: 'manual_dance_f', freq: 880.0 },
  KeyG: { key: 'G', name: 'Golden Pirouette 360° Spin ✦', pose: 'manual_dance_g', freq: 987.77 },
  KeyH: { key: 'H', name: 'Heart Hands to Mandu 💕', pose: 'manual_dance_h', freq: 1046.5 },
  KeyJ: { key: 'J', name: 'Jeté Flying Kick & Leap ♕', pose: 'manual_dance_j', freq: 880.0 },
  KeyK: { key: 'K', name: 'K-Pop Shoulder Wave & Snap ♪', pose: 'manual_dance_k', freq: 739.99 },
  KeyL: { key: 'L', name: 'Love Bow & Royal Curtsy ♡', pose: 'manual_dance_l', freq: 587.33 },
};

export interface CastleFloor2RoomsBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  partitionMeshes: THREE.Mesh[];
  setAvatarCallbacks: (callbacks: Floor2AvatarCallbacks) => void;
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  getActiveRoomCaption: () => string | null;
  interact: (playerPos: THREE.Vector3) => boolean;
  handleKeyAction: (code: string) => boolean;
  applyOrbitYawDelta: (deltaYaw: number) => void;
  applyLookDelta: (deltaYaw: number, deltaPitch: number) => void;
  exitActiveCameraMode: (playerPos?: THREE.Vector3) => void;
  getCameraState: () => Floor2CameraState;
  getStagePulseIntensity: () => number;
  getDanceStudioState: () => {
    active: boolean;
    activeSongIndex: number;
    songTitle: string;
    genre: string;
    activeDanceName: string;
    songs: readonly { title: string; genre: string }[];
  };
  selectDanceSong: (songIndex: number) => void;
  performManualDance: (key: string) => void;
  performPredefinedDance: (stepIndex: number) => void;
  update: (
    delta: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
    inputKeys?: Set<string>,
  ) => void;
}

// Pre-allocated module-scope scratch objects (Zero Per-Frame Allocations)
const _scratchLocal = new THREE.Vector3();
const _scratchLightPos = new THREE.Vector3();
const _scratchLightColor = new THREE.Color();
const _scratchCamWorldPos = new THREE.Vector3();
const _scratchLookWorldPos = new THREE.Vector3();
const _scratchSeatWorldPos = new THREE.Vector3();

function smoothStep01(x: number): number {
  const c = THREE.MathUtils.clamp(x, 0, 1);
  return c * c * (3.0 - 2.0 * c);
}

function lockStaticHierarchy(
  root: THREE.Object3D,
  dynamicSet: Set<THREE.Object3D>,
) {
  root.traverse((obj) => {
    if (dynamicSet.has(obj)) return;
    let p: THREE.Object3D | null = obj.parent;
    while (p) {
      if (dynamicSet.has(p)) return;
      p = p.parent;
    }
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
  });
}

function createWardrobeMuralTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 384);
    grad.addColorStop(0, '#fff1f2');
    grad.addColorStop(0.5, '#fce7f3');
    grad.addColorStop(1, '#fbcfe8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 384);

    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 484, 356);
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, 460, 332);

    ctx.fillStyle = '#db2777';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('♕ ROYAL COUTURE ATELIER ♕', 256, 110);

    ctx.fillStyle = '#9d174d';
    ctx.font = 'italic 24px Georgia, serif';
    ctx.fillText('Bespoke Gowns & Starlight Tiaras for Harsha', 256, 175);

    ctx.fillStyle = '#d8b467';
    ctx.font = '54px Georgia, serif';
    ctx.fillText('✦   ♡   ♕   ♡   ✦', 256, 265);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createDanceFloorMedallionTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = 256;
    const cy = 256;
    const bg = ctx.createRadialGradient(cx, cy, 16, cx, cy, 248);
    bg.addColorStop(0, '#fffdf9');
    bg.addColorStop(0.45, '#fce7f3');
    bg.addColorStop(0.8, '#fbcfe8');
    bg.addColorStop(1, '#d8b467');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);

    const rings = [238, 212, 165, 108, 56];
    rings.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = idx % 2 === 0 ? '#d8b467' : '#f472b6';
      ctx.lineWidth = idx === 0 ? 8 : 4;
      ctx.stroke();
    });

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.lineTo(18, -162);
      ctx.lineTo(0, -210);
      ctx.lineTo(-18, -162);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(244, 114, 182, 0.45)' : 'rgba(216, 180, 103, 0.45)';
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#db2777';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♡', cx, cy);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createCastleFloor2Rooms(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
): CastleFloor2RoomsBundle {
  const group = new THREE.Group();
  group.name = 'CastleFloor2Rooms';

  const colliders: CircleCollider[] = [];
  const partitionMeshes: THREE.Mesh[] = [];
  const dynamicObjects = new Set<THREE.Object3D>();

  const y0 = 5.25; // Floor 2 Mezzanine walkable top surface

  let avatarCallbacks: Floor2AvatarCallbacks | null = null;

  const addLocalCollider = (lx: number, lz: number, radius: number) => {
    colliders.push({
      x: originX + lx,
      z: originZ + lz,
      radius,
      y: baseY + y0,
      height: 3.5,
    });
  };

  // ============================================================================
  // SHARED DYNAMIC FLOOR 2 ROOM POINT LIGHT (1 Light Budget for Entire Floor 2)
  // ============================================================================
  const floor2RoomLight = new THREE.PointLight('#ffd1dc', 0.0, 14.5, 1.5);
  floor2RoomLight.position.set(-11.9, y0 + 3.1, -10.8);
  group.add(floor2RoomLight);
  dynamicObjects.add(floor2RoomLight);

  // ============================================================================
  // FLOOR 2 INTERIOR PARTITION WALLS & ROYAL ARCHWAYS (West Wing at lz = ±6.0)
  // Carefully avoids F1->F2 West Top Landing (lx in [-8.6, -5.2], lz in [6.0, 8.4])
  // ============================================================================
  const partitionWallGeoSegA = tracker.trackGeo(new THREE.BoxGeometry(2.6, 4.4, 0.42));
  partitionWallGeoSegA.translate(0, 2.2, 0);
  const partitionWallGeoSegB = tracker.trackGeo(new THREE.BoxGeometry(1.4, 4.4, 0.42));
  partitionWallGeoSegB.translate(0, 2.2, 0);
  const partitionHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 1.15, 0.44));
  partitionHeaderGeo.translate(0, 3.82, 0);
  const archGoldTrimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.2, 0.055, 8, 20, Math.PI),
  );

  const buildWestWingPartitionAtZ = (zPos: number) => {
    const outerMat = tracker.trackMat(mats.blushRoseMarble.clone());
    const innerMat = tracker.trackMat(mats.blushRoseMarble.clone());
    const headerMat = tracker.trackMat(mats.creamStone.clone());

    // Outer segment: lx in [-15.4, -12.8] (center -14.1, width 2.6)
    const segOuter = new THREE.Mesh(partitionWallGeoSegA, outerMat);
    segOuter.position.set(-14.1, y0, zPos);
    segOuter.castShadow = true;
    segOuter.receiveShadow = true;

    // Inner segment: lx in [-10.6, -9.2] (center -9.9, width 1.4)
    const segInner = new THREE.Mesh(partitionWallGeoSegB, innerMat);
    segInner.position.set(-9.9, y0, zPos);
    segInner.castShadow = true;
    segInner.receiveShadow = true;

    // Archway header above doorway gap lx in [-12.8, -10.6] (center -11.7, width 2.2)
    const header = new THREE.Mesh(partitionHeaderGeo, headerMat);
    header.position.set(-11.7, y0, zPos);

    const archTrim = new THREE.Mesh(archGoldTrimGeo, mats.champagneGold);
    archTrim.position.set(-11.7, y0 + 2.8, zPos);

    group.add(segOuter, segInner, header, archTrim);
    partitionMeshes.push(segOuter, segInner, header);
    dynamicObjects.add(segOuter);
    dynamicObjects.add(segInner);
    dynamicObjects.add(header);
  };

  buildWestWingPartitionAtZ(-6.0);
  buildWestWingPartitionAtZ(6.0);

  // ============================================================================
  // 1. ROYAL WALK-IN WARDROBE (SW Mezzanine Wing: lx in [-15.0, -8.8], lz in [-14.8, -6.2])
  // ============================================================================
  const wardrobeGroup = new THREE.Group();
  wardrobeGroup.name = 'RoyalWardrobeRoom';
  group.add(wardrobeGroup);

  // Plush circular carpet beneath the Wardrobe Podium
  const wardrobeRugGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.75, 2.75, 0.025, 32));
  wardrobeRugGeo.translate(0, 0.012, 0);
  const wardrobeRug = new THREE.Mesh(wardrobeRugGeo, mats.velvetPlum);
  wardrobeRug.position.set(-11.9, y0, -10.8);
  wardrobeRug.receiveShadow = true;
  wardrobeGroup.add(wardrobeRug);

  // Rotating Velvet Styling Podium (center lx = -11.9, lz = -10.8)
  const podiumBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.38, 1.48, 0.14, 28));
  podiumBaseGeo.translate(0, 0.07, 0);
  const podiumBase = new THREE.Mesh(podiumBaseGeo, mats.creamStone);
  podiumBase.position.set(-11.9, y0, -10.8);
  podiumBase.receiveShadow = true;
  wardrobeGroup.add(podiumBase);

  const podiumTurntableGroup = new THREE.Group();
  podiumTurntableGroup.position.set(-11.9, y0 + 0.14, -10.8);
  wardrobeGroup.add(podiumTurntableGroup);
  dynamicObjects.add(podiumTurntableGroup);

  const turntableTopGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.24, 1.28, 0.05, 28));
  turntableTopGeo.translate(0, 0.025, 0);
  const turntableTop = new THREE.Mesh(turntableTopGeo, mats.blushRoseMarble);
  podiumTurntableGroup.add(turntableTop);

  const podiumRimGeo = tracker.trackGeo(new THREE.TorusGeometry(1.28, 0.035, 10, 32));
  podiumRimGeo.rotateX(Math.PI / 2);
  const podiumRim = new THREE.Mesh(podiumRimGeo, mats.champagneGold);
  podiumRim.position.y = 0.03;
  podiumTurntableGroup.add(podiumRim);

  const podiumGlowRingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#f472b6',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    }),
  );
  const podiumGlowRingGeo = tracker.trackGeo(new THREE.RingGeometry(1.02, 1.2, 32));
  podiumGlowRingGeo.rotateX(-Math.PI / 2);
  const podiumGlowRing = new THREE.Mesh(podiumGlowRingGeo, podiumGlowRingMat);
  podiumGlowRing.position.y = 0.055;
  podiumTurntableGroup.add(podiumGlowRing);

  // Tri-Fold Full-Length Golden Vanity Mirror at SW Corner (-13.85, -10.8)
  const mirrorFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 2.75, 1.25));
  mirrorFrameGeo.translate(0, 1.375, 0);
  const mirrorGlassGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.08, 2.48));
  mirrorGlassGeo.rotateY(Math.PI / 2);
  mirrorGlassGeo.translate(0.08, 1.38, 0);

  const mirrorPanels = [
    { x: -14.25, z: -10.8, rotY: 0 },
    { x: -13.95, z: -11.95, rotY: -0.42 },
    { x: -13.95, z: -9.65, rotY: 0.42 },
  ];
  mirrorPanels.forEach((mp) => {
    const mGroup = new THREE.Group();
    mGroup.position.set(mp.x, y0, mp.z);
    mGroup.rotation.y = mp.rotY;
    const frame = new THREE.Mesh(mirrorFrameGeo, mats.champagneGold);
    const glass = new THREE.Mesh(mirrorGlassGeo, mats.crystalGlass);
    mGroup.add(frame, glass);
    wardrobeGroup.add(mGroup);
  });

  // 5 Couture Gown Mannequins around the Wardrobe Boutique
  const mannequinPedestalGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.36, 0.42, 0.22, 16));
  mannequinPedestalGeo.translate(0, 0.11, 0);
  const mannequinPoleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 10));
  mannequinPoleGeo.translate(0, 0.78, 0);
  const mannequinSkirtGeo = tracker.trackGeo(new THREE.ConeGeometry(0.42, 0.72, 16));
  mannequinSkirtGeo.translate(0, 0.76, 0);
  const mannequinBodiceGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.14, 0.42, 14));
  mannequinBodiceGeo.translate(0, 1.28, 0);
  const mannequinBeltGeo = tracker.trackGeo(new THREE.TorusGeometry(0.16, 0.025, 8, 18));
  mannequinBeltGeo.rotateX(Math.PI / 2);
  mannequinBeltGeo.translate(0, 1.1, 0);

  const mannequinSpots = [
    { x: -14.1, z: -13.5, rotY: Math.PI * 0.35 },
    { x: -12.6, z: -14.15, rotY: 0 },
    { x: -11.0, z: -14.15, rotY: 0 },
    { x: -9.5, z: -13.5, rotY: -Math.PI * 0.35 },
    { x: -14.1, z: -8.1, rotY: Math.PI * 0.65 },
  ];

  const mannequinHighlightRings: THREE.Mesh[] = [];
  OUTFIT_PALETTE_PRESETS.forEach((preset, idx) => {
    const spot = mannequinSpots[idx];
    const mRoot = new THREE.Group();
    mRoot.position.set(spot.x, y0, spot.z);
    mRoot.rotation.y = spot.rotY;

    const dressM = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: preset.dressHex,
        roughness: 0.32,
        metalness: 0.06,
        clearcoat: 0.4,
      }),
    );
    const beltM = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: preset.beltHex,
        roughness: 0.22,
        metalness: 0.8,
      }),
    );

    const ped = new THREE.Mesh(mannequinPedestalGeo, mats.creamStone);
    const pole = new THREE.Mesh(mannequinPoleGeo, mats.champagneGold);
    const skirt = new THREE.Mesh(mannequinSkirtGeo, dressM);
    const bodice = new THREE.Mesh(mannequinBodiceGeo, dressM);
    const belt = new THREE.Mesh(mannequinBeltGeo, beltM);
    skirt.castShadow = true;
    bodice.castShadow = true;

    const ringGeo = tracker.trackGeo(new THREE.RingGeometry(0.38, 0.48, 20));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: preset.dressHex,
        transparent: true,
        opacity: idx === 0 ? 0.9 : 0.25,
        side: THREE.DoubleSide,
      }),
    );
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    mannequinHighlightRings.push(ring);
    dynamicObjects.add(ring);

    mRoot.add(ped, pole, skirt, bodice, belt, ring);
    wardrobeGroup.add(mRoot);
    addLocalCollider(spot.x, spot.z, 0.46);
  });

  // Wardrobe Wall Mural on South Interior Wall (lx = -11.8, lz = -15.25)
  const wardrobeMuralTex = createWardrobeMuralTexture(tracker);
  const wardrobeMuralMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({ map: wardrobeMuralTex }),
  );
  const wardrobeMuralGeo = tracker.trackGeo(new THREE.PlaneGeometry(3.4, 2.2));
  const wardrobeMural = new THREE.Mesh(wardrobeMuralGeo, wardrobeMuralMat);
  wardrobeMural.position.set(-11.8, y0 + 2.5, -15.28);
  wardrobeGroup.add(wardrobeMural);

  // Sparkling Podium Orbs (animated when changing outfits)
  const wardrobeSparkleGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.075, 0));
  const wardrobeSparkleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0.0,
    }),
  );
  const wardrobeSparkles: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Mesh(wardrobeSparkleGeo, wardrobeSparkleMat);
    sp.visible = false;
    wardrobeGroup.add(sp);
    wardrobeSparkles.push(sp);
    dynamicObjects.add(sp);
  }

  // ============================================================================
  // 2. POP STAR CONCERT STAGE (South Mezzanine Overlook: lx in [-5.2, +5.2], lz in [-14.8, -7.2])
  // ============================================================================
  const popStageGroup = new THREE.Group();
  popStageGroup.name = 'PopStarConcertStage';
  group.add(popStageGroup);

  // Elevated Stage Deck (lx = 0.0, lz = -11.6, top at y0 + 0.26 = 5.51m)
  const stageDeckGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.35, 3.55, 0.26, 36));
  stageDeckGeo.translate(0, 0.13, 0);
  const stageDeck = new THREE.Mesh(stageDeckGeo, mats.blushRoseMarble);
  stageDeck.position.set(0.0, y0, -11.6);
  stageDeck.receiveShadow = true;
  popStageGroup.add(stageDeck);

  const stageGoldRimGeo = tracker.trackGeo(new THREE.TorusGeometry(3.42, 0.048, 10, 42));
  stageGoldRimGeo.rotateX(Math.PI / 2);
  const stageGoldRim = new THREE.Mesh(stageGoldRimGeo, mats.champagneGold);
  stageGoldRim.position.set(0.0, y0 + 0.25, -11.6);
  popStageGroup.add(stageGoldRim);

  // Glowing Neon Heart Stage Arch Backdrop at lz = -14.1
  const stageArchGeo = tracker.trackGeo(
    new THREE.TorusGeometry(2.65, 0.09, 12, 36, Math.PI),
  );
  const stageArchMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f472b6',
      emissive: '#ec4899',
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.3,
    }),
  );
  const stageArchOuter = new THREE.Mesh(stageArchGeo, stageArchMat);
  stageArchOuter.position.set(0.0, y0 + 0.26, -13.95);
  popStageGroup.add(stageArchOuter);
  dynamicObjects.add(stageArchOuter);

  const stageArchInnerGeo = tracker.trackGeo(
    new THREE.TorusGeometry(2.05, 0.055, 10, 32, Math.PI),
  );
  const stageArchInner = new THREE.Mesh(stageArchInnerGeo, mats.champagneGold);
  stageArchInner.position.set(0.0, y0 + 0.26, -13.88);
  popStageGroup.add(stageArchInner);

  // Twin Concert Speaker Stacks at lx = ±3.65, lz = -13.2
  const speakerCabinetGeo = tracker.trackGeo(new THREE.BoxGeometry(0.95, 1.85, 0.72));
  speakerCabinetGeo.translate(0, 0.925, 0);
  const wooferRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.26, 0.035, 8, 20));
  wooferRingGeo.translate(0, 0, 0.37);

  [-3.65, 3.65].forEach((sx) => {
    const spkGroup = new THREE.Group();
    spkGroup.position.set(sx, y0, -13.2);
    spkGroup.rotation.y = sx < 0 ? 0.28 : -0.28;
    const cab = new THREE.Mesh(speakerCabinetGeo, mats.velvetPlum);
    const wBottom = new THREE.Mesh(wooferRingGeo, mats.champagneGold);
    wBottom.position.y = 0.56;
    const wTop = new THREE.Mesh(wooferRingGeo, mats.champagneGold);
    wTop.position.y = 1.32;
    spkGroup.add(cab, wBottom, wTop);
    popStageGroup.add(spkGroup);
    addLocalCollider(sx, -13.2, 0.62);
  });

  // Crystal Stand Microphone at center stage (lx = 0.0, lz = -11.2, y = y0 + 0.26)
  const micBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 16));
  micBaseGeo.translate(0, 0.03, 0);
  const micStandPoleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 1.28, 10));
  micStandPoleGeo.translate(0, 0.66, 0);
  const micCapsuleGeo = tracker.trackGeo(new THREE.SphereGeometry(0.065, 12, 12));
  micCapsuleGeo.translate(0, 1.34, 0.04);

  const micGroup = new THREE.Group();
  micGroup.position.set(0.0, y0 + 0.26, -11.0);
  const micBase = new THREE.Mesh(micBaseGeo, mats.champagneGold);
  const micPole = new THREE.Mesh(micStandPoleGeo, mats.champagneGold);
  const micCap = new THREE.Mesh(micCapsuleGeo, mats.warmLanternGlow);
  micGroup.add(micBase, micPole, micCap);
  popStageGroup.add(micGroup);

  // 4 Sweeping Concert Spotlight Beams (MeshBasicMaterial with AdditiveBlending, 0 Dynamic Lights)
  const spotlightConeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(1.35, 4.2, 16, 1, true),
  );
  spotlightConeGeo.translate(0, -2.1, 0);
  const spotlightBeamMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#f472b6',
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const stageSpotlights: THREE.Mesh[] = [];
  const spotXPositions = [-2.4, -0.85, 0.85, 2.4];
  spotXPositions.forEach((sx) => {
    const beam = new THREE.Mesh(spotlightConeGeo, spotlightBeamMat);
    beam.position.set(sx, y0 + 4.35, -11.6);
    popStageGroup.add(beam);
    stageSpotlights.push(beam);
    dynamicObjects.add(beam);
  });

  // Floating Musical Note / Star Particles above Pop Stage
  const stageNoteGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.09, 0));
  const stageNoteMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.0,
    }),
  );
  const stageNoteMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const nm = new THREE.Mesh(stageNoteGeo, stageNoteMat);
    nm.visible = false;
    popStageGroup.add(nm);
    stageNoteMeshes.push(nm);
    dynamicObjects.add(nm);
  }

  // ============================================================================
  // 3. ROYAL BALLET & DANCE STUDIO (West Mezzanine Gallery: lx in [-15.2, -9.0], lz in [-5.5, +5.5])
  // ============================================================================
  const danceStudioGroup = new THREE.Group();
  danceStudioGroup.name = 'RoyalDanceStudio';
  group.add(danceStudioGroup);

  // Circular Dance Medallion Floor at lx = -12.1, lz = 0.0
  const danceFloorTex = createDanceFloorMedallionTexture(tracker);
  const danceFloorMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: danceFloorTex,
      roughness: 0.18,
      metalness: 0.12,
    }),
  );
  const danceMedallionGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.55, 2.6, 0.03, 36));
  danceMedallionGeo.translate(0, 0.015, 0);
  const danceMedallion = new THREE.Mesh(danceMedallionGeo, danceFloorMat);
  danceMedallion.position.set(-12.1, y0, 0.0);
  danceMedallion.receiveShadow = true;
  danceStudioGroup.add(danceMedallion);

  const dancePulseRingGeo = tracker.trackGeo(new THREE.RingGeometry(2.15, 2.42, 36));
  dancePulseRingGeo.rotateX(-Math.PI / 2);
  const dancePulseRingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#ec4899',
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  const dancePulseRing = new THREE.Mesh(dancePulseRingGeo, dancePulseRingMat);
  dancePulseRing.position.set(-12.1, y0 + 0.036, 0.0);
  danceStudioGroup.add(dancePulseRing);
  dynamicObjects.add(dancePulseRing);

  // Full-Length Mirrored West Studio Wall & Golden Ballet Barre (lx = -15.1, lz in [-4.2, +4.2])
  const danceMirrorFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(0.12, 3.1, 8.2));
  danceMirrorFrameGeo.translate(0, 1.55, 0);
  const danceMirrorGlassGeo = tracker.trackGeo(new THREE.PlaneGeometry(7.9, 2.8));
  danceMirrorGlassGeo.rotateY(Math.PI / 2);
  danceMirrorGlassGeo.translate(0.07, 1.55, 0);

  const danceMirrorFrame = new THREE.Mesh(danceMirrorFrameGeo, mats.champagneGold);
  danceMirrorFrame.position.set(-15.22, y0, 0.0);
  const danceMirrorGlass = new THREE.Mesh(danceMirrorGlassGeo, mats.crystalGlass);
  danceMirrorGlass.position.set(-15.22, y0, 0.0);
  danceStudioGroup.add(danceMirrorFrame, danceMirrorGlass);

  // Brass Ballet Barre along the mirror
  const balletBarreGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 7.6, 12));
  balletBarreGeo.rotateX(Math.PI / 2);
  const balletBarre = new THREE.Mesh(balletBarreGeo, mats.champagneGold);
  balletBarre.position.set(-14.72, y0 + 1.02, 0.0);
  danceStudioGroup.add(balletBarre);

  const barreBracketGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8));
  barreBracketGeo.rotateZ(Math.PI / 2);
  [-3.4, -1.7, 0.0, 1.7, 3.4].forEach((bz) => {
    const brk = new THREE.Mesh(barreBracketGeo, mats.champagneGold);
    brk.position.set(-14.96, y0 + 1.02, bz);
    danceStudioGroup.add(brk);
  });

  // Crystal Rhythm Pedestal at (-14.2, +4.5)
  const rhythmPedGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.38, 1.05, 16));
  rhythmPedGeo.translate(0, 0.525, 0);
  const rhythmOrbGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.22, 1));
  const rhythmPed = new THREE.Mesh(rhythmPedGeo, mats.creamStone);
  rhythmPed.position.set(-14.2, y0, 4.5);
  const rhythmOrb = new THREE.Mesh(rhythmOrbGeo, mats.warmLanternGlow);
  rhythmOrb.position.set(-14.2, y0 + 1.28, 4.5);
  danceStudioGroup.add(rhythmPed, rhythmOrb);
  dynamicObjects.add(rhythmOrb);
  addLocalCollider(-14.2, 4.5, 0.45);

  // ============================================================================
  // 4. GLAMOUR MAKEUP & BEAUTY VANITY STUDIO (NW Mezzanine Wing: lx in [-15.0, -9.0], lz in [+6.2, +14.8])
  // Carefully keeps F1->F2 West Top Landing (lx in [-8.6, -5.2], lz in [6.0, 8.4]) 100% clear!
  // ============================================================================
  const beautyStudioGroup = new THREE.Group();
  beautyStudioGroup.name = 'GlamourBeautyStudio';
  group.add(beautyStudioGroup);

  // Plush Lavender-Blush Salon Rug at (-12.2, +11.8)
  const beautyRugGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.35, 2.35, 0.024, 32));
  beautyRugGeo.translate(0, 0.012, 0);
  const beautyRug = new THREE.Mesh(beautyRugGeo, mats.softLavender);
  beautyRug.position.set(-12.2, y0, 11.8);
  beautyRug.receiveShadow = true;
  beautyStudioGroup.add(beautyRug);

  // Hollywood Heart Vanity Table at (-12.2, +12.85)
  const vanityDeskGeo = tracker.trackGeo(new THREE.BoxGeometry(2.2, 0.78, 0.76));
  vanityDeskGeo.translate(0, 0.39, 0);
  const vanityDesk = new THREE.Mesh(vanityDeskGeo, mats.creamStone);
  vanityDesk.position.set(-12.2, y0, 12.85);
  vanityDesk.castShadow = true;
  vanityDesk.receiveShadow = true;
  beautyStudioGroup.add(vanityDesk);
  addLocalCollider(-12.2, 12.85, 0.78);

  const vanityTopGeo = tracker.trackGeo(new THREE.BoxGeometry(2.32, 0.06, 0.84));
  vanityTopGeo.translate(0, 0.81, 0);
  const vanityTop = new THREE.Mesh(vanityTopGeo, mats.blushRoseMarble);
  vanityTop.position.set(-12.2, y0, 12.85);
  beautyStudioGroup.add(vanityTop);

  // Arched Hollywood Bulb Mirror above Vanity Table
  const vanityMirrorRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.78, 0.06, 10, 28));
  const vanityMirrorRing = new THREE.Mesh(vanityMirrorRingGeo, mats.champagneGold);
  vanityMirrorRing.position.set(-12.2, y0 + 1.62, 13.15);
  const vanityMirrorDiscGeo = tracker.trackGeo(new THREE.CircleGeometry(0.74, 28));
  const vanityMirrorDisc = new THREE.Mesh(vanityMirrorDiscGeo, mats.crystalGlass);
  vanityMirrorDisc.position.set(-12.2, y0 + 1.62, 13.12);
  vanityMirrorDisc.rotation.y = Math.PI;
  beautyStudioGroup.add(vanityMirrorRing, vanityMirrorDisc);

  // 10 Glowing Hollywood Vanity Bulbs around the mirror ring
  const bulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.042, 8, 8));
  const vanityBulbMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fffbeb',
      emissive: '#fde047',
      emissiveIntensity: 1.1,
      roughness: 0.2,
    }),
  );
  dynamicObjects.add(vanityMirrorRing);
  for (let b = 0; b < 10; b++) {
    const ang = -Math.PI * 0.8 + (b / 9) * Math.PI * 1.6;
    const bulb = new THREE.Mesh(bulbGeo, vanityBulbMat);
    bulb.position.set(
      -12.2 + Math.sin(ang) * 0.8,
      y0 + 1.62 + Math.cos(ang) * 0.8,
      13.08,
    );
    beautyStudioGroup.add(bulb);
  }

  // Crystal Perfume Atomizer & Cosmetics Tray on Vanity Table
  const perfumeBottleGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.11, 1));
  perfumeBottleGeo.translate(0, 0.94, 0);
  const perfumeBottle = new THREE.Mesh(perfumeBottleGeo, mats.crystalGlass);
  perfumeBottle.position.set(-11.65, y0, 12.68);
  beautyStudioGroup.add(perfumeBottle);

  // Tufted Velvet Salon Styling Chair at (-12.2, +11.45) facing +Z toward the mirror
  const chairSeatGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.38, 0.34, 0.46, 18));
  chairSeatGeo.translate(0, 0.23, 0);
  const chairBackGeo = tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.56, 0.14));
  chairBackGeo.translate(0, 0.68, -0.28);
  const salonChairGroup = new THREE.Group();
  salonChairGroup.position.set(-12.2, y0, 11.45);
  const chairSeat = new THREE.Mesh(chairSeatGeo, mats.velvetPlum);
  const chairBack = new THREE.Mesh(chairBackGeo, mats.velvetPlum);
  salonChairGroup.add(chairSeat, chairBack);
  beautyStudioGroup.add(salonChairGroup);

  // Perfume Shimmer Mist Particles in Beauty Studio
  const mistParticleGeo = tracker.trackGeo(new THREE.SphereGeometry(0.055, 8, 8));
  const mistParticleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#fbcfe8',
      transparent: true,
      opacity: 0.0,
    }),
  );
  const mistParticles: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const mp = new THREE.Mesh(mistParticleGeo, mistParticleMat);
    mp.visible = false;
    beautyStudioGroup.add(mp);
    mistParticles.push(mp);
    dynamicObjects.add(mp);
  }

  // Lock static hierarchy so static furniture has zero per-frame matrix recomputation cost
  lockStaticHierarchy(group, dynamicObjects);

  // ============================================================================
  // PROCEDURAL WEB AUDIO SYNTHESIZER (Pop Stage Lead + Backing Beat + Studio Chimes)
  // ============================================================================
  let audioCtx: AudioContext | null = null;
  const ensureAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  };

  const playSynthTone = (
    freq: number,
    duration = 0.38,
    type: OscillatorType = 'triangle',
    gainPeak = 0.14,
  ) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.0, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration + 0.02);
    osc2.stop(now + duration + 0.02);
  };

  const playSparkleArpeggio = (baseFreq = 523.25) => {
    const ratios = [1.0, 1.25, 1.5, 2.0];
    ratios.forEach((r, idx) => {
      setTimeout(() => {
        playSynthTone(baseFreq * r, 0.28, 'sine', 0.1);
      }, idx * 55);
    });
  };

  // ============================================================================
  // INTERACTIVE STATE MACHINE FOR FLOOR 2 ACTIVITIES
  // ============================================================================
  let activeMode: Floor2ActiveCameraMode = 'none';
  let cameraBlendAlpha = 0.0;
  let wardrobeOrbitYaw = 0.0;
  let cameraLookYawOffset = 0.0;
  let cameraLookPitchOffset = 0.0;
  let wardrobeSparkleTimer = 0.0;
  let popBackingBeatPlaying = false;
  let popBeatAccum = 0.0;
  let popBeatStep = 0;
  let popStageNoteTimer = 0.0;
  let stagePulseIntensity = 0.0;
  let activeDanceStepIndex = 1;
  let activeDanceSongIndex = 0;
  let danceBeatStep = 0;
  let activeManualDanceName = 'Freestyle Ready';
  let danceBeatAccum = 0.0;
  let beautyMistTimer = 0.0;
  let statusCaptionText: string | null = null;
  let statusCaptionTimer = 0.0;

  const POP_LEAD_FREQS = [
    523.25, // [1] C5
    587.33, // [2] D5
    659.25, // [3] E5
    698.46, // [4] F5
    783.99, // [5] G5
    880.0, // [6] A5
    987.77, // [7] B5
    1046.5, // [8] C6
  ];

  const POP_BACKING_NOTES = [
    261.63, 329.63, 392.0, 523.25,
    220.0, 261.63, 329.63, 440.0,
    174.61, 220.0, 261.63, 349.23,
    196.0, 246.94, 293.66, 392.0,
  ];

  const DANCE_STEP_NAMES = [
    'Pirouette Spin ♕',
    'Ballet Arabesque ✦',
    'Starlight Pop Groove ♪',
    'Heart Ribbon Grand Jeté ♡',
    'Royal Swan Lake Waltz Glide ✧',
  ];

  const setTemporaryCaption = (text: string, duration = 4.2) => {
    statusCaptionText = text;
    statusCaptionTimer = duration;
  };

  const selectDanceSong = (songIdx: number) => {
    if (songIdx < 0 || songIdx >= DANCE_SONGS.length) return;
    activeDanceSongIndex = songIdx;
    danceBeatStep = 0;
    danceBeatAccum = 0.0;
    const song = DANCE_SONGS[songIdx];
    dancePulseRingMat.color.set(song.ringColor);
    playSparkleArpeggio(song.leadNotes[0]);
    setTemporaryCaption(`♪ Song: ${song.title} (${song.genre}) ♪`, 3.5);
  };

  const performManualDance = (keyUpperOrCode: string) => {
    const normKey = keyUpperOrCode.startsWith('Key')
      ? keyUpperOrCode
      : `Key${keyUpperOrCode.toUpperCase()}`;
    if (normKey in MANUAL_DANCE_MOVES) {
      const move = MANUAL_DANCE_MOVES[normKey];
      avatarCallbacks?.setActivityPose(move.pose);
      activeManualDanceName = move.name;
      playSynthTone(move.freq, 0.28, 'sawtooth', 0.11);
      setTemporaryCaption(`Dance Step: ${move.name} [${move.key}]`, 2.8);
      dancePulseRingMat.opacity = 1.0;
    }
  };

  const performPredefinedDance = (stepIdx: number) => {
    const poses: AvatarActivityPose[] = [
      'dance_step_1',
      'dance_step_2',
      'dance_step_3',
      'dance_step_4',
      'dance_step_5',
    ];
    const normalizedIdx = stepIdx >= 0 && stepIdx <= 4 ? stepIdx + 1 : stepIdx;
    if (normalizedIdx < 1 || normalizedIdx > 5) return;
    const realIdx = normalizedIdx - 1;
    activeDanceStepIndex = normalizedIdx;
    activeManualDanceName = DANCE_STEP_NAMES[realIdx];
    avatarCallbacks?.setActivityPose(poses[realIdx]);
    playSparkleArpeggio(440.0 + normalizedIdx * 75);
    setTemporaryCaption(`Royal Dance Studio • ${DANCE_STEP_NAMES[realIdx]}`, 3.2);
    dancePulseRingMat.opacity = 1.0;
  };

  const updateMannequinRingHighlight = (selectedIdx: number) => {
    for (let i = 0; i < mannequinHighlightRings.length; i++) {
      const mat = mannequinHighlightRings[i].material as THREE.MeshBasicMaterial;
      mat.opacity = i === selectedIdx ? 0.95 : 0.24;
    }
  };

  const exitActiveCameraMode = (playerPos?: THREE.Vector3) => {
    if (activeMode === 'none') return;
    const prevMode = activeMode;
    activeMode = 'none';
    cameraLookYawOffset = 0.0;
    cameraLookPitchOffset = 0.0;
    popBackingBeatPlaying = false;
    stagePulseIntensity = 0.0;
    avatarCallbacks?.setActivityPose('none');

    if (playerPos) {
      if (prevMode === 'wardrobe_styling') {
        playerPos.set(originX - 10.4, baseY + y0, originZ - 10.6);
      } else if (prevMode === 'pop_stage') {
        playerPos.set(originX + 0.0, baseY + y0, originZ - 9.0);
      } else if (prevMode === 'dance_studio') {
        playerPos.set(originX - 10.4, baseY + y0, originZ + 0.0);
      } else if (prevMode === 'beauty_vanity') {
        playerPos.set(originX - 10.8, baseY + y0, originZ + 10.6);
      }
    }
  };

  return {
    group,
    colliders,
    partitionMeshes,

    setAvatarCallbacks: (callbacks: Floor2AvatarCallbacks) => {
      avatarCallbacks = callbacks;
    },

    getProximityPrompt: (playerPos: THREE.Vector3): string | null => {
      if (activeMode === 'wardrobe_styling') {
        return '[1-5] Couture Gown · [H] Hair Color · [T] Royal Tiara · Drag/A-D 360° · [E/Esc] Step Down';
      }
      if (activeMode === 'pop_stage') {
        return '[1-8] Sing Pop Synth Notes · [Space] Toggle Pop Backing Beat · [E/Esc] End Concert';
      }
      if (activeMode === 'dance_studio') {
        return '[1-5] Choose Song · [W,A,S,D,F,G,H,J,K,L] Freestyle Moves · [6,7,8,9,0] 5 Choreographies · [E/Esc] Finish Dance';
      }
      if (activeMode === 'beauty_vanity') {
        return '[H] Cycle Hair Color · [T] Toggle Royal Tiara · [G] Perfume Shimmer Mist · [E/Esc] Stand Up';
      }

      const py = playerPos.y - baseY;
      if (Math.abs(py - y0) > 1.85) return null;

      const lx = playerPos.x - originX;
      const lz = playerPos.z - originZ;

      // 1. Royal Walk-In Wardrobe Podium (-11.9, -10.8)
      if (Math.hypot(lx - -11.9, lz - -10.8) <= 3.2) {
        return '[E] Step onto Royal Wardrobe Styling Podium';
      }
      // 2. Pop Star Concert Stage (0.0, -11.2)
      if (Math.hypot(lx - 0.0, lz - -11.2) <= 3.1) {
        return '[E] Perform on Pop Star Concert Stage';
      }
      // 3. Royal Ballet & Dance Studio (-12.1, 0.0)
      if (Math.hypot(lx - -12.1, lz - 0.0) <= 3.2) {
        return '[E] Start Choreography in Royal Dance Studio';
      }
      // 4. Glamour Makeup & Beauty Vanity (-12.2, +11.6)
      if (Math.hypot(lx - -12.2, lz - 11.6) <= 2.9) {
        return '[E] Sit at Glamour Beauty Vanity';
      }

      return null;
    },

    getActiveRoomCaption: (): string | null => {
      if (statusCaptionTimer > 0 && statusCaptionText) {
        return statusCaptionText;
      }
      if (activeMode === 'wardrobe_styling' && avatarCallbacks) {
        const s = avatarCallbacks.getAppearanceSummary();
        return `Royal Wardrobe • ${s.outfitName} • ${s.hairName} • ${s.tiaraVisible ? 'Royal Tiara On ♕' : 'Tiara Off'}`;
      }
      if (activeMode === 'pop_stage') {
        return popBackingBeatPlaying
          ? 'Pop Star Stage • Backing Groove LIVE ♪ • Press [1-8] to Sing Lead!'
          : 'Pop Star Stage • Press [1-8] for Lead Notes or [Space] for Backing Groove ♪';
      }
      if (activeMode === 'dance_studio') {
        const song = DANCE_SONGS[activeDanceSongIndex];
        return `Royal Dance Studio • Song [${activeDanceSongIndex + 1}/5]: ${song.title} (${song.genre}) • Move: ${activeManualDanceName}`;
      }
      if (activeMode === 'beauty_vanity' && avatarCallbacks) {
        const s = avatarCallbacks.getAppearanceSummary();
        return `Glamour Beauty Vanity • ${s.hairName} • ${s.tiaraVisible ? 'Royal Tiara On ♕' : 'Tiara Off'}`;
      }
      return null;
    },

    interact: (playerPos: THREE.Vector3): boolean => {
      if (activeMode !== 'none') {
        exitActiveCameraMode(playerPos);
        return true;
      }

      const py = playerPos.y - baseY;
      if (Math.abs(py - y0) > 1.85) return false;

      const lx = playerPos.x - originX;
      const lz = playerPos.z - originZ;

      cameraLookYawOffset = 0.0;
      cameraLookPitchOffset = 0.0;

      // 1. Enter Royal Wardrobe Styling Podium
      if (Math.hypot(lx - -11.9, lz - -10.8) <= 3.2) {
        activeMode = 'wardrobe_styling';
        cameraBlendAlpha = 0.0;
        wardrobeOrbitYaw = 0.35;
        wardrobeSparkleTimer = 1.35;
        playSparkleArpeggio(587.33);
        return true;
      }

      // 2. Enter Pop Star Concert Stage
      if (Math.hypot(lx - 0.0, lz - -11.2) <= 3.1) {
        activeMode = 'pop_stage';
        cameraBlendAlpha = 0.0;
        popBackingBeatPlaying = true;
        popBeatAccum = 0.0;
        popStageNoteTimer = 1.2;
        avatarCallbacks?.setActivityPose('pop_sing');
        playSparkleArpeggio(523.25);
        return true;
      }

      // 3. Enter Royal Dance Studio
      if (Math.hypot(lx - -12.1, lz - 0.0) <= 3.2) {
        activeMode = 'dance_studio';
        cameraBlendAlpha = 0.0;
        activeDanceStepIndex = 1;
        danceBeatAccum = 0.0;
        avatarCallbacks?.setActivityPose('dance_step_1');
        playSparkleArpeggio(659.25);
        return true;
      }

      // 4. Enter Glamour Beauty Vanity
      if (Math.hypot(lx - -12.2, lz - 11.6) <= 2.9) {
        activeMode = 'beauty_vanity';
        cameraBlendAlpha = 0.0;
        beautyMistTimer = 1.4;
        avatarCallbacks?.setActivityPose('none');
        playSparkleArpeggio(783.99);
        return true;
      }

      return false;
    },

    handleKeyAction: (code: string): boolean => {
      if (activeMode === 'none') return false;

      if (activeMode === 'wardrobe_styling') {
        const digitMap: Record<string, number> = {
          Digit1: 0,
          Numpad1: 0,
          Digit2: 1,
          Numpad2: 1,
          Digit3: 2,
          Numpad3: 2,
          Digit4: 3,
          Numpad4: 3,
          Digit5: 4,
          Numpad5: 4,
        };
        if (code in digitMap && avatarCallbacks) {
          const idx = digitMap[code];
          const gownName = avatarCallbacks.setOutfitPalette(idx);
          updateMannequinRingHighlight(idx);
          podiumGlowRingMat.color.set(OUTFIT_PALETTE_PRESETS[idx].dressHex);
          wardrobeSparkleTimer = 1.35;
          playSparkleArpeggio(523.25 + idx * 65);
          setTemporaryCaption(`♕ Selected Couture: ${gownName} ♕`, 3.5);
          return true;
        }
        if (code === 'KeyH' && avatarCallbacks) {
          const hairName = avatarCallbacks.cycleHairColor();
          wardrobeSparkleTimer = 1.1;
          playSynthTone(783.99, 0.3, 'sine', 0.12);
          setTemporaryCaption(`✦ Hair Styled: ${hairName} ✦`, 3.2);
          return true;
        }
        if (code === 'KeyT' && avatarCallbacks) {
          const on = avatarCallbacks.toggleTiara();
          wardrobeSparkleTimer = 1.1;
          playSynthTone(on ? 987.77 : 659.25, 0.3, 'triangle', 0.12);
          setTemporaryCaption(
            on ? '♕ Royal Crystal Tiara Placed Upon Your Crown ♕' : '✦ Royal Crystal Tiara Removed ✦',
            3.2,
          );
          return true;
        }
        return false;
      }

      if (activeMode === 'pop_stage') {
        const noteMap: Record<string, number> = {
          Digit1: 0,
          Numpad1: 0,
          Digit2: 1,
          Numpad2: 1,
          Digit3: 2,
          Numpad3: 2,
          Digit4: 3,
          Numpad4: 3,
          Digit5: 4,
          Numpad5: 4,
          Digit6: 5,
          Numpad6: 5,
          Digit7: 6,
          Numpad7: 6,
          Digit8: 7,
          Numpad8: 7,
        };
        if (code in noteMap) {
          const nIdx = noteMap[code];
          playSynthTone(POP_LEAD_FREQS[nIdx], 0.42, 'sawtooth', 0.11);
          popStageNoteTimer = 1.25;
          stagePulseIntensity = 1.0;
          const colors = [
            '#f472b6',
            '#38bdf8',
            '#fde047',
            '#c084fc',
            '#fb7185',
            '#4ade80',
            '#f97316',
            '#e879f9',
          ];
          spotlightBeamMat.color.set(colors[nIdx % colors.length]);
          stageNoteMat.color.set(colors[(nIdx + 2) % colors.length]);
          return true;
        }
        if (code === 'Space') {
          popBackingBeatPlaying = !popBackingBeatPlaying;
          playSynthTone(popBackingBeatPlaying ? 523.25 : 392.0, 0.25, 'triangle', 0.1);
          return true;
        }
        return false;
      }

      if (activeMode === 'dance_studio') {
        // 1. Select from list of 5 Songs [1-5]
        const songDigitMap: Record<string, number> = {
          Digit1: 0,
          Numpad1: 0,
          Digit2: 1,
          Numpad2: 1,
          Digit3: 2,
          Numpad3: 2,
          Digit4: 3,
          Numpad4: 3,
          Digit5: 4,
          Numpad5: 4,
        };
        if (code in songDigitMap) {
          selectDanceSong(songDigitMap[code]);
          return true;
        }

        // 2. Manual Dance Steps [W, A, S, D, F, G, H, J, K, L]
        if (code in MANUAL_DANCE_MOVES) {
          performManualDance(code);
          return true;
        }

        // 3. Pre-built choreographic dance steps [6, 7, 8, 9, 0]
        const prebuiltMap: Record<string, { idx: number; pose: AvatarActivityPose }> = {
          Digit6: { idx: 1, pose: 'dance_step_1' },
          Numpad6: { idx: 1, pose: 'dance_step_1' },
          Digit7: { idx: 2, pose: 'dance_step_2' },
          Numpad7: { idx: 2, pose: 'dance_step_2' },
          Digit8: { idx: 3, pose: 'dance_step_3' },
          Numpad8: { idx: 3, pose: 'dance_step_3' },
          Digit9: { idx: 4, pose: 'dance_step_4' },
          Numpad9: { idx: 4, pose: 'dance_step_4' },
          Digit0: { idx: 5, pose: 'dance_step_5' },
          Numpad0: { idx: 5, pose: 'dance_step_5' },
        };
        if (code in prebuiltMap) {
          const sel = prebuiltMap[code];
          activeDanceStepIndex = sel.idx;
          activeManualDanceName = DANCE_STEP_NAMES[sel.idx - 1];
          avatarCallbacks?.setActivityPose(sel.pose);
          playSparkleArpeggio(440.0 + sel.idx * 75);
          setTemporaryCaption(`Royal Dance Studio • ${DANCE_STEP_NAMES[sel.idx - 1]}`, 3.2);
          return true;
        }
        return false;
      }

      if (activeMode === 'beauty_vanity') {
        if (code === 'KeyH' && avatarCallbacks) {
          const hairName = avatarCallbacks.cycleHairColor();
          beautyMistTimer = 1.25;
          playSynthTone(880.0, 0.3, 'sine', 0.11);
          setTemporaryCaption(`✦ Salon Hair Colour: ${hairName} ✦`, 3.2);
          return true;
        }
        if (code === 'KeyT' && avatarCallbacks) {
          const on = avatarCallbacks.toggleTiara();
          beautyMistTimer = 1.25;
          playSynthTone(on ? 1046.5 : 698.46, 0.3, 'triangle', 0.11);
          setTemporaryCaption(
            on ? '♕ Royal Crystal Tiara Equipped ♕' : '✦ Royal Crystal Tiara Removed ✦',
            3.2,
          );
          return true;
        }
        if (code === 'KeyG') {
          beautyMistTimer = 1.65;
          playSparkleArpeggio(698.46);
          setTemporaryCaption('♡ Rose-Gold Starlight Perfume Mist Spritzed ♡', 3.5);
          return true;
        }
        return false;
      }

      return false;
    },

    applyOrbitYawDelta: (deltaYaw: number) => {
      if (activeMode === 'wardrobe_styling') {
        wardrobeOrbitYaw += deltaYaw;
      } else if (activeMode !== 'none') {
        cameraLookYawOffset -= deltaYaw;
      }
    },

    applyLookDelta: (deltaYaw: number, deltaPitch: number) => {
      if (activeMode === 'wardrobe_styling') {
        wardrobeOrbitYaw += deltaYaw;
        cameraLookPitchOffset = THREE.MathUtils.clamp(
          cameraLookPitchOffset + deltaPitch,
          -0.78,
          0.85,
        );
      } else if (activeMode !== 'none') {
        cameraLookYawOffset -= deltaYaw;
        cameraLookPitchOffset = THREE.MathUtils.clamp(
          cameraLookPitchOffset + deltaPitch,
          -0.85,
          0.92,
        );
      }
    },

    exitActiveCameraMode,

    getCameraState: (): Floor2CameraState => {
      if (activeMode === 'none') {
        return {
          active: false,
          mode: 'none',
          camWorldPos: _scratchCamWorldPos,
          lookWorldPos: _scratchLookWorldPos,
          blendAlpha: 0,
          isSitting: false,
        };
      }

      let isSitting = false;
      let seatYaw = 0;

      if (activeMode === 'wardrobe_styling') {
        const podX = originX - 11.9;
        const podY = baseY + y0 + 0.19;
        const podZ = originZ - 10.8;
        const camDist = 3.15;
        _scratchCamWorldPos.set(
          podX + Math.sin(wardrobeOrbitYaw) * camDist,
          podY + 1.42,
          podZ + Math.cos(wardrobeOrbitYaw) * camDist,
        );
        _scratchLookWorldPos.set(podX, podY + 1.05, podZ);
        _scratchSeatWorldPos.set(podX, podY, podZ);
        seatYaw = podiumTurntableGroup.rotation.y;
      } else if (activeMode === 'pop_stage') {
        const stgX = originX + 0.0;
        const stgY = baseY + y0 + 0.26;
        const stgZ = originZ - 11.45;
        _scratchCamWorldPos.set(stgX + 1.65, stgY + 1.65, stgZ + 3.45);
        _scratchLookWorldPos.set(stgX, stgY + 1.15, stgZ - 0.35);
        _scratchSeatWorldPos.set(stgX, stgY, stgZ);
        seatYaw = 0;
      } else if (activeMode === 'dance_studio') {
        const dncX = originX - 12.1;
        const dncY = baseY + y0 + 0.03;
        const dncZ = originZ + 0.0;
        _scratchCamWorldPos.set(dncX + 3.25, dncY + 1.62, dncZ + 2.15);
        _scratchLookWorldPos.set(dncX - 0.35, dncY + 1.08, dncZ);
        _scratchSeatWorldPos.set(dncX, dncY, dncZ);
        seatYaw = Math.PI * 0.5;
      } else {
        // beauty_vanity
        const vanX = originX - 12.2;
        const vanY = baseY + y0;
        const vanZ = originZ + 11.45;
        _scratchCamWorldPos.set(vanX + 1.35, vanY + 1.48, vanZ - 1.55);
        _scratchLookWorldPos.set(vanX, vanY + 1.28, vanZ + 1.15);
        _scratchSeatWorldPos.set(vanX, vanY + 0.05, vanZ);
        isSitting = true;
        seatYaw = 0;
      }

      if (Math.abs(cameraLookYawOffset) > 0.0001 || Math.abs(cameraLookPitchOffset) > 0.0001) {
        const dx = _scratchLookWorldPos.x - _scratchCamWorldPos.x;
        const dy = _scratchLookWorldPos.y - _scratchCamWorldPos.y;
        const dz = _scratchLookWorldPos.z - _scratchCamWorldPos.z;
        const dist = Math.hypot(dx, dy, dz) || 1.0;
        const baseYaw = Math.atan2(dx, dz);
        const basePitch = Math.asin(THREE.MathUtils.clamp(-dy / dist, -0.96, 0.96));
        const finalYaw = baseYaw + cameraLookYawOffset;
        const finalPitch = THREE.MathUtils.clamp(basePitch + cameraLookPitchOffset, -0.92, 0.92);
        _scratchLookWorldPos.set(
          _scratchCamWorldPos.x + Math.sin(finalYaw) * Math.cos(finalPitch) * dist,
          _scratchCamWorldPos.y - Math.sin(finalPitch) * dist,
          _scratchCamWorldPos.z + Math.cos(finalYaw) * Math.cos(finalPitch) * dist,
        );
      }

      return {
        active: true,
        mode: activeMode,
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: cameraBlendAlpha,
        isSitting,
        seatWorldPos: _scratchSeatWorldPos,
        seatYaw,
      };
    },

    getStagePulseIntensity: () => stagePulseIntensity,

    getDanceStudioState: () => ({
      active: activeMode === 'dance_studio',
      activeSongIndex: activeDanceSongIndex,
      songTitle: DANCE_SONGS[activeDanceSongIndex].title,
      genre: DANCE_SONGS[activeDanceSongIndex].genre,
      activeDanceName: activeManualDanceName,
      songs: DANCE_SONGS.map((s) => ({ title: s.title, genre: s.genre })),
    }),

    selectDanceSong,
    performManualDance,
    performPredefinedDance,

    update: (
      delta: number,
      elapsedTime: number,
      playerPos: THREE.Vector3,
      inputKeys?: Set<string>,
    ) => {
      if (statusCaptionTimer > 0) {
        statusCaptionTimer = Math.max(0, statusCaptionTimer - delta);
      }

      if (activeMode !== 'none') {
        cameraBlendAlpha = smoothStep01(Math.min(1.0, cameraBlendAlpha + delta * 2.6));
      } else {
        cameraBlendAlpha = 0.0;
      }

      // Keyboard 2-Axis Camera Look (Up, Down, Right, Left) in any Floor 2 Activity
      if (activeMode !== 'none' && inputKeys) {
        if (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft') || inputKeys.has('KeyQ')) {
          if (activeMode === 'wardrobe_styling') {
            wardrobeOrbitYaw -= delta * 1.45;
          } else {
            cameraLookYawOffset += delta * 1.45;
          }
        }
        if (inputKeys.has('KeyD') || inputKeys.has('ArrowRight') || inputKeys.has('KeyR')) {
          if (activeMode === 'wardrobe_styling') {
            wardrobeOrbitYaw += delta * 1.45;
          } else {
            cameraLookYawOffset -= delta * 1.45;
          }
        }
        if (inputKeys.has('KeyW') || inputKeys.has('ArrowUp')) {
          cameraLookPitchOffset = THREE.MathUtils.clamp(
            cameraLookPitchOffset - delta * 1.15,
            -0.85,
            0.92,
          );
        }
        if (inputKeys.has('KeyS') || inputKeys.has('ArrowDown')) {
          cameraLookPitchOffset = THREE.MathUtils.clamp(
            cameraLookPitchOffset + delta * 1.15,
            -0.85,
            0.92,
          );
        }
      }

      // Rotate Wardrobe Turntable smoothly
      const turntableSpeed = activeMode === 'wardrobe_styling' ? 0.55 : 0.18;
      podiumTurntableGroup.rotation.y = (podiumTurntableGroup.rotation.y + delta * turntableSpeed) % (Math.PI * 2);

      // Animate Wardrobe Sparkle Orbs
      if (wardrobeSparkleTimer > 0) {
        wardrobeSparkleTimer = Math.max(0, wardrobeSparkleTimer - delta);
        const prog = 1.0 - wardrobeSparkleTimer / 1.35;
        wardrobeSparkleMat.opacity = Math.sin(prog * Math.PI) * 0.95;
        for (let i = 0; i < wardrobeSparkles.length; i++) {
          const sp = wardrobeSparkles[i];
          sp.visible = true;
          const ang = (i * Math.PI * 2) / wardrobeSparkles.length + prog * 3.8;
          const rad = 0.85 + Math.sin(prog * Math.PI + i) * 0.35;
          sp.position.set(
            -11.9 + Math.cos(ang) * rad,
            y0 + 0.35 + prog * 1.85 + (i % 3) * 0.18,
            -10.8 + Math.sin(ang) * rad,
          );
          sp.rotation.y = elapsedTime * 4.0 + i;
        }
      } else {
        for (let i = 0; i < wardrobeSparkles.length; i++) {
          wardrobeSparkles[i].visible = false;
        }
      }

      // Pop Stage Backing Groove & Spotlight Sweep
      stagePulseIntensity = Math.max(0, stagePulseIntensity - delta * 2.2);
      if (activeMode === 'pop_stage' && popBackingBeatPlaying) {
        popBeatAccum += delta;
        if (popBeatAccum >= 0.28) {
          popBeatAccum -= 0.28;
          const freq = POP_BACKING_NOTES[popBeatStep % POP_BACKING_NOTES.length];
          popBeatStep++;
          playSynthTone(freq, 0.22, 'triangle', 0.065);
          stagePulseIntensity = Math.max(stagePulseIntensity, 0.65);
        }
      }

      const isStageActive = activeMode === 'pop_stage';
      spotlightBeamMat.opacity = isStageActive
        ? 0.26 + stagePulseIntensity * 0.22
        : 0.1;
      stageArchMat.emissiveIntensity = isStageActive
        ? 1.65 + stagePulseIntensity * 0.85
        : 1.15;
      for (let i = 0; i < stageSpotlights.length; i++) {
        const sp = stageSpotlights[i];
        const phase = elapsedTime * (isStageActive ? 2.4 : 0.8) + i * 1.1;
        sp.rotation.z = Math.sin(phase) * (isStageActive ? 0.34 : 0.12);
        sp.rotation.x = 0.18 + Math.cos(phase * 0.8) * 0.14;
      }

      if (popStageNoteTimer > 0) {
        popStageNoteTimer = Math.max(0, popStageNoteTimer - delta);
        const prog = 1.0 - popStageNoteTimer / 1.25;
        stageNoteMat.opacity = Math.sin(prog * Math.PI) * 0.92;
        for (let i = 0; i < stageNoteMeshes.length; i++) {
          const nm = stageNoteMeshes[i];
          nm.visible = true;
          const ang = (i * Math.PI * 2) / stageNoteMeshes.length + elapsedTime * 2.2;
          const rad = 1.1 + prog * 1.35;
          nm.position.set(
            Math.cos(ang) * rad,
            y0 + 0.8 + prog * 2.1 + (i % 2) * 0.25,
            -11.4 + Math.sin(ang) * rad * 0.65,
          );
          nm.rotation.y = elapsedTime * 3.5 + i;
        }
      } else {
        for (let i = 0; i < stageNoteMeshes.length; i++) {
          stageNoteMeshes[i].visible = false;
        }
      }

      // Royal Dance Studio Multi-Track Song Accompaniment & Floor Ring Pulse
      rhythmOrb.rotation.y = elapsedTime * 1.4;
      if (activeMode === 'dance_studio') {
        const currentSong = DANCE_SONGS[activeDanceSongIndex];
        danceBeatAccum += delta;
        if (danceBeatAccum >= currentSong.beatInterval) {
          danceBeatAccum -= currentSong.beatInterval;
          const lIdx = danceBeatStep % currentSong.leadNotes.length;
          const bIdx = Math.floor(danceBeatStep / 2) % currentSong.bassNotes.length;
          playSynthTone(currentSong.leadNotes[lIdx], 0.24, 'triangle', 0.07);
          playSynthTone(currentSong.bassNotes[bIdx], 0.32, 'sine', 0.08);
          danceBeatStep++;
        }
        dancePulseRingMat.opacity = 0.55 + Math.sin(elapsedTime * 6.0) * 0.28;
        const sScale = 1.0 + Math.sin(elapsedTime * 6.0) * 0.04;
        dancePulseRing.scale.set(sScale, sScale, 1);
      } else {
        dancePulseRingMat.opacity = 0.28;
        dancePulseRing.scale.set(1, 1, 1);
      }

      // Glamour Beauty Studio Mist Particles
      if (beautyMistTimer > 0) {
        beautyMistTimer = Math.max(0, beautyMistTimer - delta);
        const prog = 1.0 - beautyMistTimer / 1.65;
        mistParticleMat.opacity = Math.sin(prog * Math.PI) * 0.85;
        for (let i = 0; i < mistParticles.length; i++) {
          const mp = mistParticles[i];
          mp.visible = true;
          const ang = (i * Math.PI * 2) / mistParticles.length + prog * 2.8;
          const r = 0.45 + prog * 0.65;
          mp.position.set(
            -12.2 + Math.cos(ang) * r,
            y0 + 0.95 + prog * 0.85 + (i % 3) * 0.12,
            11.65 + Math.sin(ang) * r,
          );
        }
      } else {
        for (let i = 0; i < mistParticles.length; i++) {
          mistParticles[i].visible = false;
        }
      }

      // Shared Floor 2 Room Dynamic PointLight Tracking
      _scratchLocal.set(
        playerPos.x - originX,
        playerPos.y - baseY,
        playerPos.z - originZ,
      );
      if (Math.abs(_scratchLocal.y - y0) > 2.6) {
        floor2RoomLight.intensity = THREE.MathUtils.lerp(
          floor2RoomLight.intensity,
          0.0,
          1 - Math.exp(-8 * delta),
        );
        return;
      }

      let targetIntensity = 1.35;
      if (_scratchLocal.x < -7.5 && _scratchLocal.z < -6.0) {
        // Royal Walk-In Wardrobe
        _scratchLightPos.set(-11.9, y0 + 3.1, -10.8);
        _scratchLightColor.set('#fbcfe8');
        targetIntensity = activeMode === 'wardrobe_styling' ? 2.1 : 1.45;
      } else if (Math.abs(_scratchLocal.x) <= 7.5 && _scratchLocal.z < -6.0) {
        // Pop Star Concert Stage
        _scratchLightPos.set(0.0, y0 + 3.4, -11.4);
        _scratchLightColor.set(activeMode === 'pop_stage' ? '#f472b6' : '#fde047');
        targetIntensity = activeMode === 'pop_stage' ? 2.2 + stagePulseIntensity * 0.6 : 1.5;
      } else if (_scratchLocal.x < -7.5 && Math.abs(_scratchLocal.z) <= 6.0) {
        // Royal Ballet & Dance Studio
        _scratchLightPos.set(-12.1, y0 + 3.2, 0.0);
        _scratchLightColor.set('#f9a8d4');
        targetIntensity = activeMode === 'dance_studio' ? 2.0 : 1.4;
      } else {
        // Glamour Makeup & Beauty Vanity
        _scratchLightPos.set(-12.2, y0 + 2.8, 12.0);
        _scratchLightColor.set('#fef08a');
        targetIntensity = activeMode === 'beauty_vanity' ? 2.1 : 1.45;
      }

      floor2RoomLight.position.lerp(_scratchLightPos, 1 - Math.exp(-6 * delta));
      floor2RoomLight.color.lerp(_scratchLightColor, 1 - Math.exp(-6 * delta));
      floor2RoomLight.intensity = THREE.MathUtils.lerp(
        floor2RoomLight.intensity,
        targetIntensity,
        1 - Math.exp(-8 * delta),
      );
    },
  };
}
