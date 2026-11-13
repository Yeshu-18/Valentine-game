import * as THREE from 'three';
import { CircleCollider } from '../VegetationSystem';
import {
  PRIVATE_ARRIVAL_GATE_POS,
  PRIVATE_ISLAND_BOUNDS,
  createPrivateSeededRng,
  getPrivateTerrainHeight,
} from './privateWorldMath';
import {
  STARGAZING_LOVESEAT_POS,
  STARGAZING_SKY_SEQUENCE,
  STARGAZING_TELESCOPE_POS,
} from './PrivateWorldInteractionSystem';
import { PrivatePathLightingTelemetry } from './PrivatePathLighting';
import { TrailDestinationId } from './PrivateTrailSignSystem';

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
        { u: -0.62, v: -0.86, mag: 1.05, colorHex: 0x9eb8d6 }, // 0: Bottom-left foot
        { u: -0.48, v: 0.92, mag: 1.25, colorHex: 0xd4c7ad }, // 1: Top-left peak (Alpha)
        { u: -0.03, v: -0.12, mag: 1.12, colorHex: 0xb4cce4 }, // 2: Central valley star
        { u: 0.45, v: 0.88, mag: 1.22, colorHex: 0xc8daec }, // 3: Top-right peak (Beta)
        { u: 0.64, v: -0.84, mag: 1.02, colorHex: 0x9eb8d6 }, // 4: Bottom-right foot
        { u: -0.82, v: 0.54, mag: 0.62, colorHex: 0x8aa6c4, isSpur: true }, // 5: Faint western spur
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
        { u: -0.55, v: -0.88, mag: 1.02, colorHex: 0x9eb8d6 }, // 0: Bottom-left leg
        { u: -0.27, v: 0.04, mag: 1.1, colorHex: 0xb8cfe6 }, // 1: Mid-left crossbar node
        { u: 0.04, v: 0.94, mag: 1.28, colorHex: 0xd6c8ae }, // 2: Apex star (Alpha)
        { u: 0.31, v: -0.03, mag: 1.08, colorHex: 0xb8cfe6 }, // 3: Mid-right crossbar node
        { u: 0.54, v: -0.86, mag: 1.04, colorHex: 0xa4bedb }, // 4: Bottom-right leg
        { u: 0.28, v: 1.14, mag: 0.6, colorHex: 0x8aa6c4, isSpur: true }, // 5: Faint apex spur
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
        { u: -0.52, v: -0.88, mag: 1.04, colorHex: 0xa4bedb }, // 0: Bottom-left star
        { u: -0.45, v: 0.14, mag: 0.92, colorHex: 0x9eb8d6 }, // 1: Left shaft kink
        { u: -0.49, v: 0.92, mag: 1.24, colorHex: 0xd4c7ad }, // 2: Top-left peak (Alpha)
        { u: 0.05, v: -0.06, mag: 1.0, colorHex: 0xb8cfe6 }, // 3: Diagonal bridge kink
        { u: 0.47, v: -0.9, mag: 1.18, colorHex: 0xc8daec }, // 4: Bottom-right corner (Beta)
        { u: 0.53, v: 0.9, mag: 1.16, colorHex: 0xb8cfe6 }, // 5: Top-right tip
        { u: 0.76, v: 1.06, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true }, // 6: Faint upper-right spur
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
        { u: -0.46, v: 0.92, mag: 1.24, colorHex: 0xd4c7ad }, // 0: Top-left corner (Alpha)
        { u: -0.52, v: -0.04, mag: 1.02, colorHex: 0xb4cce4 }, // 1: Spine middle kink
        { u: -0.44, v: -0.88, mag: 1.16, colorHex: 0xc8daec }, // 2: Bottom-left corner
        { u: 0.19, v: -0.74, mag: 0.98, colorHex: 0x9eb8d6 }, // 3: Lower-right curve star
        { u: 0.52, v: -0.02, mag: 1.2, colorHex: 0xb8cfe6 }, // 4: Outer-right belly star (Beta)
        { u: 0.22, v: 0.76, mag: 1.04, colorHex: 0xa4bedb }, // 5: Upper-right curve star
        { u: -0.74, v: 0.62, mag: 0.6, colorHex: 0x8aa6c4, isSpur: true }, // 6: Faint western spur
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
        { u: -0.48, v: 0.9, mag: 1.22, colorHex: 0xc8daec }, // 0: Top-left rim
        { u: -0.52, v: -0.16, mag: 0.98, colorHex: 0x9eb8d6 }, // 1: Left flank kink
        { u: -0.24, v: -0.86, mag: 1.06, colorHex: 0xb4cce4 }, // 2: Bottom-left keel
        { u: 0.24, v: -0.84, mag: 1.14, colorHex: 0xd4c7ad }, // 3: Bottom-right keel (Alpha)
        { u: 0.5, v: -0.14, mag: 1.0, colorHex: 0xa4bedb }, // 4: Right flank kink
        { u: 0.48, v: 0.92, mag: 1.24, colorHex: 0xb8cfe6 }, // 5: Top-right rim (Beta)
        { u: 0.74, v: 1.08, mag: 0.6, colorHex: 0x8aa6c4, isSpur: true }, // 6: Faint right spur
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
    // 1. "I" — Crooked 3-star spine with a slight knee bend, asymmetric canted serifs, and a side companion spur
    {
      letter: 'I',
      yaw: STARGAZING_SKY_SEQUENCE[0].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[0].pitch,
      scale: 9.2,
      tiltRad: 0.11,
      anchorStarIdx: 1,
      stars: [
        { u: 0.05, v: 0.92, mag: 1.18, colorHex: 0xd6c8ad }, // 0: Top crown star (Alpha)
        { u: -0.09, v: 0.11, mag: 1.02, colorHex: 0xb4cce4 }, // 1: Crooked middle knee star (Beta)
        { u: 0.04, v: -0.88, mag: 1.14, colorHex: 0xcfc2a8 }, // 2: Bottom base star
        { u: -0.34, v: 0.81, mag: 0.82, colorHex: 0x9eb8d6 }, // 3: Top-left crooked crossbar star
        { u: 0.39, v: 1.02, mag: 0.86, colorHex: 0xc8d8e8 }, // 4: Top-right tilted crossbar star
        { u: -0.38, v: -0.96, mag: 0.84, colorHex: 0xa4bedb }, // 5: Bottom-left crossbar star
        { u: 0.35, v: -0.76, mag: 0.8, colorHex: 0xcab8c8 }, // 6: Bottom-right canted crossbar star
        { u: -0.48, v: 0.28, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true }, // 7: Faint western spur star
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

    // 2. "L" — Bowed 4-star vertical shaft with a kicked-up 3-star foot and an upper tail star
    {
      letter: 'L',
      yaw: STARGAZING_SKY_SEQUENCE[1].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[1].pitch,
      scale: 9.6,
      tiltRad: -0.09,
      anchorStarIdx: 3,
      stars: [
        { u: -0.26, v: 0.98, mag: 1.2, colorHex: 0xd6c8ad }, // 0: Upper apex star (Alpha)
        { u: -0.38, v: 0.31, mag: 0.94, colorHex: 0xa4bedb }, // 1: Upper-mid bowed shaft star
        { u: -0.24, v: -0.32, mag: 0.88, colorHex: 0xb8cfe6 }, // 2: Lower-mid kinked shaft star
        { u: -0.33, v: -0.89, mag: 1.16, colorHex: 0xcfc2a8 }, // 3: Corner heel star (Beta)
        { u: 0.14, v: -0.96, mag: 0.96, colorHex: 0xc8d8e8 }, // 4: Mid-foot dip star
        { u: 0.54, v: -0.74, mag: 1.08, colorHex: 0xb4cce4 }, // 5: Upturned toe star
        { u: -0.62, v: 0.78, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true }, // 6: Faint upper-left spur
        { u: 0.78, v: -0.92, mag: 0.55, colorHex: 0xbca8bc, isSpur: true }, // 7: Faint toe tip spur
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

    // 3. "O" — Asymmetric 7-star polygonal ring (like Corona Borealis / Auriga) with an outer guide spur
    {
      letter: 'O',
      yaw: STARGAZING_SKY_SEQUENCE[2].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[2].pitch,
      scale: 9.4,
      tiltRad: 0.08,
      anchorStarIdx: 2,
      stars: [
        { u: -0.08, v: 0.96, mag: 1.18, colorHex: 0xd6c8ad }, // 0: North crown star (Alpha)
        { u: 0.44, v: 0.64, mag: 0.95, colorHex: 0xb4cce4 }, // 1: North-east shoulder star
        { u: 0.58, v: -0.06, mag: 1.12, colorHex: 0xcfc2a8 }, // 2: Eastern flank star (Beta)
        { u: 0.31, v: -0.81, mag: 0.88, colorHex: 0x9eb8d6 }, // 3: South-east keel star
        { u: -0.19, v: -0.93, mag: 1.04, colorHex: 0xc8d8e8 }, // 4: Southern base star
        { u: -0.56, v: -0.38, mag: 0.86, colorHex: 0xa4bedb }, // 5: Western lower star
        { u: -0.48, v: 0.48, mag: 1.0, colorHex: 0xcab8c8 }, // 6: North-west upper star
        { u: 0.82, v: 0.88, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true }, // 7: North-east spur star
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

    // 4. "V" — Taurus Hyades-inspired crooked V constellation with bent arms and a trailing wing star
    {
      letter: 'V',
      yaw: STARGAZING_SKY_SEQUENCE[3].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[3].pitch,
      scale: 9.8,
      tiltRad: -0.07,
      anchorStarIdx: 2,
      stars: [
        { u: -0.58, v: 0.95, mag: 1.14, colorHex: 0xb4cce4 }, // 0: Left wingtip star
        { u: -0.26, v: 0.14, mag: 0.92, colorHex: 0xc8d8e8 }, // 1: Left inner kink star
        { u: -0.03, v: -0.92, mag: 1.24, colorHex: 0xd6c8ad }, // 2: Bright vertex star (Alpha)
        { u: 0.29, v: -0.08, mag: 0.96, colorHex: 0xa4bedb }, // 3: Right inner elbow star
        { u: 0.54, v: 0.88, mag: 1.16, colorHex: 0xcfc2a8 }, // 4: Right wingtip star (Beta)
        { u: 0.81, v: 1.06, mag: 0.6, colorHex: 0x8aa6c4, isSpur: true }, // 5: Right outer spur star
        { u: -0.79, v: 0.68, mag: 0.55, colorHex: 0xbca8bc, isSpur: true }, // 6: Left outer spur star
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

    // 5. "E" — Kinked 3-star spine with three canted, uneven star-branches
    {
      letter: 'E',
      yaw: STARGAZING_SKY_SEQUENCE[4].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[4].pitch,
      scale: 9.6,
      tiltRad: 0.09,
      anchorStarIdx: 1,
      stars: [
        { u: -0.34, v: 0.93, mag: 1.16, colorHex: 0xd6c8ad }, // 0: Top-left spine corner (Alpha)
        { u: -0.44, v: 0.07, mag: 1.08, colorHex: 0xb4cce4 }, // 1: Mid-spine outward kink (Beta)
        { u: -0.29, v: -0.89, mag: 1.12, colorHex: 0xcfc2a8 }, // 2: Bottom-left spine corner
        { u: 0.11, v: 1.01, mag: 0.88, colorHex: 0x9eb8d6 }, // 3: Top branch mid kink
        { u: 0.52, v: 0.84, mag: 1.02, colorHex: 0xc8d8e8 }, // 4: Top branch tip
        { u: 0.28, v: 0.16, mag: 1.0, colorHex: 0xcab8c8 }, // 5: Middle bar tilted tip
        { u: 0.16, v: -0.96, mag: 0.86, colorHex: 0xa4bedb }, // 6: Bottom branch mid dip
        { u: 0.5, v: -0.76, mag: 1.04, colorHex: 0xc8d8e8 }, // 7: Bottom branch tip
        { u: -0.72, v: -0.22, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true }, // 8: Spine western spur star
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

    // 6. "Y" — Cygnus-like forked star branch high in the sky with a crooked lower stem
    {
      letter: 'Y',
      yaw: STARGAZING_SKY_SEQUENCE[5].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[5].pitch,
      scale: 9.8,
      tiltRad: -0.1,
      anchorStarIdx: 2,
      stars: [
        { u: -0.56, v: 0.96, mag: 1.14, colorHex: 0xc8d8e8 }, // 0: Upper-left fork tip
        { u: -0.22, v: 0.48, mag: 0.88, colorHex: 0x9eb8d6 }, // 1: Upper-left fork elbow
        { u: 0.03, v: 0.06, mag: 1.22, colorHex: 0xd6c8ad }, // 2: Central heart junction star (Alpha)
        { u: 0.58, v: 0.89, mag: 1.16, colorHex: 0xb4cce4 }, // 3: Upper-right fork tip (Beta)
        { u: -0.09, v: -0.44, mag: 0.92, colorHex: 0xa4bedb }, // 4: Lower stem kink
        { u: 0.06, v: -0.93, mag: 1.1, colorHex: 0xcab8c8 }, // 5: Base stem star
        { u: -0.8, v: 0.72, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true }, // 6: Left wing spur
        { u: 0.79, v: 0.56, mag: 0.56, colorHex: 0xbca8bc, isSpur: true }, // 7: Right wing spur
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

    // 7. "O" — Distinct 6-star diamond-hexagon loop so the second "O" has its own unique astronomical character
    {
      letter: 'O',
      yaw: STARGAZING_SKY_SEQUENCE[6].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[6].pitch,
      scale: 9.4,
      tiltRad: -0.11,
      anchorStarIdx: 1,
      stars: [
        { u: 0.09, v: 0.95, mag: 1.16, colorHex: 0xb4cce4 }, // 0: Upper apex star (Alpha)
        { u: 0.54, v: 0.36, mag: 1.04, colorHex: 0xd6c8ad }, // 1: Upper-right star
        { u: 0.39, v: -0.66, mag: 0.92, colorHex: 0xcab8c8 }, // 2: Lower-right star
        { u: -0.14, v: -0.94, mag: 1.14, colorHex: 0xcfc2a8 }, // 3: Southern nadir star (Beta)
        { u: -0.55, v: -0.24, mag: 0.88, colorHex: 0x9eb8d6 }, // 4: Western flank star
        { u: -0.37, v: 0.64, mag: 1.0, colorHex: 0xc8d8e8 }, // 5: North-west star
        { u: -0.78, v: -0.62, mag: 0.58, colorHex: 0x8aa6c4, isSpur: true }, // 6: South-west tail spur
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

    // 8. "U" — Organic 7-star celestial cup constellation on the right of the I LOVE YOU arc
    {
      letter: 'U',
      yaw: STARGAZING_SKY_SEQUENCE[7].yaw,
      pitch: STARGAZING_SKY_SEQUENCE[7].pitch,
      scale: 9.8,
      tiltRad: 0.08,
      anchorStarIdx: 3,
      stars: [
        { u: -0.49, v: 0.93, mag: 1.16, colorHex: 0xd6c8ad }, // 0: Upper-left rim star (Alpha)
        { u: -0.54, v: 0.14, mag: 0.92, colorHex: 0xb4cce4 }, // 1: Left flank bowed star
        { u: -0.35, v: -0.68, mag: 0.88, colorHex: 0xcfc2a8 }, // 2: Lower-left curve star
        { u: 0.04, v: -0.94, mag: 1.14, colorHex: 0xcab8c8 }, // 3: Bottom keel star (Beta)
        { u: 0.39, v: -0.61, mag: 0.9, colorHex: 0x9eb8d6 }, // 4: Lower-right curve star
        { u: 0.47, v: 0.18, mag: 0.98, colorHex: 0xc8d8e8 }, // 5: Right flank star
        { u: 0.54, v: 0.96, mag: 1.2, colorHex: 0xd6c8ad }, // 6: Upper-right rim star
        { u: 0.84, v: 1.14, mag: 0.62, colorHex: 0xbca8bc, isSpur: true }, // 7: Eastern culminating spur star
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

/**
 * Projects a 2D point `(u, v)` in the viewer-aligned tangent plane of `(yaw, pitch)`
 * onto the 3D celestial sphere of radius `skyRadius`, applying the constellation's organic `tiltRad`.
 *
 * Guarantees that `+u` is always to the viewer's RIGHT and `+v` is always UPWARD when looking
 * from the Stargazing Sanctuary at `(0, 0, 0)` toward `(yaw, pitch)`.
 */
function projectConstellationPointToSky(
  yaw: number,
  pitch: number,
  skyRadius: number,
  scale: number,
  tiltRad: number,
  u: number,
  v: number,
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
  worldPos.y += 3.5;
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

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometriesToDispose.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materialsToDispose.push(m);
    return m;
  };

  // ==========================================================================
  // 1. COMPACT MOONLIT STARGAZING SANCTUARY ISLAND & CALM NIGHT OCEAN
  // ==========================================================================
  const terrainSize = 44;
  const terrainGeo = trackGeo(
    new THREE.PlaneGeometry(terrainSize, terrainSize, 48, 48),
  );
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cRock = new THREE.Color(0x182538);
  const cMoss = new THREE.Color(0x1f3642);
  const cSand = new THREE.Color(0x233044);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getPrivateTerrainHeight(x, z);
    posAttr.setY(i, y);

    const hT = THREE.MathUtils.clamp((y + 1.5) / 4.8, 0, 1);
    tmpColor.copy(cSand).lerp(cRock, hT);
    if (y > 2.6) {
      tmpColor.lerp(cMoss, 0.45);
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
  const waterGeo = trackGeo(new THREE.PlaneGeometry(520, 520, 1, 1));
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
  const postGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 0.64, 10));
  const postCapGeo = trackGeo(new THREE.SphereGeometry(0.085, 10, 8));
  const railBeamGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8));
  railBeamGeo.rotateZ(Math.PI / 2);

  const postAngles: number[] = [];
  const numPosts = 18;
  for (let i = 0; i < numPosts; i++) {
    const a = -Math.PI + (i / numPosts) * Math.PI * 2;
    if (Math.abs(Math.abs(a) - Math.PI) < 0.26) continue;
    if (Math.abs(a) < 0.48) continue;
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
    if (dist < 4.2) {
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
  deckWarmLight.position.set(0, 1.6, 0);
  deckGroup.add(deckWarmLight);

  group.add(deckGroup);

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
  portalLight.position.set(0, 2.4, 0.5);
  portalGroup.add(portalLight);

  group.add(portalGroup);

  // ==========================================================================
  // 4. CELESTIAL NIGHT SKY DOME:
  //    - Background Starfield (always visible)
  //    - "M A N D U" Star Constellation (always visible, soft natural brightness)
  //    - "I LOVE YOU" Star Constellation (visible ONLY through the telescope, reduced brightness)
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

        // Subtle, low-opacity inner halo (prevents post-processing bloom blow-out)
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

      // Crooked Primary Constellation Line Segments
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

      // Faint Astronomical Spur Line Segments
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

  // Delicate Inter-Letter Celestial Guide Threads inside Telescope Group (I -> L -> O -> V -> E -> Y -> O -> U)
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
  group.add(skyConstellationGroup);

  // ==========================================================================
  // 5. RUNTIME ANIMATION & TELESCOPE VISIBILITY STATE
  // ==========================================================================
  let isTelescopeModeActive = false;
  let currentTelescopeVisibility = 0; // 0 when outside telescope, 1 when looking through telescope
  let connectedSkyNodesCount = 1;
  let focusedSkyNodeIndex = 1;
  let discoveredLettersMask = 0b00000001;

  const emptyPathTelemetry: PrivatePathLightingTelemetry = {
    activeRouteId: 'primary-route',
    activeRouteName: 'Stargazing Sanctuary',
    nearestPathDist: 0,
    arcDistanceMeters: 0,
    routeTotalLengthMeters: 0,
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
    resetPathLighting() {},
    setOnSteppingStoneStep() {},
    triggerPondRipple() {},
    triggerPondTouchRipple() {},

    setTelescopeSkyState: applySkyHighlightState,
    setTelescopeHighlight: applySkyHighlightState,

    getPathLightingTelemetry() {
      return emptyPathTelemetry;
    },

    getRouteDistanceTo() {
      return 0;
    },

    update(delta: number, elapsedTime: number) {
      // Gentle return portal shimmer
      portalVeilMat.opacity = 0.18 + Math.sin(elapsedTime * 2.1) * 0.04;

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

      // 2. Update Telescope-Only "I LOVE YOU" Star Constellations
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

        // Soft, realistic astronomical line brightness (reduced so it never blows out)
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
    },
  };
}
