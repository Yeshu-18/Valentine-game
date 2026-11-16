import * as THREE from 'three';
import { CircleCollider } from '../VegetationSystem';
import {
  PRIVATE_ARRIVAL_GATE_POS,
  PRIVATE_ISLAND_BOUNDS,
  PROPOSAL_GARDEN_CENTER,
  PROPOSAL_PATH_SAMPLES,
  createPrivateSeededRng,
  getPrivateTerrainHeight,
} from './privateWorldMath';
import {
  PROPOSAL_STAGE_POS,
  ProposalSequenceState,
  STARGAZING_LOVESEAT_POS,
  STARGAZING_SKY_SEQUENCE,
  STARGAZING_TELESCOPE_POS,
} from './PrivateWorldInteractionSystem';
import { PrivatePathLightingTelemetry } from './PrivatePathLighting';
import { TrailDestinationId } from './PrivateTrailSignSystem';

/**
 * 11 unique personal photographs arranged across the 3 concentric 360° Memory Sky orbits:
 * - Indices 0..3 (4 photos): Layer 1 — Inner Orbit (closest to floral arch, slow clockwise)
 * - Indices 4..7 (4 photos): Layer 2 — Middle Orbit (wider circle, staggered heights, very slow counterclockwise)
 * - Indices 8..10 (3 photos): Layer 3 — Outer Celestial Orbit (higher in the sky, smaller frames, gentle float)
 */
export const MEMORY_SKY_PHOTO_URLS: readonly string[] = [
  // Layer 1: Inner Orbit (4 photographs)
  '/assets/harsha/photo-romantic.jpg',
  '/assets/harsha/photo-treasured.jpg',
  '/assets/harsha/photo-playful.jpg',
  '/assets/aistudio/WhatsApp_Image_2026-11-03_at_11.55.38_0d91e902.jpeg',
  // Layer 2: Middle Orbit (4 photographs)
  '/assets/aistudio/WhatsApp_Image_2026-11-03_at_12.07.27_38c04f45.jpeg',
  '/assets/aistudio/WhatsApp_Image_2026-11-03_at_12.07.43_45c8be2a.jpeg',
  '/assets/aistudio/WhatsApp_Image_2026-11-03_at_12.07.54_deb94ac6.jpeg',
  '/assets/aistudio/WhatsApp_Image_2026-11-03_at_12.08.06_4a77344d.jpeg',
  // Layer 3: Outer Celestial Orbit (3 photographs)
  '/assets/aistudio/WhatsApp_Image_2026-11-03_at_12.08.16_c459e503.jpeg',
  '/assets/aistudio/WhatsApp_Image_2026-11-03_at_12.08.34_fb260cf3.jpeg',
  '/assets/aistudio/WhatsApp_Image_2026-11-03_at_12.08.47_c4696d67.jpeg',
];

export interface PrivateWorldSceneBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  setDebugVisible: (visible: boolean) => void;
  isDebugVisible: () => boolean;
  setVegetationVisible: (visible: boolean) => void;
  isVegetationVisible: () => boolean;
  resetPathLighting: () => void;
  setOnSteppingStoneStep: (cb: (stoneIndex: number) => void) => void;
  triggerPondRipple: (
    worldX: number,
    worldZ: number,
    strength?: number,
    isPlayerTouch?: boolean,
  ) => void;
  triggerPondTouchRipple: (worldX: number, worldZ: number) => void;
  setTelescopeSkyState: (
    active: boolean,
    strength: number,
    connectedSkyNodesCount?: number,
    focusedNodeIndex?: number,
    discoveredLettersMask?: number,
  ) => void;
  setTelescopeHighlight: (
    active: boolean,
    strength: number,
    connectedSkyNodesCount?: number,
    focusedNodeIndex?: number,
    discoveredLettersMask?: number,
  ) => void;
  setProposalSequenceState: (state: ProposalSequenceState) => void;
  setLoveseatCompanionActive: (active: boolean) => void;
  getPathLightingTelemetry: () => PrivatePathLightingTelemetry;
  getRouteDistanceTo: (
    playerX: number,
    playerZ: number,
    destinationId: TrailDestinationId,
  ) => number;
  update: (
    delta: number,
    elapsedTime: number,
    playerPos?: THREE.Vector3,
    playerVelocity?: THREE.Vector3,
    camera?: THREE.Camera,
  ) => void;
  dispose: () => void;
}

interface ConstellationStarPointDef {
  u: number; // Viewer-right offset in local constellation tangent plane (-1..+1)
  v: number; // Viewer-up offset in local constellation tangent plane (-1..+1)
  mag: number; // Relative star brightness/scale (0.55 = faint companion .. 1.35 = primary star)
  colorHex: number; // Soft, non-blooming astronomical star color
  isSpur?: boolean; // True for off-axis astronomical spur/companion stars
}

interface OrganicLetterConstellationBlueprint {
  letter: string;
  yaw: number;
  pitch: number;
  scale: number; // World-space span radius on the sky dome (meters)
  tiltRad: number; // Slight organic astronomical tilt so letters never look like a rigid grid font
  stars: readonly ConstellationStarPointDef[];
  mainEdges: ReadonlyArray<readonly [number, number]>; // Crooked primary letter skeleton
  spurEdges: ReadonlyArray<readonly [number, number]>; // Faint off-axis astronomical spur branches
  anchorStarIdx: number; // Star index used for inter-letter celestial guide thread
}

/**
 * ALWAYS-VISIBLE "M A N D U" STAR CONSTELLATION BLUEPRINTS
 * Ordered Left-to-Right across the eastern night sky (yaw 1.96 -> 1.18, pitch ~0.34..0.41)
 * so "M A N D U" is naturally visible to the naked eye at all times.
 */
