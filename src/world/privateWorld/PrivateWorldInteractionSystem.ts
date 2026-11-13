import * as THREE from 'three';
import {
  PRIVATE_ARRIVAL_GATE_POS,
  isNearPrivateReturnGate,
} from './privateWorldMath';

export type PrivateInteractionMode =
  | 'NONE'
  | 'TELESCOPE'
  | 'SEATED_LOVESEAT'
  | 'SEATED_POND_BENCH'
  | 'SEATED_GROTTO_ISLAND_BENCH'
  | 'SEATED_GROTTO_OVERLOOK_BENCH';

export interface PrivateInteractionPrompt {
  id: string;
  keyLabel: string;
  actionLabel: string;
  fullPrompt: string;
  distance: number;
}

export interface PrivateInteractionTarget {
  id: string;
  actionLabel: string;
  keyLabel?: string;
  radius: number;
  getPosition: (playerX: number, playerZ: number) => { x: number; z: number };
  isAvailable?: (playerX: number, playerZ: number) => boolean;
  onInteract: (playerX: number, playerZ: number) => void;
}

export interface StargazingSkySequenceNode {
  index: number; // 1..8
  letter: string; // 'I' | 'L' | 'O' | 'V' | 'E' | 'Y' | 'O' | 'U'
  wordGroup: 1 | 2 | 3; // 1 = "I", 2 = "LOVE", 3 = "YOU"
  yaw: number;
  pitch: number;
  text: string;
  subtitle: string;
}

/**
 * 8 Scattered Star-Letter Constellations ("I", "L", "O", "V", "E", "Y", "O", "U")
 * ordered Left-to-Right across the eastern sky dome (from yaw = 2.36 on the left
 * to yaw = 0.76 on the right when facing East).
 * Visible exclusively when looking through the brass telescope.
 */
export const STARGAZING_SKY_SEQUENCE: readonly StargazingSkySequenceNode[] = [
  {
    index: 1,
    letter: 'I',
    wordGroup: 1,
    yaw: 2.36,
    pitch: 0.42,
    text: 'Constellation I — “I”',
    subtitle: 'First Star Letter · Pan right through the telescope to connect I LOVE YOU',
  },
  {
    index: 2,
    letter: 'L',
    wordGroup: 2,
    yaw: 2.08,
    pitch: 0.56,
    text: 'Constellation II — “L”',
    subtitle: 'High in the Sky · Keep panning right across the stars',
  },
  {
    index: 3,
    letter: 'O',
    wordGroup: 2,
    yaw: 1.88,
    pitch: 0.36,
    text: 'Constellation III — “O”',
    subtitle: 'Lower Polygonal Star Ring · Follow the faint starlight thread',
  },
  {
    index: 4,
    letter: 'V',
    wordGroup: 2,
    yaw: 1.68,
    pitch: 0.58,
    text: 'Constellation IV — “V”',
    subtitle: 'High Celestial Crest · Halfway through I LOVE YOU',
  },
  {
    index: 5,
    letter: 'E',
    wordGroup: 2,
    yaw: 1.48,
    pitch: 0.43,
    text: 'Constellation V — “E”',
    subtitle: 'Completes “I LOVE” · Pan further right for “YOU”',
  },
  {
    index: 6,
    letter: 'Y',
    wordGroup: 3,
    yaw: 1.2,
    pitch: 0.6,
    text: 'Constellation VI — “Y”',
    subtitle: 'Forked Star Branch High in the ENE Sky',
  },
  {
    index: 7,
    letter: 'O',
    wordGroup: 3,
    yaw: 0.98,
    pitch: 0.37,
    text: 'Constellation VII — “O”',
    subtitle: 'Six-Star Diamond Loop Above the Horizon',
  },
  {
    index: 8,
    letter: 'U',
    wordGroup: 3,
    yaw: 0.76,
    pitch: 0.51,
    text: 'Constellation VIII — “U” (I LOVE YOU)',
    subtitle: 'Final Star Constellation · Complete I LOVE YOU Canopy Illuminated',
  },
];

export interface TelescopeViewState {
  yaw: number;
  pitch: number;
  constellationName: string;
  constellationSubtitle: string;
  highlightStrength: number;
  connectedNodesCount: number; // 1..8 letters connected
  focusedNodeIndex: number; // 1..8 currently looked-at letter
  discoveredMask: number; // 8-bit mask of discovered letters (bits 0..7)
}

export interface PrivateWorldInteractionSystemBundle {
  registerInteraction: (target: PrivateInteractionTarget) => void;
  updateProximity: (playerX: number, playerZ: number, playerY?: number) => void;
  getNearestPrompt: () => PrivateInteractionPrompt | null;
  getMode: () => PrivateInteractionMode;
  isMovementLocked: () => boolean;
  handleKeyE: (playerX: number, playerZ: number, playerY?: number) => boolean;
  handleKeyEscape: () => boolean;
  cancelActiveMode: () => void;
  adjustTelescopeLook: (deltaYaw: number, deltaPitch: number) => void;
  observeSkyDirection: (lookYaw: number, lookPitch: number) => number;
  getConnectedSkyNodesCount: () => number;
  getDiscoveredLettersMask: () => number;
  getTelescopeState: () => TelescopeViewState;
}

