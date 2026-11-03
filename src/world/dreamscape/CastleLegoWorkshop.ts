import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ResourceTracker } from '../ProceduralKit';
import { getTerrainHeight } from '../terrainMath';
import { createDreamCastleMaterials, type DreamCastleMaterials } from './CastleMaterials';
import type { CircleCollider } from '../VegetationSystem';
import type { AvatarActivityPose } from '../PlayerCharacter';

export interface CastleProximityPrompt {
  prompt: string;
  roomId: string;
}

export type LegoBrickShapeId =
  | '1x1'
  | '1x2'
  | '2x2'
  | '2x4'
  | 'Slope2x2'
  | 'Arch1x4'
  | 'Round1x1'
  | 'WheelAxle'
  | 'WingPair'
  | 'HeartStud1x1'
  | 'MiniCrown'
  | 'BotanicalRose'
  | 'Tile2x2YH'
  | 'WheelChassisCore'
  | 'CreatureHopperCore'
  | 'BipedRobotCore'
  | 'ThrusterFlightCore';

export type LegoCreationArchetype =
  | 'car'
  | 'creature'
  | 'robot'
  | 'spaceship'
  | 'structure';

export type LegoWorkshopMode =
  | 'none'
  | 'lego_build'
  | 'lego_awakening'
  | 'lego_remote'
  | 'lego_rebuild_tornado';

export interface PlacedLegoBrick {
  id: number;
  shape: LegoBrickShapeId;
  colorHex: string;
  studX: number; // 0..11
  studZ: number; // 0..11
  layerY: number; // 0..15
  rotY: number; // 0, 1, 2, 3 (in 90-deg steps)
  settleTimer: number; // 0..0.06s vertical squash-and-settle ease
  mesh: THREE.Mesh;
}

export interface GuidebookStepSpec {
  shape: LegoBrickShapeId;
  colorHex: string;
  studX: number;
  studZ: number;
  layerY: number;
  rotY: number; // 0..3
  hint: string;
}

export interface GuidebookBlueprint {
  id: string;
  title: string;
  shortTitle: string;
  icon: string;
  archetype: LegoCreationArchetype;
  steps: readonly GuidebookStepSpec[];
}

export interface LegoCreationRecord {
  id: string;
  title: string;
  archetype: LegoCreationArchetype;
  isCustomOurBuild: boolean;
  bricks: Array<{
    shape: LegoBrickShapeId;
    colorHex: string;
    studX: number;
    studZ: number;
    layerY: number;
    rotY: number;
  }>;
}

interface BrickShapeFootprint {
  w: number; // studs along X when rotY = 0
  d: number; // studs along Z when rotY = 0
  h: number; // height in layers (1 layer = 0.064m)
  trayIndex: number;
  label: string;
}

const STUD_UNIT = 0.08; // 1 stud = 0.08m in local build space
const LAYER_HEIGHT = 0.064; // 1 brick layer height = 0.064m
const GRID_SIZE = 12; // 12x12 studded baseplate (0.96m x 0.96m)

export const LEGO_PASTEL_PALETTE: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Blush Rose', hex: '#f472b6' },
  { name: 'Valentine Ruby', hex: '#e11d48' },
  { name: 'Champagne Gold', hex: '#f59e0b' },
  { name: 'Pearl White', hex: '#fffdf9' },
  { name: 'Lavender Dream', hex: '#c084fc' },
  { name: 'Starlight Sapphire', hex: '#38bdf8' },
  { name: 'Mint Macaron', hex: '#34d399' },
  { name: 'Warm Peach Cream', hex: '#fda4af' },
];

export const BRICK_SHAPE_META: Record<LegoBrickShapeId, BrickShapeFootprint> = {
  '1x1': { w: 1, d: 1, h: 1, trayIndex: 0, label: '1×1 Brick' },
  '1x2': { w: 1, d: 2, h: 1, trayIndex: 0, label: '1×2 Brick' },
  '2x2': { w: 2, d: 2, h: 1, trayIndex: 0, label: '2×2 Brick' },
  '2x4': { w: 2, d: 4, h: 1, trayIndex: 0, label: '2×4 Brick' },
  Slope2x2: { w: 2, d: 2, h: 1, trayIndex: 1, label: '2×2 Slope' },
  Arch1x4: { w: 1, d: 4, h: 1, trayIndex: 1, label: '1×4 Royal Arch' },
  Round1x1: { w: 1, d: 1, h: 1, trayIndex: 1, label: '1×1 Cylinder' },
  HeartStud1x1: { w: 1, d: 1, h: 1, trayIndex: 2, label: 'Heart Jewel Stud' },
  MiniCrown: { w: 2, d: 2, h: 1, trayIndex: 2, label: 'Mini Gold Crown' },
  BotanicalRose: { w: 1, d: 1, h: 1, trayIndex: 2, label: 'LEGO Rose Bloom' },
  Tile2x2YH: { w: 2, d: 2, h: 1, trayIndex: 2, label: '"Y ❤️ H" Crest Tile' },
  WheelChassisCore: { w: 2, d: 4, h: 1, trayIndex: 3, label: '🛞 Wheel Chassis Core' },
  WheelAxle: { w: 2, d: 2, h: 1, trayIndex: 3, label: 'Wheel Axle Pair' },
  CreatureHopperCore: { w: 2, d: 3, h: 1, trayIndex: 4, label: '🐾 Creature Hopper Core' },
  BipedRobotCore: { w: 2, d: 2, h: 1, trayIndex: 5, label: '🤖 Biped Robot Core' },
  ThrusterFlightCore: { w: 2, d: 4, h: 1, trayIndex: 6, label: '🚀 Thruster Flight Core' },
  WingPair: { w: 4, d: 2, h: 1, trayIndex: 6, label: 'Swept Wing Pair' },
};

export const GUIDEBOOK_BLUEPRINTS: readonly GuidebookBlueprint[] = [
  {
    id: 'roadster',
    title: '🚗 Royal Pastel Roadster',
    shortTitle: 'Royal Roadster',
    icon: '🚗',
    archetype: 'car',
    steps: [
      { shape: 'WheelChassisCore', colorHex: '#f59e0b', studX: 5, studZ: 4, layerY: 0, rotY: 0, hint: 'Snap the 🛞 Wheel Chassis Core onto the center studs' },
      { shape: '2x4', colorHex: '#f472b6', studX: 5, studZ: 4, layerY: 1, rotY: 0, hint: 'Place the Blush Rose 2×4 cabin deck' },
      { shape: 'Slope2x2', colorHex: '#fffdf9', studX: 5, studZ: 3, layerY: 1, rotY: 0, hint: 'Add the Pearl White front aerodynamic hood slope' },
      { shape: 'Slope2x2', colorHex: '#e11d48', studX: 5, studZ: 7, layerY: 1, rotY: 2, hint: 'Snap the Valentine Ruby rear tailfin slope' },
      { shape: '1x2', colorHex: '#38bdf8', studX: 5, studZ: 4, layerY: 2, rotY: 1, hint: 'Mount the Starlight Sapphire crystal windshield' },
      { shape: '2x2', colorHex: '#fffdf9', studX: 5, studZ: 5, layerY: 2, rotY: 0, hint: 'Place the Pearl White plush driver seat' },
      { shape: 'Tile2x2YH', colorHex: '#f59e0b', studX: 5, studZ: 6, layerY: 2, rotY: 0, hint: 'Crown the rear deck with the "Y ❤️ H" Crest Tile' },
      { shape: 'HeartStud1x1', colorHex: '#e11d48', studX: 5, studZ: 3, layerY: 2, rotY: 0, hint: 'Finish with the glowing Heart Jewel hood ornament!' },
    ],
  },
  {
    id: 'dino',
    title: '🦖 Cute Baby Dino',
    shortTitle: 'Cute Baby Dino',
    icon: '🦖',
    archetype: 'creature',
    steps: [
      { shape: 'CreatureHopperCore', colorHex: '#34d399', studX: 5, studZ: 5, layerY: 0, rotY: 0, hint: 'Place the 🐾 Creature Hopper Core on the center mat' },
      { shape: '2x4', colorHex: '#34d399', studX: 5, studZ: 5, layerY: 1, rotY: 0, hint: 'Build the Mint Macaron dino belly with a 2×4 brick' },
      { shape: 'Slope2x2', colorHex: '#f472b6', studX: 5, studZ: 7, layerY: 2, rotY: 2, hint: 'Attach the Blush Rose swishing dino tail slope' },
      { shape: '2x2', colorHex: '#34d399', studX: 5, studZ: 5, layerY: 2, rotY: 0, hint: 'Stack the dino neck with a Mint 2×2 brick' },
      { shape: '2x4', colorHex: '#34d399', studX: 5, studZ: 4, layerY: 3, rotY: 0, hint: 'Snap the friendly dino head & snout in place' },
      { shape: 'HeartStud1x1', colorHex: '#f472b6', studX: 5, studZ: 6, layerY: 3, rotY: 0, hint: 'Add a rosy back scale stud' },
      { shape: 'MiniCrown', colorHex: '#f59e0b', studX: 5, studZ: 5, layerY: 4, rotY: 0, hint: 'Crown your Baby Dino with the Mini Gold Crown!' },
    ],
  },
  {
    id: 'robot',
    title: '🤖 Heart-Bot Companion',
    shortTitle: 'Heart-Bot',
    icon: '🤖',
    archetype: 'robot',
    steps: [
      { shape: 'BipedRobotCore', colorHex: '#f59e0b', studX: 5, studZ: 5, layerY: 0, rotY: 0, hint: 'Place the 🤖 Biped Robot Core stepping feet' },
      { shape: '2x2', colorHex: '#fffdf9', studX: 5, studZ: 5, layerY: 1, rotY: 0, hint: 'Stack the Pearl White lower chassis' },
      { shape: '2x4', colorHex: '#f472b6', studX: 4, studZ: 5, layerY: 2, rotY: 1, hint: 'Attach the wide Blush Rose shoulder & arm span' },
      { shape: 'HeartStud1x1', colorHex: '#e11d48', studX: 5, studZ: 5, layerY: 3, rotY: 0, hint: 'Embed the glowing Valentine Heart Core on the chest' },
      { shape: 'HeartStud1x1', colorHex: '#e11d48', studX: 6, studZ: 5, layerY: 3, rotY: 0, hint: 'Add the twin Valentine Heart Core synchronization stud' },
      { shape: '2x2', colorHex: '#38bdf8', studX: 5, studZ: 5, layerY: 4, rotY: 0, hint: 'Mount the Starlight Sapphire robot visor head' },
      { shape: 'Round1x1', colorHex: '#f59e0b', studX: 5, studZ: 5, layerY: 5, rotY: 0, hint: 'Top with the golden signal antenna!' },
    ],
  },
  {
    id: 'spaceship',
    title: '🚀 Starlight Cruiser',
    shortTitle: 'Starlight Cruiser',
    icon: '🚀',
    archetype: 'spaceship',
    steps: [
      { shape: 'ThrusterFlightCore', colorHex: '#c084fc', studX: 5, studZ: 4, layerY: 0, rotY: 0, hint: 'Place the 🚀 Thruster Flight Core on the launch pad' },
      { shape: 'WingPair', colorHex: '#fffdf9', studX: 4, studZ: 5, layerY: 1, rotY: 0, hint: 'Lock the Pearl White Swept Wing Pair across the hull' },
      { shape: '2x4', colorHex: '#f472b6', studX: 5, studZ: 4, layerY: 2, rotY: 0, hint: 'Build the Blush Rose starship upper fuselage' },
      { shape: 'Slope2x2', colorHex: '#38bdf8', studX: 5, studZ: 3, layerY: 2, rotY: 0, hint: 'Fit the Starlight Sapphire crystal nosecone' },
      { shape: 'Tile2x2YH', colorHex: '#f59e0b', studX: 5, studZ: 5, layerY: 3, rotY: 0, hint: 'Inscribe the hull with the "Y ❤️ H" Royal Crest Tile' },
      { shape: 'MiniCrown', colorHex: '#f59e0b', studX: 5, studZ: 6, layerY: 3, rotY: 0, hint: 'Complete the cruiser with the Royal dorsal crown fin!' },
    ],
  },
  {
    id: 'cottage',
    title: '🏠 Petite Love Cottage',
    shortTitle: 'Love Cottage',
    icon: '🏠',
    archetype: 'structure',
    steps: [
      { shape: '2x4', colorHex: '#fffdf9', studX: 4, studZ: 5, layerY: 0, rotY: 1, hint: 'Lay the Pearl White cottage foundation terrace' },
      { shape: '2x2', colorHex: '#fda4af', studX: 4, studZ: 5, layerY: 1, rotY: 0, hint: 'Raise the West blush-marble cottage pillar' },
      { shape: '2x2', colorHex: '#fda4af', studX: 6, studZ: 5, layerY: 1, rotY: 0, hint: 'Raise the East blush-marble cottage pillar' },
      { shape: 'Arch1x4', colorHex: '#f59e0b', studX: 4, studZ: 5, layerY: 2, rotY: 1, hint: 'Span the doorway with the 1×4 Royal Arch' },
      { shape: 'Slope2x2', colorHex: '#e11d48', studX: 4, studZ: 5, layerY: 3, rotY: 1, hint: 'Place the West Valentine Ruby pitched roof slope' },
      { shape: 'Slope2x2', colorHex: '#e11d48', studX: 6, studZ: 5, layerY: 3, rotY: 3, hint: 'Place the East Valentine Ruby pitched roof slope' },
      { shape: 'Tile2x2YH', colorHex: '#f59e0b', studX: 5, studZ: 5, layerY: 4, rotY: 0, hint: 'Crown the gable with the "Y ❤️ H" Crest Tile' },
      { shape: 'BotanicalRose', colorHex: '#e11d48', studX: 5, studZ: 4, layerY: 1, rotY: 0, hint: 'Plant a blooming LEGO Rose at the cottage threshold!' },
    ],
  },
];

// Module-scope scratch objects (Strictly Zero Per-Frame Allocations)
const _scratchVecA = new THREE.Vector3();
const _scratchVecB = new THREE.Vector3();
const _scratchVecC = new THREE.Vector3();
const _scratchRaycaster = new THREE.Raycaster();
const _scratchNdc = new THREE.Vector2();
const _scratchPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _scratchHitPoint = new THREE.Vector3();
const _scratchIntersects: THREE.Intersection[] = [];

export interface LegoAvatarBridge {
  setActivityPose: (pose: AvatarActivityPose) => void;
  resetNeutralPose?: () => void;
}

export interface LegoWorkshopUiState {
  mode: LegoWorkshopMode;
  isChoosingBlueprint: boolean;
  activeGuideIndex: number; // 0..4 = Guidebook Blueprints, 5 = Free Build
  activeGuideStep: number;
  totalGuideSteps: number;
  activeBlueprintTitle: string;
  activeStepHint: string;
  requiredBrickLabel: string;
  heldBrickLabel: string;
  heldColorName: string;
  heldColorHex: string;
  placedBricksCount: number;
  cursorStudX: number;
  cursorStudZ: number;
  heldRotY: number;
  targetStudX: number | null;
  targetStudZ: number | null;
  targetRotY: number | null;
  isPositionMatched: boolean;
  isRotationMatched: boolean;
  cameraYawDeg: number;
  isAutoOrbit360: boolean;
}

export interface CastleLegoWorkshopBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  getMode: () => LegoWorkshopMode;
  isActive: () => boolean;
  setAvatarBridge: (bridge: LegoAvatarBridge | null) => void;
  selectBlueprint: (index: number) => void;
  openBlueprintSelector: () => void;
  getUiState: () => LegoWorkshopUiState | null;
  getProximityPrompt: (playerWorldPos: THREE.Vector3) => CastleProximityPrompt | null;
  interact: (playerWorldPos: THREE.Vector3) => boolean;
  handleKeyAction: (key: string, playerWorldPos?: THREE.Vector3) => boolean;
  handlePointerMove: (ndcX: number, ndcY: number, camera: THREE.Camera) => void;
  handlePointerDown: (ndcX: number, ndcY: number, button: number, camera: THREE.Camera) => boolean;
  applyLookDelta: (yawDelta: number, pitchDelta: number) => void;
  applyZoomDelta: (zoomDelta: number) => void;
  resetCameraView: () => void;
  toggleAutoOrbit360: () => void;
  getCameraState: () => {
    active: boolean;
    mode: LegoWorkshopMode;
    camWorldPos: THREE.Vector3;
    lookWorldPos: THREE.Vector3;
    fov?: number;
    seatWorldPos?: THREE.Vector3;
    seatYaw?: number;
    isSitting?: boolean;
  };
  getActiveCaption: () => string | null;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
    inputKeys?: ReadonlySet<string>,
  ) => void;
  dispose: () => void;
}

