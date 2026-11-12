import * as THREE from 'three';
import {
  getPondSteppingStoneIndexAt,
  getPrivateTerrainHeight,
  getReflectivePondSignedDistance,
  isNearPrivateReturnGate,
} from './privateWorldMath';
import {
  GROTTO_ISLAND_BENCH_POS,
  GROTTO_OVERLOOK_BENCH_POS,
} from './PrivateHiddenGrotto';

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

export interface TelescopeViewState {
  yaw: number; // Horizontal sky exploration yaw (centered on East +X = PI/2)
  pitch: number; // Vertical sky elevation pitch (radians above horizon)
  constellationName: string;
  constellationSubtitle: string;
  highlightStrength: number; // 0..1 based on how close the telescope reticle is to the constellation center
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

// Pond shoreline bench world coordinates (outside water & clear of Garden Loop path)
export const POND_SHORE_BENCH_POS = {
  x: -1.8,
  z: -7.8,
  rotY: -0.34, // Faces NNW across the Reflective Pond & Stepping Stones
} as const;

// Stargazing Deck interactive anchors in Private World local coordinates
export const STARGAZING_TELESCOPE_POS = {
  x: 145.0 + 3.2, // 148.2
  y: 18.28,
  z: 35.0,
} as const;

export const STARGAZING_LOVESEAT_POS = {
  x: 145.0 - 1.8, // 143.2
  y: 18.28,
  z: 35.0 - 3.1, // 31.9
  seatFacingYaw: 1.38, // Facing directly toward the "I LOVE YOU" Star Constellation & Eastern Horizon
} as const;

function wrapAnglePi(a: number): number {
  let r = (a + Math.PI) % (2.0 * Math.PI);
  if (r < 0) r += 2.0 * Math.PI;
  return r - Math.PI;
}

/**
 * Computes the closest water-surface touch coordinate along the Reflective Pond rim
 * when the player stands near the shoreline.
 */
export function computePondWaterTouchPoint(
  playerX: number,
  playerZ: number,
): { x: number; z: number } {
  const pondCenterX = -5.2;
  const pondCenterZ = -0.3;
  const dx = pondCenterX - playerX;
  const dz = pondCenterZ - playerZ;
  const len = Math.hypot(dx, dz) || 1.0;
  // Step 1.15m from the player's shoreline position toward the water surface
  return {
    x: playerX + (dx / len) * 1.15,
    z: playerZ + (dz / len) * 1.15,
  };
}

export function createPrivateWorldInteractionSystem(
  options: CreatePrivateInteractionSystemOptions = {},
): PrivateWorldInteractionSystemBundle {
  const targets: PrivateInteractionTarget[] = [];
  let currentMode: PrivateInteractionMode = 'NONE';
  let nearestPrompt: PrivateInteractionPrompt | null = null;
  let lastPlayerY = 12.0;

  // Telescope sky exploration state:
  // Centered directly on the "I LOVE YOU" Star Constellation at yaw = 1.38 rad, pitch = 0.46 rad
  const DEFAULT_TELE_YAW = 1.38;
  const DEFAULT_TELE_PITCH = 0.46;
  const HIGHLIGHT_CONSTELLATION_YAW = 1.38;
  const HIGHLIGHT_CONSTELLATION_PITCH = 0.46;

  let telescopeYaw = DEFAULT_TELE_YAW;
  let telescopePitch = DEFAULT_TELE_PITCH;

  function setMode(nextMode: PrivateInteractionMode) {
    if (nextMode === currentMode) return;
    const prev = currentMode;
    currentMode = nextMode;
    if (nextMode === 'TELESCOPE') {
      telescopeYaw = DEFAULT_TELE_YAW;
      telescopePitch = DEFAULT_TELE_PITCH;
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

  // 1. Stargazing Deck: Telescope Interaction ("E  Look through telescope")
  registerInteraction({
    id: 'stargazing-telescope',
    keyLabel: 'E',
    actionLabel: 'Look through telescope',
    radius: 2.85,
    getPosition: () => ({
      x: STARGAZING_TELESCOPE_POS.x - 0.55,
      z: STARGAZING_TELESCOPE_POS.z,
    }),
    onInteract: () => {
      setMode('TELESCOPE');
    },
  });

  // 2. Stargazing Deck: Curved Loveseat Interaction ("E  Sit and watch the stars")
  registerInteraction({
    id: 'stargazing-loveseat',
    keyLabel: 'E',
    actionLabel: 'Sit and watch the stars',
    radius: 2.75,
    getPosition: () => ({
      x: STARGAZING_LOVESEAT_POS.x,
      z: STARGAZING_LOVESEAT_POS.z,
    }),
    onInteract: () => {
      setMode('SEATED_LOVESEAT');
    },
  });

  // 3. Reflective Pond: Natural Wooden Bench ("E  Sit beside the pond")
  registerInteraction({
    id: 'pond-shore-bench',
    keyLabel: 'E',
    actionLabel: 'Sit beside the pond',
    radius: 2.45,
    getPosition: () => ({
      x: POND_SHORE_BENCH_POS.x,
      z: POND_SHORE_BENCH_POS.z,
    }),
    onInteract: () => {
      setMode('SEATED_POND_BENCH');
    },
  });

  // 4. Reflective Pond: Accessible Shoreline Water Touch ("E  Touch the water")
  registerInteraction({
    id: 'pond-touch-water',
    keyLabel: 'E',
    actionLabel: 'Touch the water',
    radius: 2.15,
    getPosition: (px, pz) => ({ x: px, z: pz }),
    isAvailable: (px, pz) => {
      if (getPondSteppingStoneIndexAt(px, pz) >= 0) return false;
      const distBench = Math.hypot(
        px - POND_SHORE_BENCH_POS.x,
        pz - POND_SHORE_BENCH_POS.z,
      );
      if (distBench < 2.2) return false;
      const signedDist = getReflectivePondSignedDistance(px, pz);
      return signedDist >= -0.45 && signedDist <= 1.75;
    },
    onInteract: (px, pz) => {
      const touchPt = computePondWaterTouchPoint(px, pz);
      options.onTouchPondWater?.(touchPt.x, touchPt.z);
    },
  });

  // 5. Underground Hidden Grotto: Central Discovery Island Bench ("E  Sit at the island sanctuary")
  registerInteraction({
    id: 'grotto-island-bench',
    keyLabel: 'E',
    actionLabel: 'Sit at the island sanctuary',
    radius: 2.35,
    getPosition: () => ({
      x: GROTTO_ISLAND_BENCH_POS.x,
      z: GROTTO_ISLAND_BENCH_POS.z,
    }),
    isAvailable: () => lastPlayerY < 9.5,
    onInteract: () => {
      setMode('SEATED_GROTTO_ISLAND_BENCH');
    },
  });

  // 6. Underground Hidden Grotto: Secondary Rock Viewpoint Bench ("E  Sit at the grotto overlook")
  registerInteraction({
    id: 'grotto-overlook-bench',
    keyLabel: 'E',
    actionLabel: 'Sit at the grotto overlook',
    radius: 2.45,
    getPosition: () => ({
      x: GROTTO_OVERLOOK_BENCH_POS.x,
      z: GROTTO_OVERLOOK_BENCH_POS.z,
    }),
    isAvailable: () => lastPlayerY < 9.5,
    onInteract: () => {
      setMode('SEATED_GROTTO_OVERLOOK_BENCH');
    },
  });

  // 7. Arrival Shore: Special Gate Return Interaction
  registerInteraction({
    id: 'arrival-return-gate',
    keyLabel: 'E',
    actionLabel: 'Return to Heart Island',
    radius: 4.5,
    getPosition: () => ({ x: 0.0, z: -146.2 }),
    isAvailable: (px, pz) => isNearPrivateReturnGate(px, pz),
    onInteract: () => {
      options.onReturnGateInteract?.();
    },
  });

  return {
    registerInteraction,

    updateProximity(playerX: number, playerZ: number, playerY = 12.0) {
      lastPlayerY = playerY;
      // While in a dedicated camera mode (telescope or seated), hide normal proximity prompts
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

    handleKeyE(playerX: number, playerZ: number, playerY = lastPlayerY): boolean {
      // If currently seated or in telescope mode, pressing E cleanly exits back to third-person
      if (currentMode !== 'NONE') {
        setMode('NONE');
        return true;
      }

      // Re-evaluate proximity at exact key-press coordinate
      this.updateProximity(playerX, playerZ, playerY);
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
      // Allow smooth exploration across the eastern & northern night sky
      telescopeYaw = THREE.MathUtils.clamp(
        wrapAnglePi(telescopeYaw + deltaYaw),
        0.42,
        2.45,
      );
      telescopePitch = THREE.MathUtils.clamp(
        telescopePitch + deltaPitch,
        0.14,
        1.08,
      );
    },

    getTelescopeState(): TelescopeViewState {
      const angDist = Math.hypot(
        wrapAnglePi(telescopeYaw - HIGHLIGHT_CONSTELLATION_YAW),
        telescopePitch - HIGHLIGHT_CONSTELLATION_PITCH,
      );
      const highlightStrength =
        1.0 - THREE.MathUtils.smoothstep(angDist, 0.08, 0.48);
      return {
        yaw: telescopeYaw,
        pitch: telescopePitch,
        constellationName: '“I LOVE YOU” — Joined in the Stars',
        constellationSubtitle:
          'Highlighted Star Constellation · Eastern Sky Above the Sea',
        highlightStrength,
      };
    },
  };
}

/**
 * Helper returning the exact seated camera pose for the Stargazing Loveseat, Pond Shoreline Bench,
 * or Underground Hidden Grotto benches.
 */
export function getSeatedCameraPose(mode: PrivateInteractionMode): {
  camPos: THREE.Vector3;
  lookAt: THREE.Vector3;
  avatarPos: THREE.Vector3;
  avatarYaw: number;
} | null {
  if (mode === 'SEATED_LOVESEAT') {
    const deckY = 18.28;
    return {
      camPos: new THREE.Vector3(143.45, deckY + 1.18, 32.05),
      // Aim directly toward the "I LOVE YOU" star constellation at yaw = 1.38, pitch = 0.42
      lookAt: new THREE.Vector3(169.5, deckY + 13.0, 37.2),
      avatarPos: new THREE.Vector3(143.25, deckY + 0.04, 31.95),
      avatarYaw: STARGAZING_LOVESEAT_POS.seatFacingYaw,
    };
  }
  if (mode === 'SEATED_POND_BENCH') {
    const benchGroundY = getPrivateTerrainHeight(
      POND_SHORE_BENCH_POS.x,
      POND_SHORE_BENCH_POS.z,
    );
    return {
      camPos: new THREE.Vector3(
        POND_SHORE_BENCH_POS.x - 0.12,
        benchGroundY + 1.14,
        POND_SHORE_BENCH_POS.z + 0.18,
      ),
      lookAt: new THREE.Vector3(-5.6, benchGroundY + 1.05, 1.4),
      avatarPos: new THREE.Vector3(
        POND_SHORE_BENCH_POS.x,
        benchGroundY + 0.02,
        POND_SHORE_BENCH_POS.z,
      ),
      avatarYaw: Math.PI + POND_SHORE_BENCH_POS.rotY,
    };
  }
  if (mode === 'SEATED_GROTTO_ISLAND_BENCH') {
    return {
      camPos: new THREE.Vector3(
        GROTTO_ISLAND_BENCH_POS.x + 0.35,
        GROTTO_ISLAND_BENCH_POS.y + 1.15,
        GROTTO_ISLAND_BENCH_POS.z - 0.25,
      ),
      lookAt: new THREE.Vector3(-12.5, 6.2, 148.5),
      avatarPos: new THREE.Vector3(
        GROTTO_ISLAND_BENCH_POS.x,
        GROTTO_ISLAND_BENCH_POS.y + 0.02,
        GROTTO_ISLAND_BENCH_POS.z,
      ),
      avatarYaw: -0.92,
    };
  }
  if (mode === 'SEATED_GROTTO_OVERLOOK_BENCH') {
    return {
      camPos: new THREE.Vector3(
        GROTTO_OVERLOOK_BENCH_POS.x + 0.35,
        GROTTO_OVERLOOK_BENCH_POS.y + 1.18,
        GROTTO_OVERLOOK_BENCH_POS.z + 0.35,
      ),
      lookAt: new THREE.Vector3(2.0, 4.2, 138.0),
      avatarPos: new THREE.Vector3(
        GROTTO_OVERLOOK_BENCH_POS.x,
        GROTTO_OVERLOOK_BENCH_POS.y + 0.02,
        GROTTO_OVERLOOK_BENCH_POS.z,
      ),
      avatarYaw: -2.25,
    };
  }
  return null;
}