export interface CreatePrivateInteractionSystemOptions {
  onReturnGateInteract?: () => void;
  onTouchPondWater?: (waterX: number, waterZ: number) => void;
  onModeChanged?: (
    nextMode: PrivateInteractionMode,
    prevMode: PrivateInteractionMode,
  ) => void;
}

// Stargazing Sanctuary interactive anchors centered around (0, 0)
export const STARGAZING_TELESCOPE_POS = {
  x: 3.2,
  y: 3.48,
  z: 0.0,
} as const;

export const STARGAZING_LOVESEAT_POS = {
  x: -1.8,
  y: 3.48,
  z: -3.1,
  seatFacingYaw: Math.PI / 2, // Facing East toward the MANDU & I LOVE YOU sky arc
} as const;

function wrapAnglePi(a: number): number {
  let r = (a + Math.PI) % (2.0 * Math.PI);
  if (r < 0) r += 2.0 * Math.PI;
  return r - Math.PI;
}

function countBits8(mask: number): number {
  let c = 0;
  for (let i = 0; i < 8; i++) {
    if ((mask & (1 << i)) !== 0) c++;
  }
  return c;
}

export function createPrivateWorldInteractionSystem(
  options: CreatePrivateInteractionSystemOptions = {},
): PrivateWorldInteractionSystemBundle {
  const targets: PrivateInteractionTarget[] = [];
  let currentMode: PrivateInteractionMode = 'NONE';
  let nearestPrompt: PrivateInteractionPrompt | null = null;

  // Start telescope aimed at Letter 1 ("I") on the left side of the eastern sky (yaw = 2.34, pitch = 0.42)
  const DEFAULT_TELE_YAW = 2.34;
  const DEFAULT_TELE_PITCH = 0.42;

  let telescopeYaw = DEFAULT_TELE_YAW;
  let telescopePitch = DEFAULT_TELE_PITCH;

  // Bit 0 ('I') starts illuminated when looking through the telescope; panning across the sky illuminates all 8
  let discoveredMask = 0b00000001;
  let connectedNodesCount = 1;
  let focusedNodeIndex = 1;

  function evaluateSkySequenceAt(lookYaw: number, lookPitch: number): {
    bestNode: StargazingSkySequenceNode;
    highlightStrength: number;
    connectedCount: number;
  } {
    let bestIdx = 0;
    let minAngDist = Infinity;

    for (let i = 0; i < STARGAZING_SKY_SEQUENCE.length; i++) {
      const node = STARGAZING_SKY_SEQUENCE[i];
      const d = Math.hypot(
        wrapAnglePi(lookYaw - node.yaw),
        lookPitch - node.pitch,
      );
      if (d < minAngDist) {
        minAngDist = d;
        bestIdx = i;
      }
      if (d < 0.27) {
        discoveredMask |= 1 << i;
      }
    }

    const bestNode = STARGAZING_SKY_SEQUENCE[bestIdx];
    focusedNodeIndex = bestNode.index;
    connectedNodesCount = Math.max(1, countBits8(discoveredMask));

    const highlightStrength =
      1.0 - THREE.MathUtils.smoothstep(minAngDist, 0.05, 0.34);

    return {
      bestNode,
      highlightStrength,
      connectedCount: connectedNodesCount,
    };
  }

  function setMode(nextMode: PrivateInteractionMode) {
    if (nextMode === currentMode) return;
    const prev = currentMode;
    currentMode = nextMode;
    if (nextMode === 'TELESCOPE') {
      telescopeYaw = DEFAULT_TELE_YAW;
      telescopePitch = DEFAULT_TELE_PITCH;
      evaluateSkySequenceAt(telescopeYaw, telescopePitch);
    }
    options.onModeChanged?.(nextMode, prev);
  }

  function registerInteraction(target: PrivateInteractionTarget) {
    const existingIdx = targets.findIndex((t) => t.id === target.id);
    if (existingIdx >= 0) {
      targets[existingIdx] = target;
    } else {
      targets.push(target);
    }
  }

  // 1. Stargazing Sanctuary: Brass Telescope ("E  Look through telescope")
  registerInteraction({
    id: 'stargazing-telescope',
    keyLabel: 'E',
    actionLabel: 'Look through telescope',
    radius: 2.95,
    getPosition: () => ({
      x: STARGAZING_TELESCOPE_POS.x - 0.55,
      z: STARGAZING_TELESCOPE_POS.z,
    }),
    onInteract: () => {
      setMode('TELESCOPE');
    },
  });

  // 2. Stargazing Sanctuary: Curved Loveseat ("E  Sit and watch the stars")
  registerInteraction({
    id: 'stargazing-loveseat',
    keyLabel: 'E',
    actionLabel: 'Sit and watch the stars',
    radius: 2.85,
    getPosition: () => ({
      x: STARGAZING_LOVESEAT_POS.x,
      z: STARGAZING_LOVESEAT_POS.z,
    }),
    onInteract: () => {
      setMode('SEATED_LOVESEAT');
    },
  });

  // 3. Stargazing Sanctuary: Return Portal Gate ("E  Return to Heart Island")
  registerInteraction({
    id: 'arrival-return-gate',
    keyLabel: 'E',
    actionLabel: 'Return to Heart Island',
    radius: 3.4,
    getPosition: () => ({
      x: PRIVATE_ARRIVAL_GATE_POS.x,
      z: PRIVATE_ARRIVAL_GATE_POS.z,
    }),
    isAvailable: (px, pz) => isNearPrivateReturnGate(px, pz),
    onInteract: () => {
      options.onReturnGateInteract?.();
    },
  });

  return {
    registerInteraction,

    updateProximity(playerX: number, playerZ: number) {
      if (currentMode !== 'NONE') {
        nearestPrompt = null;
        return;
      }

      let bestTarget: PrivateInteractionTarget | null = null;
      let bestDist = Infinity;

      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t.isAvailable && !t.isAvailable(playerX, playerZ)) {
          continue;
        }
        const pos = t.getPosition(playerX, playerZ);
        const d = Math.hypot(playerX - pos.x, playerZ - pos.z);
        if (d <= t.radius && d < bestDist) {
          bestDist = d;
          bestTarget = t;
        }
      }

      if (bestTarget) {
        const keyLabel = bestTarget.keyLabel ?? 'E';
        nearestPrompt = {
          id: bestTarget.id,
          keyLabel,
          actionLabel: bestTarget.actionLabel,
          fullPrompt: `${keyLabel}  ${bestTarget.actionLabel}`,
          distance: bestDist,
        };
      } else {
        nearestPrompt = null;
      }
    },

    getNearestPrompt() {
      return nearestPrompt;
    },

    getMode() {
      return currentMode;
    },

    isMovementLocked() {
      return currentMode !== 'NONE';
    },

    handleKeyE(playerX: number, playerZ: number): boolean {
      if (currentMode !== 'NONE') {
        setMode('NONE');
        return true;
      }

      this.updateProximity(playerX, playerZ);
      if (!nearestPrompt) return false;

      const chosen = targets.find((t) => t.id === nearestPrompt?.id);
      if (!chosen) return false;

      chosen.onInteract(playerX, playerZ);
      return true;
    },

    handleKeyEscape(): boolean {
      if (currentMode !== 'NONE') {
        setMode('NONE');
        return true;
      }
      return false;
    },

    cancelActiveMode() {
      if (currentMode !== 'NONE') {
        setMode('NONE');
      }
    },

    adjustTelescopeLook(deltaYaw: number, deltaPitch: number) {
      if (currentMode !== 'TELESCOPE') return;
      telescopeYaw = THREE.MathUtils.clamp(
        wrapAnglePi(telescopeYaw + deltaYaw),
        0.4,
        2.75,
      );
      telescopePitch = THREE.MathUtils.clamp(
        telescopePitch + deltaPitch,
        0.12,
        1.05,
      );
      evaluateSkySequenceAt(telescopeYaw, telescopePitch);
    },

    observeSkyDirection(lookYaw: number, lookPitch: number): number {
      const res = evaluateSkySequenceAt(lookYaw, lookPitch);
      return res.connectedCount;
    },

    getConnectedSkyNodesCount(): number {
      return connectedNodesCount;
    },

    getDiscoveredLettersMask(): number {
      return discoveredMask;
    },

    getTelescopeState(): TelescopeViewState {
      const evalRes = evaluateSkySequenceAt(telescopeYaw, telescopePitch);
      return {
        yaw: telescopeYaw,
        pitch: telescopePitch,
        constellationName: evalRes.bestNode.text,
        constellationSubtitle: evalRes.bestNode.subtitle,
        highlightStrength: evalRes.highlightStrength,
        connectedNodesCount: evalRes.connectedCount,
        focusedNodeIndex,
        discoveredMask,
      };
    },
  };
}

/**
 * Helper returning the seated camera pose for the Stargazing Loveseat at (-1.8, 3.48, -3.1).
 */
export function getSeatedCameraPose(mode: PrivateInteractionMode): {
  camPos: THREE.Vector3;
  lookAt: THREE.Vector3;
  avatarPos: THREE.Vector3;
  avatarYaw: number;
} | null {
  if (mode === 'SEATED_LOVESEAT') {
    const deckY = 3.48;
    return {
      camPos: new THREE.Vector3(-1.55, deckY + 1.18, -2.95),
      // Aim due East toward the MANDU star constellation canopy
      lookAt: new THREE.Vector3(26.0, deckY + 11.5, -2.95),
      avatarPos: new THREE.Vector3(-1.75, deckY + 0.04, -3.05),
      avatarYaw: STARGAZING_LOVESEAT_POS.seatFacingYaw,
    };
  }
  return null;
}