const MANDU_CONSTELLATION_BLUEPRINTS: readonly OrganicLetterConstellationBlueprint[] =
  [
    // 1. "M" — Cassiopeia-inspired crooked 5-star 'M' on the left of the eastern sky
    {
      letter: 'M',
      yaw: 1.96,
      pitch: 0.34,
      scale: 8.6,
      tiltRad: 0.06,
      anchorStarIdx: 2,
      stars: [
        { u: -0.62, v: -0.86, mag: 1.05, colorHex: 0x9eb8d6 },
        { u: -0.48, v: 0.92, mag: 1.25, colorHex: 0xd4c7ad },
        { u: -0.03, v: -0.12, mag: 1.12, colorHex: 0xb4cce4 },
        { u: 0.45, v: 0.88, mag: 1.22, colorHex: 0xc8daec },
        { u: 0.64, v: -0.84, mag: 1.02, colorHex: 0x9eb8d6 },
        { u: -0.82, v: 0.54, mag: 0.62, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
      spurEdges: [[1, 5]],
    },

    // 2. "A" — Asymmetric 6-star 'A' with kinked legs and canted crossbar
    {
      letter: 'A',
      yaw: 1.76,
      pitch: 0.39,
      scale: 8.4,
      tiltRad: -0.05,
      anchorStarIdx: 2,
      stars: [
        { u: -0.55, v: -0.88, mag: 1.02, colorHex: 0x9eb8d6 },
        { u: -0.27, v: 0.04, mag: 1.1, colorHex: 0xb8cfe6 },
        { u: 0.04, v: 0.94, mag: 1.28, colorHex: 0xd6c8ae },
        { u: 0.31, v: -0.03, mag: 1.08, colorHex: 0xb8cfe6 },
        { u: 0.54, v: -0.86, mag: 1.04, colorHex: 0xa4bedb },
        { u: 0.28, v: 1.14, mag: 0.6, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [1, 3],
      ],
      spurEdges: [[2, 5]],
    },

    // 3. "N" — Crooked 6-star 'N' centered due East
    {
      letter: 'N',
      yaw: 1.57,
      pitch: 0.35,
      scale: 8.4,
      tiltRad: 0.07,
      anchorStarIdx: 3,
      stars: [
        { u: -0.52, v: -0.88, mag: 1.04, colorHex: 0xa4bedb },
        { u: -0.45, v: 0.14, mag: 0.92, colorHex: 0x9eb8d6 },
        { u: -0.49, v: 0.92, mag: 1.24, colorHex: 0xd4c7ad },
        { u: 0.05, v: -0.06, mag: 1.0, colorHex: 0xb8cfe6 },
        { u: 0.47, v: -0.9, mag: 1.18, colorHex: 0xc8daec },
        { u: 0.53, v: 0.9, mag: 1.16, colorHex: 0xb8cfe6 },
        { u: 0.76, v: 1.06, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
      ],
      spurEdges: [[5, 6]],
    },

    // 4. "D" — Organic 6-star polygonal loop 'D'
    {
      letter: 'D',
      yaw: 1.38,
      pitch: 0.4,
      scale: 8.4,
      tiltRad: -0.06,
      anchorStarIdx: 1,
      stars: [
        { u: -0.46, v: 0.92, mag: 1.24, colorHex: 0xd4c7ad },
        { u: -0.52, v: -0.04, mag: 1.02, colorHex: 0xb4cce4 },
        { u: -0.44, v: -0.88, mag: 1.16, colorHex: 0xc8daec },
        { u: 0.19, v: -0.74, mag: 0.98, colorHex: 0x9eb8d6 },
        { u: 0.52, v: -0.02, mag: 1.2, colorHex: 0xb8cfe6 },
        { u: 0.22, v: 0.76, mag: 1.04, colorHex: 0xa4bedb },
        { u: -0.74, v: 0.62, mag: 0.6, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 0],
      ],
      spurEdges: [[0, 6]],
    },

    // 5. "U" — Organic 6-star cup 'U' on the right of the MANDU arc
    {
      letter: 'U',
      yaw: 1.18,
      pitch: 0.35,
      scale: 8.5,
      tiltRad: 0.05,
      anchorStarIdx: 3,
      stars: [
        { u: -0.48, v: 0.9, mag: 1.22, colorHex: 0xc8daec },
        { u: -0.52, v: -0.16, mag: 0.98, colorHex: 0x9eb8d6 },
        { u: -0.24, v: -0.86, mag: 1.06, colorHex: 0xb4cce4 },
        { u: 0.24, v: -0.84, mag: 1.14, colorHex: 0xd4c7ad },
        { u: 0.5, v: -0.14, mag: 1.0, colorHex: 0xa4bedb },
        { u: 0.48, v: 0.92, mag: 1.24, colorHex: 0xb8cfe6 },
        { u: 0.74, v: 1.08, mag: 0.6, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
      ],
      spurEdges: [[5, 6]],
    },
  ];

/**
 * TELESCOPE-ONLY "I LOVE YOU" STAR CONSTELLATION BLUEPRINTS
 * Ordered Left-to-Right across the sky (from yaw = 2.36 on the left to yaw = 0.76 on the right).
 * Soft, muted starlight colors so they never blow out with post-processing bloom.
 */
const ORGANIC_LETTER_CONSTELLATION_BLUEPRINTS: readonly OrganicLetterConstellationBlueprint[] =
  [
    // 1. "I"
    {
      letter: 'I',
      yaw: STARGAZING_SKY_SEQUENCE[0].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[0].pitch,
      scale: 9.2,
      tiltRad: 0.11,
      anchorStarIdx: 1,
      stars: [
        { u: 0.05, v: 0.92, mag: 1.18, colorHex: 0xd6c8ad },
        { u: -0.09, v: 0.11, mag: 1.02, colorHex: 0xb4cce4 },
        { u: 0.04, v: -0.88, mag: 1.14, colorHex: 0xcfc2a8 },
        { u: -0.34, v: 0.81, mag: 0.82, colorHex: 0x9eb8d6 },
        { u: 0.39, v: 1.02, mag: 0.86, colorHex: 0xc8d8e8 },
        { u: -0.38, v: -0.96, mag: 0.84, colorHex: 0xa4bedb },
        { u: 0.35, v: -0.76, mag: 0.8, colorHex: 0xcab8c8 },
        { u: -0.48, v: 0.28, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [3, 0],
        [0, 4],
        [0, 1],
        [1, 2],
        [5, 2],
        [2, 6],
      ],
      spurEdges: [[1, 7]],
    },

    // 2. "L"
    {
      letter: 'L',
      yaw: STARGAZING_SKY_SEQUENCE[1].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[1].pitch,
      scale: 9.6,
      tiltRad: -0.09,
      anchorStarIdx: 3,
      stars: [
        { u: -0.26, v: 0.98, mag: 1.2, colorHex: 0xd6c8ad },
        { u: -0.38, v: 0.31, mag: 0.94, colorHex: 0xa4bedb },
        { u: -0.24, v: -0.32, mag: 0.88, colorHex: 0xb8cfe6 },
        { u: -0.33, v: -0.89, mag: 1.16, colorHex: 0xcfc2a8 },
        { u: 0.14, v: -0.96, mag: 0.96, colorHex: 0xc8d8e8 },
        { u: 0.54, v: -0.74, mag: 1.08, colorHex: 0xb4cce4 },
        { u: -0.62, v: 0.78, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true },
        { u: 0.78, v: -0.92, mag: 0.55, colorHex: 0xbca8bc, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
      ],
      spurEdges: [
        [0, 6],
        [5, 7],
      ],
    },

    // 3. "O"
    {
      letter: 'O',
      yaw: STARGAZING_SKY_SEQUENCE[2].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[2].pitch,
      scale: 9.4,
      tiltRad: 0.08,
      anchorStarIdx: 2,
      stars: [
        { u: -0.08, v: 0.96, mag: 1.18, colorHex: 0xd6c8ad },
        { u: 0.44, v: 0.64, mag: 0.95, colorHex: 0xb4cce4 },
        { u: 0.58, v: -0.06, mag: 1.12, colorHex: 0xcfc2a8 },
        { u: 0.31, v: -0.81, mag: 0.88, colorHex: 0x9eb8d6 },
        { u: -0.19, v: -0.93, mag: 1.04, colorHex: 0xc8d8e8 },
        { u: -0.56, v: -0.38, mag: 0.86, colorHex: 0xa4bedb },
        { u: -0.48, v: 0.48, mag: 1.0, colorHex: 0xcab8c8 },
        { u: 0.82, v: 0.88, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 0],
      ],
      spurEdges: [[1, 7]],
    },

    // 4. "V"
    {
      letter: 'V',
      yaw: STARGAZING_SKY_SEQUENCE[3].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[3].pitch,
      scale: 9.8,
      tiltRad: -0.07,
      anchorStarIdx: 2,
      stars: [
        { u: -0.58, v: 0.95, mag: 1.14, colorHex: 0xb4cce4 },
        { u: -0.26, v: 0.14, mag: 0.92, colorHex: 0xc8d8e8 },
        { u: -0.03, v: -0.92, mag: 1.24, colorHex: 0xd6c8ad },
        { u: 0.29, v: -0.08, mag: 0.96, colorHex: 0xa4bedb },
        { u: 0.54, v: 0.88, mag: 1.16, colorHex: 0xcfc2a8 },
        { u: 0.81, v: 1.06, mag: 0.6, colorHex: 0x8aa6c4, isSpur: true },
        { u: -0.79, v: 0.68, mag: 0.55, colorHex: 0xbca8bc, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
      spurEdges: [
        [4, 5],
        [0, 6],
      ],
    },

    // 5. "E"
    {
      letter: 'E',
      yaw: STARGAZING_SKY_SEQUENCE[4].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[4].pitch,
      scale: 9.6,
      tiltRad: 0.09,
      anchorStarIdx: 1,
      stars: [
        { u: -0.34, v: 0.93, mag: 1.16, colorHex: 0xd6c8ad },
        { u: -0.44, v: 0.07, mag: 1.08, colorHex: 0xb4cce4 },
        { u: -0.29, v: -0.89, mag: 1.12, colorHex: 0xcfc2a8 },
        { u: 0.11, v: 1.01, mag: 0.88, colorHex: 0x9eb8d6 },
        { u: 0.52, v: 0.84, mag: 1.02, colorHex: 0xc8d8e8 },
        { u: 0.28, v: 0.16, mag: 1.0, colorHex: 0xcab8c8 },
        { u: 0.16, v: -0.96, mag: 0.86, colorHex: 0xa4bedb },
        { u: 0.5, v: -0.76, mag: 1.04, colorHex: 0xc8d8e8 },
        { u: -0.72, v: -0.22, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [4, 3],
        [3, 0],
        [0, 1],
        [1, 2],
        [1, 5],
        [2, 6],
        [6, 7],
      ],
      spurEdges: [[1, 8]],
    },

    // 6. "Y"
    {
      letter: 'Y',
      yaw: STARGAZING_SKY_SEQUENCE[5].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[5].pitch,
      scale: 9.8,
      tiltRad: -0.1,
      anchorStarIdx: 2,
      stars: [
        { u: -0.56, v: 0.96, mag: 1.14, colorHex: 0xc8d8e8 },
        { u: -0.22, v: 0.48, mag: 0.88, colorHex: 0x9eb8d6 },
        { u: 0.03, v: 0.06, mag: 1.22, colorHex: 0xd6c8ad },
        { u: 0.58, v: 0.89, mag: 1.16, colorHex: 0xb4cce4 },
        { u: -0.09, v: -0.44, mag: 0.92, colorHex: 0xa4bedb },
        { u: 0.06, v: -0.93, mag: 1.1, colorHex: 0xcab8c8 },
        { u: -0.8, v: 0.72, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true },
        { u: 0.79, v: 0.56, mag: 0.56, colorHex: 0xbca8bc, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [3, 2],
        [2, 4],
        [4, 5],
      ],
      spurEdges: [
        [0, 6],
        [3, 7],
      ],
    },

    // 7. "O"
    {
      letter: 'O',
      yaw: STARGAZING_SKY_SEQUENCE[6].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[6].pitch,
      scale: 9.4,
      tiltRad: -0.11,
      anchorStarIdx: 1,
      stars: [
        { u: 0.09, v: 0.95, mag: 1.16, colorHex: 0xb4cce4 },
        { u: 0.54, v: 0.36, mag: 1.04, colorHex: 0xd6c8ad },
        { u: 0.39, v: -0.66, mag: 0.92, colorHex: 0xcab8c8 },
        { u: -0.14, v: -0.94, mag: 1.14, colorHex: 0xcfc2a8 },
        { u: -0.55, v: -0.24, mag: 0.88, colorHex: 0x9eb8d6 },
        { u: -0.37, v: 0.64, mag: 1.0, colorHex: 0xc8d8e8 },
        { u: -0.78, v: -0.62, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 0],
      ],
      spurEdges: [[4, 6]],
    },

    // 8. "U"
    {
      letter: 'U',
      yaw: STARGAZING_SKY_SEQUENCE[7].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[7].pitch,
      scale: 9.8,
      tiltRad: 0.08,
      anchorStarIdx: 3,
      stars: [
        { u: -0.49, v: 0.93, mag: 1.16, colorHex: 0xd6c8ad },
        { u: -0.54, v: 0.14, mag: 0.92, colorHex: 0xb4cce4 },
        { u: -0.35, v: -0.68, mag: 0.88, colorHex: 0xcfc2a8 },
        { u: 0.04, v: -0.94, mag: 1.14, colorHex: 0xcab8c8 },
        { u: 0.39, v: -0.61, mag: 0.9, colorHex: 0x9eb8d6 },
        { u: 0.47, v: 0.18, mag: 0.98, colorHex: 0xc8d8e8 },
        { u: 0.54, v: 0.96, mag: 1.2, colorHex: 0xd6c8ad },
        { u: 0.84, v: 1.14, mag: 0.62, colorHex: 0xbca8bc, isSpur: true },
      ],
      mainEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
      ],
      spurEdges: [[6, 7]],
    },
  ];

/**
 * DETERMINISTIC STAR-CONSTELLATION GLYPHS FOR "HAPPY VALENTINE'S DAY, MY LOVE"
 * Every letter is defined in local `(u, v)` coordinates (`u ∈ [-0.45, +0.45]` left-to-right,
 * `v ∈ [-0.85, +0.85]` bottom-to-top) with explicit star vertices and constellation line edges.
 */
interface StarGlyphTemplate {
  width: number;
  points: ReadonlyArray<readonly [number, number]>;
  edges: ReadonlyArray<readonly [number, number]>;
}

const PROPOSAL_SKY_GLYPHS: Record<string, StarGlyphTemplate> = {
  H: {
    width: 1.0,
    points: [
      [-0.4, -0.84],
      [-0.38, 0.02],
      [-0.41, 0.85],
      [0.39, -0.83],
      [0.37, -0.02],
      [0.41, 0.84],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
      [1, 4],
    ],
  },
  A: {
    width: 1.0,
    points: [
      [-0.44, -0.84],
      [-0.22, -0.04],
      [0.02, 0.86],
      [0.24, -0.05],
      [0.43, -0.83],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [1, 3],
    ],
  },
  P: {
    width: 0.95,
    points: [
      [-0.38, -0.84],
      [-0.39, 0.04],
      [-0.37, 0.84],
      [0.22, 0.81],
      [0.41, 0.44],
      [0.2, 0.05],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 1],
    ],
  },
  Y: {
    width: 1.0,
    points: [
      [-0.44, 0.85],
      [0.0, 0.06],
      [0.44, 0.84],
      [-0.02, -0.84],
    ],
    edges: [
      [0, 1],
      [2, 1],
      [1, 3],
    ],
  },
  V: {
    width: 1.0,
    points: [
      [-0.44, 0.85],
      [-0.21, -0.05],
      [0.01, -0.85],
      [0.23, -0.03],
      [0.44, 0.84],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  L: {
    width: 0.9,
    points: [
      [-0.36, 0.85],
      [-0.39, -0.02],
      [-0.35, -0.83],
      [0.38, -0.81],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },
  E: {
    width: 0.95,
    points: [
      [0.38, 0.84],
      [-0.38, 0.85],
      [-0.4, 0.02],
      [0.26, 0.03],
      [-0.37, -0.83],
      [0.4, -0.82],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [4, 5],
    ],
  },
  N: {
    width: 1.05,
    points: [
      [-0.41, -0.84],
      [-0.39, 0.85],
      [0.02, 0.02],
      [0.41, -0.83],
      [0.42, 0.85],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  T: {
    width: 0.95,
    points: [
      [-0.44, 0.84],
      [0.0, 0.85],
      [0.44, 0.83],
      [-0.02, 0.0],
      [0.01, -0.84],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
    ],
  },
  I: {
    width: 0.65,
    points: [
      [-0.24, 0.84],
      [0.01, 0.85],
      [0.25, 0.84],
      [-0.01, 0.0],
      [-0.24, -0.84],
      [0.0, -0.84],
      [0.25, -0.83],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 5],
      [4, 5],
      [5, 6],
    ],
  },
  "'": {
    width: 0.42,
    points: [
      [0.05, 0.92],
      [-0.06, 0.52],
    ],
    edges: [[0, 1]],
  },
  S: {
    width: 0.95,
    points: [
      [0.36, 0.72],
      [-0.04, 0.86],
      [-0.38, 0.52],
      [-0.02, 0.04],
      [0.39, -0.44],
      [0.02, -0.85],
      [-0.38, -0.66],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  D: {
    width: 1.0,
    points: [
      [-0.38, -0.84],
      [-0.39, 0.84],
      [0.14, 0.76],
      [0.42, 0.02],
      [0.16, -0.75],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
    ],
  },
  ',': {
    width: 0.45,
    points: [
      [0.04, -0.68],
      [-0.1, -1.08],
    ],
    edges: [[0, 1]],
  },
  M: {
    width: 1.15,
    points: [
      [-0.48, -0.84],
      [-0.44, 0.85],
      [0.0, -0.08],
      [0.44, 0.85],
      [0.48, -0.84],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  O: {
    width: 1.0,
    points: [
      [0.0, 0.86],
      [0.41, 0.42],
      [0.39, -0.44],
      [0.0, -0.85],
      [-0.4, -0.42],
      [-0.41, 0.44],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
    ],
  },
  ' ': {
    width: 0.72,
    points: [],
    edges: [],
  },
  // Heart-Hands ('🫶🏻' normalized to '♥') star-constellation glyph:
  // Heart outline formed by fingers + curved left/right hand-cuff arcs at the base
  '♥': {
    width: 1.35,
    points: [
      [0.0, 0.38], // 0: top heart dip
      [-0.28, 0.76], // 1: upper-left finger arch
      [-0.56, 0.36], // 2: mid-left outer knuckle
      [-0.38, -0.22], // 3: lower-left thumb curve
      [0.0, -0.74], // 4: bottom heart point (joined thumbs)
      [0.38, -0.22], // 5: lower-right thumb curve
      [0.56, 0.36], // 6: mid-right outer knuckle
      [0.28, 0.76], // 7: upper-right finger arch
      [-0.64, -0.52], // 8: left wrist/palm cuff
      [0.64, -0.52], // 9: right wrist/palm cuff
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
      [2, 8],
      [8, 4],
      [6, 9],
      [9, 4],
    ],
  },
};

interface BuiltLetterConstellationRuntime {
  index: number;
  letter: string;
  mainLineMat: THREE.LineBasicMaterial;
  spurLineMat: THREE.LineBasicMaterial;
  starCoreMeshes: THREE.Mesh[];
  starCoreMaterials: THREE.MeshBasicMaterial[];
  starHaloMaterials: THREE.MeshBasicMaterial[];
  starBaseScales: number[];
  anchorWorldPos: THREE.Vector3;
}

interface ProposalConstellationCharacterRuntime {
  normU: number; // Normalized left-to-right progress [0..1]
  group: THREE.Group;
  starMeshes: THREE.Mesh[];
  starMats: THREE.MeshBasicMaterial[];
  haloMats: THREE.MeshBasicMaterial[];
  lineMat: THREE.LineBasicMaterial;
  baseScales: number[];
}

/**
 * Projects a 2D point `(u, v)` in the viewer-aligned tangent plane of `(yaw, pitch)`
 * onto the 3D celestial sphere of radius `skyRadius`, applying the constellation's organic `tiltRad`.
 *
 * Guarantees that `+u` is always to the viewer's RIGHT and `+v` is always UPWARD when looking
 * toward `(yaw, pitch)`.
 */
function projectConstellationPointToSky(
  yaw: number,
  pitch: number,
  skyRadius: number,
  scale: number,
  tiltRad: number,
  u: number,
  v: number,
  originX = 0,
  originY = 3.5,
  originZ = 0,
): THREE.Vector3 {
  const cosP = Math.cos(pitch);
  const centerDir = new THREE.Vector3(
    Math.sin(yaw) * cosP,
    Math.sin(pitch),
    Math.cos(yaw) * cosP,
  ).normalize();

  const worldUp = new THREE.Vector3(0, 1, 0);
  const skyRight = new THREE.Vector3()
    .crossVectors(centerDir, worldUp)
    .normalize();
  const skyUp = new THREE.Vector3()
    .crossVectors(skyRight, centerDir)
    .normalize();

  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  const ru = u * cosT - v * sinT;
  const rv = u * sinT + v * cosT;

  const worldPos = centerDir.clone().multiplyScalar(skyRadius);
  worldPos.addScaledVector(skyRight, ru * scale);
  worldPos.addScaledVector(skyUp, rv * scale);
  worldPos.normalize().multiplyScalar(skyRadius);
  worldPos.x += originX;
  worldPos.y += originY;
  worldPos.z += originZ;
  return worldPos;
}

export function createPrivateWorldScene(
  _options?: unknown,
): PrivateWorldSceneBundle {
  const group = new THREE.Group();
  group.name = 'PrivateRomanticWorld_StargazingSanctuary';
  group.visible = false;

  const colliders: CircleCollider[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const texturesToDispose: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometriesToDispose.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materialsToDispose.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    texturesToDispose.push(t);
    return t;
  };

  // ==========================================================================
  // 1. CONNECTED MOONLIT SANCTUARY ISLAND, PENINSULA & PROPOSAL GARDEN TERRAIN
  // ==========================================================================
  const terrainSize = 96;
  const terrainGeo = trackGeo(
    new THREE.PlaneGeometry(terrainSize, terrainSize, 84, 84),
  );
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cRock = new THREE.Color(0x182538);
  const cMoss = new THREE.Color(0x1f3844);
  const cMeadow = new THREE.Color(0x234248);
  const cSand = new THREE.Color(0x233044);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i) + 12.0;
    const z = posAttr.getZ(i) + 10.0;
    posAttr.setX(i, x);
    posAttr.setZ(i, z);

    const y = getPrivateTerrainHeight(x, z);
    posAttr.setY(i, y);

    const hT = THREE.MathUtils.clamp((y + 1.5) / 5.2, 0, 1);
    tmpColor.copy(cSand).lerp(cRock, hT);
    if (y > 2.6) {
      tmpColor.lerp(cMoss, 0.5);
    }
    if (x > 11.0 && z > 7.0 && y > 3.6) {
      tmpColor.lerp(cMeadow, 0.55);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.06,
    }),
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Calm Moonlit Ocean Plane reflecting the night sky
  const waterGeo = trackGeo(new THREE.PlaneGeometry(560, 560, 1, 1));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x071528,
      emissive: 0x051020,
      emissiveIntensity: 0.42,
      roughness: 0.16,
      metalness: 0.82,
    }),
  );
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = PRIVATE_ISLAND_BOUNDS.waterLevel;
  group.add(waterMesh);

  // ==========================================================================
  // 2. STARGAZING OBSERVATORY DECK (Centered at (0, 0), Surface Y = 3.48m)
  // ==========================================================================
  const deckGroup = new THREE.Group();
  deckGroup.name = 'StargazingObservatoryDeck';
  const deckCX = 0.0;
  const deckCZ = 0.0;
  const deckBaseY = 3.2; // Surface of plank floorboards = 3.48m
  deckGroup.position.set(deckCX, deckBaseY, deckCZ);

  const deckTimberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4c3728,
      roughness: 0.76,
      metalness: 0.08,
    }),
  );
  const deckDarkTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c1f16,
      roughness: 0.82,
      metalness: 0.12,
    }),
  );
  const deckStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4f5d73,
      roughness: 0.86,
      metalness: 0.08,
    }),
  );
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9a84e,
      roughness: 0.28,
      metalness: 0.86,
    }),
  );
  const cushionFabricMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x28354e,
      roughness: 0.85,
      metalness: 0.03,
    }),
  );
  const pillowAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5c3a58,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );
  const warmDeckGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4b5,
      emissive: 0xffb347,
      emissiveIntensity: 0.95,
      roughness: 0.25,
    }),
  );

  // Circular Stone Foundation Plinth & Rim
  const stonePlinth = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(9.6, 10.4, 0.42, 40)),
    deckStoneMat,
  );
  stonePlinth.position.y = -0.02;
  stonePlinth.receiveShadow = true;
  deckGroup.add(stonePlinth);

  // Timber Deck Floor Platform (top surface at local Y = +0.28 -> world Y = 3.48m)
  const timberFloor = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(9.1, 9.25, 0.16, 40)),
    deckTimberMat,
  );
  timberFloor.position.y = 0.2;
  timberFloor.receiveShadow = true;
  deckGroup.add(timberFloor);

  // Concentric Inlaid Brass Celestial Compass Ring on the Deck Floor
  const compassOuterRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(3.45, 3.56, 48)),
    brassMat,
  );
  compassOuterRing.rotation.x = -Math.PI / 2;
  compassOuterRing.position.y = 0.284;
  deckGroup.add(compassOuterRing);

  const compassInnerRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(1.65, 1.72, 36)),
    brassMat,
  );
  compassInnerRing.rotation.x = -Math.PI / 2;
  compassInnerRing.position.y = 0.284;
  deckGroup.add(compassInnerRing);

  // Subtle Plank Seam Grooves
  const seamGeo = trackGeo(new THREE.BoxGeometry(0.035, 0.01, 17.2));
  for (let sx = -7.5; sx <= 7.5; sx += 0.75) {
    const chord = Math.sqrt(Math.max(0.5, 81.0 - sx * sx)) * 1.95;
    const seam = new THREE.Mesh(seamGeo, deckDarkTrimMat);
    seam.scale.z = chord / 17.2;
    seam.position.set(sx, 0.282, 0);
    deckGroup.add(seam);
  }

  // Western Stone Entry Steps leading from Return Portal (-10.5, 0) up onto the Deck
  for (let st = 0; st < 4; st++) {
    const stepW = 3.4 - st * 0.12;
    const stepMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.85, 0.18, stepW)),
      deckStoneMat,
    );
    const lx = -10.8 + st * 0.62;
    const ly = 0.02 + st * 0.07;
    stepMesh.position.set(lx, ly, 0);
    stepMesh.receiveShadow = true;
    deckGroup.add(stepMesh);
  }

  // Low Open-Sky Perimeter Bollards & Rope Railings
  // Leave clear openings at Western Portal (-PI), Eastern sky view (0), and North-Eastern Proposal Garden Path (+0.76 rad)
  const postGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 0.64, 10));
  const postCapGeo = trackGeo(new THREE.SphereGeometry(0.085, 10, 8));
  const railBeamGeo = trackGeo(
    new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8),
  );
  railBeamGeo.rotateZ(Math.PI / 2);

  const postAngles: number[] = [];
  const numPosts = 20;
  for (let i = 0; i < numPosts; i++) {
    const a = -Math.PI + (i / numPosts) * Math.PI * 2;
    if (Math.abs(Math.abs(a) - Math.PI) < 0.26) continue; // Western portal opening
    if (Math.abs(a) < 0.42) continue; // Eastern telescope sky opening
    if (Math.abs(a - 0.76) < 0.32) continue; // North-Eastern Proposal Garden Path opening!
    postAngles.push(a);
  }

  const postPositions: THREE.Vector3[] = [];
  for (let i = 0; i < postAngles.length; i++) {
    const a = postAngles[i];
    const px = Math.cos(a) * 8.85;
    const pz = Math.sin(a) * 8.85;
    const post = new THREE.Mesh(postGeo, deckDarkTrimMat);
    post.position.set(px, 0.56, pz);
    deckGroup.add(post);

    if (i % 2 === 0) {
      const cap = new THREE.Mesh(postCapGeo, warmDeckGlowMat);
      cap.position.set(px, 0.9, pz);
      deckGroup.add(cap);
    }
    postPositions.push(new THREE.Vector3(px, 0.72, pz));
  }

  for (let i = 0; i < postPositions.length - 1; i++) {
    const pA = postPositions[i];
    const pB = postPositions[i + 1];
    const dist = pA.distanceTo(pB);
    if (dist < 3.6) {
      const rail = new THREE.Mesh(railBeamGeo, deckTimberMat);
      rail.position.lerpVectors(pA, pB, 0.5);
      rail.scale.x = dist;
      rail.rotation.y = -Math.atan2(pB.z - pA.z, pB.x - pA.x);
      deckGroup.add(rail);
    }
  }

  // Two Reclining Timber Sky-Loungers on the North-West & South-West Deck
  const createSkyLounger = (lx: number, lz: number, yaw: number) => {
    const lounger = new THREE.Group();
    lounger.position.set(lx, 0.28, lz);
    lounger.rotation.y = yaw;

    const frame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.95, 0.14, 0.86)),
      deckDarkTrimMat,
    );
    frame.position.y = 0.22;
    lounger.add(frame);

    const mattress = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.84, 0.12, 0.78)),
      cushionFabricMat,
    );
    mattress.position.y = 0.33;
    lounger.add(mattress);

    const backrest = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.68, 0.12, 0.76)),
      cushionFabricMat,
    );
    backrest.position.set(-0.62, 0.5, 0);
    backrest.rotation.z = -0.45;
    lounger.add(backrest);

    const bolster = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.68, 12)),
      pillowAccentMat,
    );
    bolster.rotation.x = Math.PI / 2;
    bolster.position.set(-0.56, 0.58, 0);
    lounger.add(bolster);

    deckGroup.add(lounger);
    colliders.push({ x: deckCX + lx, z: deckCZ + lz, radius: 1.05 });
  };

  createSkyLounger(-2.2, 3.6, -0.22);
  createSkyLounger(1.2, 4.4, -0.35);

  // Curved Two-Person Cushioned Stargazing Loveseat at (-1.8, -3.1)
  const loveseatGroup = new THREE.Group();
  loveseatGroup.position.set(-1.8, 0.28, -3.1);
  loveseatGroup.rotation.y = 0.18;

  const seatBase = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.2, 0.34, 2.35)),
    deckDarkTrimMat,
  );
  seatBase.position.y = 0.17;
  loveseatGroup.add(seatBase);

  const seatCushion = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.12, 0.16, 2.22)),
    cushionFabricMat,
  );
  seatCushion.position.set(0.04, 0.4, 0);
  loveseatGroup.add(seatCushion);

  const seatBack = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.24, 0.68, 2.32)),
    deckTimberMat,
  );
  seatBack.position.set(-0.48, 0.64, 0);
  seatBack.rotation.z = 0.16;
  loveseatGroup.add(seatBack);

  for (const pz of [-0.62, 0.0, 0.62]) {
    const pillow = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.18, 0.38, 0.52)),
      pillowAccentMat,
    );
    pillow.position.set(-0.3, 0.64, pz);
    pillow.rotation.z = 0.22;
    loveseatGroup.add(pillow);
  }

  // ==========================================================================
  // 2A-II. SEATED MIST COMPANION ON THE TWO-PERSON STARGAZING LOVESEAT
  // Materializes gently beside Harsha (on the left/north cushion at z = +0.38)
  // gazing up at the MANDU constellation while their inner hands rest close together.
  // ==========================================================================
  let isLoveseatCompanionTargetActive = false;
  let loveseatCompanionVisibility = 0.0;

  const loveseatCompanionCoreMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf4f9ff,
      emissive: 0x93c5fd,
      emissiveIntensity: 0.72,
      roughness: 0.22,
      metalness: 0.05,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    }),
  );

  const loveseatCompanionAuraMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const loveseatHeartMoteMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfda4af,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const loveseatCompanionGroup = new THREE.Group();
  loveseatCompanionGroup.name = 'SeatedLoveseatMistCompanion';
  // Seated on the north (+Z) half of the loveseat cushion, facing East (+X) with a slight turn toward Harsha (-Z)
  loveseatCompanionGroup.position.set(0.06, 0.46, 0.38);
  loveseatCompanionGroup.rotation.y = -0.14;
  loveseatCompanionGroup.visible = false;

  const addSeatedMistPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    px: number,
    py: number,
    pz: number,
    rx = 0,
    ry = 0,
    rz = 0,
    auraScale = 1.15,
  ) => {
    const holder = new THREE.Group();
    holder.position.set(px, py, pz);
    holder.rotation.set(rx, ry, rz);
    const core = new THREE.Mesh(geo, loveseatCompanionCoreMat);
    const aura = new THREE.Mesh(geo, loveseatCompanionAuraMat);
    aura.scale.setScalar(auraScale);
    holder.add(core, aura);
    parent.add(holder);
    return holder;
  };

  // Seated Torso & Shoulders (leaning slightly back against the cushion & gazing up at the stars)
  const seatedTorsoGeo = trackGeo(
    new THREE.CylinderGeometry(0.145, 0.125, 0.5, 16),
  );
  addSeatedMistPart(
    loveseatCompanionGroup,
    seatedTorsoGeo,
    -0.08,
    0.34,
    0,
    0,
    0,
    0.16,
    1.16,
  );

  const seatedShoulderGeo = trackGeo(new THREE.SphereGeometry(0.155, 14, 12));
  const seatedShoulder = addSeatedMistPart(
    loveseatCompanionGroup,
    seatedShoulderGeo,
    -0.11,
    0.55,
    0,
    0,
    0,
    0,
    1.15,
  );
  seatedShoulder.scale.set(0.75, 0.55, 1.28);

  // Head tilted upward gazing at the MANDU constellation in the eastern night sky
  const seatedHeadGeo = trackGeo(new THREE.SphereGeometry(0.125, 16, 14));
  const seatedHeadGroup = addSeatedMistPart(
    loveseatCompanionGroup,
    seatedHeadGeo,
    -0.12,
    0.74,
    0,
    0,
    -0.08,
    0.26,
    1.2,
  );
  seatedHeadGroup.scale.set(0.95, 1.1, 0.95);

  // Seated Hips & Thighs extending forward (+X) on the cushion
  const seatedThighGeo = trackGeo(
    new THREE.CylinderGeometry(0.068, 0.056, 0.38, 12),
  );
  addSeatedMistPart(
    loveseatCompanionGroup,
    seatedThighGeo,
    0.14,
    0.08,
    0.09,
    0,
    0,
    Math.PI / 2 - 0.06,
  );
  addSeatedMistPart(
    loveseatCompanionGroup,
    seatedThighGeo,
    0.14,
    0.08,
    -0.09,
    0,
    0,
    Math.PI / 2 - 0.06,
  );

  // Seated Calves & Feet resting down in front of the loveseat
  const seatedCalfGeo = trackGeo(
    new THREE.CylinderGeometry(0.054, 0.044, 0.38, 12),
  );
  addSeatedMistPart(
    loveseatCompanionGroup,
    seatedCalfGeo,
    0.34,
    -0.14,
    0.09,
    0,
    0,
    -0.12,
  );
  addSeatedMistPart(
    loveseatCompanionGroup,
    seatedCalfGeo,
    0.34,
    -0.14,
    -0.09,
    0,
    0,
    -0.12,
  );

  // Outer (Left / +Z) Arm resting gently on the loveseat side
  const seatedArmGeo = trackGeo(
    new THREE.CylinderGeometry(0.046, 0.038, 0.32, 12),
  );
  addSeatedMistPart(
    loveseatCompanionGroup,
    seatedArmGeo,
    -0.04,
    0.38,
    0.2,
    0.25,
    0,
    -0.35,
  );

  // Inner (Right / -Z) Arm & Hand reaching warmly toward Harsha's hand in the center of the loveseat
  addSeatedMistPart(
    loveseatCompanionGroup,
    seatedArmGeo,
    0.02,
    0.34,
    -0.2,
    -0.38,
    0.22,
    -0.48,
  );
  const seatedHandGeo = trackGeo(new THREE.SphereGeometry(0.048, 12, 10));
  const innerHandNode = addSeatedMistPart(
    loveseatCompanionGroup,
    seatedHandGeo,
    0.12,
    0.16,
    -0.34,
    0,
    0,
    0,
    1.3,
  );

  // Glowing Rose-Gold Heart Mote hovering softly above their hands in the middle of the loveseat
  const loveseatHeartMote = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.055, 0)),
    loveseatHeartMoteMat,
  );
  loveseatHeartMote.position.set(0.14, 0.28, -0.36);
  loveseatCompanionGroup.add(loveseatHeartMote);

  loveseatGroup.add(loveseatCompanionGroup);

  deckGroup.add(loveseatGroup);
  colliders.push({
    x: STARGAZING_LOVESEAT_POS.x,
    z: STARGAZING_LOVESEAT_POS.z,
    radius: 1.25,
  });

  // Brass Equatorial Telescope on Mahogany Tripod at (3.2, 0.0)
  const telescopeGroup = new THREE.Group();
  telescopeGroup.position.set(3.2, 0.28, 0.0);

  const tripodLegGeo = trackGeo(
    new THREE.CylinderGeometry(0.032, 0.02, 1.48, 8),
  );
  for (let tl = 0; tl < 3; tl++) {
    const ta = (tl / 3) * Math.PI * 2 + 0.3;
    const leg = new THREE.Mesh(tripodLegGeo, deckDarkTrimMat);
    leg.position.set(Math.cos(ta) * 0.28, 0.66, Math.sin(ta) * 0.28);
    leg.rotation.z = Math.cos(ta) * 0.26;
    leg.rotation.x = -Math.sin(ta) * 0.26;
    telescopeGroup.add(leg);
  }

  const mountHub = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.22, 14)),
    brassMat,
  );
  mountHub.position.y = 1.36;
  telescopeGroup.add(mountHub);

  const tubeAssembly = new THREE.Group();
  tubeAssembly.position.y = 1.48;
  tubeAssembly.rotation.y = -0.12;
  tubeAssembly.rotation.z = 0.42;

  const mainTube = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.095, 0.072, 1.28, 18)),
    brassMat,
  );
  mainTube.rotation.z = Math.PI / 2;
  tubeAssembly.add(mainTube);

  const objectiveLens = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.088, 0.088, 0.03, 16)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.45,
        roughness: 0.1,
        metalness: 0.2,
      }),
    ),
  );
  objectiveLens.rotation.z = Math.PI / 2;
  objectiveLens.position.x = 0.64;
  tubeAssembly.add(objectiveLens);

  const eyepiece = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.036, 0.045, 0.22, 12)),
    deckDarkTrimMat,
  );
  eyepiece.rotation.z = Math.PI / 2;
  eyepiece.position.x = -0.7;
  tubeAssembly.add(eyepiece);

  telescopeGroup.add(tubeAssembly);
  deckGroup.add(telescopeGroup);
  colliders.push({
    x: STARGAZING_TELESCOPE_POS.x,
    z: STARGAZING_TELESCOPE_POS.z,
    radius: 0.75,
  });

  const deckWarmLight = new THREE.PointLight(0xffcb88, 1.15, 18.0, 1.8);
  deckWarmLight.userData.skipAtmosphereCull = true;
  deckWarmLight.position.set(0, 1.6, 0);
  deckGroup.add(deckWarmLight);

  group.add(deckGroup);

  // ==========================================================================
  // 2B. CURVED STONE-AND-TIMBER PATH & OPEN-AIR PROPOSAL GARDEN (22.0, 18.0)
  // ==========================================================================
  const proposalGardenGroup = new THREE.Group();
  proposalGardenGroup.name = 'ConnectedProposalGardenPeninsula';

  const paverStoneGeo = trackGeo(new THREE.CylinderGeometry(0.88, 0.96, 0.09, 10));
  const timberSleeperGeo = trackGeo(new THREE.BoxGeometry(2.15, 0.07, 0.34));
  const lanternPostGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.075, 0.58, 8));
  const lanternGlobeGeo = trackGeo(new THREE.SphereGeometry(0.11, 10, 8));

  interface InteractivePathLanternNode {
    x: number;
    y: number;
    z: number;
    globeMat: THREE.MeshStandardMaterial;
    haloMat: THREE.MeshBasicMaterial;
    haloMesh: THREE.Mesh;
    bloomLevel: number; // 0 = quiet moonlit ember, 1 = awakened golden-rose bloom
    proximityBoost: number; // 0..1 active swirl boost while Harsha is walking past
  }
  const pathLanternNodes: InteractivePathLanternNode[] = [];

  // Stone and timber pavers along the curved path from Stargazing Deck NE exit (5.8, 5.6) to Proposal Garden (22.0, 18.0)
  for (let i = 2; i < PROPOSAL_PATH_SAMPLES.length - 5; i++) {
    const s = PROPOSAL_PATH_SAMPLES[i];
    const sNext = PROPOSAL_PATH_SAMPLES[i + 1];
    const dx = sNext.x - s.x;
    const dz = sNext.z - s.z;
    const segLen = Math.max(0.001, Math.hypot(dx, dz));
    const tx = dx / segLen;
    const tz = dz / segLen;
    const yaw = Math.atan2(tx, tz);
    const py = getPrivateTerrainHeight(s.x, s.z);

    if (i % 2 === 0) {
      const stone = new THREE.Mesh(paverStoneGeo, deckStoneMat);
      stone.position.set(s.x, py - 0.01, s.z);
      stone.rotation.y = yaw + (i % 4) * 0.4;
      stone.scale.set(1.15, 1.0, 0.72);
      stone.receiveShadow = true;
      proposalGardenGroup.add(stone);
    } else {
      const sleeper = new THREE.Mesh(timberSleeperGeo, deckTimberMat);
      sleeper.position.set(s.x, py - 0.01, s.z);
      sleeper.rotation.y = yaw;
      sleeper.receiveShadow = true;
      proposalGardenGroup.add(sleeper);
    }

    // Place interactive pair/alternating path lanterns along the path edges that bloom brighter as Harsha walks by
    if (i % 3 === 2) {
      const side = i % 6 === 2 ? 1 : -1;
      const nx = -tz * side;
      const nz = tx * side;
      const lx = s.x + nx * 1.48;
      const lz = s.z + nz * 1.48;
      const ly = getPrivateTerrainHeight(lx, lz);

      const post = new THREE.Mesh(lanternPostGeo, deckDarkTrimMat);
      post.position.set(lx, ly + 0.26, lz);
      proposalGardenGroup.add(post);

      const lanternGlobeMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xffe4b5,
          emissive: 0xffb347,
          emissiveIntensity: 0.55,
          roughness: 0.22,
        }),
      );
      const globe = new THREE.Mesh(lanternGlobeGeo, lanternGlobeMat);
      globe.position.set(lx, ly + 0.58, lz);
      proposalGardenGroup.add(globe);

      const lanternHaloMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xfda4af,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const halo = new THREE.Mesh(lanternGlobeGeo, lanternHaloMat);
      halo.position.set(lx, ly + 0.58, lz);
      halo.scale.setScalar(1.65);
      proposalGardenGroup.add(halo);

      pathLanternNodes.push({
        x: lx,
        y: ly + 0.58,
        z: lz,
        globeMat: lanternGlobeMat,
        haloMat: lanternHaloMat,
        haloMesh: halo,
        bloomLevel: 0.0,
        proximityBoost: 0.0,
      });
    }
  }

  // Swirling Rose-Gold Firefly Clusters around each Interactive Path Lantern (8 fireflies per lantern)
  const firefliesPerLantern = 8;
  const totalLanternFireflies = pathLanternNodes.length * firefliesPerLantern;
  const lanternFireflyPositions = new Float32Array(totalLanternFireflies * 3);
  const lanternFireflyColors = new Float32Array(totalLanternFireflies * 3);
  const cLanternRose = new THREE.Color(0xfda4af);
  const cLanternGold = new THREE.Color(0xfde047);

  for (let l = 0; l < pathLanternNodes.length; l++) {
    const node = pathLanternNodes[l];
    for (let f = 0; f < firefliesPerLantern; f++) {
      const idx = l * firefliesPerLantern + f;
      lanternFireflyPositions[idx * 3] = node.x;
      lanternFireflyPositions[idx * 3 + 1] = node.y;
      lanternFireflyPositions[idx * 3 + 2] = node.z;
      const col = f % 2 === 0 ? cLanternGold : cLanternRose;
      lanternFireflyColors[idx * 3] = col.r;
      lanternFireflyColors[idx * 3 + 1] = col.g;
      lanternFireflyColors[idx * 3 + 2] = col.b;
    }
  }

  const lanternFireflyGeo = trackGeo(new THREE.BufferGeometry());
  lanternFireflyGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(lanternFireflyPositions, 3),
  );
  lanternFireflyGeo.setAttribute(
    'color',
    new THREE.BufferAttribute(lanternFireflyColors, 3),
  );
  const lanternFireflyMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const lanternFireflyPoints = new THREE.Points(
    lanternFireflyGeo,
    lanternFireflyMat,
  );
  lanternFireflyPoints.frustumCulled = false;
  proposalGardenGroup.add(lanternFireflyPoints);

  // Proposal Garden Central Stage & Flower Meadow at (22.0, 18.0)
  const gcx = PROPOSAL_GARDEN_CENTER.x;
  const gcz = PROPOSAL_GARDEN_CENTER.z;
  const meadowY = PROPOSAL_GARDEN_CENTER.meadowY;
  const stageY = PROPOSAL_GARDEN_CENTER.stageY;

  // Raised Circular Stone & Timber Proposal Stage (top surface at Y = 4.36m)
  const stageStoneBase = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        PROPOSAL_GARDEN_CENTER.stageRadius + 0.25,
        PROPOSAL_GARDEN_CENTER.stageRadius + 0.55,
        0.24,
        36,
      ),
    ),
    deckStoneMat,
  );
  stageStoneBase.position.set(gcx, meadowY + 0.04, gcz);
  stageStoneBase.receiveShadow = true;
  proposalGardenGroup.add(stageStoneBase);

  const stageTimberTop = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        PROPOSAL_GARDEN_CENTER.stageRadius,
        PROPOSAL_GARDEN_CENTER.stageRadius + 0.1,
        0.1,
        36,
      ),
    ),
    deckTimberMat,
  );
  stageTimberTop.position.set(gcx, stageY - 0.05, gcz);
  stageTimberTop.receiveShadow = true;
  proposalGardenGroup.add(stageTimberTop);

  // Brass Celestial Inlay Ring on the Proposal Stage
  const stageBrassRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(2.12, 2.24, 48)),
    brassMat,
  );
  stageBrassRing.rotation.x = -Math.PI / 2;
  stageBrassRing.position.set(gcx, stageY + 0.005, gcz);
  proposalGardenGroup.add(stageBrassRing);

  const stageInnerBrassRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(0.95, 1.03, 36)),
    brassMat,
  );
  stageInnerBrassRing.rotation.x = -Math.PI / 2;
  stageInnerBrassRing.position.set(gcx, stageY + 0.005, gcz);
  proposalGardenGroup.add(stageInnerBrassRing);

  // Subtle Low Starlight Focal Marker at the Stage Center (triggers E prompt without blocking the kneeling figure)
  const focalCrystalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x7dd3fc,
      emissiveIntensity: 0.75,
      roughness: 0.18,
      metalness: 0.35,
    }),
  );
  const stageFocalMarker = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.14, 0)),
    focalCrystalMat,
  );
  stageFocalMarker.position.set(gcx - 0.55, stageY + 0.18, gcz - 0.55);
  proposalGardenGroup.add(stageFocalMarker);

  // Warm Pavilion / Garden Lighting
  const gardenWarmLight = new THREE.PointLight(0xffd296, 1.25, 22.0, 1.6);
  gardenWarmLight.userData.skipAtmosphereCull = true;
  gardenWarmLight.position.set(gcx, stageY + 2.4, gcz);
  proposalGardenGroup.add(gardenWarmLight);

  // Open-Air Flower Meadow & Perimeter Lantern Bollards (leaving NE ocean horizon open)
  const flowerStemGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.024, 0.32, 6));
  const flowerBlossomGeo = trackGeo(new THREE.SphereGeometry(0.085, 8, 6));
  const stemMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a5246,
      roughness: 0.85,
    }),
  );
  const blossomIvoryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    }),
  );
  const blossomRoseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfecdd3,
      emissive: 0xfda4af,
      emissiveIntensity: 0.32,
      roughness: 0.5,
    }),
  );
  const blossomSkyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x7dd3fc,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    }),
  );

  const gardenRng = createPrivateSeededRng(20270218);
  const numGardenLanterns = 12;
  for (let i = 0; i < numGardenLanterns; i++) {
    const angle = -Math.PI + (i / numGardenLanterns) * Math.PI * 2;
    // Leave SW path entrance (-2.35 rad) clear
    if (Math.abs(angle - -2.35) < 0.38) continue;

    const lx = gcx + Math.cos(angle) * (PROPOSAL_GARDEN_CENTER.radiusX - 0.55);
    const lz = gcz + Math.sin(angle) * (PROPOSAL_GARDEN_CENTER.radiusZ - 0.55);
    const ly = getPrivateTerrainHeight(lx, lz);

    const post = new THREE.Mesh(lanternPostGeo, deckDarkTrimMat);
    post.position.set(lx, ly + 0.28, lz);
    proposalGardenGroup.add(post);

    const globe = new THREE.Mesh(lanternGlobeGeo, warmDeckGlowMat);
    globe.position.set(lx, ly + 0.6, lz);
    proposalGardenGroup.add(globe);
  }

  // Scatter 54 moonlit coastal flowers around the meadow ring (outside the central stage, keeping walking space clear)
  for (let f = 0; f < 54; f++) {
    const angle = gardenRng() * Math.PI * 2;
    if (Math.abs(angle - -2.35) < 0.32) continue; // Keep path entry clear
    const dist = 3.15 + gardenRng() * 3.1;
    const fx = gcx + Math.cos(angle) * dist * 0.92;
    const fz = gcz + Math.sin(angle) * dist * 1.02;
    const fy = getPrivateTerrainHeight(fx, fz);

    const stem = new THREE.Mesh(flowerStemGeo, stemMat);
    stem.position.set(fx, fy + 0.14, fz);
    proposalGardenGroup.add(stem);

    const bMat =
      f % 3 === 0
        ? blossomIvoryMat
        : f % 3 === 1
          ? blossomRoseMat
          : blossomSkyMat;
    const blossom = new THREE.Mesh(flowerBlossomGeo, bMat);
    blossom.position.set(fx, fy + 0.31, fz);
    blossom.scale.set(1.15, 0.75, 1.15);
    proposalGardenGroup.add(blossom);
  }

  // 1. Softly Glowing Heart-Shaped Stone & Rose-Gold Inlay on the Proposal Stage
  const heartInlayPoints: THREE.Vector3[] = [];
  const heartNodeGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.038, 0.016, 8));
  const heartGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfecdd3,
      emissive: 0xfb7185,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.5,
    }),
  );
  const numHeartPts = 40;
  for (let h = 0; h <= numHeartPts; h++) {
    const t = (h / numHeartPts) * Math.PI * 2;
    const hxLocal = 16 * Math.pow(Math.sin(t), 3) * 0.082;
    const hzLocal =
      -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      ) * 0.082;
    // Rotate heart inlay to align with the NE axis (yaw = 0.72)
    const cosH = Math.cos(0.72);
    const sinH = Math.sin(0.72);
    const wx = gcx + hxLocal * cosH + hzLocal * sinH;
    const wz = gcz - hxLocal * sinH + hzLocal * cosH;
    heartInlayPoints.push(new THREE.Vector3(wx, stageY + 0.008, wz));

    if (h < numHeartPts && h % 2 === 0) {
      const node = new THREE.Mesh(heartNodeGeo, heartGlowMat);
      node.position.set(wx, stageY + 0.006, wz);
      proposalGardenGroup.add(node);
    }
  }
  const heartLineGeo = trackGeo(
    new THREE.BufferGeometry().setFromPoints(heartInlayPoints),
  );
  const heartLineMat = trackMat(
    new THREE.LineBasicMaterial({
      color: 0xfda4af,
      transparent: true,
      opacity: 0.72,
    }),
  );
  const heartInlayLoop = new THREE.Line(heartLineGeo, heartLineMat);
  proposalGardenGroup.add(heartInlayLoop);

  // 2. Delicate Rose & Ivory Petals Scattered Across the Proposal Stage
  const petalGeo = trackGeo(new THREE.CircleGeometry(0.052, 7));
  petalGeo.rotateX(-Math.PI / 2);
  const petalRoseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.28,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const petalIvoryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.25,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  for (let pt = 0; pt < 44; pt++) {
    const pAngle = gardenRng() * Math.PI * 2;
    const pDist = 0.35 + Math.pow(gardenRng(), 0.7) * 2.15;
    const px = gcx + Math.cos(pAngle) * pDist;
    const pz = gcz + Math.sin(pAngle) * pDist;
    const petal = new THREE.Mesh(
      petalGeo,
      pt % 3 === 0 ? petalIvoryMat : petalRoseMat,
    );
    petal.position.set(px, stageY + 0.007 + (pt % 3) * 0.001, pz);
    petal.rotation.y = gardenRng() * Math.PI * 2;
    petal.scale.set(0.85 + gardenRng() * 0.45, 1.0, 0.65 + gardenRng() * 0.35);
    proposalGardenGroup.add(petal);
  }

  // 3. Candlelit Floral Arch Framing the Proposal Stage & NE Horizon
  const floralArchGroup = new THREE.Group();
  floralArchGroup.name = 'RomanticCandlelitFloralArch';
  floralArchGroup.position.set(gcx + 1.58, stageY, gcz + 1.82);
  floralArchGroup.rotation.y = 0.72; // Perpendicular to NE gaze so it frames the kneeling figure & sky

  const archSpanRadius = 1.92;
  const archColumnGeo = trackGeo(
    new THREE.CylinderGeometry(0.085, 0.11, 2.15, 12),
  );
  const archPlinthGeo = trackGeo(
    new THREE.CylinderGeometry(0.22, 0.26, 0.24, 12),
  );

  for (const side of [-1, 1]) {
    const colX = side * archSpanRadius;
    const plinth = new THREE.Mesh(archPlinthGeo, deckStoneMat);
    plinth.position.set(colX, 0.12, 0);
    floralArchGroup.add(plinth);

    const col = new THREE.Mesh(archColumnGeo, deckDarkTrimMat);
    col.position.set(colX, 1.15, 0);
    floralArchGroup.add(col);
  }

  const archCrownTorus = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(archSpanRadius, 0.075, 12, 36, Math.PI)),
    deckDarkTrimMat,
  );
  archCrownTorus.position.set(0, 2.18, 0);
  floralArchGroup.add(archCrownTorus);

  // Garland of glowing rose, ivory, and starlight blossoms woven along the arch
  const archBlossomGeo = trackGeo(new THREE.SphereGeometry(0.13, 10, 8));
  for (let b = 0; b <= 20; b++) {
    const theta = (b / 20) * Math.PI;
    const bx = Math.cos(theta) * archSpanRadius;
    const by = 2.18 + Math.sin(theta) * archSpanRadius;
    const bz = Math.sin(b * 1.7) * 0.08;
    const bMat =
      b % 3 === 0
        ? blossomRoseMat
        : b % 3 === 1
          ? blossomIvoryMat
          : blossomSkyMat;
    const cluster = new THREE.Mesh(archBlossomGeo, bMat);
    cluster.position.set(bx, by, bz);
    cluster.scale.set(1.2, 0.85, 1.1);
    floralArchGroup.add(cluster);
  }

  // Warm Pillar Candles around the Floral Arch Base & Proposal Stage Rim
  const candleBodyGeo = trackGeo(
    new THREE.CylinderGeometry(0.048, 0.052, 0.22, 10),
  );
  const candleFlameGeo = trackGeo(new THREE.ConeGeometry(0.026, 0.075, 8));
  const candleWaxMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.25,
      roughness: 0.55,
    }),
  );
  const candleFlameMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffedd5,
    }),
  );

  const candleOffsets: ReadonlyArray<readonly [number, number, number]> = [
    [-archSpanRadius - 0.28, 0, 0.18],
    [-archSpanRadius + 0.26, 0, 0.22],
    [archSpanRadius - 0.26, 0, 0.22],
    [archSpanRadius + 0.28, 0, 0.18],
    [-archSpanRadius - 0.18, 0, -0.22],
    [archSpanRadius + 0.18, 0, -0.22],
  ];
  for (let c = 0; c < candleOffsets.length; c++) {
    const [cx, cy, cz] = candleOffsets[c];
    const hScale = 0.75 + (c % 3) * 0.22;
    const candle = new THREE.Mesh(candleBodyGeo, candleWaxMat);
    candle.scale.y = hScale;
    candle.position.set(cx, cy + 0.11 * hScale, cz);
    floralArchGroup.add(candle);

    const flame = new THREE.Mesh(candleFlameGeo, candleFlameMat);
    flame.position.set(cx, cy + 0.22 * hScale + 0.04, cz);
    floralArchGroup.add(flame);
  }

  proposalGardenGroup.add(floralArchGroup);

  // 4. Two Glowing Moonlit Cherry-Blossom Trees Flanking the Proposal Clearing
  const createRomanticBlossomTree = (
    tx: number,
    tz: number,
    scale: number,
    seedOffset: number,
  ) => {
    const treeGroup = new THREE.Group();
    const ty = getPrivateTerrainHeight(tx, tz);
    treeGroup.position.set(tx, ty, tz);
    treeGroup.scale.setScalar(scale);

    const trunk = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 10)),
      deckDarkTrimMat,
    );
    trunk.position.y = 1.15;
    trunk.rotation.z = 0.06;
    treeGroup.add(trunk);

    const boughGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.14, 1.65, 8));
    const canopyGeo = trackGeo(new THREE.SphereGeometry(0.82, 12, 10));

    for (let b = 0; b < 4; b++) {
      const ba = (b / 4) * Math.PI * 2 + seedOffset;
      const bough = new THREE.Mesh(boughGeo, deckDarkTrimMat);
      bough.position.set(Math.cos(ba) * 0.48, 2.35, Math.sin(ba) * 0.48);
      bough.rotation.z = -Math.cos(ba) * 0.52;
      bough.rotation.x = Math.sin(ba) * 0.52;
      treeGroup.add(bough);

      const cx = Math.cos(ba) * 1.15;
      const cz = Math.sin(ba) * 1.15;
      const canopy = new THREE.Mesh(
        canopyGeo,
        b % 2 === 0 ? blossomRoseMat : blossomIvoryMat,
      );
      canopy.position.set(cx, 2.95 + (b % 2) * 0.22, cz);
      canopy.scale.set(1.35, 0.68, 1.25);
      treeGroup.add(canopy);
    }

    const crownCanopy = new THREE.Mesh(canopyGeo, blossomRoseMat);
    crownCanopy.position.set(0, 3.35, 0);
    crownCanopy.scale.set(1.55, 0.72, 1.55);
    treeGroup.add(crownCanopy);

    proposalGardenGroup.add(treeGroup);
    colliders.push({ x: tx, z: tz, radius: 0.48 * scale });
  };

  createRomanticBlossomTree(16.8, 21.6, 1.05, 0.4);
  createRomanticBlossomTree(26.2, 13.8, 0.98, 1.7);

  // 5. Coastal Water-Edge Lanterns Along the Peninsula Shoreline
  const waterEdgeCoords: ReadonlyArray<readonly [number, number]> = [
    [8.2, 12.6],
    [12.5, 16.2],
    [14.2, 7.2],
    [18.8, 10.4],
    [15.4, 23.6],
    [21.6, 25.4],
    [27.8, 21.8],
    [28.6, 15.2],
  ];
  for (let w = 0; w < waterEdgeCoords.length; w++) {
    const [wx, wz] = waterEdgeCoords[w];
    const wy = Math.max(0.18, getPrivateTerrainHeight(wx, wz));
    const post = new THREE.Mesh(lanternPostGeo, deckDarkTrimMat);
    post.position.set(wx, wy + 0.24, wz);
    proposalGardenGroup.add(post);

    const globe = new THREE.Mesh(lanternGlobeGeo, warmDeckGlowMat);
    globe.position.set(wx, wy + 0.54, wz);
    proposalGardenGroup.add(globe);
  }

  // 6. Floating Warm Fireflies & Rose-Gold Light Motes across the Proposal Garden & Path
  const fireflyCount = 48;
  const fireflyBasePos = new Float32Array(fireflyCount * 3);
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflyColors = new Float32Array(fireflyCount * 3);
  const cFireflyGold = new THREE.Color(0xfde68a);
  const cFireflyRose = new THREE.Color(0xfda4af);

  for (let f = 0; f < fireflyCount; f++) {
    const angle = gardenRng() * Math.PI * 2;
    const rad = 1.2 + gardenRng() * 7.8;
    const fx = gcx - 1.5 + Math.cos(angle) * rad;
    const fz = gcz - 1.2 + Math.sin(angle) * rad;
    const fy = getPrivateTerrainHeight(fx, fz) + 0.45 + gardenRng() * 2.4;

    fireflyBasePos[f * 3] = fx;
    fireflyBasePos[f * 3 + 1] = fy;
    fireflyBasePos[f * 3 + 2] = fz;

    fireflyPositions[f * 3] = fx;
    fireflyPositions[f * 3 + 1] = fy;
    fireflyPositions[f * 3 + 2] = fz;

    const col = f % 3 === 0 ? cFireflyRose : cFireflyGold;
    fireflyColors[f * 3] = col.r;
    fireflyColors[f * 3 + 1] = col.g;
    fireflyColors[f * 3 + 2] = col.b;
  }

  const fireflyGeo = trackGeo(new THREE.BufferGeometry());
  fireflyGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(fireflyPositions, 3),
  );
  fireflyGeo.setAttribute(
    'color',
    new THREE.BufferAttribute(fireflyColors, 3),
  );
  const fireflyMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.14,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const firefliesPoints = new THREE.Points(fireflyGeo, fireflyMat);
  firefliesPoints.frustumCulled = false;
  proposalGardenGroup.add(firefliesPoints);

  group.add(proposalGardenGroup);

  // ==========================================================================
  // 2C. PHASE 4.6B: ETHEREAL KNEELING MIST-LIKE HUMAN FIGURE AT PROPOSAL STAGE
  //     Built from basic Three.js shapes with a transparent, slightly glowing
  //     blue-white material, smooth fade-in to the kneeling pose, and dynamic
  //     orientation facing Harsha as she moves freely.
  // ==========================================================================
  const mistFigureGroup = new THREE.Group();
  mistFigureGroup.name = 'EtherealKneelingMistFigure';
  mistFigureGroup.position.set(
    PROPOSAL_STAGE_POS.figureX,
    PROPOSAL_STAGE_POS.y,
    PROPOSAL_STAGE_POS.figureZ,
  );
  let currentFigureYaw = PROPOSAL_STAGE_POS.figureFacingYaw;
  mistFigureGroup.rotation.y = currentFigureYaw;
  mistFigureGroup.visible = false;

  // Transparent, slightly glowing blue-white material for the core human shapes
  const mistBodyCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6f4ff,
      emissive: 0x7dd3fc,
      emissiveIntensity: 0.68,
      roughness: 0.28,
      metalness: 0.08,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    }),
  );

  // Soft outer glowing blue-white mist aura shell
  const mistBodyAuraMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const mistGroundRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const figureBodyGroup = new THREE.Group();
  const addMistBodyPart = (
    geo: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    auraScale = 1.16,
  ) => {
    const core = new THREE.Mesh(geo, mistBodyCoreMat);
    core.position.set(x, y, z);
    core.rotation.set(rx, ry, rz);
    figureBodyGroup.add(core);

    const aura = new THREE.Mesh(geo, mistBodyAuraMat);
    aura.position.set(x, y, z);
    aura.rotation.set(rx, ry, rz);
    aura.scale.setScalar(auraScale);
    figureBodyGroup.add(aura);
  };

  // Static Kneeling Human Silhouette (Facing local +Z toward Harsha)
  // 1. Head & Neck (No facial features, soft human silhouette)
  addMistBodyPart(
    trackGeo(new THREE.SphereGeometry(0.135, 16, 14)),
    0,
    1.18,
    0.04,
    0.12,
    0,
    0,
    1.18,
  );
  addMistBodyPart(
    trackGeo(new THREE.CylinderGeometry(0.052, 0.064, 0.12, 10)),
    0,
    1.03,
    0.02,
    0.08,
    0,
    0,
  );

  // 2. Torso, Shoulders & Waist (Slight reverent forward inclination)
  addMistBodyPart(
    trackGeo(new THREE.CylinderGeometry(0.185, 0.145, 0.44, 14)),
    0,
    0.78,
    0.0,
    0.08,
    0,
    0,
    1.15,
  );
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.075, 0.34, 8, 12)),
    0,
    0.94,
    0.0,
    0,
    0,
    Math.PI / 2,
    1.16,
  );
  addMistBodyPart(
    trackGeo(new THREE.CylinderGeometry(0.145, 0.155, 0.2, 12)),
    0,
    0.49,
    -0.02,
    0,
    0,
    0,
    1.15,
  );

  // 3. Right Leg (Kneeling down onto the stage: thigh vertical, shin resting back)
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.076, 0.32, 8, 10)),
    -0.11,
    0.26,
    -0.02,
    0.08,
    0,
    0,
  );
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.066, 0.34, 8, 10)),
    -0.11,
    0.07,
    -0.22,
    Math.PI / 2,
    0,
    0,
  );

  // 4. Left Leg (Bent forward in a classic proposal kneel: thigh forward, shin vertical)
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.076, 0.3, 8, 10)),
    0.11,
    0.42,
    0.15,
    Math.PI / 2 - 0.12,
    0,
    0,
  );
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.066, 0.34, 8, 10)),
    0.11,
    0.21,
    0.32,
    0.04,
    0,
    0,
  );
  addMistBodyPart(
    trackGeo(new THREE.BoxGeometry(0.1, 0.06, 0.2)),
    0.11,
    0.04,
    0.38,
    0,
    0,
    0,
  );

  // 5. Arms & Cupped Hands Extended Gently Forward Toward Harsha
  // Right arm
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.054, 0.25, 8, 10)),
    -0.21,
    0.79,
    0.08,
    0.58,
    0.15,
    -0.12,
  );
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.046, 0.24, 8, 10)),
    -0.13,
    0.69,
    0.28,
    1.18,
    0.26,
    0,
  );
  // Left arm
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.054, 0.25, 8, 10)),
    0.21,
    0.79,
    0.08,
    0.58,
    -0.15,
    0.12,
  );
  addMistBodyPart(
    trackGeo(new THREE.CapsuleGeometry(0.046, 0.24, 8, 10)),
    0.13,
    0.69,
    0.28,
    1.18,
    -0.26,
    0,
  );
  // Cupped hands & warm starlight mote held between them
  addMistBodyPart(
    trackGeo(new THREE.SphereGeometry(0.058, 10, 8)),
    0,
    0.68,
    0.42,
    0,
    0,
    0,
    1.3,
  );

  mistFigureGroup.add(figureBodyGroup);

  // Soft layered ground mist discs around the kneeling figure
  const groundMistOuter = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(1.35, 32)),
    mistGroundRingMat,
  );
  groundMistOuter.rotation.x = -Math.PI / 2;
  groundMistOuter.position.y = 0.02;
  mistFigureGroup.add(groundMistOuter);

  const groundMistInner = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(0.42, 0.98, 32)),
    mistGroundRingMat,
  );
  groundMistInner.rotation.x = -Math.PI / 2;
  groundMistInner.position.y = 0.05;
  mistFigureGroup.add(groundMistInner);

  // 28 Restrained Mist & Rising Starlight Particles around the Figure
  const mistParticleCount = 28;
  const mistParticleBasePos = new Float32Array(mistParticleCount * 3);
  const mistParticlePositions = new Float32Array(mistParticleCount * 3);
  for (let p = 0; p < mistParticleCount; p++) {
    const a = (p / mistParticleCount) * Math.PI * 2 + gardenRng() * 0.4;
    const r = 0.22 + gardenRng() * 0.68;
    const py = 0.08 + gardenRng() * 1.25;
    mistParticleBasePos[p * 3] = Math.cos(a) * r;
    mistParticleBasePos[p * 3 + 1] = py;
    mistParticleBasePos[p * 3 + 2] = Math.sin(a) * r;

    mistParticlePositions[p * 3] = mistParticleBasePos[p * 3];
    mistParticlePositions[p * 3 + 1] = mistParticleBasePos[p * 3 + 1];
    mistParticlePositions[p * 3 + 2] = mistParticleBasePos[p * 3 + 2];
  }
  const mistParticlesGeo = trackGeo(new THREE.BufferGeometry());
  mistParticlesGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(mistParticlePositions, 3),
  );
  const mistParticlesMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.09,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const mistParticlesPoints = new THREE.Points(
    mistParticlesGeo,
    mistParticlesMat,
  );
  mistFigureGroup.add(mistParticlesPoints);

  group.add(mistFigureGroup);

  // ==========================================================================
  // 2D. POST-CONSTELLATION GRAND FINALE:
  //     - Warm Golden Festival Stage & Arch Illumination
  //     - Continuous Multi-Color Sky Fireworks & Ascending Rocket Trails
  //     - Golden Stage Sparkler Fountains around the Proposal Stage & Arch
  //     - Choreographed Bride & Groom Marriage Ceremony Beneath the Floral Arch
  // ==========================================================================
  const celebrationGroup = new THREE.Group();
  celebrationGroup.name = 'PostConstellationWeddingCelebrationGroup';
  celebrationGroup.visible = false;

  // Dedicated Festival PointLights (marked skipAtmosphereCull so they stay bright)
  const stageFestivalLight = new THREE.PointLight(0xffdf9e, 0.0, 28.0, 1.45);
  stageFestivalLight.userData.skipAtmosphereCull = true;
  stageFestivalLight.position.set(gcx + 0.5, stageY + 3.2, gcz + 0.6);
  celebrationGroup.add(stageFestivalLight);

  const archFestivalLight = new THREE.PointLight(0xffb4c8, 0.0, 18.0, 1.5);
  archFestivalLight.userData.skipAtmosphereCull = true;
  archFestivalLight.position.set(gcx + 1.45, stageY + 2.4, gcz + 1.65);
  celebrationGroup.add(archFestivalLight);

  const fireworkSkyFlashLight = new THREE.PointLight(0xfde047, 0.0, 85.0, 1.2);
  fireworkSkyFlashLight.userData.skipAtmosphereCull = true;
  fireworkSkyFlashLight.position.set(gcx + 18.0, stageY + 22.0, gcz + 18.0);
  celebrationGroup.add(fireworkSkyFlashLight);

  // --------------------------------------------------------------------------
  // A. BRIDE & GROOM MARRIAGE CEREMONY ON THE PROPOSAL STAGE BENEATH THE ARCH
  // --------------------------------------------------------------------------
  const weddingCoupleGroup = new THREE.Group();
  weddingCoupleGroup.name = 'BrideAndGroomWeddingCeremony';
  // Positioned on the Proposal Stage directly in front of the Candlelit Floral Arch
  weddingCoupleGroup.position.set(gcx + 0.96, stageY, gcz + 1.12);
  // Oriented facing SW (toward the stage center & Harsha) so local +Z faces the viewer
  weddingCoupleGroup.rotation.y = 0.72 + Math.PI;

  const weddingMaterials: { mat: THREE.Material; baseOpacity: number }[] = [];
  const createWeddingStdMat = (
    params: THREE.MeshStandardMaterialParameters,
    baseOpacity = 1.0,
  ) => {
    const m = trackMat(
      new THREE.MeshStandardMaterial({
        ...params,
        transparent: true,
        opacity: 0.0,
      }),
    );
    weddingMaterials.push({ mat: m, baseOpacity });
    return m;
  };

  const skinMat = createWeddingStdMat({
    color: 0xfbd3b4,
    emissive: 0xd97706,
    emissiveIntensity: 0.14,
    roughness: 0.52,
    metalness: 0.04,
  });
  const darkHairMat = createWeddingStdMat({
    color: 0x1e1b24,
    roughness: 0.68,
    metalness: 0.08,
  });
  const groomSherwaniMat = createWeddingStdMat({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.22,
    roughness: 0.42,
    metalness: 0.18,
  });
  const groomGoldTrimMat = createWeddingStdMat({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.38,
    roughness: 0.24,
    metalness: 0.82,
  });
  const groomStoleMat = createWeddingStdMat({
    color: 0xe11d48,
    emissive: 0xbe123c,
    emissiveIntensity: 0.28,
    roughness: 0.45,
    metalness: 0.15,
  });
  const brideCrimsonMat = createWeddingStdMat({
    color: 0xf43f5e,
    emissive: 0xe11d48,
    emissiveIntensity: 0.3,
    roughness: 0.38,
    metalness: 0.16,
  });
  const brideRoseSilkMat = createWeddingStdMat({
    color: 0xfda4af,
    emissive: 0xfb7185,
    emissiveIntensity: 0.26,
    roughness: 0.35,
    metalness: 0.12,
  });
  const brideVeilMat = createWeddingStdMat(
    {
      color: 0xffe4e6,
      emissive: 0xfda4af,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    },
    0.46,
  );
  const garlandRoseMat = createWeddingStdMat({
    color: 0xfb7185,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.48,
    roughness: 0.35,
  });
  const garlandGoldMat = createWeddingStdMat({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.52,
    roughness: 0.3,
  });

  // 1. GROOM COMPOSITE FIGURE (Starts on local left X = -0.46)
  const groomRoot = new THREE.Group();
  groomRoot.position.set(-0.46, 0, 0);

  // Legs & Shoes
  const legGeo = trackGeo(new THREE.CapsuleGeometry(0.052, 0.34, 8, 10));
  const shoeGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.05, 0.18));
  for (const lx of [-0.075, 0.075]) {
    const leg = new THREE.Mesh(legGeo, groomSherwaniMat);
    leg.position.set(lx, 0.24, 0);
    groomRoot.add(leg);
    const shoe = new THREE.Mesh(shoeGeo, groomGoldTrimMat);
    shoe.position.set(lx, 0.025, 0.03);
    groomRoot.add(shoe);
  }

  // Sherwani Tunic Coat & Flared Skirt Hem
  const sherwaniTorso = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.155, 0.185, 0.56, 16)),
    groomSherwaniMat,
  );
  sherwaniTorso.position.set(0, 0.66, 0);
  groomRoot.add(sherwaniTorso);

  const sherwaniCollar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.082, 0.095, 0.08, 14)),
    groomGoldTrimMat,
  );
  sherwaniCollar.position.set(0, 0.96, 0.01);
  groomRoot.add(sherwaniCollar);

  // Gold button placket down the front (+Z)
  const btnGeo = trackGeo(new THREE.SphereGeometry(0.014, 8, 6));
  for (let b = 0; b < 5; b++) {
    const btn = new THREE.Mesh(btnGeo, groomGoldTrimMat);
    btn.position.set(0, 0.88 - b * 0.075, 0.162);
    groomRoot.add(btn);
  }

  // Royal Crimson & Gold Ceremonial Stole (Dupatta) Draped Across Chest
  const groomStole = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.168, 0.028, 10, 24)),
    groomStoleMat,
  );
  groomStole.position.set(0, 0.78, 0.02);
  groomStole.rotation.set(0.55, 0.25, 0.42);
  groomRoot.add(groomStole);

  // Groom Head, Hair & Ceremonial Ivory-Gold Turban (Pagri)
  const groomHeadGroup = new THREE.Group();
  groomHeadGroup.position.set(0, 1.09, 0);
  const groomHead = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.116, 16, 14)),
    skinMat,
  );
  groomHeadGroup.add(groomHead);

  const groomHair = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.119, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    darkHairMat,
  );
  groomHair.rotation.x = -0.22;
  groomHeadGroup.add(groomHair);

  const groomTurban = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.095, 0.042, 10, 20)),
    groomGoldTrimMat,
  );
  groomTurban.position.set(0, 0.068, 0.01);
  groomTurban.rotation.x = Math.PI / 2 - 0.18;
  groomHeadGroup.add(groomTurban);

  const groomKalgi = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.028, 0)),
    groomStoleMat,
  );
  groomKalgi.position.set(0, 0.11, 0.115);
  groomHeadGroup.add(groomKalgi);
  groomRoot.add(groomHeadGroup);

  // Groom Articulated Arms (Pivot at shoulders)
  const armSleeveGeo = trackGeo(new THREE.CapsuleGeometry(0.042, 0.26, 8, 10));
  const handSphereGeo = trackGeo(new THREE.SphereGeometry(0.038, 10, 8));

  const groomLeftArm = new THREE.Group(); // +X side (inner side facing Bride)
  groomLeftArm.position.set(0.175, 0.88, 0);
  const gLArmMesh = new THREE.Mesh(armSleeveGeo, groomSherwaniMat);
  gLArmMesh.position.set(0, -0.14, 0.06);
  gLArmMesh.rotation.x = -0.45;
  groomLeftArm.add(gLArmMesh);
  const gLHand = new THREE.Mesh(handSphereGeo, skinMat);
  gLHand.position.set(0, -0.28, 0.14);
  groomLeftArm.add(gLHand);
  groomRoot.add(groomLeftArm);

  const groomRightArm = new THREE.Group(); // -X side (outer side)
  groomRightArm.position.set(-0.175, 0.88, 0);
  const gRArmMesh = new THREE.Mesh(armSleeveGeo, groomSherwaniMat);
  gRArmMesh.position.set(0, -0.14, 0.06);
  gRArmMesh.rotation.x = -0.45;
  groomRightArm.add(gRArmMesh);
  const gRHand = new THREE.Mesh(handSphereGeo, skinMat);
  gRHand.position.set(0, -0.28, 0.14);
  groomRightArm.add(gRHand);
  groomRoot.add(groomRightArm);

  weddingCoupleGroup.add(groomRoot);

  // 2. BRIDE COMPOSITE FIGURE (Starts on local right X = +0.46)
  const brideRoot = new THREE.Group();
  brideRoot.position.set(0.46, 0, 0);

  // Flared Bridal Lehenga / Gown Skirt with Dual Gold Zardozi Borders
  const brideSkirt = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.135, 0.35, 0.58, 22)),
    brideCrimsonMat,
  );
  brideSkirt.position.set(0, 0.29, 0);
  brideRoot.add(brideSkirt);

  const brideHemGoldRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.342, 0.018, 10, 28)),
    groomGoldTrimMat,
  );
  brideHemGoldRing.rotation.x = Math.PI / 2;
  brideHemGoldRing.position.set(0, 0.04, 0);
  brideRoot.add(brideHemGoldRing);

  const brideMidGoldRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.285, 0.012, 8, 28)),
    groomGoldTrimMat,
  );
  brideMidGoldRing.rotation.x = Math.PI / 2;
  brideMidGoldRing.position.set(0, 0.18, 0);
  brideRoot.add(brideMidGoldRing);

  // Bridal Bodice (Choli) & Golden Waist Belt (Kamarbandh)
  const brideBodice = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.142, 0.128, 0.34, 16)),
    brideRoseSilkMat,
  );
  brideBodice.position.set(0, 0.72, 0);
  brideRoot.add(brideBodice);

  const brideWaistBelt = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.136, 0.016, 8, 24)),
    groomGoldTrimMat,
  );
  brideWaistBelt.rotation.x = Math.PI / 2;
  brideWaistBelt.position.set(0, 0.57, 0);
  brideRoot.add(brideWaistBelt);

  const brideNecklace = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.088, 0.014, 8, 20)),
    groomGoldTrimMat,
  );
  brideNecklace.rotation.x = Math.PI / 2 + 0.35;
  brideNecklace.position.set(0, 0.89, 0.02);
  brideRoot.add(brideNecklace);

  // Bride Head, Floral Hair Bun, Golden Maang-Tikka & Translucent Bridal Veil
  const brideHeadGroup = new THREE.Group();
  brideHeadGroup.position.set(0, 1.04, 0);
  const brideHead = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.11, 16, 14)),
    skinMat,
  );
  brideHeadGroup.add(brideHead);

  const brideHairCap = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.113, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6)),
    darkHairMat,
  );
  brideHairCap.rotation.x = -0.25;
  brideHeadGroup.add(brideHairCap);

  const brideHairBun = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.058, 12, 10)),
    darkHairMat,
  );
  brideHairBun.position.set(0, 0.02, -0.11);
  brideHeadGroup.add(brideHairBun);

  const brideCrownTikka = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.024, 0)),
    groomGoldTrimMat,
  );
  brideCrownTikka.position.set(0, 0.075, 0.102);
  brideHeadGroup.add(brideCrownTikka);

  // Translucent Rose-Blush Bridal Veil Draping from Crown Over Back & Shoulders
  const brideVeil = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        0.09,
        0.32,
        0.78,
        18,
        1,
        true,
        Math.PI * 0.55,
        Math.PI * 1.9,
      ),
    ),
    brideVeilMat,
  );
  brideVeil.position.set(0, -0.26, -0.05);
  brideVeil.rotation.x = 0.14;
  brideHeadGroup.add(brideVeil);

  brideRoot.add(brideHeadGroup);

  // Bride Articulated Arms with Golden Bangles
  const bangleGeo = trackGeo(new THREE.TorusGeometry(0.042, 0.009, 8, 16));
  const brideLeftArm = new THREE.Group(); // +X side (outer side)
  brideLeftArm.position.set(0.16, 0.84, 0);
  const bLArmMesh = new THREE.Mesh(armSleeveGeo, skinMat);
  bLArmMesh.position.set(0, -0.13, 0.06);
  bLArmMesh.rotation.x = -0.45;
  brideLeftArm.add(bLArmMesh);
  const bLBangle = new THREE.Mesh(bangleGeo, groomGoldTrimMat);
  bLBangle.position.set(0, -0.22, 0.11);
  bLBangle.rotation.x = Math.PI / 2 - 0.45;
  brideLeftArm.add(bLBangle);
  const bLHand = new THREE.Mesh(handSphereGeo, skinMat);
  bLHand.position.set(0, -0.26, 0.14);
  brideLeftArm.add(bLHand);
  brideRoot.add(brideLeftArm);

  const brideRightArm = new THREE.Group(); // -X side (inner side facing Groom)
  brideRightArm.position.set(-0.16, 0.84, 0);
  const bRArmMesh = new THREE.Mesh(armSleeveGeo, skinMat);
  bRArmMesh.position.set(0, -0.13, 0.06);
  bRArmMesh.rotation.x = -0.45;
  brideRightArm.add(bRArmMesh);
  const bRBangle = new THREE.Mesh(bangleGeo, groomGoldTrimMat);
  bRBangle.position.set(0, -0.22, 0.11);
  bRBangle.rotation.x = Math.PI / 2 - 0.45;
  brideRightArm.add(bRBangle);
  const bRHand = new THREE.Mesh(handSphereGeo, skinMat);
  bRHand.position.set(0, -0.26, 0.14);
  brideRightArm.add(bRHand);
  brideRoot.add(brideRightArm);

  weddingCoupleGroup.add(brideRoot);

  // 3. CEREMONIAL FLORAL GARLANDS (JAIMALA) EXCHANGED BETWEEN BRIDE & GROOM
  const createCeremonialGarland = () => {
    const gGroup = new THREE.Group();
    const ring = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.148, 0.026, 10, 24)),
      garlandRoseMat,
    );
    ring.rotation.x = Math.PI / 2 + 0.38;
    gGroup.add(ring);

    const beadGeo = trackGeo(new THREE.SphereGeometry(0.032, 8, 6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bead = new THREE.Mesh(
        beadGeo,
        i % 2 === 0 ? garlandGoldMat : garlandRoseMat,
      );
      bead.position.set(
        Math.cos(a) * 0.148,
        Math.sin(a) * 0.148 * Math.sin(0.38),
        Math.sin(a) * 0.148 * Math.cos(0.38),
      );
      gGroup.add(bead);
    }
    return gGroup;
  };

  const groomGarland = createCeremonialGarland();
  const brideGarland = createCeremonialGarland();
  weddingCoupleGroup.add(groomGarland);
  weddingCoupleGroup.add(brideGarland);

  // 4. INTERLOCKING GOLDEN WEDDING RINGS & FLOATING ROSE-GOLD HEART EMBLEM
  const weddingSymbolGroup = new THREE.Group();
  weddingSymbolGroup.position.set(0, 1.38, 0.16);

  const weddingRingGeo = trackGeo(new THREE.TorusGeometry(0.078, 0.015, 12, 28));
  const ringLeft = new THREE.Mesh(weddingRingGeo, groomGoldTrimMat);
  ringLeft.position.set(-0.042, 0, 0);
  ringLeft.rotation.y = 0.35;
  weddingSymbolGroup.add(ringLeft);

  const ringRight = new THREE.Mesh(weddingRingGeo, groomGoldTrimMat);
  ringRight.position.set(0.042, 0, 0);
  ringRight.rotation.y = -0.35;
  weddingSymbolGroup.add(ringRight);

  const heartLobeGeo = trackGeo(new THREE.SphereGeometry(0.055, 12, 10));
  const heartTipGeo = trackGeo(new THREE.ConeGeometry(0.076, 0.11, 12));
  const floatingHeartMesh = new THREE.Group();
  floatingHeartMesh.position.set(0, 0.18, 0);
  const hLobeL = new THREE.Mesh(heartLobeGeo, garlandRoseMat);
  hLobeL.position.set(-0.036, 0.03, 0);
  floatingHeartMesh.add(hLobeL);
  const hLobeR = new THREE.Mesh(heartLobeGeo, garlandRoseMat);
  hLobeR.position.set(0.036, 0.03, 0);
  floatingHeartMesh.add(hLobeR);
  const hTip = new THREE.Mesh(heartTipGeo, garlandRoseMat);
  hTip.position.set(0, -0.032, 0);
  hTip.rotation.x = Math.PI;
  floatingHeartMesh.add(hTip);
  weddingSymbolGroup.add(floatingHeartMesh);

  weddingCoupleGroup.add(weddingSymbolGroup);
  celebrationGroup.add(weddingCoupleGroup);

  // --------------------------------------------------------------------------
  // B. 6 GOLDEN STAGE SPARKLER FOUNTAINS AROUND THE PROPOSAL STAGE & ARCH
  // --------------------------------------------------------------------------
  const sparklerNozzleCoords: ReadonlyArray<readonly [number, number]> = [
    [gcx - 1.75, gcz + 0.45],
    [gcx + 0.45, gcz - 1.75],
    [gcx - 0.85, gcz + 1.95],
    [gcx + 1.95, gcz - 0.85],
    [gcx + 0.25, gcz + 2.55],
    [gcx + 2.55, gcz + 0.25],
  ];
  const nozzleGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.065, 0.16, 10));
  for (let n = 0; n < sparklerNozzleCoords.length; n++) {
    const [nx, nz] = sparklerNozzleCoords[n];
    const nozzle = new THREE.Mesh(nozzleGeo, brassMat);
    nozzle.position.set(nx, stageY + 0.08, nz);
    celebrationGroup.add(nozzle);
  }

  const sparksPerFountain = 36;
  const totalStageSparks = sparklerNozzleCoords.length * sparksPerFountain;
  const stageSparksPositions = new Float32Array(totalStageSparks * 3);
  const stageSparksColors = new Float32Array(totalStageSparks * 3);
  const stageSparksSeeds = new Float32Array(totalStageSparks * 4);
  const cSparkGold = new THREE.Color(0xfde047);
  const cSparkIvory = new THREE.Color(0xfffbeb);
  const cSparkCoral = new THREE.Color(0xfb923c);

  for (let i = 0; i < totalStageSparks; i++) {
    const fIdx = Math.floor(i / sparksPerFountain);
    const [nx, nz] = sparklerNozzleCoords[fIdx];
    stageSparksPositions[i * 3] = nx;
    stageSparksPositions[i * 3 + 1] = stageY + 0.15;
    stageSparksPositions[i * 3 + 2] = nz;

    const ang = gardenRng() * Math.PI * 2;
    const spread = 0.18 + gardenRng() * 0.48;
    const upSpeed = 1.25 + gardenRng() * 0.85;
    const phaseOffset = gardenRng();
    stageSparksSeeds[i * 4] = Math.cos(ang) * spread;
    stageSparksSeeds[i * 4 + 1] = upSpeed;
    stageSparksSeeds[i * 4 + 2] = Math.sin(ang) * spread;
    stageSparksSeeds[i * 4 + 3] = phaseOffset;

    const sc = i % 3 === 0 ? cSparkIvory : i % 3 === 1 ? cSparkGold : cSparkCoral;
    stageSparksColors[i * 3] = sc.r;
    stageSparksColors[i * 3 + 1] = sc.g;
    stageSparksColors[i * 3 + 2] = sc.b;
  }

  const stageSparksGeo = trackGeo(new THREE.BufferGeometry());
  stageSparksGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(stageSparksPositions, 3),
  );
  stageSparksGeo.setAttribute(
    'color',
    new THREE.BufferAttribute(stageSparksColors, 3),
  );
  const stageSparksMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.13,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const stageSparksPoints = new THREE.Points(stageSparksGeo, stageSparksMat);
  stageSparksPoints.frustumCulled = false;
  celebrationGroup.add(stageSparksPoints);

  // --------------------------------------------------------------------------
  // C. FALLING BRIDAL ROSE & GOLD PETAL SHOWER BENEATH THE FLORAL ARCH
  // --------------------------------------------------------------------------
  const bridalPetalCount = 56;
  const bridalPetalPos = new Float32Array(bridalPetalCount * 3);
  const bridalPetalCol = new Float32Array(bridalPetalCount * 3);
  const bridalPetalSeeds = new Float32Array(bridalPetalCount * 4);
  for (let i = 0; i < bridalPetalCount; i++) {
    bridalPetalSeeds[i * 4] = (gardenRng() - 0.5) * 2.8;
    bridalPetalSeeds[i * 4 + 1] = gardenRng();
    bridalPetalSeeds[i * 4 + 2] = (gardenRng() - 0.5) * 2.2;
    bridalPetalSeeds[i * 4 + 3] = 0.5 + gardenRng() * 0.6;

    const pc = i % 2 === 0 ? cFireflyRose : cFireflyGold;
    bridalPetalCol[i * 3] = pc.r;
    bridalPetalCol[i * 3 + 1] = pc.g;
    bridalPetalCol[i * 3 + 2] = pc.b;
  }
  const bridalPetalGeo = trackGeo(new THREE.BufferGeometry());
  bridalPetalGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(bridalPetalPos, 3),
  );
  bridalPetalGeo.setAttribute(
    'color',
    new THREE.BufferAttribute(bridalPetalCol, 3),
  );
  const bridalPetalMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.11,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const bridalPetalPoints = new THREE.Points(bridalPetalGeo, bridalPetalMat);
  bridalPetalPoints.frustumCulled = false;
  celebrationGroup.add(bridalPetalPoints);

  // --------------------------------------------------------------------------
  // D. CONTINUOUS MULTI-COLOR SKY FIREWORKS AROUND THE HORIZON
  // --------------------------------------------------------------------------
  interface FireworkShellConfig {
    cx: number;
    cy: number;
    cz: number;
    period: number;
    phaseOffset: number;
    burstRadius: number;
    primaryHex: number;
    secondaryHex: number;
  }

  const fireworkShellConfigs: readonly FireworkShellConfig[] = [
    {
      cx: gcx + 26.0,
      cy: 25.0,
      cz: gcz + 28.0,
      period: 2.8,
      phaseOffset: 0.0,
      burstRadius: 8.5,
      primaryHex: 0xfde047, // Gold
      secondaryHex: 0xfb7185, // Rose
    },
    {
      cx: gcx + 12.0,
      cy: 29.0,
      cz: gcz + 36.0,
      period: 3.1,
      phaseOffset: 0.35,
      burstRadius: 9.2,
      primaryHex: 0xfb7185, // Rose-Pink
      secondaryHex: 0xfffbeb, // Ivory
    },
    {
      cx: gcx + 36.0,
      cy: 26.5,
      cz: gcz + 14.0,
      period: 2.95,
      phaseOffset: 0.68,
      burstRadius: 8.8,
      primaryHex: 0x38bdf8, // Sky-Cyan
      secondaryHex: 0xfde047, // Gold
    },
    {
      cx: gcx - 4.0,
      cy: 24.5,
      cz: gcz + 34.0,
      period: 3.25,
      phaseOffset: 0.18,
      burstRadius: 8.2,
      primaryHex: 0xc084fc, // Violet
      secondaryHex: 0xf472b6, // Pink
    },
    {
      cx: gcx + 38.0,
      cy: 23.5,
      cz: gcz - 2.0,
      period: 3.0,
      phaseOffset: 0.52,
      burstRadius: 8.4,
      primaryHex: 0xfb923c, // Coral-Amber
      secondaryHex: 0xfef08a, // Lemon-Gold
    },
    {
      cx: gcx + 22.0,
      cy: 32.5,
      cz: gcz + 32.0,
      period: 3.4,
      phaseOffset: 0.82,
      burstRadius: 10.2,
      primaryHex: 0x34d399, // Emerald-Mint
      secondaryHex: 0x38bdf8, // Cyan
    },
    {
      cx: gcx + 6.0,
      cy: 22.0,
      cz: gcz + 26.0,
      period: 2.65,
      phaseOffset: 0.42,
      burstRadius: 7.6,
      primaryHex: 0xf472b6, // Magenta-Rose
      secondaryHex: 0xfde047, // Gold
    },
    {
      cx: gcx + 28.0,
      cy: 21.5,
      cz: gcz + 12.0,
      period: 2.85,
      phaseOffset: 0.91,
      burstRadius: 7.8,
      primaryHex: 0xfef08a, // Warm Ivory-Gold
      secondaryHex: 0xfb7185, // Rose
    },
  ];

  const particlesPerShell = 72;
  const totalFireworkParticles =
    fireworkShellConfigs.length * particlesPerShell;
  const fwPositions = new Float32Array(totalFireworkParticles * 3);
  const fwColors = new Float32Array(totalFireworkParticles * 3);
  const fwUnitDirs = new Float32Array(totalFireworkParticles * 4); // dx, dy, dz, speedScale

  const cTmp1 = new THREE.Color();
  const cTmp2 = new THREE.Color();

  for (let s = 0; s < fireworkShellConfigs.length; s++) {
    const cfg = fireworkShellConfigs[s];
    cTmp1.setHex(cfg.primaryHex);
    cTmp2.setHex(cfg.secondaryHex);

    for (let p = 0; p < particlesPerShell; p++) {
      const idx = s * particlesPerShell + p;
      // Double-shell chrysanthemum distribution: outer sphere + inner ring
      const isInnerRing = p >= 52;
      const u = gardenRng();
      const v = gardenRng();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);

      const speedScale = isInnerRing
        ? 0.52 + gardenRng() * 0.14
        : 0.82 + gardenRng() * 0.26;
      fwUnitDirs[idx * 4] = Math.sin(phi) * Math.cos(theta);
      fwUnitDirs[idx * 4 + 1] = Math.cos(phi);
      fwUnitDirs[idx * 4 + 2] = Math.sin(phi) * Math.sin(theta);
      fwUnitDirs[idx * 4 + 3] = speedScale;

      const col = isInnerRing || p % 3 === 0 ? cTmp2 : cTmp1;
      fwColors[idx * 3] = col.r;
      fwColors[idx * 3 + 1] = col.g;
      fwColors[idx * 3 + 2] = col.b;
    }
  }

  const fireworksGeo = trackGeo(new THREE.BufferGeometry());
  fireworksGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(fwPositions, 3),
  );
  fireworksGeo.setAttribute('color', new THREE.BufferAttribute(fwColors, 3));
  const fireworksMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.46,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const skyFireworksPoints = new THREE.Points(fireworksGeo, fireworksMat);
  skyFireworksPoints.frustumCulled = false;
  celebrationGroup.add(skyFireworksPoints);

  // --- E. 360° Celestial Memory Orbit & Glowing Star-Heart Installation ---
  const celestialMemoryOrbitGroup = new THREE.Group();
  celestialMemoryOrbitGroup.name = 'CelestialMemoryOrbit360';
  celebrationGroup.add(celestialMemoryOrbitGroup);

  // Helper to create a warm high-resolution CanvasTexture for each memory photograph
  const createMemoryPhotoTexture = (
    photoUrl: string,
    photoIndex: number,
  ): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    const drawRomanticFallback = () => {
      if (!ctx) return;
      const grad = ctx.createLinearGradient(0, 0, 512, 384);
      grad.addColorStop(0, '#2a1836');
      grad.addColorStop(0.5, '#4a2545');
      grad.addColorStop(1, '#1e162b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 384);

      const radial = ctx.createRadialGradient(256, 192, 18, 256, 192, 230);
      radial.addColorStop(0, 'rgba(255, 224, 150, 0.34)');
      radial.addColorStop(0.6, 'rgba(255, 160, 195, 0.12)');
      radial.addColorStop(1, 'rgba(20, 12, 28, 0.0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, 512, 384);

      ctx.strokeStyle = 'rgba(255, 226, 158, 0.42)';
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, 484, 356);
    };

    drawRomanticFallback();

    const texture = trackTex(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, 512, 384);
        ctx.fillStyle = '#181022';
        ctx.fillRect(0, 0, 512, 384);

        // Cover-fit image nicely into 4:3 frame
        const targetRatio = 512 / 384;
        const imgRatio =
          img.naturalWidth && img.naturalHeight
            ? img.naturalWidth / img.naturalHeight
            : targetRatio;
        let sx = 0;
        let sy = 0;
        let sw = img.naturalWidth || 512;
        let sh = img.naturalHeight || 384;
        if (imgRatio > targetRatio) {
          sw = sh * targetRatio;
          sx = ((img.naturalWidth || 512) - sw) * 0.5;
        } else {
          sh = sw / targetRatio;
          sy = ((img.naturalHeight || 384) - sh) * 0.35;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 512, 384);

        // Soft golden inner vignette for celestial warmth
        const vig = ctx.createRadialGradient(256, 192, 135, 256, 192, 310);
        vig.addColorStop(0, 'rgba(255, 235, 190, 0.0)');
        vig.addColorStop(0.82, 'rgba(255, 215, 145, 0.06)');
        vig.addColorStop(1, 'rgba(28, 14, 24, 0.32)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, 512, 384);

        ctx.strokeStyle = 'rgba(255, 232, 170, 0.55)';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 504, 376);

        texture.needsUpdate = true;
      };
      img.src = photoUrl || MEMORY_SKY_PHOTO_URLS[photoIndex % MEMORY_SKY_PHOTO_URLS.length];
    }

    return texture;
  };

  // Shared geometries across all 11 memory photo frames (zero redundant geometry allocations)
  const frameWidth = 2.08;
  const frameHeight = 1.56;
  const borderThickness = 0.048;
  const borderDepth = 0.036;

  const sharedGlassBackGeo = trackGeo(
    new THREE.PlaneGeometry(frameWidth + 0.16, frameHeight + 0.16),
  );
  const sharedPhotoPlaneGeo = trackGeo(
    new THREE.PlaneGeometry(frameWidth, frameHeight),
  );
  const sharedBorderHGeo = trackGeo(
    new THREE.BoxGeometry(
      frameWidth + borderThickness * 2,
      borderThickness,
      borderDepth,
    ),
  );
  const sharedBorderVGeo = trackGeo(
    new THREE.BoxGeometry(borderThickness, frameHeight, borderDepth),
  );
  const sharedFrameGlowGeo = trackGeo(
    new THREE.PlaneGeometry(frameWidth + 0.42, frameHeight + 0.42),
  );
  const sharedStarCoreGeo = trackGeo(new THREE.OctahedronGeometry(0.16, 0));

  // 3 Concentric Golden Starlight Orbit Threads around the Garden Centre (gcx, gcz)
  interface OrbitRingVisual {
    line: THREE.LineLoop;
    lineMat: THREE.LineBasicMaterial;
    beadsPoints: THREE.Points;
    beadsMat: THREE.PointsMaterial;
    baseY: number;
    layerIndex: number;
  }
  const orbitRingVisuals: OrbitRingVisual[] = [];
  const orbitLayerRadii = [6.6, 10.2, 13.6];
  const orbitLayerBaseHeights = [
    stageY + 4.05,
    stageY + 5.45,
    stageY + 6.85,
  ];
  const orbitLayerTilts = [0.045, -0.055, 0.035];

  for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
    const r = orbitLayerRadii[layerIdx];
    const baseY = orbitLayerBaseHeights[layerIdx];
    const tilt = orbitLayerTilts[layerIdx];
    const segs = 96;
    const ringPts: THREE.Vector3[] = [];
    const beadCount = 36 + layerIdx * 10;
    const beadPositions = new Float32Array(beadCount * 3);

    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const rx = gcx + Math.cos(a) * r;
      const rz = gcz + Math.sin(a) * r;
      const ry = baseY + Math.sin(a * 2 + layerIdx) * 0.18 + Math.cos(a) * tilt * r;
      ringPts.push(new THREE.Vector3(rx, ry, rz));
    }

    for (let b = 0; b < beadCount; b++) {
      const a = (b / beadCount) * Math.PI * 2;
      beadPositions[b * 3] = gcx + Math.cos(a) * r;
      beadPositions[b * 3 + 1] =
        baseY + Math.sin(a * 2 + layerIdx) * 0.18 + Math.cos(a) * tilt * r;
      beadPositions[b * 3 + 2] = gcz + Math.sin(a) * r;
    }

    const lineGeo = trackGeo(new THREE.BufferGeometry().setFromPoints(ringPts));
    const lineMat = trackMat(
      new THREE.LineBasicMaterial({
        color: layerIdx === 2 ? 0xffe8a8 : 0xffd27d,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const line = new THREE.LineLoop(lineGeo, lineMat);
    line.frustumCulled = false;
    celestialMemoryOrbitGroup.add(line);

    const beadsGeo = trackGeo(new THREE.BufferGeometry());
    beadsGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(beadPositions, 3),
    );
    const beadsMat = trackMat(
      new THREE.PointsMaterial({
        color: 0xfff0be,
        size: layerIdx === 0 ? 0.18 : layerIdx === 1 ? 0.15 : 0.13,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const beadsPoints = new THREE.Points(beadsGeo, beadsMat);
    beadsPoints.frustumCulled = false;
    celestialMemoryOrbitGroup.add(beadsPoints);

    orbitRingVisuals.push({
      line,
      lineMat,
      beadsPoints,
      beadsMat,
      baseY,
      layerIndex: layerIdx,
    });
  }

  // 11 Memory Photo Exhibits across the 3 Concentric Orbital Layers
  interface MemoryOrbitPhotoNode {
    root: THREE.Group;
    photoMat: THREE.MeshBasicMaterial;
    glassMat: THREE.MeshBasicMaterial;
    goldBorderMat: THREE.MeshStandardMaterial;
    haloGlowMat: THREE.MeshBasicMaterial;
    starCoreMesh: THREE.Mesh;
    starCoreMat: THREE.MeshBasicMaterial;
    layerIndex: 0 | 1 | 2;
    orbitRadius: number;
    baseAngle: number;
    baseHeight: number;
    heightOffset: number;
    angularSpeed: number; // rad/s: inner clockwise (-), middle counterclockwise (+), outer nearly stationary
    baseScale: number;
    appearStartTime: number;
    appearDuration: number;
    floatPhase: number;
  }

  const memoryOrbitPhotoNodes: MemoryOrbitPhotoNode[] = [];

  const photoOrbitSpecs: Array<{
    layerIndex: 0 | 1 | 2;
    orbitRadius: number;
    baseAngle: number;
    baseHeight: number;
    heightOffset: number;
    angularSpeed: number;
    baseScale: number;
    appearStartTime: number;
  }> = [
    // Layer 1: Inner Orbit — 4 photographs closest to the ceremony above & around the floral arch (slow clockwise)
    {
      layerIndex: 0,
      orbitRadius: 6.6,
      baseAngle: 0.35,
      baseHeight: stageY + 3.95,
      heightOffset: 0.0,
      angularSpeed: -0.052,
      baseScale: 1.0,
      appearStartTime: 1.2,
    },
    {
      layerIndex: 0,
      orbitRadius: 6.6,
      baseAngle: 0.35 + Math.PI * 0.5,
      baseHeight: stageY + 4.18,
      heightOffset: 0.14,
      angularSpeed: -0.052,
      baseScale: 1.0,
      appearStartTime: 1.65,
    },
    {
      layerIndex: 0,
      orbitRadius: 6.6,
      baseAngle: 0.35 + Math.PI,
      baseHeight: stageY + 3.92,
      heightOffset: -0.08,
      angularSpeed: -0.052,
      baseScale: 1.0,
      appearStartTime: 2.1,
    },
    {
      layerIndex: 0,
      orbitRadius: 6.6,
      baseAngle: 0.35 + Math.PI * 1.5,
      baseHeight: stageY + 4.22,
      heightOffset: 0.12,
      angularSpeed: -0.052,
      baseScale: 1.0,
      appearStartTime: 2.55,
    },

    // Layer 2: Middle Orbit — 4 photographs in wider circular arrangement, staggered vertical heights (very slow counterclockwise)
    {
      layerIndex: 1,
      orbitRadius: 10.2,
      baseAngle: 0.78,
      baseHeight: stageY + 5.2,
      heightOffset: -0.18,
      angularSpeed: 0.031,
      baseScale: 0.88,
      appearStartTime: 3.4,
    },
    {
      layerIndex: 1,
      orbitRadius: 10.2,
      baseAngle: 0.78 + Math.PI * 0.5,
      baseHeight: stageY + 5.68,
      heightOffset: 0.22,
      angularSpeed: 0.031,
      baseScale: 0.88,
      appearStartTime: 3.9,
    },
    {
      layerIndex: 1,
      orbitRadius: 10.2,
      baseAngle: 0.78 + Math.PI,
      baseHeight: stageY + 5.32,
      heightOffset: -0.12,
      angularSpeed: 0.031,
      baseScale: 0.88,
      appearStartTime: 4.4,
    },
    {
      layerIndex: 1,
      orbitRadius: 10.2,
      baseAngle: 0.78 + Math.PI * 1.5,
      baseHeight: stageY + 5.82,
      heightOffset: 0.25,
      angularSpeed: 0.031,
      baseScale: 0.88,
      appearStartTime: 4.9,
    },

    // Layer 3: Outer Celestial Orbit — 3 photographs higher in the sky, smaller frames with subtle golden illumination (almost stationary with gentle floating)
    {
      layerIndex: 2,
      orbitRadius: 13.6,
      baseAngle: 0.18,
      baseHeight: stageY + 6.65,
      heightOffset: 0.0,
      angularSpeed: -0.007,
      baseScale: 0.74,
      appearStartTime: 5.4,
    },
    {
      layerIndex: 2,
      orbitRadius: 13.6,
      baseAngle: 0.18 + (Math.PI * 2) / 3,
      baseHeight: stageY + 7.05,
      heightOffset: 0.24,
      angularSpeed: -0.007,
      baseScale: 0.74,
      appearStartTime: 5.95,
    },
    {
      layerIndex: 2,
      orbitRadius: 13.6,
      baseAngle: 0.18 + (Math.PI * 4) / 3,
      baseHeight: stageY + 6.82,
      heightOffset: -0.14,
      angularSpeed: -0.007,
      baseScale: 0.74,
      appearStartTime: 6.5,
    },
  ];

  for (let i = 0; i < photoOrbitSpecs.length; i++) {
    const spec = photoOrbitSpecs[i];
    const photoUrl = MEMORY_SKY_PHOTO_URLS[i % MEMORY_SKY_PHOTO_URLS.length];
    const tex = createMemoryPhotoTexture(photoUrl, i);

    const frameRoot = new THREE.Group();
    frameRoot.name = `CelestialMemoryFrame_${i + 1}`;
    frameRoot.visible = false;

    // 1. Soft Golden Additive Halo Behind Frame (pulses with major fireworks)
    const haloGlowMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: spec.layerIndex === 2 ? 0xffe6a3 : 0xffcf75,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const haloMesh = new THREE.Mesh(sharedFrameGlowGeo, haloGlowMat);
    haloMesh.position.z = -0.025;
    frameRoot.add(haloMesh);

    // 2. Translucent Glass-Like Backing Plate
    const glassMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfff5dc,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const glassMesh = new THREE.Mesh(sharedGlassBackGeo, glassMat);
    glassMesh.position.z = -0.01;
    frameRoot.add(glassMesh);

    // 3. Double-Sided Luminous Memory Photograph Plane
    const photoMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: tex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      }),
    );
    const photoMesh = new THREE.Mesh(sharedPhotoPlaneGeo, photoMat);
    frameRoot.add(photoMesh);

    // 4. Restrained Brushed-Gold 4-Edge Frame Borders
    const goldBorderMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf6d379,
        emissive: 0xffb845,
        emissiveIntensity: 0.45,
        roughness: 0.24,
        metalness: 0.85,
        transparent: true,
        opacity: 0.0,
      }),
    );

    const topBar = new THREE.Mesh(sharedBorderHGeo, goldBorderMat);
    topBar.position.set(0, (frameHeight + borderThickness) * 0.5, 0);
    const bottomBar = new THREE.Mesh(sharedBorderHGeo, goldBorderMat);
    bottomBar.position.set(0, -(frameHeight + borderThickness) * 0.5, 0);
    const leftBar = new THREE.Mesh(sharedBorderVGeo, goldBorderMat);
    leftBar.position.set(-(frameWidth + borderThickness) * 0.5, 0, 0);
    const rightBar = new THREE.Mesh(sharedBorderVGeo, goldBorderMat);
    rightBar.position.set((frameWidth + borderThickness) * 0.5, 0, 0);
    frameRoot.add(topBar, bottomBar, leftBar, rightBar);

    // 5. Celestial Star-Core Gem (brightens during Stage 6 when photos rise and transform into stars)
    const starCoreMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfff4c8,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const starCoreMesh = new THREE.Mesh(sharedStarCoreGeo, starCoreMat);
    starCoreMesh.position.set(0, frameHeight * 0.5 + 0.22, 0.02);
    frameRoot.add(starCoreMesh);

    celestialMemoryOrbitGroup.add(frameRoot);

    memoryOrbitPhotoNodes.push({
      root: frameRoot,
      photoMat,
      glassMat,
      goldBorderMat,
      haloGlowMat,
      starCoreMesh,
      starCoreMat,
      layerIndex: spec.layerIndex,
      orbitRadius: spec.orbitRadius,
      baseAngle: spec.baseAngle,
      baseHeight: spec.baseHeight,
      heightOffset: spec.heightOffset,
      angularSpeed: spec.angularSpeed,
      baseScale: spec.baseScale,
      appearStartTime: spec.appearStartTime,
      appearDuration: 1.5,
      floatPhase: i * 1.37,
    });
  }

  // Stage 6: Ascending Star-Streams (110 golden particles rising from the 11 photographs to the heart apex)
  const ascensionParticlesPerPhoto = 10;
  const totalAscensionParticles =
    memoryOrbitPhotoNodes.length * ascensionParticlesPerPhoto;
  const ascensionPositions = new Float32Array(totalAscensionParticles * 3);
  const ascensionPhases = new Float32Array(totalAscensionParticles);
  for (let i = 0; i < totalAscensionParticles; i++) {
    ascensionPhases[i] = (i % ascensionParticlesPerPhoto) / ascensionParticlesPerPhoto;
    ascensionPositions[i * 3] = gcx;
    ascensionPositions[i * 3 + 1] = stageY + 5.0;
    ascensionPositions[i * 3 + 2] = gcz;
  }
  const ascensionGeo = trackGeo(new THREE.BufferGeometry());
  ascensionGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(ascensionPositions, 3),
  );
  const ascensionMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xffe9a6,
      size: 0.24,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const ascensionStreamPoints = new THREE.Points(ascensionGeo, ascensionMat);
  ascensionStreamPoints.frustumCulled = false;
  celestialMemoryOrbitGroup.add(ascensionStreamPoints);

  // Stage 7 (Final Shot): Glowing Star-Heart Directly Above the Floral Arch & Wedding Couple
  const celestialHeartGroup = new THREE.Group();
  celestialHeartGroup.name = 'CelestialStarHeartAboveCouple';
  const heartCenterX = gcx + 1.15;
  const heartCenterY = stageY + 6.95;
  const heartCenterZ = gcz + 1.25;
  celestialHeartGroup.position.set(heartCenterX, heartCenterY, heartCenterZ);
  // Face along the garden viewing axis so it frames the couple beneath the arch
  celestialHeartGroup.rotation.y = -Math.PI * 0.25;

  const heartStarCount = 164;
  const heartStarPositions = new Float32Array(heartStarCount * 3);
  const heartStarColors = new Float32Array(heartStarCount * 3);
  const heartOutlinePts: THREE.Vector3[] = [];
  const cHeartGold = new THREE.Color(0xffe699);
  const cHeartRose = new THREE.Color(0xffb8d2);

  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(t), 3) * 0.115;
    const hy =
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)) *
      0.115;
    heartOutlinePts.push(new THREE.Vector3(hx, hy, 0));
  }

  for (let i = 0; i < heartStarCount; i++) {
    const t = (i / heartStarCount) * Math.PI * 2;
    const radialSpread = i < 108 ? 1.0 : 0.72 + gardenRng() * 0.42;
    const hx = 16 * Math.pow(Math.sin(t), 3) * 0.115 * radialSpread;
    const hy =
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)) *
      0.115 *
      radialSpread;
    const hz = (gardenRng() - 0.5) * 0.28;
    heartStarPositions[i * 3] = hx + (gardenRng() - 0.5) * 0.08;
    heartStarPositions[i * 3 + 1] = hy + (gardenRng() - 0.5) * 0.08;
    heartStarPositions[i * 3 + 2] = hz;

    const col = i % 4 === 0 ? cHeartRose : cHeartGold;
    heartStarColors[i * 3] = col.r;
    heartStarColors[i * 3 + 1] = col.g;
    heartStarColors[i * 3 + 2] = col.b;
  }

  const celestialHeartOutlineGeo = trackGeo(
    new THREE.BufferGeometry().setFromPoints(heartOutlinePts),
  );
  const celestialHeartOutlineMat = trackMat(
    new THREE.LineBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const celestialHeartOutline = new THREE.LineLoop(
    celestialHeartOutlineGeo,
    celestialHeartOutlineMat,
  );
  celestialHeartGroup.add(celestialHeartOutline);

  const celestialHeartStarsGeo = trackGeo(new THREE.BufferGeometry());
  celestialHeartStarsGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(heartStarPositions, 3),
  );
  celestialHeartStarsGeo.setAttribute(
    'color',
    new THREE.BufferAttribute(heartStarColors, 3),
  );
  const celestialHeartStarsMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.26,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const celestialHeartStars = new THREE.Points(
    celestialHeartStarsGeo,
    celestialHeartStarsMat,
  );
  celestialHeartGroup.add(celestialHeartStars);
  celestialMemoryOrbitGroup.add(celestialHeartGroup);

  const tmpLookAtTarget = new THREE.Vector3();

  group.add(celebrationGroup);

  // ==========================================================================
  // 3. SPECIAL GATE RETURN PORTAL AT WESTERN STEPS (-10.5, 3.2, 0.0)
  // ==========================================================================
  const portalGroup = new THREE.Group();
  portalGroup.name = 'SanctuaryReturnPortalArch';
  portalGroup.position.set(
    PRIVATE_ARRIVAL_GATE_POS.x,
    3.2,
    PRIVATE_ARRIVAL_GATE_POS.z,
  );
  portalGroup.rotation.y = Math.PI / 2;

  const pillarGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.3, 3.8, 12));
  const leftPillar = new THREE.Mesh(pillarGeo, deckStoneMat);
  leftPillar.position.set(-1.55, 1.9, 0);
  portalGroup.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, deckStoneMat);
  rightPillar.position.set(1.55, 1.9, 0);
  portalGroup.add(rightPillar);

  const archCrown = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.55, 0.22, 12, 28, Math.PI)),
    deckStoneMat,
  );
  archCrown.position.set(0, 3.8, 0);
  portalGroup.add(archCrown);

  const portalRingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.6,
    }),
  );
  const portalRingMesh = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.38, 0.055, 10, 36)),
    portalRingMat,
  );
  portalRingMesh.position.set(0, 2.35, 0);
  portalGroup.add(portalRingMesh);

  const portalVeilMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const portalVeilMesh = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(1.34, 32)),
    portalVeilMat,
  );
  portalVeilMesh.position.set(0, 2.35, 0);
  portalGroup.add(portalVeilMesh);

  const portalLight = new THREE.PointLight(0xfbbf24, 1.1, 12.0, 1.8);
  portalLight.userData.skipAtmosphereCull = true;
  portalLight.position.set(0, 2.4, 0.5);
  portalGroup.add(portalLight);

  group.add(portalGroup);

  // ==========================================================================
  // 4. CELESTIAL NIGHT SKY DOME:
  //    - Background Starfield (always visible)
  //    - "M A N D U" Star Constellation (always visible, soft natural brightness)
  //    - "I LOVE YOU" Star Constellation (visible ONLY through the telescope, reduced brightness)
  //    - "HAPPY VALENTINE'S DAY, MY LOVE" Proposal Constellation (progressive L->R reveal)
  // ==========================================================================
  const skyConstellationGroup = new THREE.Group();
  skyConstellationGroup.name = 'SkyConstellationDome';

  const rng = createPrivateSeededRng(20270214);
  const skyRadius = 178.0;

  // 4A. Subtle Background Starfield (420 stars across the upper hemisphere)
  const bgStarCount = 420;
  const bgPositions = new Float32Array(bgStarCount * 3);
  const bgColors = new Float32Array(bgStarCount * 3);
  const cStarWarm = new THREE.Color(0xd8ccb4);
  const cStarBlue = new THREE.Color(0x9eb8d6);
  const cStarRose = new THREE.Color(0xcab8c8);

  for (let i = 0; i < bgStarCount; i++) {
    const yaw = rng() * Math.PI * 2;
    const pitch = 0.08 + Math.pow(rng(), 0.78) * 1.25;
    const r = skyRadius + 8.0 + rng() * 14.0;
    const cosP = Math.cos(pitch);
    bgPositions[i * 3] = Math.sin(yaw) * cosP * r;
    bgPositions[i * 3 + 1] = Math.sin(pitch) * r + 3.5;
    bgPositions[i * 3 + 2] = Math.cos(yaw) * cosP * r;

    const pick = rng();
    const sc =
      pick < 0.55 ? cStarBlue : pick < 0.85 ? cStarWarm : cStarRose;
    const bright = 0.42 + rng() * 0.36;
    bgColors[i * 3] = sc.r * bright;
    bgColors[i * 3 + 1] = sc.g * bright;
    bgColors[i * 3 + 2] = sc.b * bright;
  }

  const bgStarGeo = trackGeo(new THREE.BufferGeometry());
  bgStarGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(bgPositions, 3),
  );
  bgStarGeo.setAttribute('color', new THREE.BufferAttribute(bgColors, 3));
  const bgStarMat = trackMat(
    new THREE.PointsMaterial({
      size: 1.25,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    }),
  );
  const bgStarsPoints = new THREE.Points(bgStarGeo, bgStarMat);
  bgStarsPoints.frustumCulled = false;
  skyConstellationGroup.add(bgStarsPoints);

  // Delicate, Pinpoint Star Core & Subtle Halo Geometries (no oversized bloom halos)
  const starDiamondGeo = trackGeo(new THREE.OctahedronGeometry(0.26, 0));
  const starInnerHaloGeo = trackGeo(new THREE.SphereGeometry(0.48, 8, 6));

  function buildConstellationSet(
    blueprints: readonly OrganicLetterConstellationBlueprint[],
    parentGroup: THREE.Group,
    initialMainLineOpacity: number,
    initialSpurLineOpacity: number,
  ): BuiltLetterConstellationRuntime[] {
    const builtList: BuiltLetterConstellationRuntime[] = [];

    for (let idx = 0; idx < blueprints.length; idx++) {
      const bp = blueprints[idx];
      const letterGroup = new THREE.Group();
      letterGroup.name = `ConstellationLetter_${idx + 1}_${bp.letter}`;

      const worldStarPositions: THREE.Vector3[] = [];
      const starCoreMeshes: THREE.Mesh[] = [];
      const starCoreMaterials: THREE.MeshBasicMaterial[] = [];
      const starHaloMaterials: THREE.MeshBasicMaterial[] = [];
      const starBaseScales: number[] = [];

      for (let s = 0; s < bp.stars.length; s++) {
        const st = bp.stars[s];
        const wPos = projectConstellationPointToSky(
          bp.yaw,
          bp.pitch,
          skyRadius,
          bp.scale,
          bp.tiltRad,
          st.u,
          st.v,
        );
        worldStarPositions.push(wPos);

        const starNodeGroup = new THREE.Group();
        starNodeGroup.position.copy(wPos);
        starNodeGroup.lookAt(0, 3.5, 0);

        const coreMat = trackMat(
          new THREE.MeshBasicMaterial({
            color: st.colorHex,
            transparent: true,
            opacity: st.isSpur ? 0.55 : 0.82,
            depthWrite: false,
          }),
        );
        const coreMesh = new THREE.Mesh(starDiamondGeo, coreMat);
        const baseScale = st.mag * (st.isSpur ? 0.68 : 0.88);
        coreMesh.scale.setScalar(baseScale);
        coreMesh.frustumCulled = false;
        starNodeGroup.add(coreMesh);
        starCoreMeshes.push(coreMesh);
        starCoreMaterials.push(coreMat);
        starBaseScales.push(baseScale);

        const innerHaloMat = trackMat(
          new THREE.MeshBasicMaterial({
            color: st.colorHex,
            transparent: true,
            opacity: st.isSpur ? 0.12 : 0.22,
            depthWrite: false,
          }),
        );
        const innerHalo = new THREE.Mesh(starInnerHaloGeo, innerHaloMat);
        innerHalo.scale.setScalar(st.mag * 0.85);
        innerHalo.frustumCulled = false;
        starNodeGroup.add(innerHalo);
        starHaloMaterials.push(innerHaloMat);

        letterGroup.add(starNodeGroup);
      }

      const mainSegCoords: number[] = [];
      for (let e = 0; e < bp.mainEdges.length; e++) {
        const [iA, iB] = bp.mainEdges[e];
        const pA = worldStarPositions[iA];
        const pB = worldStarPositions[iB];
        mainSegCoords.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      }
      const mainLineGeo = trackGeo(new THREE.BufferGeometry());
      mainLineGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(mainSegCoords, 3),
      );
      const mainLineMat = trackMat(
        new THREE.LineBasicMaterial({
          color: 0x8cb4d8,
          transparent: true,
          opacity: initialMainLineOpacity,
          depthWrite: false,
        }),
      );
      const mainLines = new THREE.LineSegments(mainLineGeo, mainLineMat);
      mainLines.frustumCulled = false;
      letterGroup.add(mainLines);

      const spurSegCoords: number[] = [];
      for (let e = 0; e < bp.spurEdges.length; e++) {
        const [iA, iB] = bp.spurEdges[e];
        const pA = worldStarPositions[iA];
        const pB = worldStarPositions[iB];
        spurSegCoords.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      }
      const spurLineGeo = trackGeo(new THREE.BufferGeometry());
      spurLineGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(spurSegCoords, 3),
      );
      const spurLineMat = trackMat(
        new THREE.LineBasicMaterial({
          color: 0x6e9bc4,
          transparent: true,
          opacity: initialSpurLineOpacity,
          depthWrite: false,
        }),
      );
      const spurLines = new THREE.LineSegments(spurLineGeo, spurLineMat);
      spurLines.frustumCulled = false;
      letterGroup.add(spurLines);

      parentGroup.add(letterGroup);

      builtList.push({
        index: idx + 1,
        letter: bp.letter,
        mainLineMat,
        spurLineMat,
        starCoreMeshes,
        starCoreMaterials,
        starHaloMaterials,
        starBaseScales,
        anchorWorldPos: worldStarPositions[bp.anchorStarIdx].clone(),
      });
    }

    return builtList;
  }

  // 4B. ALWAYS-VISIBLE "M A N D U" Star Constellation Group (soft, natural brightness)
  const manduConstellationGroup = new THREE.Group();
  manduConstellationGroup.name = 'AlwaysVisibleManduConstellation';
  const builtManduConstellations = buildConstellationSet(
    MANDU_CONSTELLATION_BLUEPRINTS,
    manduConstellationGroup,
    0.28,
    0.14,
  );
  skyConstellationGroup.add(manduConstellationGroup);

  // 4C. TELESCOPE-ONLY "I LOVE YOU" Star Constellation Group (hidden outside telescope)
  const iLoveYouTelescopeGroup = new THREE.Group();
  iLoveYouTelescopeGroup.name = 'TelescopeOnlyILoveYouConstellation';
  iLoveYouTelescopeGroup.visible = false;

  const builtILoveYouConstellations = buildConstellationSet(
    ORGANIC_LETTER_CONSTELLATION_BLUEPRINTS,
    iLoveYouTelescopeGroup,
    0.0,
    0.0,
  );

  const interLetterArcMats: THREE.LineBasicMaterial[] = [];
  for (let i = 0; i < builtILoveYouConstellations.length - 1; i++) {
    const startPos = builtILoveYouConstellations[i].anchorWorldPos;
    const endPos = builtILoveYouConstellations[i + 1].anchorWorldPos;
    const midPos = startPos
      .clone()
      .add(endPos)
      .multiplyScalar(0.5)
      .normalize()
      .multiplyScalar(skyRadius);
    midPos.y += 4.5;

    const curve = new THREE.QuadraticBezierCurve3(startPos, midPos, endPos);
    const arcPts = curve.getPoints(18);
    const arcGeo = trackGeo(new THREE.BufferGeometry().setFromPoints(arcPts));
    const arcMat = trackMat(
      new THREE.LineBasicMaterial({
        color: 0xa8c2dc,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      }),
    );
    const arcLine = new THREE.Line(arcGeo, arcMat);
    arcLine.frustumCulled = false;
    iLoveYouTelescopeGroup.add(arcLine);
    interLetterArcMats.push(arcMat);
  }

  skyConstellationGroup.add(iLoveYouTelescopeGroup);

  // ==========================================================================
  // 4D. PHASE 4.6B SECTION 5: "HAPPY VALENTINE'S DAY, MY LOVE" SKY CONSTELLATION
  //     Centered above the Proposal Garden's NE Ocean Horizon (yaw=0.72, pitch=0.35)
  // ==========================================================================
  const proposalConstellationGroup = new THREE.Group();
  proposalConstellationGroup.name = 'ProposalSkyConstellation_HappyValentinesDayMyLove';
  proposalConstellationGroup.visible = false;

  const builtProposalChars: ProposalConstellationCharacterRuntime[] = [];

  // Create a warm starlit CanvasTexture for the '🫶🏻' emoji so it glows inside the Heart-Hands star constellation
  const createHeartHandsSkyTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);
      const glow = ctx.createRadialGradient(128, 128, 12, 128, 128, 112);
      glow.addColorStop(0, 'rgba(255, 230, 165, 0.48)');
      glow.addColorStop(0.55, 'rgba(251, 146, 185, 0.18)');
      glow.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 256, 256);

      ctx.font =
        '132px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(253, 224, 71, 0.85)';
      ctx.shadowBlur = 18;
      ctx.fillText('🫶🏻', 128, 134);
    }
    const tex = trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  const heartHandsSkyTex = createHeartHandsSkyTexture();
  const heartHandsPlaneGeo = trackGeo(new THREE.PlaneGeometry(7.2, 7.2));

  function buildProposalConstellationLine(
    lineText: string,
    lineOffsetV: number,
    charScale: number,
    normUStart: number,
    normUEnd: number,
  ) {
    // Normalize multi-codepoint '🫶🏻' / '🫶' into single-character glyph key '♥'
    const normalizedText = lineText.replace(/🫶🏻|🫶/g, '♥');
    const glyphs: { ch: string; tpl: StarGlyphTemplate; centerX: number }[] = [];
    let cursorX = 0;
    const spacing = 0.34;

    for (let i = 0; i < normalizedText.length; i++) {
      const ch = normalizedText[i];
      const tpl = PROPOSAL_SKY_GLYPHS[ch] ?? PROPOSAL_SKY_GLYPHS[' '];
      const halfW = tpl.width * 0.5;
      cursorX += halfW;
      glyphs.push({ ch, tpl, centerX: cursorX });
      cursorX += halfW + spacing;
    }
    const totalWidth = Math.max(0.1, cursorX - spacing);

    for (let i = 0; i < glyphs.length; i++) {
      const { ch, tpl, centerX } = glyphs[i];
      if (tpl.points.length === 0) continue;

      const localGroup = new THREE.Group();
      localGroup.name = `ProposalSkyChar_${ch}_${i}`;
      const relX = centerX - totalWidth * 0.5;
      const charNormU = THREE.MathUtils.lerp(
        normUStart,
        normUEnd,
        centerX / totalWidth,
      );

      const starWorldPts: THREE.Vector3[] = [];
      const starMeshes: THREE.Mesh[] = [];
      const starMats: THREE.MeshBasicMaterial[] = [];
      const haloMats: THREE.MeshBasicMaterial[] = [];
      const baseScales: number[] = [];

      for (let p = 0; p < tpl.points.length; p++) {
        const [pu, pv] = tpl.points[p];
        const u = (relX + pu * tpl.width) * charScale;
        const v = lineOffsetV + pv * charScale * 1.15;

        const wPos = projectConstellationPointToSky(
          PROPOSAL_STAGE_POS.playerFacingYaw, // 0.72 rad (NE horizon)
          0.35, // Comfortable sky elevation above the Proposal Garden horizon
          164.0,
          1.0,
          0.0,
          u,
          v,
          PROPOSAL_STAGE_POS.x,
          PROPOSAL_STAGE_POS.y,
          PROPOSAL_STAGE_POS.z,
        );
        starWorldPts.push(wPos);

        const starNode = new THREE.Group();
        starNode.position.copy(wPos);
        starNode.lookAt(
          PROPOSAL_STAGE_POS.playerStandX,
          PROPOSAL_STAGE_POS.y + 1.4,
          PROPOSAL_STAGE_POS.playerStandZ,
        );

        const isPrimary = p === 0 || p === tpl.points.length - 1;
        const colorHex = isPrimary ? 0xfde68a : 0xbae6fd;

        const sMat = trackMat(
          new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
          }),
        );
        const sMesh = new THREE.Mesh(starDiamondGeo, sMat);
        const bScale = isPrimary ? 0.86 : 0.72;
        sMesh.scale.setScalar(bScale);
        sMesh.frustumCulled = false;
        starNode.add(sMesh);
        starMeshes.push(sMesh);
        starMats.push(sMat);
        baseScales.push(bScale);

        const hMat = trackMat(
          new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
          }),
        );
        const hMesh = new THREE.Mesh(starInnerHaloGeo, hMat);
        hMesh.scale.setScalar(isPrimary ? 0.82 : 0.66);
        hMesh.frustumCulled = false;
        starNode.add(hMesh);
        haloMats.push(hMat);

        localGroup.add(starNode);
      }

      const lineCoords: number[] = [];
      for (let e = 0; e < tpl.edges.length; e++) {
        const [iA, iB] = tpl.edges[e];
        const pA = starWorldPts[iA];
        const pB = starWorldPts[iB];
        if (pA && pB) {
          lineCoords.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
        }
      }

      const lineGeo = trackGeo(new THREE.BufferGeometry());
      lineGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(lineCoords, 3),
      );
      const lineMat = trackMat(
        new THREE.LineBasicMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
        }),
      );
      const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
      lineSegments.frustumCulled = false;
      localGroup.add(lineSegments);

      // If this character is the '🫶🏻' ('♥') glyph, also add a luminous '🫶🏻' sprite plane at its sky center
      if (ch === '♥') {
        const centerSkyPos = projectConstellationPointToSky(
          PROPOSAL_STAGE_POS.playerFacingYaw,
          0.35,
          163.5,
          1.0,
          0.0,
          relX * charScale,
          lineOffsetV,
          PROPOSAL_STAGE_POS.x,
          PROPOSAL_STAGE_POS.y,
          PROPOSAL_STAGE_POS.z,
        );
        const emojiMat = trackMat(
          new THREE.MeshBasicMaterial({
            map: heartHandsSkyTex,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        const emojiMesh = new THREE.Mesh(heartHandsPlaneGeo, emojiMat);
        emojiMesh.position.copy(centerSkyPos);
        emojiMesh.lookAt(
          PROPOSAL_STAGE_POS.playerStandX,
          PROPOSAL_STAGE_POS.y + 1.4,
          PROPOSAL_STAGE_POS.playerStandZ,
        );
        emojiMesh.frustumCulled = false;
        localGroup.add(emojiMesh);
        starMeshes.push(emojiMesh);
        starMats.push(emojiMat);
        haloMats.push(emojiMat);
        baseScales.push(1.0);
      }

      proposalConstellationGroup.add(localGroup);
      builtProposalChars.push({
        normU: charNormU,
        group: localGroup,
        starMeshes,
        starMats,
        haloMats,
        lineMat,
        baseScales,
      });
    }
  }

  // Line 1: "HAPPY VALENTINE'S DAY," (upper line, progressive reveal 0.0 -> 0.68)
  buildProposalConstellationLine("HAPPY VALENTINE'S DAY,", 7.2, 3.85, 0.0, 0.68);
  // Line 2: "LOML 🫶🏻" (lower line, progressive reveal 0.64 -> 0.98)
  buildProposalConstellationLine('LOML 🫶🏻', -4.2, 4.45, 0.64, 0.98);

  skyConstellationGroup.add(proposalConstellationGroup);
  group.add(skyConstellationGroup);

  // ==========================================================================
  // 5. RUNTIME ANIMATION, TELESCOPE & PROPOSAL SEQUENCE STATE
  // ==========================================================================
  let isTelescopeModeActive = false;
  let currentTelescopeVisibility = 0;
  let connectedSkyNodesCount = 1;
  let focusedSkyNodeIndex = 1;
  let discoveredLettersMask = 0b00000001;

  let currentProposalState: ProposalSequenceState = {
    phase: 'IDLE',
    messageIndex: 0,
    totalMessages: 6,
    currentMessageText: '',
    figureOpacity: 0,
    mistIntensity: 0,
    dissolveProgress: 0,
    constellationRevealProgress: 0,
    celebrationProgress: 0,
    weddingAnimTime: 0,
    hasCompletedOnce: false,
  };

  const cWaterMoon = new THREE.Color(0x071528);
  const cWaterFest = new THREE.Color(0x18385c);
  const cWaterEmissiveMoon = new THREE.Color(0x051020);
  const cWaterEmissiveFest = new THREE.Color(0x2d243b);

  const emptyPathTelemetry: PrivatePathLightingTelemetry = {
    activeRouteId: 'primary-route',
    activeRouteName: 'Proposal Garden Path',
    nearestPathDist: 0,
    arcDistanceMeters: 0,
    routeTotalLengthMeters: 18,
    waveLeadMeters: 0,
    activeGlowingStones: 8,
    totalEmbeddedStones: 8,
  };

  function applySkyHighlightState(
    active: boolean,
    _strength: number,
    connectedCount?: number,
    focusedIndex?: number,
    mask?: number,
  ) {
    isTelescopeModeActive = active;
    if (connectedCount !== undefined) {
      connectedSkyNodesCount = THREE.MathUtils.clamp(connectedCount, 1, 8);
    }
    if (focusedIndex !== undefined) {
      focusedSkyNodeIndex = THREE.MathUtils.clamp(focusedIndex, 1, 8);
    }
    if (mask !== undefined) {
      discoveredLettersMask = mask;
    }
  }

  return {
    group,
    colliders,

    setDebugVisible() {},
    isDebugVisible() {
      return false;
    },
    setVegetationVisible() {},
    isVegetationVisible() {
      return false;
    },
    resetPathLighting() {
      for (let i = 0; i < pathLanternNodes.length; i++) {
        pathLanternNodes[i].bloomLevel = 0;
        pathLanternNodes[i].proximityBoost = 0;
      }
    },
    setOnSteppingStoneStep() {},
    triggerPondRipple() {},
    triggerPondTouchRipple() {},

    setTelescopeSkyState: applySkyHighlightState,
    setTelescopeHighlight: applySkyHighlightState,

    setProposalSequenceState(state: ProposalSequenceState) {
      currentProposalState = state;
    },

    setLoveseatCompanionActive(active: boolean) {
      isLoveseatCompanionTargetActive = active;
    },

    getPathLightingTelemetry() {
      return emptyPathTelemetry;
    },

    getRouteDistanceTo() {
      return 0;
    },

    update(
      delta: number,
      elapsedTime: number,
      playerPos?: THREE.Vector3,
      _playerVelocity?: THREE.Vector3,
      camera?: THREE.Camera,
    ) {
      // Gentle return portal, focal crystal & heart inlay shimmer
      portalVeilMat.opacity = 0.18 + Math.sin(elapsedTime * 2.1) * 0.04;
      stageFocalMarker.rotation.y = elapsedTime * 0.85;
      stageFocalMarker.position.y =
        stageY + 0.18 + Math.sin(elapsedTime * 2.2) * 0.03;
      heartLineMat.opacity = 0.62 + Math.sin(elapsedTime * 2.4) * 0.15;

      // 0A. Update Two-Person Stargazing Loveseat Companion Presence
      const targetCompVis = isLoveseatCompanionTargetActive ? 1.0 : 0.0;
      loveseatCompanionVisibility +=
        (targetCompVis - loveseatCompanionVisibility) *
        Math.min(1, delta * 3.2);
      if (loveseatCompanionVisibility <= 0.005) {
        loveseatCompanionGroup.visible = false;
      } else {
        loveseatCompanionGroup.visible = true;
        const breathe = Math.sin(elapsedTime * 1.75) * 0.01;
        loveseatCompanionGroup.position.y = 0.46 + breathe;
        seatedHeadGroup.rotation.z =
          0.26 + Math.sin(elapsedTime * 1.1) * 0.03;
        innerHandNode.position.y =
          0.16 + Math.sin(elapsedTime * 2.1) * 0.008;

        loveseatCompanionCoreMat.opacity =
          loveseatCompanionVisibility * 0.76;
        loveseatCompanionAuraMat.opacity =
          loveseatCompanionVisibility *
          (0.28 + Math.sin(elapsedTime * 2.3) * 0.05);

        loveseatHeartMote.position.y =
          0.27 + Math.sin(elapsedTime * 2.4) * 0.035;
        loveseatHeartMote.rotation.y = elapsedTime * 1.4;
        loveseatHeartMoteMat.opacity =
          loveseatCompanionVisibility *
          (0.68 + Math.sin(elapsedTime * 3.0) * 0.18);
      }

      // 0B. Interactive "Lantern Lighting Walk" Along the Curved Garden Path
      const celProgForPath = currentProposalState.celebrationProgress ?? 0;
      const lfAttr = lanternFireflyGeo.attributes
        .position as THREE.BufferAttribute;
      let litLanternCount = 0;

      for (let l = 0; l < pathLanternNodes.length; l++) {
        const node = pathLanternNodes[l];
        let distToPlayer = 999;
        if (playerPos) {
          distToPlayer = Math.hypot(
            playerPos.x - node.x,
            playerPos.z - node.z,
          );
        }

        // Awaken lantern permanently when Harsha walks within 4.3m (or during wedding celebration)
        const nearFactor =
          1.0 - THREE.MathUtils.smoothstep(distToPlayer, 1.4, 4.4);
        if (nearFactor > 0.05 || celProgForPath > 0.05) {
          const targetBloom = Math.max(
            node.bloomLevel,
            nearFactor > 0.05 ? Math.max(0.88, nearFactor) : 0,
            celProgForPath,
          );
          node.bloomLevel +=
            (targetBloom - node.bloomLevel) * Math.min(1, delta * 3.8);
        }
        node.proximityBoost +=
          (nearFactor - node.proximityBoost) * Math.min(1, delta * 5.0);

        if (node.bloomLevel > 0.25) litLanternCount++;

        const pulse = Math.sin(elapsedTime * 2.8 + l * 0.9) * 0.1;
        node.globeMat.emissiveIntensity =
          0.55 +
          node.bloomLevel * 1.55 +
          node.proximityBoost * 0.65 +
          pulse * node.bloomLevel;
        node.haloMat.opacity =
          0.06 +
          node.bloomLevel * 0.34 +
          node.proximityBoost * 0.18 +
          pulse * 0.05;
        node.haloMesh.scale.setScalar(
          1.55 + node.bloomLevel * 0.55 + node.proximityBoost * 0.35,
        );

        // Swirl rose-gold fireflies around each awakened path lantern
        const activeSwirl = Math.max(0.08, node.bloomLevel);
        for (let f = 0; f < firefliesPerLantern; f++) {
          const idx = l * firefliesPerLantern + f;
          const angle =
            elapsedTime * (1.35 + (f % 3) * 0.35) + f * 0.78 + l * 1.1;
          const radius =
            (0.16 + (f % 4) * 0.11) *
            (0.35 + activeSwirl * 0.85 + node.proximityBoost * 0.35);
          const heightOffset =
            ((elapsedTime * 0.28 + f * 0.17 + l * 0.13) % 0.95) *
              activeSwirl -
            0.12;
          lfAttr.setXYZ(
            idx,
            node.x + Math.cos(angle) * radius,
            node.y + heightOffset,
            node.z + Math.sin(angle) * radius,
          );
        }
      }
      lfAttr.needsUpdate = true;
      emptyPathTelemetry.activeGlowingStones = litLanternCount;
      emptyPathTelemetry.totalEmbeddedStones = pathLanternNodes.length;

      // Animate floating warm fireflies & rose-gold light motes across the Proposal Garden
      const ffAttr = fireflyGeo.attributes.position as THREE.BufferAttribute;
      for (let f = 0; f < fireflyCount; f++) {
        const bx = fireflyBasePos[f * 3];
        const by = fireflyBasePos[f * 3 + 1];
        const bz = fireflyBasePos[f * 3 + 2];
        const phase = elapsedTime * 0.85 + f * 1.13;
        ffAttr.setXYZ(
          f,
          bx + Math.sin(phase) * 0.32,
          by + Math.sin(elapsedTime * 1.35 + f * 0.7) * 0.24,
          bz + Math.cos(phase * 0.9) * 0.32,
        );
      }
      ffAttr.needsUpdate = true;
      fireflyMat.opacity = 0.68 + Math.sin(elapsedTime * 2.6) * 0.15;

      // 1. Update Always-Visible "M A N D U" Star Constellations (subtle, natural starlight)
      for (let i = 0; i < builtManduConstellations.length; i++) {
        const m = builtManduConstellations[i];
        const twinkle =
          Math.sin(elapsedTime * 1.9 + i * 1.3) * 0.5 + 0.5;
        m.mainLineMat.opacity = 0.25 + twinkle * 0.05;
        m.spurLineMat.opacity = 0.13 + twinkle * 0.03;

        for (let s = 0; s < m.starCoreMeshes.length; s++) {
          const wave =
            Math.sin(elapsedTime * 2.4 + i * 1.5 + s * 2.1) * 0.08;
          m.starCoreMeshes[s].scale.setScalar(
            m.starBaseScales[s] * (0.96 + wave),
          );
        }
      }

      // 2. Update Kneeling Mist Figure & Rising Particles at the Proposal Stage
      const figOp = currentProposalState.figureOpacity;
      const mistDens = currentProposalState.mistIntensity;
      const riseProg = currentProposalState.dissolveProgress;

      if (figOp <= 0.005 && mistDens <= 0.005) {
        mistFigureGroup.visible = false;
      } else {
        mistFigureGroup.visible = true;

        // Smoothly turn the kneeling figure to face Harsha as she walks around the stage
        if (playerPos) {
          const dx = playerPos.x - PROPOSAL_STAGE_POS.figureX;
          const dz = playerPos.z - PROPOSAL_STAGE_POS.figureZ;
          if (dx * dx + dz * dz > 0.04) {
            const desiredYaw = Math.atan2(dx, dz);
            let diff =
              ((desiredYaw - currentFigureYaw + Math.PI) % (Math.PI * 2)) -
              Math.PI;
            if (diff < -Math.PI) diff += Math.PI * 2;
            currentFigureYaw += diff * Math.min(1, delta * 5.5);
            mistFigureGroup.rotation.y = currentFigureYaw;
          }
        }

        // Simple fade-in effect settling gently into the kneeling position
        const breathe = Math.sin(elapsedTime * 1.8) * 0.012;
        const kneelSettleOffset =
          currentProposalState.phase === 'MIST_GATHER'
            ? (1.0 - figOp) * 0.22
            : 0.0;
        figureBodyGroup.position.y = kneelSettleOffset + breathe;
        figureBodyGroup.rotation.x =
          currentProposalState.phase === 'MIST_GATHER'
            ? (1.0 - figOp) * -0.12
            : 0.0;
        const emergeScale =
          currentProposalState.phase === 'MIST_GATHER'
            ? 0.9 + figOp * 0.1
            : 1.0;
        figureBodyGroup.scale.set(1.0, emergeScale, 1.0);

        mistBodyCoreMat.opacity = figOp * 0.78;
        mistBodyAuraMat.opacity =
          figOp * (0.3 + Math.sin(elapsedTime * 2.4) * 0.05);
        mistGroundRingMat.opacity =
          mistDens * (0.36 + Math.sin(elapsedTime * 1.9) * 0.05);

        groundMistOuter.rotation.z = elapsedTime * 0.18;
        groundMistInner.rotation.z = -elapsedTime * 0.26;
        const mistSpread = 1.0 + riseProg * 0.65;
        groundMistOuter.scale.setScalar(mistSpread);

        // Update mist particles (gentle swirl during message, rising & fading during dissolution)
        const pAttr = mistParticlesGeo.attributes
          .position as THREE.BufferAttribute;
        for (let p = 0; p < mistParticleCount; p++) {
          const bx = mistParticleBasePos[p * 3];
          const by = mistParticleBasePos[p * 3 + 1];
          const bz = mistParticleBasePos[p * 3 + 2];
          const swirlAngle = elapsedTime * 0.55 + p * 0.7;
          const driftX = Math.cos(swirlAngle) * (0.05 + riseProg * 0.28);
          const driftZ = Math.sin(swirlAngle) * (0.05 + riseProg * 0.28);
          const driftY =
            ((elapsedTime * 0.14 + p * 0.09) % 0.45) +
            riseProg * (1.45 + (p % 5) * 0.28);

          pAttr.setXYZ(p, bx + driftX, by + driftY, bz + driftZ);
        }
        pAttr.needsUpdate = true;
        mistParticlesMat.opacity =
          mistDens * (1.0 - riseProg * 0.65) * 0.65;
      }

      // 3. Update "HAPPY VALENTINE'S DAY, MY LOVE" Proposal Constellation Reveal (Left-to-Right)
      const revProg = currentProposalState.constellationRevealProgress;
      if (revProg <= 0.002) {
        proposalConstellationGroup.visible = false;
      } else {
        proposalConstellationGroup.visible = true;
        for (let i = 0; i < builtProposalChars.length; i++) {
          const chObj = builtProposalChars[i];
          const charAlpha = THREE.MathUtils.clamp(
            (revProg - chObj.normU * 0.88) / 0.12,
            0.0,
            1.0,
          );
          if (charAlpha <= 0.001) {
            chObj.group.visible = false;
            continue;
          }
          chObj.group.visible = true;
          const twinkle =
            Math.sin(elapsedTime * 2.3 + i * 0.85) * 0.5 + 0.5;
          chObj.lineMat.opacity = charAlpha * (0.36 + twinkle * 0.06);

          for (let s = 0; s < chObj.starMeshes.length; s++) {
            const sWave =
              Math.sin(elapsedTime * 2.8 + i * 1.1 + s * 1.9) * 0.09;
            chObj.starMeshes[s].scale.setScalar(
              chObj.baseScales[s] * (0.95 + sWave) * (0.6 + charAlpha * 0.4),
            );
            chObj.starMats[s].opacity = charAlpha * (0.84 + twinkle * 0.08);
            chObj.haloMats[s].opacity = charAlpha * (0.22 + twinkle * 0.05);
          }
        }
      }

      // 3B. Post-Constellation Grand Finale: Bright Golden Festival Illumination,
      //     Continuous Sky Fireworks, Stage Sparklers & Bride-and-Groom Marriage Animation
      const celProg = currentProposalState.celebrationProgress ?? 0;
      const wedTime = currentProposalState.weddingAnimTime ?? 0;

      // Boost lanterns, stage lights, water reflections & blossom warmth with celProg
      deckWarmLight.intensity = THREE.MathUtils.lerp(1.15, 2.85, celProg);
      gardenWarmLight.intensity = THREE.MathUtils.lerp(1.25, 3.75, celProg);
      warmDeckGlowMat.emissiveIntensity = THREE.MathUtils.lerp(
        0.95,
        2.3,
        celProg,
      );
      blossomIvoryMat.emissiveIntensity = THREE.MathUtils.lerp(
        0.35,
        0.88,
        celProg,
      );
      blossomRoseMat.emissiveIntensity = THREE.MathUtils.lerp(
        0.32,
        0.85,
        celProg,
      );
      blossomSkyMat.emissiveIntensity = THREE.MathUtils.lerp(
        0.35,
        0.85,
        celProg,
      );
      heartGlowMat.emissiveIntensity = THREE.MathUtils.lerp(
        0.85,
        1.85,
        celProg,
      );
      waterMat.color.lerpColors(cWaterMoon, cWaterFest, celProg);
      waterMat.emissive.lerpColors(
        cWaterEmissiveMoon,
        cWaterEmissiveFest,
        celProg,
      );
      waterMat.emissiveIntensity = THREE.MathUtils.lerp(0.42, 0.95, celProg);

      if (celProg <= 0.005) {
        celebrationGroup.visible = false;
        stageFestivalLight.intensity = 0;
        archFestivalLight.intensity = 0;
        fireworkSkyFlashLight.intensity = 0;
      } else {
        celebrationGroup.visible = true;
        stageFestivalLight.intensity =
          celProg * (3.6 + Math.sin(elapsedTime * 3.2) * 0.25);
        archFestivalLight.intensity =
          celProg * (2.6 + Math.cos(elapsedTime * 2.8) * 0.2);

        for (let m = 0; m < weddingMaterials.length; m++) {
          const item = weddingMaterials[m];
          item.mat.opacity = item.baseOpacity * celProg;
        }

        // Choreographed 3-Beat Bride & Groom Marriage Ceremony on the Proposal Stage
        // Beat 1 (0.0s .. 3.0s): Ceremonial Approach & Reverent Bow beneath the Floral Arch
        // Beat 2 (3.0s .. 6.5s): Exchange of Floral Garlands (Jaimala) & Golden Wedding Rings
        // Beat 3 (6.5s+): Joining Hands in Marriage & Joyous Celebration under Petals & Fireworks
        const approachT = THREE.MathUtils.clamp(wedTime / 3.0, 0, 1);
        const smoothApproach =
          approachT * approachT * (3.0 - 2.0 * approachT);
        const exchangeT = THREE.MathUtils.clamp((wedTime - 3.0) / 3.5, 0, 1);
        const smoothExchange =
          exchangeT * exchangeT * (3.0 - 2.0 * exchangeT);
        const joinedT = THREE.MathUtils.clamp((wedTime - 6.5) / 2.2, 0, 1);
        const smoothJoined = joinedT * joinedT * (3.0 - 2.0 * joinedT);

        // Subtle periodic celebratory vow nod every 12 seconds after joining hands
        const eternalWave =
          wedTime > 8.5 ? Math.sin((wedTime - 8.5) * 1.45) : 0;

        const separationX = THREE.MathUtils.lerp(0.48, 0.25, smoothApproach);
        const walkBob =
          approachT < 1.0
            ? Math.abs(Math.sin(wedTime * 6.5)) * 0.025 * (1.0 - approachT)
            : Math.sin(elapsedTime * 2.1) * 0.008;

        groomRoot.position.set(
          -separationX + eternalWave * 0.012,
          walkBob,
          smoothJoined * 0.05,
        );
        brideRoot.position.set(
          separationX - eternalWave * 0.012,
          walkBob,
          smoothJoined * 0.05,
        );

        // Orientation: During Beat 1 & 2, face each other (+PI/2 and -PI/2);
        // During Beat 3, pivot toward the stage center & Harsha (+0.38 and -0.38 rad) while holding hands!
        const groomTargetYaw = THREE.MathUtils.lerp(
          Math.PI * 0.46,
          0.36,
          smoothJoined,
        );
        const brideTargetYaw = THREE.MathUtils.lerp(
          -Math.PI * 0.46,
          -0.36,
          smoothJoined,
        );
        groomRoot.rotation.y = groomTargetYaw + eternalWave * 0.06;
        brideRoot.rotation.y = brideTargetYaw - eternalWave * 0.06;

        // Reverent Bow at the end of Beat 1 (1.8s .. 3.2s) & gentle nod in Beat 3
        const bowFactor =
          Math.sin(
            THREE.MathUtils.clamp((wedTime - 1.6) / 1.6, 0, 1) * Math.PI,
          ) *
            0.22 +
          (wedTime > 9.0 ? Math.max(0, Math.sin(wedTime * 0.9)) * 0.08 : 0);
        groomHeadGroup.rotation.x = bowFactor;
        brideHeadGroup.rotation.x = bowFactor * 1.1;

        // Arm Choreography:
        // Beat 2: Raise both arms forward to place floral garlands & exchange rings
        // Beat 3: Inner arms (groomLeftArm & brideRightArm) reach together to clasp hands;
        //         Outer arms (groomRightArm & brideLeftArm) wave gently in celebration!
        const raiseGarlandBell = Math.sin(exchangeT * Math.PI);
        groomLeftArm.rotation.x =
          -0.25 - raiseGarlandBell * 0.95 - smoothJoined * 0.55;
        groomLeftArm.rotation.z = smoothJoined * 0.32;

        brideRightArm.rotation.x =
          -0.25 - raiseGarlandBell * 0.95 - smoothJoined * 0.55;
        brideRightArm.rotation.z = -smoothJoined * 0.32;

        const outerWave =
          smoothJoined * (0.45 + Math.sin(elapsedTime * 3.2) * 0.18);
        groomRightArm.rotation.x = -0.2 - raiseGarlandBell * 0.75 - outerWave;
        groomRightArm.rotation.z = -outerWave * 0.45;

        brideLeftArm.rotation.x = -0.2 - raiseGarlandBell * 0.75 - outerWave;
        brideLeftArm.rotation.z = outerWave * 0.45;

        // Ceremonial Floral Garlands (Jaimala) Trajectory:
        // Start in each partner's hands during Beat 1/2, arc up over the head in Beat 2,
        // and rest around each other's neck/chest in Beat 3!
        const garlandArcHeight = Math.sin(smoothExchange * Math.PI) * 0.34;
        groomGarland.position.set(
          THREE.MathUtils.lerp(
            -separationX + 0.16,
            brideRoot.position.x,
            smoothExchange,
          ),
          THREE.MathUtils.lerp(0.76, 0.88, smoothExchange) +
            garlandArcHeight +
            walkBob,
          THREE.MathUtils.lerp(0.12, brideRoot.position.z + 0.02, smoothExchange),
        );
        brideGarland.position.set(
          THREE.MathUtils.lerp(
            separationX - 0.16,
            groomRoot.position.x,
            smoothExchange,
          ),
          THREE.MathUtils.lerp(0.74, 0.91, smoothExchange) +
            garlandArcHeight +
            walkBob,
          THREE.MathUtils.lerp(0.12, groomRoot.position.z + 0.02, smoothExchange),
        );

        // Twin Interlocking Golden Wedding Rings & Floating Heart Emblem above joined hands
        const symbolVis = THREE.MathUtils.clamp((wedTime - 2.6) / 2.2, 0, 1);
        weddingSymbolGroup.visible = symbolVis > 0.01;
        weddingSymbolGroup.scale.setScalar(
          symbolVis * (0.92 + Math.sin(elapsedTime * 2.8) * 0.08),
        );
        weddingSymbolGroup.position.set(
          0,
          1.34 + Math.sin(elapsedTime * 2.2) * 0.04,
          0.16,
        );
        weddingSymbolGroup.rotation.y = elapsedTime * 0.95;

        // Animate 6 Golden Stage Sparkler Fountains
        const spAttr = stageSparksGeo.attributes
          .position as THREE.BufferAttribute;
        for (let i = 0; i < totalStageSparks; i++) {
          const fIdx = Math.floor(i / sparksPerFountain);
          const [nx, nz] = sparklerNozzleCoords[fIdx];
          const vx = stageSparksSeeds[i * 4];
          const vy = stageSparksSeeds[i * 4 + 1];
          const vz = stageSparksSeeds[i * 4 + 2];
          const phase = stageSparksSeeds[i * 4 + 3];

          const life = (elapsedTime * 1.45 + phase) % 1.0;
          const sx = nx + vx * life;
          const sy =
            stageY + 0.14 + vy * life - 0.55 * life * life;
          const sz = nz + vz * life;
          spAttr.setXYZ(i, sx, Math.max(stageY + 0.05, sy), sz);
        }
        spAttr.needsUpdate = true;
        stageSparksMat.opacity =
          celProg * (0.82 + Math.sin(elapsedTime * 8.0) * 0.12);

        // Animate 56 Falling Bridal Rose & Gold Petals beneath the Floral Arch
        const bpAttr = bridalPetalGeo.attributes
          .position as THREE.BufferAttribute;
        for (let i = 0; i < bridalPetalCount; i++) {
          const ox = bridalPetalSeeds[i * 4];
          const phase = bridalPetalSeeds[i * 4 + 1];
          const oz = bridalPetalSeeds[i * 4 + 2];
          const speed = bridalPetalSeeds[i * 4 + 3];

          const fallT = (elapsedTime * 0.28 * speed + phase) % 1.0;
          const px =
            gcx +
            1.15 +
            ox +
            Math.sin(elapsedTime * 1.8 + i) * 0.18;
          const py = stageY + 2.95 * (1.0 - fallT) + 0.06;
          const pz =
            gcz +
            1.25 +
            oz +
            Math.cos(elapsedTime * 1.5 + i) * 0.18;
          bpAttr.setXYZ(i, px, py, pz);
        }
        bpAttr.needsUpdate = true;
        bridalPetalMat.opacity = celProg * 0.85;

        // Animate 8 Continuous Multi-Color Sky Firework Shells & Ascending Rocket Trails
        const fwAttr = fireworksGeo.attributes
          .position as THREE.BufferAttribute;
        let brightestBurstStrength = 0;
        let brightestBurstHex = 0xfde047;

        for (let s = 0; s < fireworkShellConfigs.length; s++) {
          const cfg = fireworkShellConfigs[s];
          const cycleT =
            ((elapsedTime + cfg.phaseOffset * cfg.period) % cfg.period) /
            cfg.period;

          if (cycleT < 0.22) {
            // Ascending Rocket Streak Phase (0.0 .. 0.22)
            const rocketT = cycleT / 0.22;
            const easeUp = 1.0 - Math.pow(1.0 - rocketT, 2.0);
            const curY = THREE.MathUtils.lerp(4.0, cfg.cy, easeUp);

            for (let p = 0; p < particlesPerShell; p++) {
              const idx = s * particlesPerShell + p;
              const trailLag = (p / particlesPerShell) * 2.4;
              const jitter = (p % 5) * 0.04;
              fwAttr.setXYZ(
                idx,
                cfg.cx + jitter,
                Math.max(3.5, curY - trailLag),
                cfg.cz - jitter,
              );
            }
          } else {
            // Multi-Color Chrysanthemum & Ring Burst Phase (0.22 .. 1.0)
            const burstT = (cycleT - 0.22) / 0.78;
            const expand =
              (1.0 - Math.pow(1.0 - burstT, 2.3)) * cfg.burstRadius;
            const gravityDrop = burstT * burstT * 3.8;
            const flashStrength = Math.sin(
              THREE.MathUtils.clamp(burstT * 1.35, 0, 1) * Math.PI,
            );
            if (flashStrength > brightestBurstStrength) {
              brightestBurstStrength = flashStrength;
              brightestBurstHex = cfg.primaryHex;
            }

            for (let p = 0; p < particlesPerShell; p++) {
              const idx = s * particlesPerShell + p;
              const dx = fwUnitDirs[idx * 4];
              const dy = fwUnitDirs[idx * 4 + 1];
              const dz = fwUnitDirs[idx * 4 + 2];
              const spd = fwUnitDirs[idx * 4 + 3];
              const r = expand * spd;

              fwAttr.setXYZ(
                idx,
                cfg.cx + dx * r,
                cfg.cy + dy * r - gravityDrop,
                cfg.cz + dz * r,
              );
            }
          }
        }
        fwAttr.needsUpdate = true;
        fireworksMat.opacity =
          celProg * (0.86 + Math.sin(elapsedTime * 6.5) * 0.1);
        fireworkSkyFlashLight.color.setHex(brightestBurstHex);
        fireworkSkyFlashLight.intensity =
          celProg * brightestBurstStrength * 4.2;

        // 5. Update 360° Celestial Memory Orbit & 7-Stage Wedding Finale Choreography
        // Stage 4: 360° orbital motion smoothly activates around wedTime >= 4.5s
        const orbitMotionRamp = THREE.MathUtils.smoothstep(wedTime, 4.2, 7.2);
        const orbitElapsed = Math.max(0, wedTime - 4.2) * orbitMotionRamp;

        // Stage 6: Final celebration ascension (10.0s .. 16.0s) — photos gently rise & release star streams
        const starAscensionProg = THREE.MathUtils.smoothstep(
          wedTime,
          10.0,
          15.8,
        );
        // Stage 7: Final shot (12.0s .. 17.2s) — stars form a glowing heart above the wedding couple
        const starHeartProg = THREE.MathUtils.smoothstep(wedTime, 12.0, 17.0);

        // Update 3 Concentric Golden Starlight Orbit Threads
        for (let rIdx = 0; rIdx < orbitRingVisuals.length; rIdx++) {
          const ringVis = orbitRingVisuals[rIdx];
          const ringAppearStart = rIdx === 0 ? 1.2 : rIdx === 1 ? 3.4 : 5.2;
          const ringAppear = THREE.MathUtils.smoothstep(
            wedTime,
            ringAppearStart,
            ringAppearStart + 2.2,
          );
          const ringFireworkBoost = brightestBurstStrength * 0.22;
          ringVis.lineMat.opacity =
            celProg * ringAppear * (0.28 + ringFireworkBoost);
          ringVis.beadsMat.opacity =
            celProg *
            ringAppear *
            (0.64 +
              Math.sin(elapsedTime * 2.8 + rIdx) * 0.14 +
              ringFireworkBoost);
          ringVis.beadsPoints.rotation.y =
            (rIdx === 0 ? -0.025 : rIdx === 1 ? 0.018 : -0.006) * orbitElapsed;
        }

        // Update 11 Camera-Facing Photographs Across the 3 Concentric 360° Orbits
        const ascAttr = ascensionGeo.getAttribute(
          'position',
        ) as THREE.BufferAttribute;

        for (let i = 0; i < memoryOrbitPhotoNodes.length; i++) {
          const node = memoryOrbitPhotoNodes[i];
          const appearProg = THREE.MathUtils.smoothstep(
            wedTime,
            node.appearStartTime,
            node.appearStartTime + node.appearDuration,
          );

          if (appearProg <= 0.005) {
            node.root.visible = false;
            continue;
          }
          node.root.visible = true;

          // Distinct orbital rotation per layer:
          // Layer 0 (inner): slow clockwise (-0.052 rad/s)
          // Layer 1 (middle): very slow counterclockwise (+0.031 rad/s)
          // Layer 2 (outer): almost stationary (-0.007 rad/s) with gentle floating
          const curAngle = node.baseAngle + orbitElapsed * node.angularSpeed;
          const floatWave =
            Math.sin(
              elapsedTime * (node.layerIndex === 2 ? 1.15 : 1.45) +
                node.floatPhase,
            ) * (node.layerIndex === 2 ? 0.22 : 0.14);

          // Stage 6: Photographs gently rise higher into the starry sky as they release starlight
          const ascensionLift = starAscensionProg * 0.65;
          const worldX = gcx + Math.cos(curAngle) * node.orbitRadius;
          const worldZ = gcz + Math.sin(curAngle) * node.orbitRadius;
          const worldY =
            node.baseHeight +
            node.heightOffset +
            floatWave +
            ascensionLift -
            (1.0 - appearProg) * 0.85;

          node.root.position.set(worldX, worldY, worldZ);

          // Camera-facing perspective with subtle banking so 360° rotation feels natural from any angle
          if (camera) {
            tmpLookAtTarget.set(
              camera.position.x,
               THREE.MathUtils.lerp(worldY, camera.position.y, 0.65),
              camera.position.z,
            );
          } else if (playerPos) {
            tmpLookAtTarget.set(playerPos.x, worldY - 0.8, playerPos.z);
          } else {
            tmpLookAtTarget.set(gcx, stageY + 1.65, gcz);
          }
          node.root.lookAt(tmpLookAtTarget);

          // Scale gently settles on entry and subtly condenses during star transformation
          const entryScale =
            node.baseScale *
            (0.65 + 0.35 * appearProg) *
            (1.0 - starAscensionProg * 0.12);
          node.root.scale.setScalar(entryScale);

          // Stage 5: Synchronize golden frame highlights with major fireworks bursts
          const fireworkHighlight = brightestBurstStrength;
          const frameAlpha = celProg * appearProg;

          node.photoMat.opacity = frameAlpha * (0.94 - starAscensionProg * 0.1);
          node.glassMat.opacity = frameAlpha * 0.26;
          node.goldBorderMat.opacity = frameAlpha * 0.96;
          node.goldBorderMat.emissiveIntensity =
            0.42 + fireworkHighlight * 0.95 + starAscensionProg * 0.45;
          node.haloGlowMat.opacity =
            frameAlpha *
            (0.18 +
              fireworkHighlight * 0.44 +
              starAscensionProg * 0.28 +
              Math.sin(elapsedTime * 2.6 + node.floatPhase) * 0.05);

          // Stage 6: Star-core gem above each photograph blooms as stars ascend toward the heart
          node.starCoreMat.opacity =
            frameAlpha *
            (0.25 + starAscensionProg * 0.75 + fireworkHighlight * 0.25);
          node.starCoreMesh.rotation.y = elapsedTime * 1.8 + i;
          const starGemScale =
            0.7 + starAscensionProg * 0.85 + fireworkHighlight * 0.3;
          node.starCoreMesh.scale.setScalar(starGemScale);

          // Update ascending star particles streaming from this photograph to the Celestial Star-Heart
          for (let p = 0; p < ascensionParticlesPerPhoto; p++) {
            const pIdx = i * ascensionParticlesPerPhoto + p;
            const streamT =
              (ascensionPhases[pIdx] + elapsedTime * 0.28 + i * 0.09) % 1.0;
            const easeT = streamT * streamT * (3.0 - 2.0 * streamT);
            const spiral =
              Math.sin(streamT * Math.PI * 2 + i + elapsedTime * 2.0) *
              (1.0 - streamT) *
              0.35;
            const sx =
              THREE.MathUtils.lerp(worldX, heartCenterX, easeT) + spiral;
            const sy =
              THREE.MathUtils.lerp(worldY + 0.4, heartCenterY, easeT) +
              Math.sin(streamT * Math.PI) * 0.85;
            const sz =
              THREE.MathUtils.lerp(worldZ, heartCenterZ, easeT) - spiral;
            ascAttr.setXYZ(pIdx, sx, sy, sz);
          }
        }

        ascAttr.needsUpdate = true;
        ascensionMat.opacity =
          celProg *
          starAscensionProg *
          (0.68 + Math.sin(elapsedTime * 4.2) * 0.16);

        // Stage 7: Final Shot — Glowing Star-Heart above the wedding couple & floral arch
        if (starHeartProg <= 0.005) {
          celestialHeartGroup.visible = false;
        } else {
          celestialHeartGroup.visible = true;
          const heartPulse =
            1.0 +
            Math.sin(elapsedTime * 2.4) * 0.045 +
            brightestBurstStrength * 0.06;
          celestialHeartGroup.scale.setScalar(
            (0.72 + 0.28 * starHeartProg) * heartPulse,
          );
          if (camera) {
            const dx = camera.position.x - heartCenterX;
            const dz = camera.position.z - heartCenterZ;
            celestialHeartGroup.rotation.y = Math.atan2(dx, dz);
          }
          celestialHeartOutlineMat.opacity =
            celProg *
            starHeartProg *
            (0.65 + brightestBurstStrength * 0.3 + Math.sin(elapsedTime * 3.1) * 0.1);
          celestialHeartStarsMat.opacity =
            celProg *
            starHeartProg *
            (0.88 + Math.sin(elapsedTime * 3.8) * 0.12);
        }
      }

      // 4. Update Telescope-Only "I LOVE YOU" Star Constellations
      const targetTeleVis = isTelescopeModeActive ? 1.0 : 0.0;
      currentTelescopeVisibility +=
        (targetTeleVis - currentTelescopeVisibility) *
        Math.min(1, delta * 7.5);

      if (currentTelescopeVisibility <= 0.01) {
        iLoveYouTelescopeGroup.visible = false;
        return;
      }

      iLoveYouTelescopeGroup.visible = true;
      const vis = currentTelescopeVisibility;
      const allEightConnected = connectedSkyNodesCount >= 8;

      for (let i = 0; i < builtILoveYouConstellations.length; i++) {
        const c = builtILoveYouConstellations[i];
        const isDiscovered =
          (discoveredLettersMask & (1 << i)) !== 0 ||
          c.index <= connectedSkyNodesCount;
        const isFocused = c.index === focusedSkyNodeIndex;

        const twinkle =
          Math.sin(elapsedTime * 2.2 + i * 1.15) * 0.5 + 0.5;

        const baseMainOp = isDiscovered
          ? (isFocused ? 0.44 : 0.34) +
            twinkle * 0.04 +
            (allEightConnected ? 0.04 : 0)
          : 0.16 + twinkle * 0.03;

        c.mainLineMat.opacity = baseMainOp * vis;
        c.mainLineMat.color.setHex(
          isFocused
            ? 0xd6c8ad
            : isDiscovered
              ? 0x9eb8d6
              : 0x7294b8,
        );

        const baseSpurOp = isDiscovered
          ? isFocused
            ? 0.22
            : 0.16
          : 0.09;
        c.spurLineMat.opacity = baseSpurOp * vis;

        for (let s = 0; s < c.starCoreMeshes.length; s++) {
          const starWave =
            Math.sin(elapsedTime * 2.7 + i * 1.7 + s * 2.3) * 0.08;
          const discoveryScale = isDiscovered
            ? isFocused
              ? 1.06
              : 0.98
            : 0.84;
          c.starCoreMeshes[s].scale.setScalar(
            c.starBaseScales[s] * (discoveryScale + starWave),
          );
          c.starCoreMaterials[s].opacity =
            (isDiscovered ? 0.82 : 0.55) * vis;
        }

        for (let h = 0; h < c.starHaloMaterials.length; h++) {
          const haloWave =
            Math.sin(elapsedTime * 2.2 + i * 1.3 + h * 1.9) * 0.04;
          const baseHaloOp = isDiscovered ? 0.22 : 0.12;
          c.starHaloMaterials[h].opacity =
            THREE.MathUtils.clamp(baseHaloOp + haloWave, 0.08, 0.3) * vis;
        }
      }

      for (let i = 0; i < interLetterArcMats.length; i++) {
        const bothConnected =
          (discoveredLettersMask & (1 << i)) !== 0 &&
          (discoveredLettersMask & (1 << (i + 1))) !== 0;
        const nextHint =
          (discoveredLettersMask & (1 << i)) !== 0 &&
          (discoveredLettersMask & (1 << (i + 1))) === 0;
        const baseArcOp = bothConnected
          ? 0.2 + Math.sin(elapsedTime * 2.0 + i) * 0.03
          : nextHint
            ? 0.13 + Math.sin(elapsedTime * 3.0 + i) * 0.03
            : 0.04;
        interLetterArcMats[i].opacity = baseArcOp * vis;
      }
    },

    dispose() {
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      texturesToDispose.forEach((t) => t.dispose());
    },
  };
}