export function createCastleLegoWorkshop(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
  y0: number,
): CastleLegoWorkshopBundle {
  const group = new THREE.Group();
  group.name = 'CastleFloor2LegoWorkshop';

  const colliders: CircleCollider[] = [];
  let avatarBridge: LegoAvatarBridge | null = null;

  const toWorld = (lx: number, ly: number, lz: number, target = new THREE.Vector3()) =>
    target.set(originX + lx, baseY + ly, originZ + lz);

  // ============================================================================
  // 1. SHARED GEOMETRY POOL (Pre-built canonical BufferGeometries for all shapes)
  // ============================================================================
  const shapeGeoPool = new Map<LegoBrickShapeId, THREE.BufferGeometry>();

  const buildCanonicalBrickGeo = (shape: LegoBrickShapeId): THREE.BufferGeometry => {
    const existing = shapeGeoPool.get(shape);
    if (existing) return existing;

    const meta = BRICK_SHAPE_META[shape];
    const parts: THREE.BufferGeometry[] = [];
    const bw = meta.w * STUD_UNIT - 0.003;
    const bd = meta.d * STUD_UNIT - 0.003;
    const bh = meta.h * LAYER_HEIGHT;

    const addBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, z);
      parts.push(g);
    };
    const addCyl = (
      rt: number,
      rb: number,
      h: number,
      seg: number,
      x: number,
      y: number,
      z: number,
      rotZ = 0,
    ) => {
      const g = new THREE.CylinderGeometry(rt, rb, h, seg);
      if (rotZ !== 0) g.rotateZ(rotZ);
      g.translate(x, y, z);
      parts.push(g);
    };
    const addTopStuds = (wStuds: number, dStuds: number, topY: number) => {
      for (let sx = 0; sx < wStuds; sx++) {
        for (let sz = 0; sz < dStuds; sz++) {
          const px = (sx - (wStuds - 1) * 0.5) * STUD_UNIT;
          const pz = (sz - (dStuds - 1) * 0.5) * STUD_UNIT;
          addCyl(0.022, 0.022, 0.015, 10, px, topY + 0.0075, pz);
        }
      }
    };

    if (shape === '1x1' || shape === '1x2' || shape === '2x2' || shape === '2x4') {
      addBox(bw, bh, bd, 0, bh * 0.5, 0);
      addTopStuds(meta.w, meta.d, bh);
    } else if (shape === 'Round1x1') {
      addCyl(bw * 0.48, bw * 0.48, bh, 14, 0, bh * 0.5, 0);
      addTopStuds(1, 1, bh);
    } else if (shape === 'Slope2x2') {
      // Rear half has full height + 1x2 studs; front half slopes down toward -Z
      addBox(bw, bh, bd * 0.48, 0, bh * 0.5, bd * 0.25);
      const wedge = new THREE.BoxGeometry(bw, bh * 0.52, bd * 0.58);
      wedge.rotateX(0.52);
      wedge.translate(0, bh * 0.36, -bd * 0.18);
      parts.push(wedge);
      for (let sx = 0; sx < 2; sx++) {
        const px = (sx - 0.5) * STUD_UNIT;
        addCyl(0.022, 0.022, 0.015, 10, px, bh + 0.0075, STUD_UNIT * 0.5);
      }
    } else if (shape === 'Arch1x4') {
      // Two side pillars + top lintel bar + 4 studs
      addBox(bw, bh * 0.36, bd, 0, bh * 0.82, 0);
      addBox(bw, bh * 0.64, STUD_UNIT * 0.88, 0, bh * 0.32, -STUD_UNIT * 1.5);
      addBox(bw, bh * 0.64, STUD_UNIT * 0.88, 0, bh * 0.32, STUD_UNIT * 1.5);
      addTopStuds(1, 4, bh);
    } else if (shape === 'HeartStud1x1') {
      addCyl(0.032, 0.035, bh * 0.45, 12, 0, bh * 0.225, 0);
      const lobeL = new THREE.SphereGeometry(0.022, 10, 10);
      lobeL.translate(-0.012, bh * 0.72, 0);
      const lobeR = new THREE.SphereGeometry(0.022, 10, 10);
      lobeR.translate(0.012, bh * 0.72, 0);
      const cone = new THREE.ConeGeometry(0.03, 0.038, 10);
      cone.rotateX(Math.PI);
      cone.translate(0, bh * 0.5, 0);
      parts.push(lobeL, lobeR, cone);
    } else if (shape === 'MiniCrown') {
      addCyl(bw * 0.42, bw * 0.36, bh * 0.45, 14, 0, bh * 0.225, 0);
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI * 2) / 6;
        const spire = new THREE.ConeGeometry(0.014, bh * 0.58, 6);
        spire.translate(Math.cos(ang) * bw * 0.32, bh * 0.72, Math.sin(ang) * bw * 0.32);
        parts.push(spire);
      }
    } else if (shape === 'BotanicalRose') {
      addCyl(0.012, 0.016, bh * 0.55, 8, 0, bh * 0.275, 0);
      const bloom = new THREE.DodecahedronGeometry(0.032, 1);
      bloom.translate(0, bh * 0.76, 0);
      parts.push(bloom);
    } else if (shape === 'Tile2x2YH') {
      // Smooth flat royal crest tile with raised bevel rim
      addBox(bw, bh * 0.45, bd, 0, bh * 0.225, 0);
      addBox(bw * 0.86, bh * 0.14, bd * 0.86, 0, bh * 0.5, 0);
    } else if (shape === 'WheelAxle') {
      addBox(bw * 0.72, bh * 0.65, bd * 0.72, 0, bh * 0.45, 0);
      addCyl(0.032, 0.032, 0.022, 12, -bw * 0.52, 0.032, 0, Math.PI / 2);
      addCyl(0.032, 0.032, 0.022, 12, bw * 0.52, 0.032, 0, Math.PI / 2);
      addTopStuds(2, 2, bh * 0.78);
    } else if (shape === 'WingPair') {
      addBox(bw, bh * 0.45, bd * 0.75, 0, bh * 0.25, 0);
      addBox(STUD_UNIT * 2 - 0.003, bh * 0.55, bd, 0, bh * 0.5, 0);
      addTopStuds(2, 2, bh);
    } else if (shape === 'WheelChassisCore') {
      addBox(bw, bh * 0.65, bd, 0, bh * 0.55, 0);
      for (const zOff of [-STUD_UNIT * 1.1, STUD_UNIT * 1.1]) {
        addCyl(0.033, 0.033, 0.022, 12, -bw * 0.54, 0.033, zOff, Math.PI / 2);
        addCyl(0.033, 0.033, 0.022, 12, bw * 0.54, 0.033, zOff, Math.PI / 2);
      }
      addTopStuds(2, 4, bh * 0.88);
    } else if (shape === 'CreatureHopperCore') {
      addBox(bw * 0.85, bh * 0.7, bd * 0.85, 0, bh * 0.55, 0);
      // Cute articulated paw feet on left & right
      for (const zOff of [-STUD_UNIT * 0.75, STUD_UNIT * 0.75]) {
        addBox(0.036, 0.026, 0.052, -bw * 0.36, 0.014, zOff);
        addBox(0.036, 0.026, 0.052, bw * 0.36, 0.014, zOff);
      }
      addTopStuds(2, 3, bh * 0.9);
    } else if (shape === 'BipedRobotCore') {
      addBox(bw, bh * 0.42, bd, 0, bh * 0.79, 0);
      addBox(0.052, bh * 0.58, 0.075, -STUD_UNIT * 0.48, bh * 0.29, 0);
      addBox(0.052, bh * 0.58, 0.075, STUD_UNIT * 0.48, bh * 0.29, 0);
      addTopStuds(2, 2, bh);
    } else if (shape === 'ThrusterFlightCore') {
      addBox(bw, bh * 0.72, bd, 0, bh * 0.52, 0);
      // Twin rear thruster nozzles at +Z
      addCyl(0.022, 0.03, 0.038, 10, -STUD_UNIT * 0.45, bh * 0.45, bd * 0.54);
      addCyl(0.022, 0.03, 0.038, 10, STUD_UNIT * 0.45, bh * 0.45, bd * 0.54);
      addTopStuds(2, 4, bh * 0.88);
    }

    const normalizedParts = parts.map((p) => {
      const nonIndexed = p.index ? p.toNonIndexed() : p.clone();
      nonIndexed.deleteAttribute('uv');
      nonIndexed.deleteAttribute('uv2');
      if (!nonIndexed.getAttribute('normal')) {
        nonIndexed.computeVertexNormals();
      }
      p.dispose();
      return nonIndexed;
    });

    const mergedRaw = BufferGeometryUtils.mergeGeometries(normalizedParts, false);
    normalizedParts.forEach((p) => p.dispose());
    const merged = tracker.trackGeo(mergedRaw ?? new THREE.BoxGeometry(bw, bh, bd));
    merged.computeVertexNormals();
    shapeGeoPool.set(shape, merged);
    return merged;
  };

  // Pre-warm all 17 canonical brick geometries at startup
  (Object.keys(BRICK_SHAPE_META) as LegoBrickShapeId[]).forEach((s) => buildCanonicalBrickGeo(s));

  // Shared plastic & crystal material cache by colorHex
  const brickMatCache = new Map<string, THREE.MeshPhysicalMaterial>();
  const getBrickMaterial = (hex: string): THREE.MeshPhysicalMaterial => {
    let mat = brickMatCache.get(hex);
    if (!mat) {
      const isGold = hex.toLowerCase() === '#f59e0b';
      const isGem = hex.toLowerCase() === '#e11d48' || hex.toLowerCase() === '#38bdf8';
      mat = tracker.trackMat(
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(hex),
          emissive: new THREE.Color(hex),
          emissiveIntensity: isGem ? 0.22 : 0.06,
          roughness: isGold ? 0.22 : 0.26,
          metalness: isGold ? 0.72 : 0.06,
          clearcoat: 0.65,
          clearcoatRoughness: 0.18,
        }),
      );
      brickMatCache.set(hex, mat);
    }
    return mat;
  };

  // Vertex-colored shared material for 1-draw-call batched creations on Activation Platform & Showcase
  const batchedCreationMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.25,
      metalness: 0.14,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }),
  );

  // Helper: Merge an array of bricks into a single vertex-colored Mesh (1 draw call!)
  const buildBatchedCreationGroup = (
    bricks: ReadonlyArray<{
      shape: LegoBrickShapeId;
      colorHex: string;
      studX: number;
      studZ: number;
      layerY: number;
      rotY: number;
    }>,
    archetype: LegoCreationArchetype,
  ): {
    root: THREE.Group;
    headlightMat: THREE.MeshStandardMaterial;
    turntableGroup: THREE.Group;
  } => {
    const root = new THREE.Group();
    const turntableGroup = new THREE.Group();
    root.add(turntableGroup);

    const coloredClones: THREE.BufferGeometry[] = [];
    const tmpColor = new THREE.Color();

    // Compute centroid so creation is centered on (0, 0, 0) at base Y = 0
    let sumX = 0;
    let sumZ = 0;
    let minLayerY = 99;
    let maxLayerY = 0;

    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      const meta = BRICK_SHAPE_META[b.shape];
      const spanX = b.rotY % 2 === 0 ? meta.w : meta.d;
      const spanZ = b.rotY % 2 === 0 ? meta.d : meta.w;
      const cx = (b.studX + spanX * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
      const cz = (b.studZ + spanZ * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
      sumX += cx;
      sumZ += cz;
      if (b.layerY < minLayerY) minLayerY = b.layerY;
      if (b.layerY + meta.h > maxLayerY) maxLayerY = b.layerY + meta.h;
    }
    const count = Math.max(1, bricks.length);
    const centerX = sumX / count;
    const centerZ = sumZ / count;
    const baseLayerOffset = minLayerY < 99 ? minLayerY : 0;

    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      const meta = BRICK_SHAPE_META[b.shape];
      const spanX = b.rotY % 2 === 0 ? meta.w : meta.d;
      const spanZ = b.rotY % 2 === 0 ? meta.d : meta.w;
      const lx = (b.studX + spanX * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT - centerX;
      const lz = (b.studZ + spanZ * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT - centerZ;
      const ly = (b.layerY - baseLayerOffset) * LAYER_HEIGHT;

      const template = buildCanonicalBrickGeo(b.shape);
      const clone = template.clone();
      clone.rotateY((-b.rotY * Math.PI) / 2);
      clone.translate(lx, ly, lz);

      const vCount = clone.attributes.position.count;
      const colorArr = new Float32Array(vCount * 3);
      tmpColor.set(b.colorHex);
      for (let v = 0; v < vCount; v++) {
        colorArr[v * 3] = tmpColor.r;
        colorArr[v * 3 + 1] = tmpColor.g;
        colorArr[v * 3 + 2] = tmpColor.b;
      }
      clone.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
      coloredClones.push(clone);
    }

    if (coloredClones.length > 0) {
      const mergedGeo = tracker.trackGeo(
        BufferGeometryUtils.mergeGeometries(coloredClones, false),
      );
      coloredClones.forEach((c) => c.dispose());
      const mergedMesh = new THREE.Mesh(mergedGeo, batchedCreationMat);
      mergedMesh.castShadow = true;
      mergedMesh.receiveShadow = true;
      turntableGroup.add(mergedMesh);
    }

    // Add glowing headlights / eyes / thruster / window accents (1 tiny accent mesh)
    const headlightMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fef08a'),
        emissive: new THREE.Color('#f43f5e'),
        emissiveIntensity: 0.95,
        roughness: 0.15,
      }),
    );
    const eyeGeo = buildCanonicalBrickGeo('HeartStud1x1');
    const accentL = new THREE.Mesh(eyeGeo, headlightMat);
    const accentR = new THREE.Mesh(eyeGeo, headlightMat);
    const topH = Math.max(1, maxLayerY - baseLayerOffset) * LAYER_HEIGHT;
    accentL.scale.setScalar(0.42);
    accentR.scale.setScalar(0.42);
    if (archetype === 'car' || archetype === 'spaceship') {
      accentL.position.set(-0.045, LAYER_HEIGHT * 0.8, -0.13);
      accentR.position.set(0.045, LAYER_HEIGHT * 0.8, -0.13);
    } else {
      accentL.position.set(-0.036, topH * 0.72, -0.065);
      accentR.position.set(0.036, topH * 0.72, -0.065);
    }
    turntableGroup.add(accentL, accentR);

    return { root, headlightMat, turntableGroup };
  };

  // ============================================================================
  // 2. SPATIAL LAYOUT: 5 PHYSICAL ZONES IN PLAYFUL BRICK DISTRICT PLAZA (-80, +5)
  // ============================================================================
  const TABLE_LX = 0.0;
  const TABLE_LZ = 1.25;
  const TABLE_TOP_Y = y0 + 0.78;
  const BUILDER_STAND_LX = 0.0;
  const BUILDER_STAND_LZ = 0.02;

  const LECTERN_LX = 0.96;
  const LECTERN_LZ = 0.62;

  const PLATFORM_LX = 3.15;
  const PLATFORM_LZ = 1.65;
  const PLATFORM_RADIUS = 0.92;

  // --- ZONE 0: OPEN-AIR PLAYFUL BRICK WORKSHOP PAVILION PLINTH & WELCOME ARCH ---
  const pavilionGroup = new THREE.Group();
  pavilionGroup.name = 'PlayfulBrickPavilion';

  // Flush Studded Brick Plaza Terrace (11.6m x 9.6m centered around (0.4, y0, 1.4))
  const plazaFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(11.6, 0.03, 9.6));
  plazaFloorGeo.translate(0.4, y0 + 0.015, 1.4);
  const plazaRimGeo = tracker.trackGeo(new THREE.BoxGeometry(11.88, 0.024, 9.88));
  plazaRimGeo.translate(0.4, y0 + 0.012, 1.4);
  const plazaFloorMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fff1f5'),
      roughness: 0.35,
      metalness: 0.06,
    }),
  );
  const plazaFloorMesh = new THREE.Mesh(plazaFloorGeo, plazaFloorMat);
  plazaFloorMesh.receiveShadow = true;
  const plazaRimMesh = new THREE.Mesh(plazaRimGeo, mats.champagneGold);
  plazaRimMesh.receiveShadow = true;
  pavilionGroup.add(plazaRimMesh, plazaFloorMesh);

  // 4 Colorful LEGO Brick Corner Columns framing the Open-Air Workshop Courtyard
  const pillarGeo = tracker.trackGeo(new THREE.BoxGeometry(0.56, 3.4, 0.56));
  pillarGeo.translate(0, 1.7, 0);
  const pillarCapGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12));
  pillarCapGeo.translate(0, 3.48, 0);
  const cornerSpecs: Array<{ x: number; z: number; hex: string }> = [
    { x: -5.1, z: -3.1, hex: '#f472b6' },
    { x: 5.9, z: -3.1, hex: '#38bdf8' },
    { x: -5.1, z: 5.8, hex: '#f59e0b' },
    { x: 5.9, z: 5.8, hex: '#c084fc' },
  ];
  cornerSpecs.forEach((cp) => {
    const colMat = getBrickMaterial(cp.hex);
    const pMesh = new THREE.Mesh(pillarGeo, colMat);
    pMesh.position.set(cp.x, y0, cp.z);
    pMesh.castShadow = true;
    const cMesh = new THREE.Mesh(pillarCapGeo, mats.champagneGold);
    cMesh.position.set(cp.x, y0, cp.z);
    pavilionGroup.add(pMesh, cMesh);
    colliders.push({
      x: originX + cp.x,
      z: originZ + cp.z,
      radius: 0.42,
      y: baseY + y0,
      height: 3.6,
    });
  });

  // Overhead Welcome Header Beam & Signboard on the North Showcase Backdrop (lz = 5.8)
  const headerBeamGeo = tracker.trackGeo(new THREE.BoxGeometry(11.4, 0.42, 0.36));
  headerBeamGeo.translate(0.4, y0 + 3.25, 5.8);
  pavilionGroup.add(new THREE.Mesh(headerBeamGeo, mats.champagneGold));

  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 1024;
  bannerCanvas.height = 144;
  const bCtx = bannerCanvas.getContext('2d');
  if (bCtx) {
    bCtx.fillStyle = '#701a35'; // Deep royal rosewood / burgundy
    bCtx.fillRect(0, 0, 1024, 144);
    // Outer golden filigree rim
    bCtx.strokeStyle = '#f59e0b';
    bCtx.lineWidth = 6;
    bCtx.strokeRect(8, 8, 1008, 128);
    // Inner delicate gold accent line
    bCtx.strokeStyle = '#fde047';
    bCtx.lineWidth = 2.5;
    bCtx.strokeRect(16, 16, 992, 112);

    // Decorative corner diamonds
    const drawDiamond = (cx: number, cy: number, r: number) => {
      bCtx.beginPath();
      bCtx.moveTo(cx, cy - r);
      bCtx.lineTo(cx + r, cy);
      bCtx.lineTo(cx, cy + r);
      bCtx.lineTo(cx - r, cy);
      bCtx.closePath();
      bCtx.fillStyle = '#fde047';
      bCtx.fill();
    };
    drawDiamond(32, 32, 6);
    drawDiamond(992, 32, 6);
    drawDiamond(32, 112, 6);
    drawDiamond(992, 112, 6);

    // Drop shadow for crisp readability
    bCtx.font = 'bold 30px Georgia, serif';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    bCtx.fillText('🧱 PLAYFUL BRICK WORKSHOP • YESHWANTH & HARSHA', 513, 73);
    bCtx.fillStyle = '#fef08a';
    bCtx.fillText('🧱 PLAYFUL BRICK WORKSHOP • YESHWANTH & HARSHA', 512, 72);
  }
  const bannerTex = tracker.trackTex(new THREE.CanvasTexture(bannerCanvas));
  bannerTex.colorSpace = THREE.SRGBColorSpace;

  // Sturdy Architectural Signboard Assembly (7.8m wide x 0.62m tall x 0.44m deep)
  // Framing the header beam with gold collar, maroon backing, and zero awkward clipping!
  const signCollarGeo = tracker.trackGeo(new THREE.BoxGeometry(8.0, 0.62, 0.44));
  const signCollarMesh = new THREE.Mesh(signCollarGeo, mats.champagneGold);
  signCollarMesh.position.set(0.4, y0 + 3.25, 5.8);
  signCollarMesh.castShadow = true;

  const signPlaqueGeo = tracker.trackGeo(new THREE.BoxGeometry(7.76, 0.52, 0.48));
  const signPlaqueMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#701a35'),
      roughness: 0.38,
      metalness: 0.15,
    }),
  );
  const signPlaqueMesh = new THREE.Mesh(signPlaqueGeo, signPlaqueMat);
  signPlaqueMesh.position.set(0.4, y0 + 3.25, 5.8);

  const bannerPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(7.68, 0.48));
  const bannerMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.45,
      metalness: 0.12,
      side: THREE.DoubleSide,
    }),
  );

  // Front Decal facing South toward the courtyard (-Z)
  const bannerMeshSouth = new THREE.Mesh(bannerPlaneGeo, bannerMat);
  bannerMeshSouth.position.set(0.4, y0 + 3.25, 5.555);
  bannerMeshSouth.rotation.y = Math.PI;

  // Back Decal facing North (+Z)
  const bannerMeshNorth = new THREE.Mesh(bannerPlaneGeo, bannerMat);
  bannerMeshNorth.position.set(0.4, y0 + 3.25, 6.045);

  // Twin Gold End Brackets (left & right)
  const bracketGeo = tracker.trackGeo(new THREE.BoxGeometry(0.24, 0.72, 0.5));
  const bracketL = new THREE.Mesh(bracketGeo, mats.champagneGold);
  bracketL.position.set(0.4 - 3.94, y0 + 3.25, 5.8);
  const bracketR = new THREE.Mesh(bracketGeo, mats.champagneGold);
  bracketR.position.set(0.4 + 3.94, y0 + 3.25, 5.8);

  pavilionGroup.add(
    signCollarMesh,
    signPlaqueMesh,
    bannerMeshSouth,
    bannerMeshNorth,
    bracketL,
    bracketR,
  );

  group.add(pavilionGroup);

  // --- ZONE 1: MASTER BUILD TABLE & 12x12 STUD MAT ---
  const buildTableGroup = new THREE.Group();
  buildTableGroup.position.set(TABLE_LX, y0, TABLE_LZ);

  const tableTopGeo = tracker.trackGeo(new THREE.BoxGeometry(1.56, 0.08, 1.32));
  tableTopGeo.translate(0, 0.74, 0);
  const tableRimGeo = tracker.trackGeo(new THREE.BoxGeometry(1.62, 0.045, 1.38));
  tableRimGeo.translate(0, 0.77, 0);
  const tableLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.042, 0.72, 10));
  tableLegGeo.translate(0, 0.36, 0);

  const tableTopMesh = new THREE.Mesh(tableTopGeo, mats.pearlWhite);
  tableTopMesh.castShadow = true;
  tableTopMesh.receiveShadow = true;
  const tableRimMesh = new THREE.Mesh(tableRimGeo, mats.champagneGold);
  buildTableGroup.add(tableTopMesh, tableRimMesh);

  for (const lxOff of [-0.68, 0.68]) {
    for (const lzOff of [-0.56, 0.56]) {
      const leg = new THREE.Mesh(tableLegGeo, mats.champagneGold);
      leg.position.set(lxOff, 0, lzOff);
      buildTableGroup.add(leg);
    }
  }

  // 12x12 Studded Baseplate Mat (0.96m x 0.96m) centered on the table at (0, 0.78, 0.04)
  const MAT_LOCAL_Z = 0.04;
  const matBaseGeo = tracker.trackGeo(
    new THREE.BoxGeometry(GRID_SIZE * STUD_UNIT + 0.04, 0.018, GRID_SIZE * STUD_UNIT + 0.04),
  );
  const matBaseMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fff1f5'),
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 0.45,
    }),
  );
  const matBaseMesh = new THREE.Mesh(matBaseGeo, matBaseMat);
  matBaseMesh.position.set(0, 0.789, MAT_LOCAL_Z);
  matBaseMesh.receiveShadow = true;
  buildTableGroup.add(matBaseMesh);

  const MAT_SURFACE_Y = y0 + 0.798; // Exact top of the 12x12 stud mat in castle local coordinates

  // 144 Baseplate Studs in a single InstancedMesh (1 draw call!)
  const baseStudGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.021, 0.021, 0.012, 10));
  baseStudGeo.translate(0, 0.006, 0);
  const baseStudMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      roughness: 0.28,
      metalness: 0.25,
    }),
  );
  const baseStudInst = new THREE.InstancedMesh(baseStudGeo, baseStudMat, GRID_SIZE * GRID_SIZE);
  const studDummy = new THREE.Object3D();
  let sIdx = 0;
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const px = (gx + 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
      const pz = MAT_LOCAL_Z + (gz + 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
      studDummy.position.set(px, 0.798, pz);
      studDummy.updateMatrix();
      baseStudInst.setMatrixAt(sIdx++, studDummy.matrix);
    }
  }
  baseStudInst.instanceMatrix.needsUpdate = true;
  buildTableGroup.add(baseStudInst);

  // --- ZONE 2: SURROUNDING PHYSICAL BRICK SORTING TRAYS (8 Compartments) ---
  interface SortingTraySlot {
    index: number;
    label: string;
    shapes: LegoBrickShapeId[];
    lx: number;
    lz: number;
    rimMat: THREE.MeshStandardMaterial;
    hitMesh: THREE.Mesh;
  }
  const sortingTrays: SortingTraySlot[] = [];
  const trayHitMeshes: THREE.Mesh[] = [];

  const trayDefs: Array<{
    label: string;
    shapes: LegoBrickShapeId[];
    lx: number;
    lz: number;
    sampleColor: string;
  }> = [
    { label: 'Classic Bricks', shapes: ['2x4', '2x2', '1x2', '1x1'], lx: -0.64, lz: -0.26, sampleColor: '#f472b6' },
    { label: 'Slopes & Arches', shapes: ['Slope2x2', 'Arch1x4', 'Round1x1'], lx: -0.64, lz: 0.06, sampleColor: '#fffdf9' },
    { label: 'Royal & Valentine', shapes: ['HeartStud1x1', 'MiniCrown', 'BotanicalRose', 'Tile2x2YH'], lx: -0.64, lz: 0.38, sampleColor: '#e11d48' },
    { label: '🛞 Wheel Core', shapes: ['WheelChassisCore', 'WheelAxle'], lx: -0.34, lz: -0.54, sampleColor: '#f59e0b' },
    { label: '🐾 Creature Core', shapes: ['CreatureHopperCore'], lx: -0.11, lz: -0.54, sampleColor: '#34d399' },
    { label: '🤖 Robot Core', shapes: ['BipedRobotCore'], lx: 0.12, lz: -0.54, sampleColor: '#38bdf8' },
    { label: '🚀 Flight Core', shapes: ['ThrusterFlightCore', 'WingPair'], lx: 0.35, lz: -0.54, sampleColor: '#c084fc' },
    { label: '🎨 Color Palette', shapes: ['2x2'], lx: 0.64, lz: 0.12, sampleColor: '#fda4af' },
  ];

  const trayBoxGeo = tracker.trackGeo(new THREE.BoxGeometry(0.21, 0.036, 0.24));
  trayDefs.forEach((td, idx) => {
    const rimMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fde047'),
        emissive: new THREE.Color('#f59e0b'),
        emissiveIntensity: 0.18,
        roughness: 0.22,
        metalness: 0.72,
      }),
    );
    const trayMesh = new THREE.Mesh(trayBoxGeo, rimMat);
    trayMesh.position.set(td.lx, 0.795, td.lz);
    trayMesh.userData.trayIndex = idx;
    buildTableGroup.add(trayMesh);
    trayHitMeshes.push(trayMesh);

    // Physical sample brick sitting inside the sorting tray compartment
    const sampleGeo = buildCanonicalBrickGeo(td.shapes[0]);
    const sampleMesh = new THREE.Mesh(sampleGeo, getBrickMaterial(td.sampleColor));
    sampleMesh.scale.setScalar(0.62);
    sampleMesh.position.set(td.lx, 0.815, td.lz);
    sampleMesh.rotation.y = 0.35;
    buildTableGroup.add(sampleMesh);

    sortingTrays.push({
      index: idx,
      label: td.label,
      shapes: td.shapes,
      lx: td.lx,
      lz: td.lz,
      rimMat,
      hitMesh: trayMesh,
    });
  });

  group.add(buildTableGroup);
  colliders.push({
    x: originX + TABLE_LX,
    z: originZ + TABLE_LZ,
    radius: 0.82,
    y: baseY + y0,
    height: 1.2,
  });

  // --- ZONE 3: PHYSICAL 3D LEGO GUIDEBOOK STAND (Right of Build Table) ---
  const guidebookStandGroup = new THREE.Group();
  guidebookStandGroup.position.set(LECTERN_LX, y0, LECTERN_LZ);
  guidebookStandGroup.rotation.y = -0.42;

  const lecternPedestalGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.06, 0.16, 0.92, 12));
  lecternPedestalGeo.translate(0, 0.46, 0);
  const lecternDeskGeo = tracker.trackGeo(new THREE.BoxGeometry(0.52, 0.035, 0.38));
  const lecternPedestal = new THREE.Mesh(lecternPedestalGeo, mats.champagneGold);
  const lecternDesk = new THREE.Mesh(lecternDeskGeo, mats.champagneGold);
  lecternDesk.position.set(0, 0.94, 0);
  lecternDesk.rotation.x = 0.48;
  guidebookStandGroup.add(lecternPedestal, lecternDesk);

  // Dynamic 3D Illustrated Guidebook Canvas Page Texture (512x384)
  const guideCanvas = document.createElement('canvas');
  guideCanvas.width = 512;
  guideCanvas.height = 384;
  const guideCtx = guideCanvas.getContext('2d');
  const guideTex = tracker.trackTex(new THREE.CanvasTexture(guideCanvas));
  guideTex.colorSpace = THREE.SRGBColorSpace;

  const bookPageGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.46, 0.32));
  bookPageGeo.rotateX(-Math.PI / 2);
  const bookPageMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: guideTex,
      side: THREE.DoubleSide,
    }),
  );
  const bookPageMesh = new THREE.Mesh(bookPageGeo, bookPageMat);
  bookPageMesh.position.set(0, 0.965, 0.01);
  bookPageMesh.rotation.x = 0.48;
  guidebookStandGroup.add(bookPageMesh);

  // Animated flipping page leaf
  const flipLeafGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.22, 0.31));
  flipLeafGeo.translate(0.11, 0, 0);
  flipLeafGeo.rotateX(-Math.PI / 2);
  const flipLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffdf9'),
      roughness: 0.4,
      side: THREE.DoubleSide,
    }),
  );
  const pageFlipGroup = new THREE.Group();
  pageFlipGroup.position.set(0, 0.97, 0.01);
  pageFlipGroup.rotation.x = 0.48;
  const flipLeafMesh = new THREE.Mesh(flipLeafGeo, flipLeafMat);
  pageFlipGroup.add(flipLeafMesh);
  pageFlipGroup.visible = false;
  guidebookStandGroup.add(pageFlipGroup);

  group.add(guidebookStandGroup);

  // --- ZONE 4: "BRING TO LIFE" ACTIVATION PLATFORM & MINIATURE TOY TEST TRACK ---
  const activationPlatformGroup = new THREE.Group();
  activationPlatformGroup.position.set(PLATFORM_LX, y0, PLATFORM_LZ);

  const padBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(PLATFORM_RADIUS, PLATFORM_RADIUS + 0.08, 0.08, 28),
  );
  padBaseGeo.translate(0, 0.04, 0);
  const padCrystalGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(PLATFORM_RADIUS * 0.84, PLATFORM_RADIUS * 0.84, 0.025, 28),
  );
  padCrystalGeo.translate(0, 0.085, 0);
  const padRuneRingGeo = tracker.trackGeo(
    new THREE.TorusGeometry(PLATFORM_RADIUS * 0.72, 0.018, 8, 32),
  );
  padRuneRingGeo.rotateX(Math.PI / 2);

  const padCrystalMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.25,
    }),
  );
  const padBaseMesh = new THREE.Mesh(padBaseGeo, mats.champagneGold);
  const padCrystalMesh = new THREE.Mesh(padCrystalGeo, padCrystalMat);
  const padRuneRingMesh = new THREE.Mesh(padRuneRingGeo, mats.warmLanternGlow);
  padRuneRingMesh.position.y = 0.102;
  activationPlatformGroup.add(padBaseMesh, padCrystalMesh, padRuneRingMesh);

  // Rising Golden-Pink Awakening Stardust Ring (sweeps upward during 1.4s Bring to Life)
  const awakeningRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.42, 0.024, 10, 28));
  awakeningRingGeo.rotateX(Math.PI / 2);
  const awakeningRingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    }),
  );
  const awakeningRingMesh = new THREE.Mesh(awakeningRingGeo, awakeningRingMat);
  awakeningRingMesh.visible = false;
  activationPlatformGroup.add(awakeningRingMesh);

  // Miniature Toy-Scale Test Track Elements around the Activation Platform:
  // 1) Pastel & Gold Miniature Ruler-Ramp (Jump Ramp at local z = -1.05)
  const rampGeo = tracker.trackGeo(new THREE.BoxGeometry(0.46, 0.03, 0.56));
  const rampMesh = new THREE.Mesh(rampGeo, mats.champagneGold);
  rampMesh.position.set(0, 0.08, -1.08);
  rampMesh.rotation.x = 0.26;
  activationPlatformGroup.add(rampMesh);

  // 2) Stacked-Storybook Tunnel Arch (at local x = -0.88, z = 0)
  const tunnelPillarGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.36, 0.38));
  tunnelPillarGeo.translate(0, 0.18, 0);
  const tunnelRoofGeo = tracker.trackGeo(new THREE.BoxGeometry(0.56, 0.06, 0.42));
  tunnelRoofGeo.translate(0, 0.39, 0);
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(-0.92, 0, 0);
  const tunL = new THREE.Mesh(tunnelPillarGeo, getBrickMaterial('#f472b6'));
  tunL.position.x = -0.2;
  const tunR = new THREE.Mesh(tunnelPillarGeo, getBrickMaterial('#38bdf8'));
  tunR.position.x = 0.2;
  const tunTop = new THREE.Mesh(tunnelRoofGeo, mats.champagneGold);
  tunnelGroup.add(tunL, tunR, tunTop);
  activationPlatformGroup.add(tunnelGroup);

  // 3) 6 Interactive Wobble LEGO Flowers around the Test Track
  const wobbleFlowers: Array<{ group: THREE.Group; lx: number; lz: number; wobbleVel: number; wobbleAngle: number }> = [];
  const flowerOffsets = [
    { dx: -0.65, dz: -0.85, color: '#f472b6' },
    { dx: 0.65, dz: -0.85, color: '#e11d48' },
    { dx: 0.78, dz: 0.15, color: '#c084fc' },
    { dx: 0.58, dz: 0.88, color: '#38bdf8' },
    { dx: -0.58, dz: 0.88, color: '#34d399' },
    { dx: -1.15, dz: 0.65, color: '#f59e0b' },
  ];
  const wobbleRoseGeo = buildCanonicalBrickGeo('BotanicalRose');
  flowerOffsets.forEach((fo) => {
    const fg = new THREE.Group();
    fg.position.set(fo.dx, 0.02, fo.dz);
    const fm = new THREE.Mesh(wobbleRoseGeo, getBrickMaterial(fo.color));
    fm.scale.setScalar(1.85);
    fg.add(fm);
    activationPlatformGroup.add(fg);
    wobbleFlowers.push({
      group: fg,
      lx: PLATFORM_LX + fo.dx,
      lz: PLATFORM_LZ + fo.dz,
      wobbleVel: 0,
      wobbleAngle: 0,
    });
  });

  group.add(activationPlatformGroup);

  // --- ZONE 5: PERIMETER WALL LEGO SHOWCASE GALLERY ("🏛️ SHOWCASE" & "💗 OUR BUILDS") ---
  interface ShowcasePedestalSlot {
    index: number;
    isOurBuilds: boolean;
    lx: number;
    lz: number;
    pedestalGroup: THREE.Group;
    displayAnchor: THREE.Group;
    haloMat: THREE.MeshStandardMaterial;
    creation: LegoCreationRecord | null;
    mountedRoot: THREE.Group | null;
  }

  const showcasePedestals: ShowcasePedestalSlot[] = [];
  const pedestalColGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.86, 16));
  pedestalColGeo.translate(0, 0.43, 0);
  const pedestalCapGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.29, 0.25, 0.06, 16));
  pedestalCapGeo.translate(0, 0.88, 0);
  const pedestalHaloGeo = tracker.trackGeo(new THREE.TorusGeometry(0.26, 0.016, 8, 24));
  pedestalHaloGeo.rotateX(Math.PI / 2);
  pedestalHaloGeo.translate(0, 0.915, 0);

  const pedestalSpecs: Array<{ lx: number; lz: number; isOurBuilds: boolean; label: string }> = [
    { lx: -3.4, lz: 4.75, isOurBuilds: false, label: '🚗 Royal Roadster' },
    { lx: -1.8, lz: 4.75, isOurBuilds: false, label: '🦖 Cute Baby Dino' },
    { lx: -0.2, lz: 4.75, isOurBuilds: false, label: '🤖 Heart-Bot' },
    { lx: 1.4, lz: 4.75, isOurBuilds: false, label: '🚀 Starlight Cruiser' },
    { lx: 3.0, lz: 4.75, isOurBuilds: false, label: '🏠 Love Cottage' },
    { lx: 4.65, lz: 4.65, isOurBuilds: true, label: '💗 OUR BUILDS #1' },
    { lx: -4.25, lz: 2.15, isOurBuilds: true, label: '💗 OUR BUILDS #2' },
  ];

  const createPlaqueTexture = (title: string, isOurBuilds: boolean): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = isOurBuilds ? '#831843' : '#500724';
      ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, 248, 56);
      ctx.fillStyle = isOurBuilds ? '#fbcfe8' : '#fef08a';
      ctx.font = 'bold 21px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 128, 33);
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const plaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.48, 0.12));

  pedestalSpecs.forEach((ps, idx) => {
    const pg = new THREE.Group();
    pg.position.set(ps.lx, y0, ps.lz);
    if (idx === 6) {
      pg.rotation.y = Math.PI / 2;
    } else {
      pg.rotation.y = Math.PI;
    }

    const col = new THREE.Mesh(
      pedestalColGeo,
      ps.isOurBuilds ? mats.blushRoseMarble : mats.pearlWhite,
    );
    const cap = new THREE.Mesh(pedestalCapGeo, mats.champagneGold);
    const haloMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(ps.isOurBuilds ? '#f472b6' : '#fde047'),
        emissive: new THREE.Color(ps.isOurBuilds ? '#ec4899' : '#f59e0b'),
        emissiveIntensity: 0.72,
        roughness: 0.2,
      }),
    );
    const halo = new THREE.Mesh(pedestalHaloGeo, haloMat);

    const plaqueMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: createPlaqueTexture(ps.label, ps.isOurBuilds),
      }),
    );
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0, 0.68, 0.29);

    // Heart-Arched Alcove Frame for "💗 OUR BUILDS" pedestals
    if (ps.isOurBuilds) {
      const archGeo = tracker.trackGeo(new THREE.TorusGeometry(0.36, 0.022, 8, 24, Math.PI));
      const archMesh = new THREE.Mesh(archGeo, mats.champagneGold);
      archMesh.position.set(0, 1.18, -0.12);
      pg.add(archMesh);
    }

    const displayAnchor = new THREE.Group();
    displayAnchor.position.set(0, 0.92, 0);
    pg.add(col, cap, halo, plaque, displayAnchor);
    group.add(pg);

    showcasePedestals.push({
      index: idx,
      isOurBuilds: ps.isOurBuilds,
      lx: ps.lx,
      lz: ps.lz,
      pedestalGroup: pg,
      displayAnchor,
      haloMat,
      creation: null,
      mountedRoot: null,
    });
  });

  const mountCreationOnPedestal = (slotIndex: number, record: LegoCreationRecord) => {
    const slot = showcasePedestals[slotIndex];
    if (!slot) return;
    if (slot.mountedRoot) {
      slot.displayAnchor.remove(slot.mountedRoot);
      slot.mountedRoot = null;
    }
    slot.creation = record;
    const batched = buildBatchedCreationGroup(record.bricks, record.archetype);
    batched.root.scale.setScalar(0.95);
    slot.displayAnchor.add(batched.root);
    slot.mountedRoot = batched.root;
  };

  // Pre-populate Showcase Pedestals 0..4 with the 5 Guidebook Models & Pedestal 5 with a romantic "Y ❤️ H" custom keepsake so Harsha can immediately inspect, Play [E], or Rebuild [R] any model!
  GUIDEBOOK_BLUEPRINTS.forEach((bp, idx) => {
    mountCreationOnPedestal(idx, {
      id: bp.id,
      title: bp.title,
      archetype: bp.archetype,
      isCustomOurBuild: false,
      bricks: bp.steps.map((s) => ({
        shape: s.shape,
        colorHex: s.colorHex,
        studX: s.studX,
        studZ: s.studZ,
        layerY: s.layerY,
        rotY: s.rotY,
      })),
    });
  });
  mountCreationOnPedestal(5, {
    id: 'our_heart_arch',
    title: '💗 Harsha & Yeshwanth Love Arch',
    archetype: 'structure',
    isCustomOurBuild: true,
    bricks: [
      { shape: '2x4', colorHex: '#f472b6', studX: 4, studZ: 5, layerY: 0, rotY: 1 },
      { shape: 'Arch1x4', colorHex: '#f59e0b', studX: 4, studZ: 5, layerY: 1, rotY: 1 },
      { shape: 'Tile2x2YH', colorHex: '#fffdf9', studX: 5, studZ: 5, layerY: 2, rotY: 0 },
      { shape: 'MiniCrown', colorHex: '#f59e0b', studX: 5, studZ: 5, layerY: 3, rotY: 0 },
    ],
  });

  // ============================================================================
  // 3. ACTIVE BUILD MAT STATE, GHOST PREVIEW, LASER GUIDES & SPARKLE BURST
  // ============================================================================
  const activeMatGroup = new THREE.Group();
  activeMatGroup.position.set(TABLE_LX, MAT_SURFACE_Y, TABLE_LZ + MAT_LOCAL_Z);
  group.add(activeMatGroup);

  const placedBricks: PlacedLegoBrick[] = [];
  let nextBrickUid = 1;
  let nextOurBuildsSlot = 5; // Alternates between pedestal 5 and 6 for custom creations

  let mode: LegoWorkshopMode = 'none';
  let activeGuideIndex = 0; // 0..4 = Guidebook models, 5 = Freeform Mode ("💗 Our Builds")
  let activeGuideStep = 0;
  let pageFlipTimer = 0;

  let heldShape: LegoBrickShapeId = GUIDEBOOK_BLUEPRINTS[0].steps[0].shape;
  let heldColorIdx = 2; // Champagne Gold default for Step 1 of Roadster
  let heldRotY = 0; // 0..3
  let cursorStudX = 5;
  let cursorStudZ = 4;
  let cursorLayerY = 0;

  // Translucent Champagne-Gold / Blush Ghost Preview Brick on the Stud Mat
  const ghostMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fde047'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  const ghostPreviewMesh = new THREE.Mesh(buildCanonicalBrickGeo(heldShape), ghostMat);
  ghostPreviewMesh.visible = false;
  activeMatGroup.add(ghostPreviewMesh);

  // Holographic Blueprint Ghost for the current Guidebook Step
  const blueprintGhostMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38bdf8'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.38,
      wireframe: false,
      depthWrite: false,
    }),
  );
  const blueprintGhostMesh = new THREE.Mesh(buildCanonicalBrickGeo(heldShape), blueprintGhostMat);
  blueprintGhostMesh.visible = false;
  activeMatGroup.add(blueprintGhostMesh);

  // 4 Vertical Laser Guide Lines from Ghost Preview down to Target Studs
  const laserLineGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.0025, 0.0025, 1.0, 6));
  laserLineGeo.translate(0, 0.5, 0);
  const laserLineMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
      transparent: true,
      opacity: 0.72,
    }),
  );
  const laserGuideMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const lm = new THREE.Mesh(laserLineGeo, laserLineMat);
    lm.visible = false;
    activeMatGroup.add(lm);
    laserGuideMeshes.push(lm);
  }

  // 5 Golden/Pink Stud-Sparkle Particles on Brick Snap
  const sparkleGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.016, 0));
  const sparkleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
      transparent: true,
      opacity: 0.95,
    }),
  );
  const snapSparkles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }> = [];
  for (let i = 0; i < 5; i++) {
    const sm = new THREE.Mesh(sparkleGeo, sparkleMat);
    sm.visible = false;
    activeMatGroup.add(sm);
    snapSparkles.push({ mesh: sm, vx: 0, vy: 0, vz: 0, life: 0 });
  }

  const triggerSnapSparkles = (lx: number, ly: number, lz: number) => {
    for (let i = 0; i < snapSparkles.length; i++) {
      const sp = snapSparkles[i];
      const ang = (i * Math.PI * 2) / 5 + Math.random() * 0.4;
      sp.mesh.position.set(lx, ly + 0.02, lz);
      sp.vx = Math.cos(ang) * 0.35;
      sp.vy = 0.42 + Math.random() * 0.2;
      sp.vz = Math.sin(ang) * 0.35;
      sp.life = 0.28;
      sp.mesh.visible = true;
    }
  };

  // Compute automatic stacking layerY for a brick footprint at (studX, studZ, rotY)
  const computeStackLayerY = (
    shape: LegoBrickShapeId,
    sX: number,
    sZ: number,
    rY: number,
  ): number => {
    const meta = BRICK_SHAPE_META[shape];
    const spanX = rY % 2 === 0 ? meta.w : meta.d;
    const spanZ = rY % 2 === 0 ? meta.d : meta.w;
    let maxOccupiedLayer = 0;

    for (let i = 0; i < placedBricks.length; i++) {
      const pb = placedBricks[i];
      const pbMeta = BRICK_SHAPE_META[pb.shape];
      const pbSpanX = pb.rotY % 2 === 0 ? pbMeta.w : pbMeta.d;
      const pbSpanZ = pb.rotY % 2 === 0 ? pbMeta.d : pbMeta.w;

      const overlapX = sX < pb.studX + pbSpanX && sX + spanX > pb.studX;
      const overlapZ = sZ < pb.studZ + pbSpanZ && sZ + spanZ > pb.studZ;
      if (overlapX && overlapZ) {
        const top = pb.layerY + pbMeta.h;
        if (top > maxOccupiedLayer) maxOccupiedLayer = top;
      }
    }
    return Math.min(14, maxOccupiedLayer);
  };

  const clampCursorToGrid = () => {
    const meta = BRICK_SHAPE_META[heldShape];
    const spanX = heldRotY % 2 === 0 ? meta.w : meta.d;
    const spanZ = heldRotY % 2 === 0 ? meta.d : meta.w;
    cursorStudX = THREE.MathUtils.clamp(cursorStudX, 0, GRID_SIZE - spanX);
    cursorStudZ = THREE.MathUtils.clamp(cursorStudZ, 0, GRID_SIZE - spanZ);
    cursorLayerY = computeStackLayerY(heldShape, cursorStudX, cursorStudZ, heldRotY);
  };

  const syncGhostAndBlueprintVisuals = () => {
    const isBuild = mode === 'lego_build';
    ghostPreviewMesh.visible = isBuild;
    if (!isBuild) {
      blueprintGhostMesh.visible = false;
      for (let i = 0; i < 4; i++) laserGuideMeshes[i].visible = false;
      return;
    }

    clampCursorToGrid();
    const meta = BRICK_SHAPE_META[heldShape];
    const spanX = heldRotY % 2 === 0 ? meta.w : meta.d;
    const spanZ = heldRotY % 2 === 0 ? meta.d : meta.w;
    const gx = (cursorStudX + spanX * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
    const gz = (cursorStudZ + spanZ * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
    const gy = cursorLayerY * LAYER_HEIGHT;

    ghostPreviewMesh.geometry = buildCanonicalBrickGeo(heldShape);
    ghostPreviewMesh.position.set(gx, gy + 0.008, gz);
    ghostPreviewMesh.rotation.set(0, (-heldRotY * Math.PI) / 2, 0);
    ghostMat.color.set(LEGO_PASTEL_PALETTE[heldColorIdx].hex);

    // 4 Corner Laser Guide Lines down to the baseplate/target studs
    const halfW = (spanX - 1) * 0.5 * STUD_UNIT;
    const halfD = (spanZ - 1) * 0.5 * STUD_UNIT;
    const corners = [
      { x: gx - halfW, z: gz - halfD },
      { x: gx + halfW, z: gz - halfD },
      { x: gx - halfW, z: gz + halfD },
      { x: gx + halfW, z: gz + halfD },
    ];
    const laserH = Math.max(0.06, gy + 0.04);
    for (let i = 0; i < 4; i++) {
      const lm = laserGuideMeshes[i];
      lm.visible = true;
      lm.position.set(corners[i].x, 0, corners[i].z);
      lm.scale.set(1, laserH, 1);
    }

    // Holographic Blueprint Ghost for active Guidebook step
    if (activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length) {
      const bp = GUIDEBOOK_BLUEPRINTS[activeGuideIndex];
      if (activeGuideStep < bp.steps.length) {
        const step = bp.steps[activeGuideStep];
        const sMeta = BRICK_SHAPE_META[step.shape];
        const sSpanX = step.rotY % 2 === 0 ? sMeta.w : sMeta.d;
        const sSpanZ = step.rotY % 2 === 0 ? sMeta.d : sMeta.w;
        const bx = (step.studX + sSpanX * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
        const bz = (step.studZ + sSpanZ * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
        const by = step.layerY * LAYER_HEIGHT;

        blueprintGhostMesh.geometry = buildCanonicalBrickGeo(step.shape);
        blueprintGhostMesh.position.set(bx, by + 0.002, bz);
        blueprintGhostMesh.rotation.set(0, (-step.rotY * Math.PI) / 2, 0);
        blueprintGhostMat.color.set(step.colorHex);
        blueprintGhostMesh.visible = true;
      } else {
        blueprintGhostMesh.visible = false;
      }
    } else {
      blueprintGhostMesh.visible = false;
    }
  };

  // Render the 3D Illustrated Guidebook Canvas Page
  const redrawGuidebookCanvas = () => {
    if (!guideCtx) return;
    const ctx = guideCtx;
    ctx.clearRect(0, 0, 512, 384);

    // Parchment & Champagne Gold Royal Book Spread
    const bg = ctx.createLinearGradient(0, 0, 512, 384);
    bg.addColorStop(0, '#fffdf9');
    bg.addColorStop(0.5, '#fdf2f8');
    bg.addColorStop(1, '#fffdf9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 384);

    // Center spine & gold border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 364);
    ctx.beginPath();
    ctx.moveTo(256, 14);
    ctx.lineTo(256, 370);
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.textAlign = 'center';
    if (activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length) {
      const bp = GUIDEBOOK_BLUEPRINTS[activeGuideIndex];
      const total = bp.steps.length;
      const isDone = activeGuideStep >= total;

      // Left page: Model Title & Progress
      ctx.fillStyle = '#9d174d';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillText('ROYAL LEGO GUIDEBOOK', 128, 48);
      ctx.fillStyle = '#be185d';
      ctx.font = 'bold 24px Georgia, serif';
      ctx.fillText(bp.title, 128, 92);

      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillText(
        isDone ? `✦ COMPLETED (${total}/${total}) ✦` : `STEP ${activeGuideStep + 1} OF ${total}`,
        128,
        142,
      );

      // Progress bar
      ctx.fillStyle = '#fce7f3';
      ctx.fillRect(38, 168, 180, 18);
      ctx.fillStyle = '#ec4899';
      const prog = isDone ? 1.0 : activeGuideStep / Math.max(1, total);
      ctx.fillRect(38, 168, Math.round(180 * prog), 18);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(38, 168, 180, 18);

      ctx.fillStyle = '#831843';
      ctx.font = '15px Georgia, serif';
      ctx.fillText('[G] Next Guide Model / Freeform', 128, 232);
      ctx.fillText('[P] Bring Creation to Life!', 128, 262);
      ctx.fillText(`Bricks on Mat: ${placedBricks.length}`, 128, 304);

      // Right page: Current Step Brick & Placement Instruction
      if (!isDone) {
        const step = bp.steps[activeGuideStep];
        const meta = BRICK_SHAPE_META[step.shape];
        ctx.fillStyle = '#9d174d';
        ctx.font = 'bold 19px Georgia, serif';
        ctx.fillText('REQUIRED BRICK:', 384, 54);

        ctx.fillStyle = step.colorHex;
        ctx.fillRect(334, 78, 100, 56);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.strokeRect(334, 78, 100, 56);

        ctx.fillStyle = '#831843';
        ctx.font = 'bold 20px Georgia, serif';
        ctx.fillText(meta.label, 384, 166);
        ctx.font = '16px Georgia, serif';
        ctx.fillText(`Grid Target: (${step.studX + 1}, ${step.studZ + 1}) • Layer ${step.layerY + 1}`, 384, 198);
        ctx.fillStyle = '#be185d';
        ctx.font = 'italic 15px Georgia, serif';
        ctx.fillText(step.hint.slice(0, 34), 384, 242);
        if (step.hint.length > 34) {
          ctx.fillText(step.hint.slice(34), 384, 264);
        }
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 15px Georgia, serif';
        ctx.fillText('Click or Press [E]/[Space] to Snap!', 384, 318);
      } else {
        ctx.fillStyle = '#be185d';
        ctx.font = 'bold 24px Georgia, serif';
        ctx.fillText('🎉 READY TO AWAKEN!', 384, 130);
        ctx.fillStyle = '#831843';
        ctx.font = '18px Georgia, serif';
        ctx.fillText('Press [P] or [E] to move your', 384, 185);
        ctx.fillText('creation to the Activation Pad', 384, 212);
        ctx.fillText('and drive it with your Remote!', 384, 239);
      }
    } else {
      // Freeform Mode ("💗 Our Builds")
      ctx.fillStyle = '#be185d';
      ctx.font = 'bold 24px Georgia, serif';
      ctx.fillText('💗 FREEFORM: OUR BUILDS', 128, 78);
      ctx.fillStyle = '#831843';
      ctx.font = '16px Georgia, serif';
      ctx.fillText('Invent anything you dream!', 128, 128);
      ctx.fillText('Add a Smart Core (Trays 4–7)', 128, 160);
      ctx.fillText('to make your invention drive,', 128, 184);
      ctx.fillText('hop, march, or fly!', 128, 208);
      ctx.fillText(`Bricks Placed: ${placedBricks.length}`, 128, 268);

      ctx.fillStyle = '#9d174d';
      ctx.font = 'bold 19px Georgia, serif';
      ctx.fillText('SELECTED BRICK:', 384, 62);
      ctx.fillStyle = LEGO_PASTEL_PALETTE[heldColorIdx].hex;
      ctx.fillRect(334, 86, 100, 56);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.strokeRect(334, 86, 100, 56);
      ctx.fillStyle = '#831843';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillText(BRICK_SHAPE_META[heldShape].label, 384, 174);
      ctx.font = '16px Georgia, serif';
      ctx.fillText(`Color: ${LEGO_PASTEL_PALETTE[heldColorIdx].name}`, 384, 206);
      ctx.fillText('[1–8] Trays • [C] Color • [R] Rotate', 384, 256);
      ctx.fillText('[P] Bring to Life & Save to Alcove!', 384, 294);
    }

    guideTex.needsUpdate = true;
  };

  let isChoosingBlueprint = false;

  const checkRotationMatchesStep = (step: GuidebookStepSpec, rY: number): boolean => {
    const meta = BRICK_SHAPE_META[step.shape];
    if (
      step.shape === 'Slope2x2' ||
      step.shape === 'HeartStud1x1' ||
      step.shape === 'MiniCrown' ||
      step.shape === 'Tile2x2YH' ||
      step.shape === 'BipedRobotCore'
    ) {
      return rY === step.rotY;
    }
    if (meta.w !== meta.d) {
      return rY % 2 === step.rotY % 2;
    }
    return true;
  };

  // Spawn held brick at the Top-Left corner of the 12x12 stud mat from the builder camera's view
  // (+X is Left on screen, +Z is Top/Far on screen) with an unaligned initial rotation so the player
  // can actively move (WASD / Arrows), rotate ([R]), and place ([Space] / [E]) the brick!
  const spawnBrickAtTopLeft = (targetRotY?: number) => {
    if (targetRotY !== undefined) {
      heldRotY = (targetRotY + 1) % 4;
    } else {
      heldRotY = 0;
    }
    const meta = BRICK_SHAPE_META[heldShape];
    const spanX = heldRotY % 2 === 0 ? meta.w : meta.d;
    const spanZ = heldRotY % 2 === 0 ? meta.d : meta.w;
    cursorStudX = GRID_SIZE - spanX;
    cursorStudZ = GRID_SIZE - spanZ;
    cursorLayerY = computeStackLayerY(heldShape, cursorStudX, cursorStudZ, heldRotY);
  };

  // Sync held brick to current Guidebook step requirement, starting at Top-Left of the mat
  const syncHeldBrickToGuideStep = () => {
    if (activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length) {
      const bp = GUIDEBOOK_BLUEPRINTS[activeGuideIndex];
      if (activeGuideStep < bp.steps.length) {
        const step = bp.steps[activeGuideStep];
        heldShape = step.shape;
        const cIdx = LEGO_PASTEL_PALETTE.findIndex(
          (c) => c.hex.toLowerCase() === step.colorHex.toLowerCase(),
        );
        if (cIdx >= 0) heldColorIdx = cIdx;
        spawnBrickAtTopLeft(step.rotY);
      }
    } else {
      spawnBrickAtTopLeft();
    }
    syncGhostAndBlueprintVisuals();
    redrawGuidebookCanvas();
  };

  const clearBuildMat = () => {
    while (placedBricks.length > 0) {
      const b = placedBricks.pop()!;
      activeMatGroup.remove(b.mesh);
    }
    syncGhostAndBlueprintVisuals();
    redrawGuidebookCanvas();
  };

  const selectBlueprintOption = (index: number) => {
    activeGuideIndex = THREE.MathUtils.clamp(index, 0, GUIDEBOOK_BLUEPRINTS.length);
    activeGuideStep = 0;
    isChoosingBlueprint = false;
    clearBuildMat();
    pageFlipTimer = 0.42;
    pageFlipGroup.visible = true;
    syncHeldBrickToGuideStep();
    const title =
      activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length
        ? GUIDEBOOK_BLUEPRINTS[activeGuideIndex].title
        : '🎨 Free Build (Our Builds)';
    activeCaption = `🧱 Selected ${title}! Brick spawned at Top-Left — Move with [WASD/Arrows], Rotate with [R], and Place with [Space/E]!`;
    captionTimer = 4.2;
  };

  // Place a brick onto the 12x12 Stud Mat at (cursorStudX, cursorLayerY, cursorStudZ)
  const placeHeldBrickOnMat = (): boolean => {
    if (isChoosingBlueprint) {
      isChoosingBlueprint = false;
      syncHeldBrickToGuideStep();
      return true;
    }

    clampCursorToGrid();

    // In Guided Blueprint mode, verify the player moved the brick from Top-Left to the target and rotated it!
    if (activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length) {
      const bp = GUIDEBOOK_BLUEPRINTS[activeGuideIndex];
      if (activeGuideStep < bp.steps.length) {
        const step = bp.steps[activeGuideStep];
        if (heldShape !== step.shape) {
          heldShape = step.shape;
          syncGhostAndBlueprintVisuals();
        }
        const isPosMatch = cursorStudX === step.studX && cursorStudZ === step.studZ;
        const isRotMatch = checkRotationMatchesStep(step, heldRotY);

        if (!isPosMatch) {
          activeCaption = `🎯 Move the brick from Top-Left using [WASD / Arrow Keys] to the glowing target at (${step.studX + 1}, ${step.studZ + 1})!`;
          captionTimer = 3.2;
          return true;
        }
        if (!isRotMatch) {
          activeCaption = `🔄 Almost there! Press [R] to rotate the brick to match the glowing blueprint outline, then press [Space] or [E]!`;
          captionTimer = 3.2;
          return true;
        }
        // Align exact canonical rotation on snap
        heldRotY = step.rotY;
      }
    }

    const meta = BRICK_SHAPE_META[heldShape];
    const spanX = heldRotY % 2 === 0 ? meta.w : meta.d;
    const spanZ = heldRotY % 2 === 0 ? meta.d : meta.w;
    const lx = (cursorStudX + spanX * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
    const lz = (cursorStudZ + spanZ * 0.5 - GRID_SIZE * 0.5) * STUD_UNIT;
    const ly = cursorLayerY * LAYER_HEIGHT;
    const colorHex = LEGO_PASTEL_PALETTE[heldColorIdx].hex;

    const mesh = new THREE.Mesh(
      buildCanonicalBrickGeo(heldShape),
      getBrickMaterial(colorHex),
    );
    mesh.position.set(lx, ly + 0.032, lz); // Starts slightly elevated for 0.06s squash-and-settle ease
    mesh.rotation.set(0, (-heldRotY * Math.PI) / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    activeMatGroup.add(mesh);

    placedBricks.push({
      id: nextBrickUid++,
      shape: heldShape,
      colorHex,
      studX: cursorStudX,
      studZ: cursorStudZ,
      layerY: cursorLayerY,
      rotY: heldRotY,
      settleTimer: 0.06,
      mesh,
    });

    triggerSnapSparkles(lx, ly + meta.h * LAYER_HEIGHT, lz);

    // Check if this placement completes the current Guidebook step!
    if (activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length) {
      const bp = GUIDEBOOK_BLUEPRINTS[activeGuideIndex];
      if (activeGuideStep < bp.steps.length) {
        activeGuideStep++;
        pageFlipTimer = 0.42;
        pageFlipGroup.visible = true;
        if (activeGuideStep < bp.steps.length) {
          syncHeldBrickToGuideStep();
          activeCaption = `✨ Step ${activeGuideStep}/${bp.steps.length} snapped! Next brick spawned at Top-Left — Move, Rotate [R], and Place!`;
          captionTimer = 3.2;
        } else {
          syncGhostAndBlueprintVisuals();
          redrawGuidebookCanvas();
          activeCaption = `🎉 ${bp.title} Complete! Press [P] to Bring Creation to Life!`;
          captionTimer = 4.5;
        }
        return true;
      }
    }

    // In Free Build mode, spawn the next brick at Top-Left as well
    spawnBrickAtTopLeft();
    syncGhostAndBlueprintVisuals();
    redrawGuidebookCanvas();
    return true;
  };

  // Remove the top-most brick under the cursor (or last placed brick)
  const removeBrickFromMat = (): boolean => {
    if (placedBricks.length === 0) return false;
    // Try to find the highest brick overlapping (cursorStudX, cursorStudZ)
    let bestIdx = -1;
    let bestLayer = -1;
    for (let i = placedBricks.length - 1; i >= 0; i--) {
      const pb = placedBricks[i];
      const meta = BRICK_SHAPE_META[pb.shape];
      const spanX = pb.rotY % 2 === 0 ? meta.w : meta.d;
      const spanZ = pb.rotY % 2 === 0 ? meta.d : meta.w;
      if (
        cursorStudX >= pb.studX &&
        cursorStudX < pb.studX + spanX &&
        cursorStudZ >= pb.studZ &&
        cursorStudZ < pb.studZ + spanZ
      ) {
        if (pb.layerY > bestLayer) {
          bestLayer = pb.layerY;
          bestIdx = i;
        }
      }
    }
    if (bestIdx < 0) bestIdx = placedBricks.length - 1;
    const removed = placedBricks.splice(bestIdx, 1)[0];
    activeMatGroup.remove(removed.mesh);
    heldShape = removed.shape;
    heldRotY = removed.rotY;
    const cIdx = LEGO_PASTEL_PALETTE.findIndex(
      (c) => c.hex.toLowerCase() === removed.colorHex.toLowerCase(),
    );
    if (cIdx >= 0) heldColorIdx = cIdx;
    syncGhostAndBlueprintVisuals();
    redrawGuidebookCanvas();
    return true;
  };

  // ============================================================================
  // 4. "BRING TO LIFE" AWAKENING & PHYSICAL REMOTE CONTROL STATE
  // ============================================================================
  let activeLiveCreation: {
    record: LegoCreationRecord;
    root: THREE.Group;
    turntableGroup: THREE.Group;
    headlightMat: THREE.MeshStandardMaterial;
    lx: number;
    ly: number;
    lz: number;
    yaw: number;
    forwardSpeed: number;
    verticalSpeed: number;
    actionAnimTimer: number; // Spacebar special action (wheelie, roar heart, 360 spin, barrel roll, chime)
    hopPhase: number;
  } | null = null;

  let awakeningTimer = 0;
  let activeCaption: string | null = null;
  let captionTimer = 0;

  // Floating Heart Bubble for Creature Roar & Chimney Heart-Smoke Puffs for Structure
  const heartBubbleGroup = new THREE.Group();
  const heartBubbleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fb7185'),
      transparent: true,
      opacity: 0.92,
    }),
  );
  const heartBubbleMesh = new THREE.Mesh(
    buildCanonicalBrickGeo('HeartStud1x1'),
    heartBubbleMat,
  );
  heartBubbleMesh.scale.setScalar(1.35);
  heartBubbleGroup.add(heartBubbleMesh);
  heartBubbleGroup.visible = false;
  group.add(heartBubbleGroup);

  const determineCreationArchetype = (
    bricks: ReadonlyArray<{ shape: LegoBrickShapeId }>,
  ): LegoCreationArchetype => {
    for (let i = 0; i < bricks.length; i++) {
      const s = bricks[i].shape;
      if (s === 'ThrusterFlightCore') return 'spaceship';
      if (s === 'BipedRobotCore') return 'robot';
      if (s === 'CreatureHopperCore') return 'creature';
      if (s === 'WheelChassisCore' || s === 'WheelAxle') return 'car';
    }
    if (activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length) {
      return GUIDEBOOK_BLUEPRINTS[activeGuideIndex].archetype;
    }
    return 'structure';
  };

  const startBringToLife = (customRecord?: LegoCreationRecord): boolean => {
    isChoosingBlueprint = false;
    let record: LegoCreationRecord;
    if (customRecord) {
      record = customRecord;
    } else {
      const isGuide = activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length;
      const bp = isGuide ? GUIDEBOOK_BLUEPRINTS[activeGuideIndex] : null;

      if (placedBricks.length === 0 && !bp) {
        activeCaption = 'Place bricks onto the stud mat first before Pressing [P] Bring to Life!';
        captionTimer = 3.2;
        return true;
      }

      // If in Guided Blueprint mode and the player presses [P] before placing all steps,
      // use the full blueprint steps (or their placed bricks if >= 2) so [P] Bring to Life always works!
      const sourceBricks =
        placedBricks.length >= 2 || !bp
          ? placedBricks.map((pb) => ({
              shape: pb.shape,
              colorHex: pb.colorHex,
              studX: pb.studX,
              studZ: pb.studZ,
              layerY: pb.layerY,
              rotY: pb.rotY,
            }))
          : bp.steps.map((st) => ({
              shape: st.shape,
              colorHex: st.colorHex,
              studX: st.studX,
              studZ: st.studZ,
              layerY: st.layerY,
              rotY: st.rotY,
            }));

      const archetype = determineCreationArchetype(sourceBricks);
      record = {
        id: bp ? bp.id : `custom_${Date.now()}`,
        title: bp ? bp.title : `💗 Harsha's Custom ${archetype.toUpperCase()}`,
        archetype,
        isCustomOurBuild: !isGuide,
        bricks: sourceBricks,
      };
    }

    if (activeLiveCreation) {
      group.remove(activeLiveCreation.root);
      activeLiveCreation = null;
    }

    const batched = buildBatchedCreationGroup(record.bricks, record.archetype);
    batched.root.position.set(TABLE_LX, TABLE_TOP_Y + 0.05, TABLE_LZ);
    group.add(batched.root);

    activeLiveCreation = {
      record,
      root: batched.root,
      turntableGroup: batched.turntableGroup,
      headlightMat: batched.headlightMat,
      lx: PLATFORM_LX,
      ly: y0 + 0.11,
      lz: PLATFORM_LZ,
      yaw: 0,
      forwardSpeed: 0,
      verticalSpeed: 0,
      actionAnimTimer: 0,
      hopPhase: 0,
    };

    mode = 'lego_awakening';
    resetOrbitCamera();
    awakeningTimer = 1.4;
    awakeningRingMesh.visible = true;
    awakeningRingMat.opacity = 0.95;
    ghostPreviewMesh.visible = false;
    blueprintGhostMesh.visible = false;
    for (let i = 0; i < 4; i++) laserGuideMeshes[i].visible = false;

    avatarBridge?.setActivityPose('lego_remote');
    activeCaption = `✨ Bringing ${record.title} to Life on the Activation Platform...`;
    captionTimer = 3.8;
    return true;
  };

  const dockActiveCreationToShowcase = () => {
    if (activeLiveCreation) {
      const rec = activeLiveCreation.record;
      group.remove(activeLiveCreation.root);
      activeLiveCreation = null;

      let targetSlot = 0;
      if (rec.isCustomOurBuild) {
        targetSlot = nextOurBuildsSlot;
        nextOurBuildsSlot = nextOurBuildsSlot === 5 ? 6 : 5;
      } else {
        const bpIdx = GUIDEBOOK_BLUEPRINTS.findIndex((b) => b.id === rec.id);
        targetSlot = bpIdx >= 0 ? bpIdx : 0;
      }
      mountCreationOnPedestal(targetSlot, rec);
      activeCaption = `🏛️ Docked ${rec.title} to Showcase Pedestal #${targetSlot + 1}!`;
      captionTimer = 3.5;
    }
    heartBubbleGroup.visible = false;
    resetOrbitCamera();
    mode = 'none';
    avatarBridge?.setActivityPose('none');
  };

  // ============================================================================
  // 5. CASCADE DISASSEMBLY ("REBUILD TORNADO" — 1.1s Reverse Arc into Trays)
  // ============================================================================
  interface TornadoBrickParticle {
    mesh: THREE.Mesh;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    delay: number;
  }
  const tornadoParticles: TornadoBrickParticle[] = [];
  let tornadoTimer = 0;
  const TORNADO_DURATION = 1.1;

  const triggerRebuildTornado = (pedestalIdx: number): boolean => {
    const slot = showcasePedestals[pedestalIdx];
    if (!slot || !slot.creation) return false;

    const rec = slot.creation;
    // Clear any existing tornado particles
    while (tornadoParticles.length > 0) {
      const p = tornadoParticles.pop()!;
      group.remove(p.mesh);
    }

    const total = rec.bricks.length;
    for (let i = total - 1; i >= 0; i--) {
      const b = rec.bricks[i];
      const meta = BRICK_SHAPE_META[b.shape];
      const tray = sortingTrays[meta.trayIndex] ?? sortingTrays[0];

      const mesh = new THREE.Mesh(
        buildCanonicalBrickGeo(b.shape),
        getBrickMaterial(b.colorHex),
      );
      const startPos = new THREE.Vector3(
        TABLE_LX + (b.studX - 5.5) * STUD_UNIT,
        TABLE_TOP_Y + 0.38 + b.layerY * LAYER_HEIGHT,
        TABLE_LZ + (b.studZ - 5.5) * STUD_UNIT,
      );
      const endPos = new THREE.Vector3(
        TABLE_LX + tray.lx,
        TABLE_TOP_Y + 0.04,
        TABLE_LZ + tray.lz,
      );
      mesh.position.copy(startPos);
      group.add(mesh);

      const reverseOrderIdx = total - 1 - i;
      tornadoParticles.push({
        mesh,
        startPos,
        endPos,
        delay: (reverseOrderIdx / Math.max(1, total)) * 0.45,
      });
    }

    // Set Guidebook to this creation's blueprint & clear build mat so Harsha can rebuild it fresh
    const bpIdx = GUIDEBOOK_BLUEPRINTS.findIndex((b) => b.id === rec.id);
    activeGuideIndex = bpIdx >= 0 ? bpIdx : 5;
    activeGuideStep = 0;
    clearBuildMat();
    syncHeldBrickToGuideStep();

    mode = 'lego_rebuild_tornado';
    tornadoTimer = TORNADO_DURATION;
    avatarBridge?.setActivityPose('lego_build');
    activeCaption = `🌪️ Rebuild Tornado! Popping ${rec.title} bricks back into their sorting trays...`;
    captionTimer = 3.5;
    return true;
  };

  // ============================================================================
  // 5B. ZONE 6 (OUTDOOR PLAYFUL BRICK DISTRICT EMPTY SPACE):
  //     LARGE-SCALE "PROJECT HAIL MARY" SPACECRAFT & ROCKY'S REPLICA NEARBY
  // ============================================================================
  const isOutdoorBrickDistrict = originX < 0;
  const SHIP_LX = 2.6;
  const SHIP_LZ = -10.2;
  const ROCKY_LX = -3.2;
  const ROCKY_LZ = -6.8;

  // ============================================================================
  // EXHIBIT LIGHTING & NAME BOARD INTENSITY CONTROLS
  // Modify these values to manually adjust lighting and board illumination:
  // ============================================================================
  const ROCKY_EXHIBIT_DIFFUSE_INTENSITY = 0.18; // Mild wide diffused illumination across Rocky's habitat
  const HAIL_MARY_SHIP_DIFFUSE_INTENSITY = 0.18; // Mild wide diffused illumination across Hail Mary cradle
  const ROCKY_BOARD_ILLUMINATION = 0.16; // Mild, soft, even, glare-free self-illumination of Rocky's nameplate
  const HAIL_MARY_BOARD_ILLUMINATION = 0.16; // Mild, soft, even, glare-free self-illumination of Project Hail Mary plaques

  let hailMaryCelebrationTimer = 0;
  let rockyBodyRig: THREE.Group | null = null;
  const rockyFrontClawPivots: THREE.Group[] = [];
  const rockyMusicParticles: Array<{ mesh: THREE.Mesh; phase: number; baseX: number; baseZ: number }> = [];
  let spinDriveCoreMat: THREE.MeshStandardMaterial | null = null;
  let spinDrivePulseRing: THREE.Mesh | null = null;
  let astrophageOrbMesh: THREE.Mesh | null = null;

  if (isOutdoorBrickDistrict) {
    const hailMaryDistrictGroup = new THREE.Group();
    hailMaryDistrictGroup.name = 'ProjectHailMaryAndRockyExhibit';

    // 1. Connecting Studded Promenade & Starship Launch Apron in the South Empty Space
    const promenadeGeo = tracker.trackGeo(new THREE.BoxGeometry(4.4, 0.028, 3.8));
    promenadeGeo.translate(0.0, y0 + 0.014, -5.1);
    const launchApronGeo = tracker.trackGeo(new THREE.BoxGeometry(14.2, 0.036, 6.8));
    launchApronGeo.translate(SHIP_LX, y0 + 0.018, SHIP_LZ);
    const launchApronRimGeo = tracker.trackGeo(new THREE.BoxGeometry(14.52, 0.026, 7.12));
    launchApronRimGeo.translate(SHIP_LX, y0 + 0.013, SHIP_LZ);

    const apronSlateMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1e293b'),
        roughness: 0.42,
        metalness: 0.28,
      }),
    );
    const hullWhiteMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f8fafc'),
        roughness: 0.22,
        metalness: 0.14,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
      }),
    );
    const aerospaceTitaniumMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#64748b'),
        roughness: 0.32,
        metalness: 0.78,
      }),
    );
    const darkCarbonMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#0f172a'),
        roughness: 0.38,
        metalness: 0.62,
      }),
    );
    const foilGoldMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f59e0b'),
        emissive: new THREE.Color('#78350f'),
        emissiveIntensity: 0.22,
        roughness: 0.2,
        metalness: 0.88,
      }),
    );
    const xenoniteAmberMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#d97706'),
        emissive: new THREE.Color('#92400e'),
        emissiveIntensity: 0.25,
        roughness: 0.15,
        metalness: 0.08,
        transparent: true,
        opacity: 0.56,
        clearcoat: 0.9,
      }),
    );
    const xenoniteSolidMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#78350f'),
        roughness: 0.48,
        metalness: 0.24,
      }),
    );
    spinDriveCoreMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e0f2fe'),
        emissive: new THREE.Color('#38bdf8'),
        emissiveIntensity: 1.45,
        roughness: 0.12,
      }),
    );
    const petrovaVioletMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f472b6'),
        emissive: new THREE.Color('#ec4899'),
        emissiveIntensity: 1.15,
        roughness: 0.18,
      }),
    );

    const promenadeMesh = new THREE.Mesh(promenadeGeo, plazaFloorMat);
    promenadeMesh.receiveShadow = true;
    const apronRimMesh = new THREE.Mesh(launchApronRimGeo, mats.champagneGold);
    apronRimMesh.receiveShadow = true;
    const apronMesh = new THREE.Mesh(launchApronGeo, apronSlateMat);
    apronMesh.receiveShadow = true;
    hailMaryDistrictGroup.add(promenadeMesh, apronRimMesh, apronMesh);

    // 2. LARGE-SIZE "PROJECT HAIL MARY" SPACECRAFT (13.4m long x 5.8m tall)
    // Oriented horizontally along X at (SHIP_LX = 2.6, y0 + 2.55, SHIP_LZ = -10.2)
    // Nose Cone points West (-X) toward Rocky's Dome; Triple Spin Drives point East (+X)
    const shipGroup = new THREE.Group();
    const SHIP_AXIS_Y = y0 + 2.55;
    shipGroup.position.set(SHIP_LX, SHIP_AXIS_Y, SHIP_LZ);

    // 2A. 4 Heavy Launch Cradle Towers supporting the spacecraft from the pad
    const cradleLegGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 2.35, 0.42));
    const cradleSaddleGeo = tracker.trackGeo(
      new THREE.TorusGeometry(1.48, 0.11, 8, 24, Math.PI),
    );
    for (const cxOff of [-2.8, 2.2]) {
      for (const czOff of [-1.25, 1.25]) {
        const tower = new THREE.Mesh(cradleLegGeo, aerospaceTitaniumMat);
        tower.position.set(cxOff, -SHIP_AXIS_Y + y0 + 1.175, czOff);
        tower.castShadow = true;
        shipGroup.add(tower);
      }
      const saddle = new THREE.Mesh(cradleSaddleGeo, foilGoldMat);
      saddle.rotation.y = Math.PI / 2;
      saddle.rotation.x = Math.PI;
      saddle.position.set(cxOff, 0, 0);
      shipGroup.add(saddle);
    }

    // 2B. Parabolic Forward Radiation/Heat Shield & Nose Cone (Bow at local X = -6.2 .. -3.8)
    const noseConeGeo = tracker.trackGeo(new THREE.ConeGeometry(1.46, 2.55, 24));
    noseConeGeo.rotateZ(Math.PI / 2); // Tip points toward -X
    const noseConeMesh = new THREE.Mesh(noseConeGeo, hullWhiteMat);
    noseConeMesh.position.set(-4.95, 0, 0);
    noseConeMesh.castShadow = true;
    shipGroup.add(noseConeMesh);

    const noseCapGeo = tracker.trackGeo(new THREE.SphereGeometry(0.36, 16, 16));
    const noseCapMesh = new THREE.Mesh(noseCapGeo, darkCarbonMat);
    noseCapMesh.position.set(-6.15, 0, 0);
    shipGroup.add(noseCapMesh);

    // Forward Petrova-Scope Optical Sensor Pod & RCS Thruster Quads
    const rcsPodGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 0.24, 0.24));
    for (let q = 0; q < 4; q++) {
      const ang = (q * Math.PI) / 2 + Math.PI / 4;
      const rcs = new THREE.Mesh(rcsPodGeo, aerospaceTitaniumMat);
      rcs.position.set(-3.9, Math.sin(ang) * 1.38, Math.cos(ang) * 1.38);
      shipGroup.add(rcs);
    }

    // 2C. Cylindrical Pressurized Crew & Laboratory Module (local X = -3.7 .. +0.1)
    const crewCylGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.44, 1.44, 3.8, 28));
    crewCylGeo.rotateZ(Math.PI / 2);
    const crewCylMesh = new THREE.Mesh(crewCylGeo, hullWhiteMat);
    crewCylMesh.position.set(-1.8, 0, 0);
    crewCylMesh.castShadow = true;
    crewCylMesh.receiveShadow = true;
    shipGroup.add(crewCylMesh);

    // Circumferential Structural Rings & LEGO Stud Collar Accents along the Hull
    // Circumferential Structural Bulkhead Rings framing the Crew Module from the outside (at the forward & aft collars)
    // NOTE: Rings are at x = -3.68 and x = 0.08 so they frame the cabin cleanly and NEVER enclose or slice across the nameplate!
    const hullRingGeo = tracker.trackGeo(new THREE.TorusGeometry(1.46, 0.055, 10, 32));
    hullRingGeo.rotateY(Math.PI / 2);
    for (const rx of [-3.68, 0.08]) {
      const ring = new THREE.Mesh(hullRingGeo, foilGoldMat);
      ring.position.set(rx, 0, 0);
      shipGroup.add(ring);
    }

    // Illuminated Sapphire Lab Porthole Windows on Port & Starboard Sides
    const portholeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16));
    portholeGeo.rotateX(Math.PI / 2);
    for (const px of [-2.95, -1.8, -0.65]) {
      for (const side of [-1, 1]) {
        const win = new THREE.Mesh(portholeGeo, spinDriveCoreMat);
        win.position.set(px, 0.28, side * 1.42);
        shipGroup.add(win);
      }
    }

    // "PROJECT HAIL MARY" Hull Decal Plates on Both Sides of the Crew Module
    // Positioned cleanly in the open central hull bay between the bulkheads with ZERO ring enclosure!
    const hullCanvas = document.createElement('canvas');
    hullCanvas.width = 1024;
    hullCanvas.height = 256;
    const hCtx = hullCanvas.getContext('2d');
    if (hCtx) {
      // Matte dark aerospace composite slate (prevents blinding glare & bloom blowout!)
      hCtx.fillStyle = '#0f172a';
      hCtx.fillRect(0, 0, 1024, 256);

      // Outer aerospace titanium border & accent stripes
      hCtx.strokeStyle = '#f59e0b';
      hCtx.lineWidth = 8;
      hCtx.strokeRect(10, 10, 1004, 236);

      // Top cyan sensor line & bottom red telemetry stripe
      hCtx.fillStyle = '#0284c7';
      hCtx.fillRect(18, 18, 988, 12);
      hCtx.fillStyle = '#e11d48';
      hCtx.fillRect(18, 226, 988, 12);

      // Inner plate background
      hCtx.fillStyle = '#1e293b';
      hCtx.fillRect(20, 32, 984, 192);

      // Soft white title (crisp, clear, elegant, ZERO glare)
      hCtx.font = 'bold 54px Georgia, serif';
      hCtx.textAlign = 'center';
      hCtx.textBaseline = 'middle';
      hCtx.fillStyle = '#f8fafc';
      hCtx.fillText('🚀 PROJECT HAIL MARY', 512, 104);

      // Golden subtitle
      hCtx.font = 'bold 24px sans-serif';
      hCtx.fillStyle = '#fbbf24';
      hCtx.fillText('PETROVA LINE ENVOY • GRACE & ROCKY', 512, 168);
    }
    const hullTex = tracker.trackTex(new THREE.CanvasTexture(hullCanvas));
    hullTex.colorSpace = THREE.SRGBColorSpace;
    const hullNamePlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.4, 0.58));
    const hullNameMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: hullTex,
        emissiveMap: hullTex,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: HAIL_MARY_BOARD_ILLUMINATION * 0.85,
        roughness: 0.95, // Fully matte - zero glare hot spots
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
    );
    const hullBackGeo = tracker.trackGeo(new THREE.BoxGeometry(2.44, 0.62, 0.03));
    const hullBackNorth = new THREE.Mesh(hullBackGeo, aerospaceTitaniumMat);
    hullBackNorth.position.set(-1.8, -0.22, 1.44);
    const hullBackSouth = new THREE.Mesh(hullBackGeo, aerospaceTitaniumMat);
    hullBackSouth.position.set(-1.8, -0.22, -1.44);
    hullBackSouth.rotation.y = Math.PI;

    const hullSignNorth = new THREE.Mesh(hullNamePlaneGeo, hullNameMat);
    hullSignNorth.position.set(-1.8, -0.22, 1.458);
    const hullSignSouth = new THREE.Mesh(hullNamePlaneGeo, hullNameMat);
    hullSignSouth.position.set(-1.8, -0.22, -1.458);
    hullSignSouth.rotation.y = Math.PI;
    shipGroup.add(hullBackNorth, hullBackSouth, hullSignNorth, hullSignSouth);

    // Architectural Trim Cowl and Soft Recessed Halo Wash behind the Nameplates
    const cowlLightGeo = tracker.trackGeo(new THREE.BoxGeometry(0.72, 0.065, 0.14));
    const cowlLensGeo = tracker.trackGeo(new THREE.BoxGeometry(0.66, 0.02, 0.08));
    const ledGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f8fafc'),
        emissive: new THREE.Color('#38bdf8'),
        emissiveIntensity: 0.06, // Mild diffused accent line, no bloom glare
        roughness: 0.85,
      }),
    );
    for (const side of [1, -1]) {
      const cowl = new THREE.Mesh(cowlLightGeo, aerospaceTitaniumMat);
      cowl.position.set(-1.8, 0.18, side * 1.48);
      const lens = new THREE.Mesh(cowlLensGeo, ledGlowMat);
      lens.position.set(0, -0.03, 0);
      cowl.add(lens);
      shipGroup.add(cowl);
    }

    // Wide, mild diffused ambient fill spread softly across the launch apron and starship cradle (no focused spot!)
    const shipCradleFillL = new THREE.PointLight(
      0x38bdf8,
      HAIL_MARY_SHIP_DIFFUSE_INTENSITY,
      11.0,
      1.0, // Linear decay spreads light smoothly across wide area without central hotspot
    );
    shipCradleFillL.position.set(SHIP_LX - 3.8, y0 + 1.8, SHIP_LZ + 2.2);
    const shipCradleFillR = new THREE.PointLight(
      0xfef08a,
      HAIL_MARY_SHIP_DIFFUSE_INTENSITY,
      11.0,
      1.0,
    );
    shipCradleFillR.position.set(SHIP_LX + 3.8, y0 + 1.8, SHIP_LZ + 2.2);
    hailMaryDistrictGroup.add(shipCradleFillL, shipCradleFillR);

    // Dedicated Museum Exhibition Plaque on the Promenade Apron in front of the Spacecraft
    const shipPlaqueCanvas = document.createElement('canvas');
    shipPlaqueCanvas.width = 1024;
    shipPlaqueCanvas.height = 256;
    const spCtx = shipPlaqueCanvas.getContext('2d');
    if (spCtx) {
      spCtx.fillStyle = '#0f172a';
      spCtx.fillRect(0, 0, 1024, 256);
      spCtx.strokeStyle = '#f59e0b';
      spCtx.lineWidth = 8;
      spCtx.strokeRect(8, 8, 1008, 240);
      spCtx.strokeStyle = '#38bdf8';
      spCtx.lineWidth = 2.5;
      spCtx.strokeRect(18, 18, 988, 220);

      spCtx.font = 'bold 50px Georgia, serif';
      spCtx.textAlign = 'center';
      spCtx.fillStyle = '#f8fafc';
      spCtx.fillText('🚀 PROJECT HAIL MARY', 512, 88);

      spCtx.font = 'bold 24px sans-serif';
      spCtx.fillStyle = '#fbbf24';
      spCtx.fillText('SOLAR SYSTEM ENVOY • HUMAN & ERIDIAN ALLIANCE', 512, 148);

      spCtx.font = 'italic 20px Georgia, serif';
      spCtx.fillStyle = '#94a3b8';
      spCtx.fillText('Commanded by Ryland Grace & Chief Engineer Rocky', 512, 196);
    }
    const shipPlaqueTex = tracker.trackTex(new THREE.CanvasTexture(shipPlaqueCanvas));
    shipPlaqueTex.colorSpace = THREE.SRGBColorSpace;
    const shipPlaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.0, 0.52));
    const shipPlaqueMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: shipPlaqueTex,
        emissiveMap: shipPlaqueTex,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: HAIL_MARY_BOARD_ILLUMINATION,
        roughness: 0.95, // Fully matte - zero glare hotspot
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
    );

    // Promenade Exhibition Plaque Assembly Group (all elements locked to the same tilt and space)
    const shipPlaqueGroup = new THREE.Group();
    shipPlaqueGroup.position.set(SHIP_LX - 0.8, y0 + 0.76, SHIP_LZ + 2.65);
    shipPlaqueGroup.rotation.x = -0.32; // Angled comfortably toward arriving visitors

    const shipPlaqueBackGeo = tracker.trackGeo(new THREE.BoxGeometry(2.04, 0.56, 0.04));
    const shipPlaqueBackMesh = new THREE.Mesh(shipPlaqueBackGeo, aerospaceTitaniumMat);
    shipPlaqueBackMesh.position.set(0, 0, 0);

    const shipPlaqueMesh = new THREE.Mesh(shipPlaqueGeo, shipPlaqueMat);
    shipPlaqueMesh.position.set(0, 0, 0.022);

    // Museum Light Fixture Hood & Soft Light Strip perfectly aligned along top rim of plaque
    const hoodGeo = tracker.trackGeo(new THREE.BoxGeometry(2.08, 0.055, 0.16));
    const hoodMesh = new THREE.Mesh(hoodGeo, mats.champagneGold);
    hoodMesh.position.set(0, 0.305, 0.06);
    const hoodLensGeo = tracker.trackGeo(new THREE.BoxGeometry(1.98, 0.02, 0.08));
    const hoodLensMesh = new THREE.Mesh(hoodLensGeo, ledGlowMat);
    hoodLensMesh.position.set(0, -0.026, 0.02);
    hoodMesh.add(hoodLensMesh);

    // Golden Stand Column supporting behind the backplate
    const shipPlaqueStandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 0.72, 10));
    const shipPlaqueStandMesh = new THREE.Mesh(shipPlaqueStandGeo, mats.champagneGold);
    shipPlaqueStandMesh.position.set(SHIP_LX - 0.8, y0 + 0.36, SHIP_LZ + 2.58);

    shipPlaqueGroup.add(
      shipPlaqueBackMesh,
      shipPlaqueMesh,
      hoodMesh,
    );

    hailMaryDistrictGroup.add(shipPlaqueStandMesh, shipPlaqueGroup);

    hailMaryDistrictGroup.add(shipPlaqueStandMesh, shipPlaqueGroup);

    // 2D. Centrifuge Separation Coupler & Extendable Cable Tether Winch Assembly (local X = 0.1 .. 1.45)
    const spineCoreGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.68, 0.68, 4.8, 20));
    spineCoreGeo.rotateZ(Math.PI / 2);
    const spineCoreMesh = new THREE.Mesh(spineCoreGeo, darkCarbonMat);
    spineCoreMesh.position.set(2.3, 0, 0);
    shipGroup.add(spineCoreMesh);

    const tetherDrumGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 16));
    const tetherDrumL = new THREE.Mesh(tetherDrumGeo, foilGoldMat);
    tetherDrumL.position.set(0.65, 0.82, 0);
    const tetherDrumR = new THREE.Mesh(tetherDrumGeo, foilGoldMat);
    tetherDrumR.position.set(0.65, -0.82, 0);
    shipGroup.add(tetherDrumL, tetherDrumR);

    // Twin High-Tensile Centrifuge Tether Cables & Boom Struts
    const tetherCableGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8));
    tetherCableGeo.rotateZ(Math.PI / 2);
    for (const ty of [-0.95, 0.95]) {
      for (const tz of [-0.55, 0.55]) {
        const cable = new THREE.Mesh(tetherCableGeo, aerospaceTitaniumMat);
        cable.position.set(0.68, ty, tz);
        shipGroup.add(cable);
      }
    }

    // 2E. Cluster of 9 Cylindrical Astrophage Fuel Tanks (local X = 1.35 .. 4.55)
    const fuelTankGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 3.1, 18));
    fuelTankGeo.rotateZ(Math.PI / 2);
    const tankCapGeo = tracker.trackGeo(new THREE.SphereGeometry(0.42, 14, 14));
    for (let t = 0; t < 8; t++) {
      const ang = (t * Math.PI * 2) / 8;
      const ty = Math.sin(ang) * 1.18;
      const tz = Math.cos(ang) * 1.18;
      const tankMat = t % 2 === 0 ? hullWhiteMat : foilGoldMat;
      const tank = new THREE.Mesh(fuelTankGeo, tankMat);
      tank.position.set(2.95, ty, tz);
      tank.castShadow = true;
      const capF = new THREE.Mesh(tankCapGeo, aerospaceTitaniumMat);
      capF.position.set(1.4, ty, tz);
      const capB = new THREE.Mesh(tankCapGeo, aerospaceTitaniumMat);
      capB.position.set(4.5, ty, tz);
      shipGroup.add(tank, capF, capB);
    }

    // Aft Structural Bulkhead Ring at X = 4.65
    const aftBulkheadGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.62, 1.52, 0.36, 24));
    aftBulkheadGeo.rotateZ(Math.PI / 2);
    const aftBulkheadMesh = new THREE.Mesh(aftBulkheadGeo, aerospaceTitaniumMat);
    aftBulkheadMesh.position.set(4.68, 0, 0);
    shipGroup.add(aftBulkheadMesh);

    // 2F. Triple-Bell "Spin Drive" Aft Propulsion Cluster (local X = 4.85 .. 6.25)
    const spinBellGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.32, 0.82, 1.28, 20, 1, true),
    );
    spinBellGeo.rotateZ(Math.PI / 2);
    const spinCoreDiscGeo = tracker.trackGeo(new THREE.CircleGeometry(0.68, 20));
    spinCoreDiscGeo.rotateY(Math.PI / 2);

    for (let b = 0; b < 3; b++) {
      const bAng = (b * Math.PI * 2) / 3 - Math.PI / 2;
      const by = Math.sin(bAng) * 0.74;
      const bz = Math.cos(bAng) * 0.74;
      const bell = new THREE.Mesh(spinBellGeo, darkCarbonMat);
      bell.position.set(5.45, by, bz);
      bell.castShadow = true;
      const coreDisc = new THREE.Mesh(spinCoreDiscGeo, spinDriveCoreMat);
      coreDisc.position.set(5.85, by, bz);
      shipGroup.add(bell, coreDisc);
    }

    // Animated Petrova-Wavelength Spin Drive Plasma Ring at the Stern
    const pulseRingGeo = tracker.trackGeo(new THREE.TorusGeometry(1.35, 0.06, 12, 32));
    pulseRingGeo.rotateY(Math.PI / 2);
    spinDrivePulseRing = new THREE.Mesh(pulseRingGeo, petrovaVioletMat);
    spinDrivePulseRing.position.set(6.15, 0, 0);
    shipGroup.add(spinDrivePulseRing);

    hailMaryDistrictGroup.add(shipGroup);

    // 3. OVERHEAD TRANSPARENT XENONITE AIRLOCK TUNNEL connecting Hail Mary Bow to Rocky's Dome
    const tunnelGroup = new THREE.Group();
    const tunnelStart = new THREE.Vector3(SHIP_LX - 2.6, y0 + 3.65, SHIP_LZ + 0.55);
    const tunnelEnd = new THREE.Vector3(ROCKY_LX + 0.45, y0 + 2.15, ROCKY_LZ - 0.35);
    const tunnelMid = new THREE.Vector3().addVectors(tunnelStart, tunnelEnd).multiplyScalar(0.5);
    const tunnelLen = tunnelStart.distanceTo(tunnelEnd);

    const xenoniteTubeGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.46, 0.46, tunnelLen, 6),
    );
    xenoniteTubeGeo.rotateX(Math.PI / 2);
    const xenoniteTubeMesh = new THREE.Mesh(xenoniteTubeGeo, xenoniteAmberMat);
    xenoniteTubeMesh.position.copy(tunnelMid);
    xenoniteTubeMesh.lookAt(tunnelEnd);
    tunnelGroup.add(xenoniteTubeMesh);

    // Hexagonal Xenonite Support Ribs along the Airlock Tunnel + Central Clear Divider Wall
    const tunnelRibGeo = tracker.trackGeo(new THREE.TorusGeometry(0.48, 0.04, 6, 6));
    for (let r = 1; r <= 5; r++) {
      const t = r / 6;
      const rib = new THREE.Mesh(
        tunnelRibGeo,
        r === 3 ? mats.champagneGold : xenoniteSolidMat,
      );
      rib.position.lerpVectors(tunnelStart, tunnelEnd, t);
      rib.lookAt(tunnelEnd);
      tunnelGroup.add(rib);
    }
    hailMaryDistrictGroup.add(tunnelGroup);

    // 4. ROCKY'S REPLICA NEARBY & ERIDIAN XENONITE HABITAT DOME at (ROCKY_LX = -3.2, ROCKY_LZ = -6.8)
    const rockyHabitatGroup = new THREE.Group();
    rockyHabitatGroup.position.set(ROCKY_LX, y0, ROCKY_LZ);

    // 4A. Octagonal/Hexagonal Xenonite Habitat Pedestal & Open Observation Dome
    const rockyPadBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.15, 2.35, 0.28, 6));
    rockyPadBaseGeo.translate(0, 0.14, 0);
    const rockyPadTopGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.98, 2.12, 0.08, 6));
    rockyPadTopGeo.translate(0, 0.32, 0);
    const rockyPadBase = new THREE.Mesh(rockyPadBaseGeo, xenoniteSolidMat);
    rockyPadBase.receiveShadow = true;
    const rockyPadTopMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d97706'),
        roughness: 0.90, // Fully matte warm mineral stone - zero specular glare
        metalness: 0.0,
      }),
    );
    const rockyPadTop = new THREE.Mesh(rockyPadTopGeo, rockyPadTopMat);
    rockyPadTop.receiveShadow = true;
    rockyHabitatGroup.add(rockyPadBase, rockyPadTop);

    // Translucent Hexagonal Xenonite Rear Canopy Arch (open at the front so the player has a 100% clear view of Rocky!)
    const domeCanopyGeo = tracker.trackGeo(
      new THREE.SphereGeometry(1.92, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.46),
    );
    const domeCanopyMesh = new THREE.Mesh(domeCanopyGeo, xenoniteAmberMat);
    domeCanopyMesh.position.set(0, 2.15, 0);
    rockyHabitatGroup.add(domeCanopyMesh);

    const domePillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.065, 0.065, 2.05, 6));
    domePillarGeo.translate(0, 1.25, 0);
    for (let p = 0; p < 6; p++) {
      const pAng = (p * Math.PI * 2) / 6 + Math.PI / 6;
      // Leave the North/East approach face open
      if (Math.sin(pAng) > 0.35 && Math.cos(pAng) > -0.2) continue;
      const pil = new THREE.Mesh(domePillarGeo, xenoniteSolidMat);
      pil.position.set(Math.cos(pAng) * 1.85, 0, Math.sin(pAng) * 1.85);
      rockyHabitatGroup.add(pil);
    }

    // 4B. ROCKY REPLICA (Five-Legged Pentagonal Eridian Chief Engineer)
    rockyBodyRig = new THREE.Group();
    rockyBodyRig.position.set(0, 0.92, 0);
    // Face North-East toward the arriving player & Workshop Pavilion
    rockyBodyRig.rotation.y = 0.55;

    const rockyCarapaceMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#322920'),
        roughness: 0.95, // Pure matte mineral stone carapace - completely eliminates metallic reflection and glare
        metalness: 0.0,
      }),
    );
    const rockyVeinMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d97706'),
        emissive: new THREE.Color('#78350f'),
        emissiveIntensity: 0.18,
        roughness: 0.92, // Soft diffuse joint surfaces - zero specular hotspot
        metalness: 0.0,
      }),
    );
    const rockyClawMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d97706'),
        emissive: new THREE.Color('#78350f'),
        emissiveIntensity: 0.16,
        roughness: 0.74, // Organic mineral claw texture, no harsh chrome/gold specular highlights
        metalness: 0.08,
      }),
    );
    const rockySashMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#10b981'),
        emissive: new THREE.Color('#047857'),
        emissiveIntensity: 0.24,
        roughness: 0.65,
        metalness: 0.05,
      }),
    );

    // Pentagonal Rocky Carapace Torso (5-sided prism + faceted upper shell)
    const carapaceCoreGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.48, 0.56, 0.46, 5));
    const carapaceTopGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.48, 0.22, 5));
    carapaceTopGeo.translate(0, 0.34, 0);
    const carapaceCoreMesh = new THREE.Mesh(carapaceCoreGeo, rockyCarapaceMat);
    carapaceCoreMesh.castShadow = true;
    const carapaceTopMesh = new THREE.Mesh(carapaceTopGeo, rockyCarapaceMat);
    carapaceTopMesh.castShadow = true;
    rockyBodyRig.add(carapaceCoreMesh, carapaceTopMesh);

    // 5 Glowing Top Radiator Vent Slits on Rocky's Carapace
    const ventSlitGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.04, 0.06));
    for (let v = 0; v < 5; v++) {
      const vAng = (v * Math.PI * 2) / 5;
      const vent = new THREE.Mesh(ventSlitGeo, rockyVeinMat);
      vent.position.set(Math.cos(vAng) * 0.28, 0.44, Math.sin(vAng) * 0.28);
      vent.rotation.y = -vAng;
      rockyBodyRig.add(vent);
    }

    // Festive Eridian Tool Sash / Bandolier & Belt around Rocky's Carapace
    const sashRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.52, 0.055, 8, 5));
    sashRingGeo.rotateX(Math.PI / 2);
    const sashRingMesh = new THREE.Mesh(sashRingGeo, rockySashMat);
    sashRingMesh.position.y = 0.06;
    rockyBodyRig.add(sashRingMesh);

    // Miniature Eridian Wrench & Glowing Astrophage Containment Sphere on Rocky's Tool Belt
    const astrophageOrbGeo = tracker.trackGeo(new THREE.IcosahedronGeometry(0.11, 2));
    astrophageOrbMesh = new THREE.Mesh(astrophageOrbGeo, spinDriveCoreMat);
    astrophageOrbMesh.position.set(0.38, 0.14, 0.42);
    rockyBodyRig.add(astrophageOrbMesh);

    // 5 Radially Symmetric Articulated Eridian Legs (72° apart) + 3-Fingered Claws
    // Legs 0 and 4 are raised in Rocky's signature "Jazz Hands! / Fist My Bump!" greeting!
    const hipJointGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 10, 10));
    const femurGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.075, 0.065, 0.56, 8));
    femurGeo.translate(0, 0.28, 0);
    const tibiaGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.062, 0.048, 0.64, 8));
    tibiaGeo.translate(0, -0.32, 0);
    const clawFingerGeo = tracker.trackGeo(new THREE.ConeGeometry(0.028, 0.14, 6));
    clawFingerGeo.translate(0, 0.07, 0);

    for (let legIdx = 0; legIdx < 5; legIdx++) {
      const legAngle = (legIdx * Math.PI * 2) / 5;
      const isJazzHandLeg = legIdx === 0 || legIdx === 1;

      const legRoot = new THREE.Group();
      legRoot.position.set(Math.cos(legAngle) * 0.48, -0.05, Math.sin(legAngle) * 0.48);
      legRoot.rotation.y = -legAngle;

      const hip = new THREE.Mesh(hipJointGeo, rockyVeinMat);
      legRoot.add(hip);

      const femur = new THREE.Mesh(femurGeo, rockyCarapaceMat);
      femur.castShadow = true;
      femur.rotation.z = isJazzHandLeg ? -0.55 : -1.05;
      legRoot.add(femur);

      const kneePivot = new THREE.Group();
      if (isJazzHandLeg) {
        kneePivot.position.set(0.32, 0.44, 0);
      } else {
        kneePivot.position.set(0.48, 0.26, 0);
      }
      const kneeSphere = new THREE.Mesh(hipJointGeo, rockyVeinMat);
      kneeSphere.scale.setScalar(0.85);
      kneePivot.add(kneeSphere);

      const tibia = new THREE.Mesh(tibiaGeo, rockyCarapaceMat);
      tibia.castShadow = true;
      if (isJazzHandLeg) {
        // Raised forearm waving in "Jazz Hands!"
        tibia.rotation.z = 2.45;
      } else {
        // Grounded stance leg supporting carapace on the Xenonite pad
        tibia.rotation.z = 0.22;
      }
      kneePivot.add(tibia);

      // 3-Fingered Opposable Eridian Hand/Claw at the tip of the leg
      const handGroup = new THREE.Group();
      if (isJazzHandLeg) {
        handGroup.position.set(0.38, 0.46, 0);
      } else {
        handGroup.position.set(0.14, -0.62, 0);
      }
      for (let f = -1; f <= 1; f++) {
        const finger = new THREE.Mesh(clawFingerGeo, rockyClawMat);
        finger.rotation.z = f * 0.48;
        finger.rotation.x = 0.25;
        handGroup.add(finger);
      }
      kneePivot.add(handGroup);

      if (isJazzHandLeg) {
        rockyFrontClawPivots.push(kneePivot);
      }

      legRoot.add(kneePivot);
      rockyBodyRig.add(legRoot);
    }

    rockyHabitatGroup.add(rockyBodyRig);

    // 4C. Floating Musical Chord & Carapace Steam Particles above Rocky
    const musicNoteGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.065, 0));
    for (let m = 0; m < 5; m++) {
      const mMesh = new THREE.Mesh(
        musicNoteGeo,
        m % 2 === 0 ? mats.warmLanternGlow : petrovaVioletMat,
      );
      const ang = (m * Math.PI * 2) / 5;
      const bx = Math.cos(ang) * 0.35;
      const bz = Math.sin(ang) * 0.35;
      mMesh.position.set(bx, 1.55 + m * 0.18, bz);
      rockyHabitatGroup.add(mMesh);
      rockyMusicParticles.push({ mesh: mMesh, phase: m * 1.25, baseX: bx, baseZ: bz });
    }

    // 4D. Dedicated Plaque in front of Rocky's Xenonite Dome
    const rockyPlaqueCanvas = document.createElement('canvas');
    rockyPlaqueCanvas.width = 512;
    rockyPlaqueCanvas.height = 128;
    const rCtx = rockyPlaqueCanvas.getContext('2d');
    if (rCtx) {
      rCtx.fillStyle = '#27170c';
      rCtx.fillRect(0, 0, 512, 128);
      rCtx.strokeStyle = '#fde047';
      rCtx.lineWidth = 6;
      rCtx.strokeRect(6, 6, 500, 116);
      rCtx.fillStyle = '#fef08a';
      rCtx.font = 'bold 25px Georgia, serif';
      rCtx.textAlign = 'center';
      rCtx.fillText('🎵 ROCKY • ERIDIAN CHIEF ENGINEER', 256, 44);
      rCtx.fillStyle = '#fed7aa';
      rCtx.font = 'italic 20px Georgia, serif';
      rCtx.fillText('"Amaze! Amaze! Amaze! Fist my bump, question?"', 256, 82);
      rCtx.fillStyle = '#38bdf8';
      rCtx.font = 'bold 16px sans-serif';
      rCtx.fillText('[E] Jazz Hands & Spin Drive Overdrive', 256, 108);
    }
    const rockyPlaqueTex = tracker.trackTex(new THREE.CanvasTexture(rockyPlaqueCanvas));
    rockyPlaqueTex.colorSpace = THREE.SRGBColorSpace;
    const rockyPlaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.55, 0.38));
    const rockyPlaqueMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: rockyPlaqueTex,
        emissiveMap: rockyPlaqueTex,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: ROCKY_BOARD_ILLUMINATION,
        roughness: 0.98, // Fully matte diffuse - zero specular glare
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
    );

    // Rocky Exhibition Plaque Assembly Group (all elements locked to the same local coordinate space)
    const rockyPlaqueGroup = new THREE.Group();
    rockyPlaqueGroup.position.set(0.65, 0.62, 1.85);
    rockyPlaqueGroup.rotation.y = 0.35; // Angled toward approaching visitors

    // 1. Backing casing plate
    const rockyPlaqueBackGeo = tracker.trackGeo(new THREE.BoxGeometry(1.58, 0.42, 0.04));
    const rockyPlaqueBackMesh = new THREE.Mesh(rockyPlaqueBackGeo, aerospaceTitaniumMat);
    rockyPlaqueBackMesh.position.set(0, 0, 0);

    // 2. Front Decal with Rocky's titles & quotes
    const rockyPlaqueMesh = new THREE.Mesh(rockyPlaqueGeo, rockyPlaqueMat);
    rockyPlaqueMesh.position.set(0, 0, 0.022);

    // 3. Supporting Gold Post connecting behind the plate (does not poke through front face!)
    const rockyStandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.045, 0.06, 0.62, 10));
    const rockyStandMesh = new THREE.Mesh(rockyStandGeo, mats.champagneGold);
    rockyStandMesh.position.set(0, -0.31, -0.04);

    // 4. Architectural Visor Hood & Light Strip (mounted squarely atop plaque frame, perfectly aligned!)
    const rockyHoodGeo = tracker.trackGeo(new THREE.BoxGeometry(1.60, 0.048, 0.14));
    const rockyHoodMesh = new THREE.Mesh(rockyHoodGeo, mats.champagneGold);
    rockyHoodMesh.position.set(0, 0.234, 0.05); // Flush directly above the 0.42m high plaque, cantilevered slightly forward
    const rockyLensGeo = tracker.trackGeo(new THREE.BoxGeometry(1.52, 0.018, 0.06));
    const warmAmberGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fef08a'),
        emissive: new THREE.Color('#f59e0b'),
        emissiveIntensity: 0.06, // Soft, non-glare lens accent
        roughness: 0.85,
      }),
    );
    const rockyLensMesh = new THREE.Mesh(rockyLensGeo, warmAmberGlowMat);
    rockyLensMesh.position.set(0, -0.022, 0.02);
    rockyHoodMesh.add(rockyLensMesh);

    // Soft wide ambient fill spread behind the plaque onto Rocky's xenonite dome & habitat (decay = 1.0, wide smooth spread)
    const rockyPlaqueBacklight = new THREE.PointLight(
      0xfde047,
      ROCKY_EXHIBIT_DIFFUSE_INTENSITY,
      8.0,
      1.0,
    );
    rockyPlaqueBacklight.position.set(0, 0.28, -0.35);

    rockyPlaqueGroup.add(
      rockyStandMesh,
      rockyPlaqueBackMesh,
      rockyPlaqueMesh,
      rockyHoodMesh,
      rockyPlaqueBacklight,
    );
    rockyHabitatGroup.add(rockyPlaqueGroup);

    hailMaryDistrictGroup.add(rockyHabitatGroup);
    group.add(hailMaryDistrictGroup);

    // Register Walkable Perimeter Colliders for Rocky's Dome & Hail Mary Launch Cradle
    colliders.push({
      x: originX + ROCKY_LX,
      z: originZ + ROCKY_LZ,
      radius: 1.95,
      y: baseY + y0,
      height: 2.8,
    });
    for (const cxOff of [-3.2, 0.0, 3.2]) {
      colliders.push({
        x: originX + SHIP_LX + cxOff,
        z: originZ + SHIP_LZ,
        radius: 1.75,
        y: baseY + y0,
        height: 4.5,
      });
    }
  }

  // ============================================================================
  // 6. PROXIMITY DETECTION, INTERACTION & 360° TRACKPAD ORBIT CAMERA
  // ============================================================================
  const promptCache: CastleProximityPrompt = {
    prompt: '',
    roomId: 'floor2_lego_workshop',
  };

  let buildCamYawOffset = 0; // Unclamped full 360° orbit angle in radians (-PI..+PI)
  let buildCamPitchOffset = 0.62; // Default 35° elevated studio angle (clamped 0.08..1.42 rad)
  let buildCamRadius = 1.12; // Zoom distance around the build mat (clamped 0.48..2.15m)
  let isAutoOrbit360 = false;
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();
  const seatWorldPos = new THREE.Vector3();

  const wrapYawPi = (a: number): number => {
    let r = (a + Math.PI) % (Math.PI * 2);
    if (r < 0) r += Math.PI * 2;
    return r - Math.PI;
  };

  const resetOrbitCamera = () => {
    buildCamYawOffset = 0;
    buildCamPitchOffset = 0.62;
    buildCamRadius = 1.12;
    isAutoOrbit360 = false;
  };

  const findNearestPedestal = (lx: number, lz: number): ShowcasePedestalSlot | null => {
    let best: ShowcasePedestalSlot | null = null;
    let bestDist = 1.48;
    for (let i = 0; i < showcasePedestals.length; i++) {
      const sp = showcasePedestals[i];
      const d = Math.hypot(lx - sp.lx, lz - sp.lz);
      if (d < bestDist && sp.creation) {
        bestDist = d;
        best = sp;
      }
    }
    return best;
  };

  const isNearHailMaryOrRocky = (lx: number, lz: number): boolean => {
    if (!isOutdoorBrickDistrict) return false;
    const dRocky = Math.hypot(lx - ROCKY_LX, lz - ROCKY_LZ);
    const dShip = Math.hypot((lx - SHIP_LX) * 0.45, lz - SHIP_LZ);
    return dRocky < 6.2 || dShip < 6.5;
  };

  const triggerHailMaryAndRockyCelebration = (): boolean => {
    hailMaryCelebrationTimer = 3.8;
    activeCaption =
      '🎵 Rocky waves with Jazz Hands: "Amaze! Amaze! Amaze! Fist my bump, Yeshwanth & Harsha!" 🚀 Spin Drives at Full Petrova Power!';
    captionTimer = 4.2;
    return true;
  };

  redrawGuidebookCanvas();

  return {
    group,
    colliders,
    getMode: () => mode,
    isActive: () => mode !== 'none',
    setAvatarBridge(bridge: LegoAvatarBridge | null) {
      avatarBridge = bridge;
    },
    selectBlueprint(index: number) {
      if (mode === 'none') {
        mode = 'lego_build';
        resetOrbitCamera();
        avatarBridge?.setActivityPose('lego_build');
      }
      selectBlueprintOption(index);
    },
    openBlueprintSelector() {
      if (mode === 'none') {
        mode = 'lego_build';
        resetOrbitCamera();
        avatarBridge?.setActivityPose('lego_build');
      }
      isChoosingBlueprint = true;
      activeCaption = '📖 Choose what you want to build (1–5 Blueprints or 6 Free Build)!';
      captionTimer = 3.5;
    },
    resetCameraView() {
      resetOrbitCamera();
    },
    toggleAutoOrbit360() {
      isAutoOrbit360 = !isAutoOrbit360;
    },
    getUiState(): LegoWorkshopUiState | null {
      if (mode === 'none') return null;
      const isGuide = activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length;
      const bp = isGuide ? GUIDEBOOK_BLUEPRINTS[activeGuideIndex] : null;
      const step = bp && activeGuideStep < bp.steps.length ? bp.steps[activeGuideStep] : null;
      const isPositionMatched = step
        ? cursorStudX === step.studX && cursorStudZ === step.studZ
        : true;
      const isRotationMatched = step ? checkRotationMatchesStep(step, heldRotY) : true;
      const deg = ((Math.round((buildCamYawOffset * 180) / Math.PI) % 360) + 360) % 360;

      return {
        mode,
        isChoosingBlueprint,
        activeGuideIndex,
        activeGuideStep,
        totalGuideSteps: bp ? bp.steps.length : 0,
        activeBlueprintTitle: bp ? bp.title : '🎨 Free Build (Our Builds)',
        activeStepHint: step
          ? step.hint
          : bp
            ? '🎉 Build Complete! Use Trackpad to 360° Inspect or Press [P] to Bring to Life!'
            : 'Pick any brick from Trays [1–7], Color [C], Move [WASD], Rotate [R], Place [Space]!',
        requiredBrickLabel: step
          ? BRICK_SHAPE_META[step.shape].label
          : BRICK_SHAPE_META[heldShape].label,
        heldBrickLabel: BRICK_SHAPE_META[heldShape].label,
        heldColorName: LEGO_PASTEL_PALETTE[heldColorIdx].name,
        heldColorHex: LEGO_PASTEL_PALETTE[heldColorIdx].hex,
        placedBricksCount: placedBricks.length,
        cursorStudX,
        cursorStudZ,
        heldRotY,
        targetStudX: step ? step.studX : null,
        targetStudZ: step ? step.studZ : null,
        targetRotY: step ? step.rotY : null,
        isPositionMatched,
        isRotationMatched,
        cameraYawDeg: deg,
        isAutoOrbit360,
      };
    },

    getProximityPrompt(playerWorldPos: THREE.Vector3): CastleProximityPrompt | null {
      const lx = playerWorldPos.x - originX;
      const lz = playerWorldPos.z - originZ;
      const ly = playerWorldPos.y - baseY;

      if (Math.abs(ly - y0) > 4.5) return null;
      if (Math.abs(lx) > 18.0 || lz < -22.0 || lz > 12.0) return null;

      if (mode === 'lego_build') {
        if (isChoosingBlueprint) {
          promptCache.prompt =
            '📖 Choose What to Build: [1] 🚗 Roadster • [2] 🦖 Baby Dino • [3] 🤖 Heart-Bot • [4] 🚀 Spaceship • [5] 🏠 Cottage • [6] 🎨 Free Build';
          return promptCache;
        }
        const isGuide = activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length;
        const bp = isGuide ? GUIDEBOOK_BLUEPRINTS[activeGuideIndex] : null;
        const stepLabel = bp
          ? activeGuideStep < bp.steps.length
            ? `${bp.shortTitle} Step ${activeGuideStep + 1}/${bp.steps.length}: ${BRICK_SHAPE_META[bp.steps[activeGuideStep].shape].label}`
            : `${bp.shortTitle} Complete! Press [P] to Bring to Life!`
          : `🎨 Free Build (${placedBricks.length} bricks) • Held: ${BRICK_SHAPE_META[heldShape].label}`;
        promptCache.prompt =
          `🧱 ${stepLabel} | 🖱️ Trackpad: 360° Orbit & Zoom • [WASD] Move • [R] Rotate • [Space/E] Place • [P] Bring to Life`;
        return promptCache;
      }

      if (mode === 'lego_awakening') {
        promptCache.prompt = `✨ Awakening your LEGO creation on the Activation Platform...`;
        return promptCache;
      }

      if (mode === 'lego_rebuild_tornado') {
        promptCache.prompt = `🌪️ Cascade Disassembly: Returning bricks to their sorting trays...`;
        return promptCache;
      }

      if (mode === 'lego_remote' && activeLiveCreation) {
        const arch = activeLiveCreation.record.archetype;
        const actionDesc =
          arch === 'car'
            ? '[WASD] Drive & Steer • [Space] Horn & Wheelie Jump'
            : arch === 'creature'
              ? '[WASD] Hop & Waddle • [Space] Cute Roar & Heart Bubble'
              : arch === 'robot'
                ? '[WASD] March • [Space] 360° Spin & Wave'
                : arch === 'spaceship'
                  ? '[WASD] Fly & Bank • [Q/Z] Altitude • [Space] Aerial Barrel Roll'
                  : '[A/D] Rotate Music-Box Turntable • [Space] Chime & Heart-Smoke Puffs';
        promptCache.prompt = `🎮 Remote Control (${activeLiveCreation.record.title}): ${actionDesc} • 🖱️ Trackpad: 360° View • [E / Esc] Dock to Showcase`;
        return promptCache;
      }

      // Check Project Hail Mary Spacecraft & Rocky's Replica in the South Empty Space
      if (isNearHailMaryOrRocky(lx, lz)) {
        promptCache.prompt =
          `🚀 Project Hail Mary & Rocky's Replica: Press [E] "Fist My Bump!" (Jazz Hands & Spin Drive Overdrive)`;
        return promptCache;
      }

      // Check Showcase Pedestals
      const nearPedestal = findNearestPedestal(lx, lz);
      if (nearPedestal && nearPedestal.creation) {
        promptCache.prompt =
          `🏛️ Showcase [${nearPedestal.creation.title}]: Press [E] PLAY (Remote Control)  •  [R] REBUILD (Cascade Disassembly)  •  [G] VIEW IN GUIDE`;
        return promptCache;
      }

      // Check Master Build Table & 3D Guidebook Stand
      const distTable = Math.hypot(lx - TABLE_LX, lz - TABLE_LZ);
      const distLectern = Math.hypot(lx - LECTERN_LX, lz - LECTERN_LZ);
      if (distTable < 1.65 || distLectern < 1.35) {
        promptCache.prompt =
          `🧱 LEGO World Build Studio: Press [E] Choose What to Build  •  [G] Browse Blueprints  •  [P] Bring to Life`;
        return promptCache;
      }

      // Check "Bring to Life" Activation Platform
      const distPad = Math.hypot(lx - PLATFORM_LX, lz - PLATFORM_LZ);
      if (distPad < 1.55) {
        promptCache.prompt =
          placedBricks.length >= 2
            ? `✨ Activation Platform: Press [E] or [P] Bring Current Table Build to Life! (${placedBricks.length} bricks)`
            : `✨ Activation Platform: Press [E] or [P] Test Drive Royal Roadster with Remote Control!`;
        return promptCache;
      }

      return null;
    },

    interact(playerWorldPos: THREE.Vector3): boolean {
      const lx = playerWorldPos.x - originX;
      const lz = playerWorldPos.z - originZ;
      const ly = playerWorldPos.y - baseY;

      if (mode === 'lego_build') {
        if (isChoosingBlueprint) {
          selectBlueprintOption(activeGuideIndex);
          return true;
        }
        // If Guidebook build is finished, [E] brings it to life on the Activation Platform!
        if (
          activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length &&
          activeGuideStep >= GUIDEBOOK_BLUEPRINTS[activeGuideIndex].steps.length
        ) {
          return startBringToLife();
        }
        return placeHeldBrickOnMat();
      }

      if (mode === 'lego_remote') {
        dockActiveCreationToShowcase();
        return true;
      }

      if (mode === 'lego_awakening' || mode === 'lego_rebuild_tornado') {
        return true;
      }

      if (Math.abs(ly - y0) > 4.5) return false;
      if (Math.abs(lx) > 18.0 || lz < -22.0 || lz > 12.0) return false;

      // 0. Project Hail Mary & Rocky's Replica -> [E] "Fist My Bump!" Jazz Hands & Spin Drive Pulse
      if (isNearHailMaryOrRocky(lx, lz)) {
        return triggerHailMaryAndRockyCelebration();
      }

      // 1. Showcase Pedestal -> [E] PLAY moves creation to Activation Platform & equips Remote Control!
      const nearPedestal = findNearestPedestal(lx, lz);
      if (nearPedestal && nearPedestal.creation) {
        return startBringToLife(nearPedestal.creation);
      }

      // 2. Build Table or Guidebook Stand -> Enter Build Studio & Open "Choose What to Build" Options!
      const distTable = Math.hypot(lx - TABLE_LX, lz - TABLE_LZ);
      const distLectern = Math.hypot(lx - LECTERN_LX, lz - LECTERN_LZ);
      if (distTable < 1.65 || distLectern < 1.35) {
        mode = 'lego_build';
        isChoosingBlueprint = true;
        resetOrbitCamera();
        avatarBridge?.setActivityPose('lego_build');
        syncHeldBrickToGuideStep();
        activeCaption =
          '🧱 Welcome to the LEGO Build Studio! Choose what to build (1–6) & use your Trackpad to view 360°!';
        captionTimer = 4.2;
        return true;
      }

      // 3. Activation Platform -> Bring current build (or Roadster) to life
      const distPad = Math.hypot(lx - PLATFORM_LX, lz - PLATFORM_LZ);
      if (distPad < 1.55) {
        if (placedBricks.length >= 2) {
          return startBringToLife();
        }
        return startBringToLife(showcasePedestals[0].creation ?? undefined);
      }

      return false;
    },

    handleKeyAction(key: string, playerWorldPos?: THREE.Vector3): boolean {
      const k = key.toLowerCase();

      // While in Remote Control Mode:
      if (mode === 'lego_remote' && activeLiveCreation) {
        if (k === 'escape' || k === 'p') {
          dockActiveCreationToShowcase();
          return true;
        }
        if (k === ' ') {
          activeLiveCreation.actionAnimTimer = 0.78;
          const arch = activeLiveCreation.record.archetype;
          if (arch === 'car') {
            activeCaption = '🚗 Beep-Beep! Popping a Royal Roadster wheelie jump!';
          } else if (arch === 'creature') {
            activeCaption = '🦖 Rawr! Baby Dino sends a floating Valentine Heart Bubble!';
          } else if (arch === 'robot') {
            activeCaption = '🤖 Heart-Bot performs a 360° celebratory spin & wave!';
          } else if (arch === 'spaceship') {
            activeCaption = '🚀 Starlight Cruiser executes a supersonic aerial barrel roll!';
          } else {
            activeCaption = '🏠 Love Cottage music-box chimes with rising heart-smoke puffs!';
          }
          captionTimer = 2.8;
          return true;
        }
        return false;
      }

      // While in Build Studio Mode:
      if (mode === 'lego_build') {
        if (k === 'escape') {
          if (isChoosingBlueprint) {
            isChoosingBlueprint = false;
            return true;
          }
          mode = 'none';
          isAutoOrbit360 = false;
          ghostPreviewMesh.visible = false;
          blueprintGhostMesh.visible = false;
          for (let i = 0; i < 4; i++) laserGuideMeshes[i].visible = false;
          avatarBridge?.setActivityPose('none');
          return true;
        }

        // If the "Choose What to Build" picker is open, keys 1..6 directly pick the option!
        if (isChoosingBlueprint && k >= '1' && k <= '6') {
          selectBlueprintOption(parseInt(k, 10) - 1);
          return true;
        }

        if (k === 'r') {
          isChoosingBlueprint = false;
          heldRotY = (heldRotY + 1) % 4;
          syncGhostAndBlueprintVisuals();
          return true;
        }
        if (k === ' ' || k === 'enter') {
          return placeHeldBrickOnMat();
        }
        if (k === 'backspace' || k === 'delete' || k === 'x') {
          return removeBrickFromMat();
        }
        if (k === 'c') {
          isChoosingBlueprint = false;
          heldColorIdx = (heldColorIdx + 1) % LEGO_PASTEL_PALETTE.length;
          syncGhostAndBlueprintVisuals();
          redrawGuidebookCanvas();
          return true;
        }
        if (k === 'g') {
          isChoosingBlueprint = !isChoosingBlueprint;
          if (isChoosingBlueprint) {
            activeCaption =
              '📖 Choose What to Build: Press [1–5] for Guidebook Blueprints or [6] for Free Build!';
            captionTimer = 3.5;
          }
          return true;
        }
        if (k === 'p') {
          return startBringToLife();
        }
        // Camera-angle-aware Grid cursor nudging with WASD or Arrow keys (works from any 360° trackpad angle!)
        if (
          k === 'w' ||
          k === 'arrowup' ||
          k === 's' ||
          k === 'arrowdown' ||
          k === 'a' ||
          k === 'arrowleft' ||
          k === 'd' ||
          k === 'arrowright'
        ) {
          isChoosingBlueprint = false;
          clampCursorToGrid();
          // Determine local movement vector relative to current 360° camera yaw
          const fwdIn = k === 'w' || k === 'arrowup' ? 1 : k === 's' || k === 'arrowdown' ? -1 : 0;
          const leftIn = k === 'a' || k === 'arrowleft' ? 1 : k === 'd' || k === 'arrowright' ? -1 : 0;
          const cosY = Math.cos(buildCamYawOffset);
          const sinY = Math.sin(buildCamYawOffset);
          // At yaw = 0 (camera at -Z looking +Z): forward is +Z, left is +X
          const rawDx = leftIn * cosY - fwdIn * sinY;
          const rawDz = fwdIn * cosY + leftIn * sinY;
          const stepX = Math.abs(rawDx) >= Math.abs(rawDz) ? Math.sign(rawDx) : 0;
          const stepZ = Math.abs(rawDz) > Math.abs(rawDx) ? Math.sign(rawDz) : 0;
          const meta = BRICK_SHAPE_META[heldShape];
          const spanX = heldRotY % 2 === 0 ? meta.w : meta.d;
          const spanZ = heldRotY % 2 === 0 ? meta.d : meta.w;
          cursorStudX = THREE.MathUtils.clamp(cursorStudX + stepX, 0, GRID_SIZE - spanX);
          cursorStudZ = THREE.MathUtils.clamp(cursorStudZ + stepZ, 0, GRID_SIZE - spanZ);
          syncGhostAndBlueprintVisuals();
          return true;
        }
        // In Free Build mode, keys 1..8 pick bricks from the 8 sorting trays and spawn at Top-Left.
        // In Guided Blueprint mode, keys 1..6 let the player switch blueprints directly!
        if (k >= '1' && k <= '8') {
          const num = parseInt(k, 10);
          if (activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length && num >= 1 && num <= 6) {
            selectBlueprintOption(num - 1);
            return true;
          }
          const tIdx = num - 1;
          if (tIdx === 7) {
            heldColorIdx = (heldColorIdx + 1) % LEGO_PASTEL_PALETTE.length;
          } else {
            const tray = sortingTrays[tIdx];
            if (tray) {
              const curIdx = tray.shapes.indexOf(heldShape);
              heldShape = tray.shapes[(curIdx + 1) % tray.shapes.length];
              spawnBrickAtTopLeft();
            }
          }
          syncGhostAndBlueprintVisuals();
          redrawGuidebookCanvas();
          return true;
        }
        return false;
      }

      // While exploring near Showcase Pedestals, Build Table, Activation Platform, Guidebook, or Project Hail Mary:
      if (playerWorldPos && mode === 'none') {
        const lx = playerWorldPos.x - originX;
        const lz = playerWorldPos.z - originZ;
        const ly = playerWorldPos.y - baseY;
        if (Math.abs(ly - y0) <= 4.5 && Math.abs(lx) <= 18.0 && lz >= -22.0 && lz <= 12.0) {
          if ((k === 'e' || k === 'enter' || k === ' ') && isNearHailMaryOrRocky(lx, lz)) {
            return triggerHailMaryAndRockyCelebration();
          }
          if (k === 'p' && Math.abs(lx) <= 8.5 && Math.abs(lz) <= 8.5) {
            return startBringToLife();
          }
          const nearPedestal = findNearestPedestal(lx, lz);
          if (nearPedestal && nearPedestal.creation) {
            if (k === 'r') {
              return triggerRebuildTornado(nearPedestal.index);
            }
            if (k === 'g') {
              const bpIdx = GUIDEBOOK_BLUEPRINTS.findIndex(
                (b) => b.id === nearPedestal.creation?.id,
              );
              mode = 'lego_build';
              resetOrbitCamera();
              avatarBridge?.setActivityPose('lego_build');
              selectBlueprintOption(bpIdx >= 0 ? bpIdx : 5);
              return true;
            }
          }
          const distTable = Math.hypot(lx - TABLE_LX, lz - TABLE_LZ);
          const distLectern = Math.hypot(lx - LECTERN_LX, lz - LECTERN_LZ);
          if ((distTable < 1.65 || distLectern < 1.35) && k === 'g') {
            mode = 'lego_build';
            isChoosingBlueprint = true;
            resetOrbitCamera();
            avatarBridge?.setActivityPose('lego_build');
            syncHeldBrickToGuideStep();
            return true;
          }
        }
      }

      return false;
    },

    // Pointer Move in Build Mode: Do NOT teleport the brick cursor on passive mouse hover!
    // The brick starts at Top-Left and is moved intentionally by the player via WASD / Arrows / HUD controls.
    handlePointerMove(_ndcX: number, _ndcY: number, _camera: THREE.Camera): void {
      // Intentionally preserved as no-op so mouse movement does not override Top-Left brick start
    },

    // Pointer Click Raycasting (Tray pick, Guidebook flip, Place brick, or Right-click Remove)
    handlePointerDown(
      ndcX: number,
      ndcY: number,
      button: number,
      camera: THREE.Camera,
    ): boolean {
      if (mode !== 'lego_build' || isChoosingBlueprint) return false;

      if (button === 2) {
        return removeBrickFromMat();
      }

      _scratchNdc.set(ndcX, ndcY);
      _scratchRaycaster.setFromCamera(_scratchNdc, camera);

      // 1. Check if clicking a physical Sorting Tray compartment -> picks brick and starts it at Top-Left
      _scratchIntersects.length = 0;
      _scratchRaycaster.intersectObjects(trayHitMeshes, false, _scratchIntersects);
      if (_scratchIntersects.length > 0) {
        const tIdx = _scratchIntersects[0].object.userData.trayIndex as number;
        if (tIdx === 7) {
          heldColorIdx = (heldColorIdx + 1) % LEGO_PASTEL_PALETTE.length;
        } else if (activeGuideIndex >= GUIDEBOOK_BLUEPRINTS.length) {
          const tray = sortingTrays[tIdx];
          if (tray) {
            const curIdx = tray.shapes.indexOf(heldShape);
            heldShape = tray.shapes[(curIdx + 1) % tray.shapes.length];
            spawnBrickAtTopLeft();
          }
        }
        syncGhostAndBlueprintVisuals();
        redrawGuidebookCanvas();
        return true;
      }

      // 2. Check if clicking the 3D Guidebook Lectern page -> opens "Choose What to Build" options
      _scratchIntersects.length = 0;
      _scratchRaycaster.intersectObject(bookPageMesh, false, _scratchIntersects);
      if (_scratchIntersects.length > 0) {
        isChoosingBlueprint = true;
        return true;
      }

      return false;
    },

    // Full 360° Trackpad & Pointer Orbit around the Built Item!
    applyLookDelta(yawDelta: number, pitchDelta: number) {
      if (mode === 'lego_build' || mode === 'lego_remote') {
        isAutoOrbit360 = false;
        buildCamYawOffset = wrapYawPi(buildCamYawOffset + yawDelta * 1.15);
        buildCamPitchOffset = THREE.MathUtils.clamp(
          buildCamPitchOffset + pitchDelta * 0.75,
          0.08,
          1.42,
        );
      }
    },

    applyZoomDelta(zoomDelta: number) {
      if (mode === 'lego_build' || mode === 'lego_remote') {
        buildCamRadius = THREE.MathUtils.clamp(
          buildCamRadius + zoomDelta * 0.18,
          0.48,
          2.15,
        );
      }
    },

    getCameraState() {
      if (mode === 'none') {
        return {
          active: false,
          mode: 'none',
          camWorldPos,
          lookWorldPos,
        };
      }

      if (mode === 'lego_build' || mode === 'lego_rebuild_tornado') {
        // True 360° Spherical Orbit around the Center of the 12x12 Stud Mat & Built Item
        const pivotX = TABLE_LX;
        const pivotY = TABLE_TOP_Y + 0.12;
        const pivotZ = TABLE_LZ + MAT_LOCAL_Z;
        const horizRadius = Math.cos(buildCamPitchOffset) * buildCamRadius;
        const vertOffset = Math.sin(buildCamPitchOffset) * buildCamRadius;

        toWorld(
          pivotX + Math.sin(buildCamYawOffset) * horizRadius,
          pivotY + Math.max(0.12, vertOffset),
          pivotZ - Math.cos(buildCamYawOffset) * horizRadius,
          camWorldPos,
        );
        toWorld(pivotX, pivotY, pivotZ, lookWorldPos);
        toWorld(BUILDER_STAND_LX, y0, BUILDER_STAND_LZ, seatWorldPos);
        return {
          active: true,
          mode,
          camWorldPos,
          lookWorldPos,
          fov: 46,
          seatWorldPos,
          seatYaw: 0,
          isSitting: false,
        };
      }

      if (mode === 'lego_awakening') {
        toWorld(PLATFORM_LX - 1.35, y0 + 1.15, PLATFORM_LZ - 1.25, camWorldPos);
        toWorld(PLATFORM_LX, y0 + 0.25, PLATFORM_LZ, lookWorldPos);
        toWorld(PLATFORM_LX - 1.15, y0, PLATFORM_LZ - 0.65, seatWorldPos);
        return {
          active: true,
          mode,
          camWorldPos,
          lookWorldPos,
          fov: 50,
          seatWorldPos,
          seatYaw: 0.95,
          isSitting: false,
        };
      }

      // Remote Control Mode: 360° Orbitable Toy-Scale Follow View around the active creation!
      if (activeLiveCreation) {
        const c = activeLiveCreation;
        const baseFollowDist = c.record.archetype === 'spaceship' ? 1.35 : 1.15;
        const followDist = baseFollowDist * (buildCamRadius / 1.12);
        const followHeight =
          (c.record.archetype === 'spaceship' ? 0.42 : 0.32) +
          Math.sin(buildCamPitchOffset) * followDist * 0.65;
        const camAngle = c.yaw - buildCamYawOffset;
        const cx = THREE.MathUtils.clamp(
          c.lx + Math.sin(camAngle) * followDist,
          -6.2,
          6.8,
        );
        const cz = THREE.MathUtils.clamp(
          c.lz + Math.cos(camAngle) * followDist,
          -4.2,
          5.6,
        );
        toWorld(cx, c.ly + Math.max(0.14, followHeight), cz, camWorldPos);
        toWorld(c.lx, c.ly + 0.16, c.lz, lookWorldPos);
        toWorld(PLATFORM_LX - 1.18, y0, PLATFORM_LZ - 0.55, seatWorldPos);
        return {
          active: true,
          mode: 'lego_remote',
          camWorldPos,
          lookWorldPos,
          fov: 54,
          seatWorldPos,
          seatYaw: Math.atan2(c.lx - (PLATFORM_LX - 1.18), c.lz - (PLATFORM_LZ - 0.55)),
          isSitting: false,
        };
      }

      return {
        active: false,
        mode: 'none',
        camWorldPos,
        lookWorldPos,
      };
    },

    getActiveCaption: () => activeCaption,

    update(
      dt: number,
      elapsedTime: number,
      _playerWorldPos: THREE.Vector3,
      inputKeys?: ReadonlySet<string>,
    ) {
      if (captionTimer > 0) {
        captionTimer = Math.max(0, captionTimer - dt);
        if (captionTimer <= 0) activeCaption = null;
      }

      // 0. Smooth 360° Auto-Orbit when enabled in HUD
      if (isAutoOrbit360 && (mode === 'lego_build' || mode === 'lego_remote')) {
        buildCamYawOffset = wrapYawPi(buildCamYawOffset + dt * 0.72);
      }

      // 0B. Animate Project Hail Mary Spin Drives & Rocky's "Jazz Hands!" Replica
      if (isOutdoorBrickDistrict) {
        if (hailMaryCelebrationTimer > 0) {
          hailMaryCelebrationTimer = Math.max(0, hailMaryCelebrationTimer - dt);
        }
        const isCelebrating = hailMaryCelebrationTimer > 0;
        const animSpeed = isCelebrating ? 10.5 : 3.4;

        if (rockyBodyRig) {
          const bobAmp = isCelebrating ? 0.085 : 0.024;
          rockyBodyRig.position.y = 0.92 + Math.sin(elapsedTime * animSpeed) * bobAmp;
          rockyBodyRig.rotation.z = Math.sin(elapsedTime * (animSpeed * 0.75)) * (isCelebrating ? 0.12 : 0.035);
          rockyBodyRig.rotation.y =
            0.55 + Math.sin(elapsedTime * (isCelebrating ? 5.2 : 1.4)) * (isCelebrating ? 0.28 : 0.08);
        }

        for (let i = 0; i < rockyFrontClawPivots.length; i++) {
          const cp = rockyFrontClawPivots[i];
          const waveAmp = isCelebrating ? 0.42 : 0.16;
          cp.rotation.z = Math.sin(elapsedTime * (animSpeed * 1.35) + i * Math.PI) * waveAmp;
          cp.rotation.x = Math.cos(elapsedTime * animSpeed + i) * (waveAmp * 0.6);
        }

        for (let i = 0; i < rockyMusicParticles.length; i++) {
          const mp = rockyMusicParticles[i];
          const cycle = ((elapsedTime * (isCelebrating ? 1.35 : 0.55) + mp.phase) % 1.0);
          mp.mesh.position.set(
            mp.baseX + Math.sin(cycle * Math.PI * 2 + mp.phase) * 0.14,
            1.42 + cycle * (isCelebrating ? 1.15 : 0.68),
            mp.baseZ + Math.cos(cycle * Math.PI * 2 + mp.phase) * 0.14,
          );
          mp.mesh.rotation.y = elapsedTime * 2.4 + mp.phase;
          mp.mesh.scale.setScalar(Math.sin(cycle * Math.PI) * (isCelebrating ? 1.45 : 1.0));
        }

        if (astrophageOrbMesh) {
          astrophageOrbMesh.rotation.y = elapsedTime * 2.2;
        }

        if (spinDriveCoreMat) {
          spinDriveCoreMat.emissiveIntensity = isCelebrating
            ? 2.4 + Math.sin(elapsedTime * 16.0) * 0.7
            : 1.35 + Math.sin(elapsedTime * 4.5) * 0.35;
        }

        if (spinDrivePulseRing) {
          const ringCycle = (elapsedTime * (isCelebrating ? 2.2 : 0.9)) % 1.0;
          spinDrivePulseRing.position.x = 5.9 + ringCycle * 1.45;
          spinDrivePulseRing.scale.setScalar(0.85 + ringCycle * 0.65);
        }
      }

      // 1. Animate 3D Guidebook Page Flip
      if (pageFlipTimer > 0) {
        pageFlipTimer = Math.max(0, pageFlipTimer - dt);
        const prog = 1.0 - pageFlipTimer / 0.42;
        flipLeafMesh.rotation.z = prog * Math.PI;
        if (pageFlipTimer <= 0) {
          pageFlipGroup.visible = false;
        }
      }

      // 2. Highlight active Guidebook Step's Sorting Tray with a golden pulse
      let targetTrayIdx = -1;
      if (
        mode === 'lego_build' &&
        activeGuideIndex < GUIDEBOOK_BLUEPRINTS.length &&
        activeGuideStep < GUIDEBOOK_BLUEPRINTS[activeGuideIndex].steps.length
      ) {
        const reqShape = GUIDEBOOK_BLUEPRINTS[activeGuideIndex].steps[activeGuideStep].shape;
        targetTrayIdx = BRICK_SHAPE_META[reqShape].trayIndex;
      }
      for (let i = 0; i < sortingTrays.length; i++) {
        const tray = sortingTrays[i];
        if (i === targetTrayIdx) {
          tray.rimMat.emissiveIntensity = 0.65 + Math.sin(elapsedTime * 7.5) * 0.35;
        } else {
          tray.rimMat.emissiveIntensity = 0.16;
        }
      }

      // 3. Animate 0.06s Vertical Squash-and-Settle Ease on newly snapped bricks
      for (let i = 0; i < placedBricks.length; i++) {
        const pb = placedBricks[i];
        if (pb.settleTimer > 0) {
          pb.settleTimer = Math.max(0, pb.settleTimer - dt);
          const u = pb.settleTimer / 0.06;
          const targetY = pb.layerY * LAYER_HEIGHT;
          pb.mesh.position.y = targetY + u * 0.032;
          const squash = 1.0 + Math.sin(u * Math.PI) * 0.08;
          pb.mesh.scale.set(squash, 1.0 / squash, squash);
        }
      }

      // 4. Animate 5 Golden/Pink Stud-Sparkle Particles
      for (let i = 0; i < snapSparkles.length; i++) {
        const sp = snapSparkles[i];
        if (sp.life > 0) {
          sp.life = Math.max(0, sp.life - dt);
          sp.mesh.position.x += sp.vx * dt;
          sp.mesh.position.y += sp.vy * dt;
          sp.mesh.position.z += sp.vz * dt;
          sp.vy -= 1.5 * dt;
          sp.mesh.scale.setScalar(sp.life / 0.28);
          if (sp.life <= 0) sp.mesh.visible = false;
        }
      }

      // 5. Animate Blueprint Ghost Pulse
      if (blueprintGhostMesh.visible) {
        blueprintGhostMat.opacity = 0.34 + Math.sin(elapsedTime * 6.0) * 0.14;
      }

      // 6. Animate Cascade Disassembly ("Rebuild Tornado" — 1.1s arc back into sorting trays)
      if (mode === 'lego_rebuild_tornado') {
        tornadoTimer = Math.max(0, tornadoTimer - dt);
        const elapsedTornado = TORNADO_DURATION - tornadoTimer;
        for (let i = 0; i < tornadoParticles.length; i++) {
          const tp = tornadoParticles[i];
          const localT = THREE.MathUtils.clamp((elapsedTornado - tp.delay) / 0.65, 0, 1);
          _scratchVecA.lerpVectors(tp.startPos, tp.endPos, localT);
          _scratchVecA.y += Math.sin(localT * Math.PI) * 0.55;
          tp.mesh.position.copy(_scratchVecA);
          tp.mesh.rotation.y = localT * Math.PI * 4.0;
          tp.mesh.rotation.x = Math.sin(localT * Math.PI) * 1.2;
        }
        if (tornadoTimer <= 0) {
          while (tornadoParticles.length > 0) {
            const p = tornadoParticles.pop()!;
            group.remove(p.mesh);
          }
          mode = 'lego_build';
          activeCaption = '✨ All bricks sorted! Follow the 3D Guidebook to rebuild step-by-step.';
          captionTimer = 3.5;
        }
      }

      // 7. Animate 1.4s "Bring to Life" Awakening Sequence
      if (mode === 'lego_awakening' && activeLiveCreation) {
        awakeningTimer = Math.max(0, awakeningTimer - dt);
        const prog = 1.0 - awakeningTimer / 1.4;
        const smoothProg = prog * prog * (3 - 2 * prog);

        activeLiveCreation.root.position.set(
          THREE.MathUtils.lerp(TABLE_LX, PLATFORM_LX, smoothProg),
          THREE.MathUtils.lerp(TABLE_TOP_Y + 0.08, y0 + 0.11, smoothProg) +
            Math.sin(prog * Math.PI) * 0.42,
          THREE.MathUtils.lerp(TABLE_LZ, PLATFORM_LZ, smoothProg),
        );
        activeLiveCreation.root.rotation.y = smoothProg * Math.PI * 2.0;

        // Rising golden-pink stardust ring
        awakeningRingMesh.position.y = 0.08 + prog * 0.68;
        awakeningRingMesh.scale.setScalar(0.85 + Math.sin(prog * Math.PI) * 0.45);
        awakeningRingMat.opacity = (1.0 - prog) * 0.95;
        activeLiveCreation.headlightMat.emissiveIntensity = 0.5 + prog * 1.4;

        if (awakeningTimer <= 0) {
          awakeningRingMesh.visible = false;
          mode = 'lego_remote';
          activeLiveCreation.lx = PLATFORM_LX;
          activeLiveCreation.ly =
            activeLiveCreation.record.archetype === 'spaceship' ? y0 + 0.45 : y0 + 0.11;
          activeLiveCreation.lz = PLATFORM_LZ;
          activeLiveCreation.yaw = 0;
          activeCaption = `🎮 Remote Control Active! Use WASD to control ${activeLiveCreation.record.title} and [Space] for its special action!`;
          captionTimer = 4.2;
        }
      }

      // 8. Animate Physical Remote Control Locomotion (Car, Creature, Robot, Spaceship, Structure)
      if (mode === 'lego_remote' && activeLiveCreation) {
        const c = activeLiveCreation;
        const arch = c.record.archetype;
        const moveW = Boolean(inputKeys?.has('KeyW') || inputKeys?.has('ArrowUp'));
        const moveS = Boolean(inputKeys?.has('KeyS') || inputKeys?.has('ArrowDown'));
        const moveA = Boolean(inputKeys?.has('KeyA') || inputKeys?.has('ArrowLeft'));
        const moveD = Boolean(inputKeys?.has('KeyD') || inputKeys?.has('ArrowRight'));
        const moveUp = Boolean(inputKeys?.has('KeyQ') || inputKeys?.has('ShiftLeft'));
        const moveDown = Boolean(inputKeys?.has('KeyZ') || inputKeys?.has('ControlLeft'));

        if (c.actionAnimTimer > 0) {
          c.actionAnimTimer = Math.max(0, c.actionAnimTimer - dt);
        }
        const actProg = c.actionAnimTimer > 0 ? 1.0 - c.actionAnimTimer / 0.78 : 0;

        if (arch === 'structure') {
          // Pure Structure: Interactive warm lights, chimney heart-smoke puffs & rotating music-box turntable
          const turnInput = (moveA ? 1 : 0) - (moveD ? 1 : 0);
          c.turntableGroup.rotation.y += (0.85 + turnInput * 2.2) * dt;
          c.headlightMat.emissiveIntensity = 1.15 + Math.sin(elapsedTime * 5.0) * 0.45;
          c.root.position.set(c.lx, c.ly + Math.sin(elapsedTime * 3.0) * 0.012, c.lz);

          // Rising chimney heart-smoke puff
          const puffCycle = (elapsedTime * 0.85) % 1.0;
          heartBubbleGroup.visible = true;
          heartBubbleGroup.position.set(
            c.lx + Math.sin(puffCycle * Math.PI * 2) * 0.05,
            c.ly + 0.32 + puffCycle * 0.42,
            c.lz,
          );
          heartBubbleGroup.scale.setScalar(0.65 + puffCycle * 0.6);
        } else {
          // Movable Toy Creation (Car, Creature, Robot, Spaceship)
          const maxSpd =
            arch === 'spaceship' ? 2.65 : arch === 'car' ? 2.35 : arch === 'robot' ? 1.45 : 1.65;
          const targetSpd = moveW ? maxSpd : moveS ? -maxSpd * 0.6 : 0;
          c.forwardSpeed = THREE.MathUtils.lerp(c.forwardSpeed, targetSpd, 1 - Math.exp(-7.5 * dt));

          const turnRate = arch === 'car' ? 2.8 : 3.2;
          const turnInput = (moveA ? 1 : 0) - (moveD ? 1 : 0);
          c.yaw += turnInput * turnRate * dt;

          // Forward vector in local workshop coordinates (-Z is yaw = 0)
          const fwdX = -Math.sin(c.yaw);
          const fwdZ = -Math.cos(c.yaw);
          c.lx = THREE.MathUtils.clamp(c.lx + fwdX * c.forwardSpeed * dt, -4.6, 5.4);
          c.lz = THREE.MathUtils.clamp(c.lz + fwdZ * c.forwardSpeed * dt, -2.8, 4.2);

          // Avoid colliding with the Master Build Table footprint
          const dxT = c.lx - TABLE_LX;
          const dzT = c.lz - TABLE_LZ;
          const distT = Math.hypot(dxT, dzT);
          if (distT < 0.96 && distT > 0.001 && c.ly < y0 + 0.92) {
            c.lx = TABLE_LX + (dxT / distT) * 0.96;
            c.lz = TABLE_LZ + (dzT / distT) * 0.96;
          }

          // Miniature Ruler-Ramp Jump Boost at (PLATFORM_LX, PLATFORM_LZ - 1.08)
          const distRamp = Math.hypot(c.lx - PLATFORM_LX, c.lz - (PLATFORM_LZ - 1.08));
          const rampHeight = distRamp < 0.34 ? (1.0 - distRamp / 0.34) * 0.14 : 0;

          if (arch === 'spaceship') {
            const vertIn = (moveUp ? 1 : 0) - (moveDown ? 1 : 0);
            c.ly = THREE.MathUtils.clamp(
              c.ly + vertIn * 1.15 * dt,
              y0 + 0.25,
              y0 + 1.85,
            );
            const hoverBob = Math.sin(elapsedTime * 4.5) * 0.035;
            c.root.position.set(c.lx, c.ly + hoverBob, c.lz);
            c.root.rotation.set(
              -c.forwardSpeed * 0.08,
              c.yaw,
              -turnInput * 0.38 + (c.actionAnimTimer > 0 ? actProg * Math.PI * 2.0 : 0),
            );
            heartBubbleGroup.visible = false;
          } else if (arch === 'car') {
            const wheeliePitch =
              c.actionAnimTimer > 0 ? Math.sin(actProg * Math.PI) * 0.48 : 0;
            const jumpArc =
              c.actionAnimTimer > 0 ? Math.sin(actProg * Math.PI) * 0.18 : 0;
            c.ly = y0 + 0.08 + rampHeight + jumpArc;
            c.root.position.set(c.lx, c.ly, c.lz);
            c.root.rotation.set(wheeliePitch, c.yaw, -turnInput * 0.12);
            heartBubbleGroup.visible = false;
          } else if (arch === 'creature') {
            const isMoving = Math.abs(c.forwardSpeed) > 0.08 || Math.abs(turnInput) > 0.05;
            if (isMoving) c.hopPhase += dt * 11.0;
            const hopY = isMoving ? Math.abs(Math.sin(c.hopPhase)) * 0.095 : Math.sin(elapsedTime * 3.2) * 0.015;
            c.ly = y0 + 0.08 + rampHeight + hopY;
            c.root.position.set(c.lx, c.ly, c.lz);
            c.root.rotation.set(
              isMoving ? Math.cos(c.hopPhase) * 0.14 : 0,
              c.yaw,
              isMoving ? Math.sin(c.hopPhase * 0.5) * 0.1 : 0,
            );
            // Cute roar floating heart bubble on Spacebar
            if (c.actionAnimTimer > 0) {
              heartBubbleGroup.visible = true;
              heartBubbleGroup.position.set(c.lx, c.ly + 0.34 + actProg * 0.28, c.lz);
              heartBubbleGroup.scale.setScalar(0.85 + Math.sin(actProg * Math.PI) * 0.65);
            } else {
              heartBubbleGroup.visible = false;
            }
          } else if (arch === 'robot') {
            const isMoving = Math.abs(c.forwardSpeed) > 0.08 || Math.abs(turnInput) > 0.05;
            if (isMoving) c.hopPhase += dt * 9.5;
            const marchBob = isMoving ? Math.abs(Math.cos(c.hopPhase)) * 0.045 : Math.sin(elapsedTime * 2.8) * 0.01;
            c.ly = y0 + 0.08 + rampHeight + marchBob;
            c.root.position.set(c.lx, c.ly, c.lz);
            const spinYaw = c.actionAnimTimer > 0 ? actProg * Math.PI * 2.0 : 0;
            c.root.rotation.set(
              0,
              c.yaw + spinYaw,
              isMoving ? Math.sin(c.hopPhase) * 0.12 : 0,
            );
            heartBubbleGroup.visible = false;
          }

          // Check proximity to Wobble LEGO Flowers along the Test Track
          for (let i = 0; i < wobbleFlowers.length; i++) {
            const wf = wobbleFlowers[i];
            const df = Math.hypot(c.lx - wf.lx, c.lz - wf.lz);
            if (df < 0.28 && Math.abs(c.forwardSpeed) > 0.15) {
              wf.wobbleVel = 6.5;
            }
          }
        }
      }

      // 9. Update Wobble LEGO Flowers spring physics & Showcase pedestal gentle rotation
      for (let i = 0; i < wobbleFlowers.length; i++) {
        const wf = wobbleFlowers[i];
        if (Math.abs(wf.wobbleAngle) > 0.001 || Math.abs(wf.wobbleVel) > 0.001) {
          wf.wobbleVel -= wf.wobbleAngle * 28.0 * dt;
          wf.wobbleVel *= Math.exp(-4.5 * dt);
          wf.wobbleAngle += wf.wobbleVel * dt;
          wf.group.rotation.x = Math.sin(elapsedTime * 8.0) * wf.wobbleAngle * 0.35;
          wf.group.rotation.z = Math.cos(elapsedTime * 8.0) * wf.wobbleAngle * 0.35;
        }
      }

      for (let i = 0; i < showcasePedestals.length; i++) {
        const sp = showcasePedestals[i];
        if (sp.mountedRoot) {
          sp.mountedRoot.rotation.y = elapsedTime * 0.55 + i * 0.9;
        }
      }
      padRuneRingMesh.rotation.z = elapsedTime * 0.65;
    },

    dispose() {
      tracker.dispose();
    },
  };
}

/**
 * Standalone factory for the Playful Brick District LEGO World Workshop at (-80, +5).
 */
export function createPlayfulBrickWorkshop(): CastleLegoWorkshopBundle {
  const tracker = new ResourceTracker();
  const mats = createDreamCastleMaterials(tracker);
  const originX = -80.0;
  const originZ = 5.0;
  const baseY = getTerrainHeight(originX, originZ);
  const workshop = createCastleLegoWorkshop(tracker, mats, originX, baseY, originZ, 0.0);
  workshop.group.name = 'PlayfulBrickDistrictWorkshop';
  workshop.group.position.set(originX, baseY, originZ);
  return workshop;
}

