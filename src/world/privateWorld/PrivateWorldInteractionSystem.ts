import * as THREE from 'three';
import {
  PRIVATE_ARRIVAL_GATE_POS,
  PROPOSAL_GARDEN_CENTER,
  isNearPrivateReturnGate,
} from './privateWorldMath';

export type PrivateInteractionMode =
  | 'NONE'
  | 'TELESCOPE'
  | 'SEATED_LOVESEAT'
  | 'PROPOSAL_SEQUENCE'
  | 'SEATED_POND_BENCH'
  | 'SEATED_GROTTO_ISLAND_BENCH'
  | 'SEATED_GROTTO_OVERLOOK_BENCH';

export type ProposalSequencePhase =
  | 'IDLE'
  | 'MIST_GATHER'
  | 'MESSAGE'
  | 'FIGURE_DISSOLVE'
  | 'CONSTELLATION_REVEAL'
  | 'FINAL_HOLD';

/**
 * Exact 6-part personal proposal message delivered by the kneeling mist figure (verbatim).
 */
export const PROPOSAL_MESSAGE_SECTIONS: readonly string[] = [
  'Thank you for coming into my life',
  'You have made my life sooo beautiful in ways you have never imagined',
  'Thank you for everything',
  'I am really happy and grateful that you came into my life...',
  'Not just in this birth, will you find me and become my life partner in every birth, Harsha... ?',
  'Once again, I love you mandu.... Thank you for everything..',
];

export interface ProposalSequenceState {
  phase: ProposalSequencePhase;
  messageIndex: number; // 0..5
  totalMessages: number; // 6
  currentMessageText: string | null;
  figureOpacity: number; // 0..1 opacity of the kneeling mist figure
  mistIntensity: number; // 0..1 ground mist & particle swirl intensity
  dissolveProgress: number; // 0..1 rising particle dissolution progress
  constellationRevealProgress: number; // 0..1 progressive L->R reveal of HAPPY VALENTINE'S DAY, MY LOVE
  celebrationProgress: number; // 0..1 post-constellation fireworks, festival lighting & wedding ceremony factor
  weddingAnimTime: number; // continuous elapsed seconds for the bride & groom marriage animation
  hasCompletedOnce: boolean;
}

export interface PrivateInteractionPrompt {
  id: string;
  keyLabel: string;
  actionLabel: string;
  fullPrompt: string;
  distance: number;
}

export interface PrivateInteractionTarget {
  id: string;
  actionLabel: string | ((playerX: number, playerZ: number) => string);
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
    text: 'Constellation VIII — “U”',
    subtitle: 'Final Star Constellation Illuminated',
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
  updateProposalSequence: (delta: number) => ProposalSequenceState;
  advanceProposalMessage: () => boolean;
  triggerWeddingCelebration: () => void;
  stopWeddingCelebration: () => void;
  getProposalState: () => ProposalSequenceState;
}

export interface CreatePrivateInteractionSystemOptions {
  onReturnGateInteract?: () => void;
  onTouchPondWater?: (waterX: number, waterZ: number) => void;
  onModeChanged?: (
    nextMode: PrivateInteractionMode,
    prevMode: PrivateInteractionMode,
  ) => void;
  onProposalPhaseChanged?: (phase: ProposalSequencePhase) => void;
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
  seatFacingYaw: Math.PI / 2,
} as const;

// Proposal Garden Stage interactive focal point at (22.0, 4.36, 18.0)
export const PROPOSAL_STAGE_POS = {
  x: PROPOSAL_GARDEN_CENTER.x,
  y: PROPOSAL_GARDEN_CENTER.stageY,
  z: PROPOSAL_GARDEN_CENTER.z,
  // Harsha stands on the SW edge of the stage looking NE (yaw = 0.72) toward the kneeling figure & horizon
  playerStandX: 20.1,
  playerStandZ: 16.3,
  playerFacingYaw: 0.72,
  // Kneeling mist figure materializes ~2.55m in front of Harsha facing her
  figureX: 21.8,
  figureZ: 18.2,
  figureFacingYaw: 0.72 + Math.PI,
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3.0 - 2.0 * t);
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

  let discoveredMask = 0b00000001;
  let connectedNodesCount = 1;
  let focusedNodeIndex = 1;

  // Proposal Sequence State Machine
  let proposalPhase: ProposalSequencePhase = 'IDLE';
  let proposalPhaseTimer = 0;
  let proposalMessageIndex = 0;
  let figureOpacity = 0;
  let mistIntensity = 0;
  let dissolveProgress = 0;
  let constellationRevealProgress = 0;
  let celebrationProgress = 0;
  let weddingAnimTime = 0;
  let hasCompletedProposalOnce = false;

  const MIST_GATHER_DURATION = 2.3;
  const FIGURE_DISSOLVE_DURATION = 3.2;
  const CONSTELLATION_REVEAL_DURATION = 4.8;
  const CONSTELLATION_POST_REVEAL_WAIT_DURATION = 5.0;
  const CELEBRATION_RAMP_DURATION = 2.4;

  function setProposalPhase(nextPhase: ProposalSequencePhase) {
    if (proposalPhase === nextPhase) return;
    proposalPhase = nextPhase;
    proposalPhaseTimer = 0;
    options.onProposalPhaseChanged?.(nextPhase);
  }

  function startOrReplayProposalSequence() {
    proposalMessageIndex = 0;
    figureOpacity = 0;
    mistIntensity = 0;
    dissolveProgress = 0;
    // Reset constellation reveal and celebration so replaying performs the full sequence cleanly
    constellationRevealProgress = 0;
    celebrationProgress = 0;
    weddingAnimTime = 0;
    setProposalPhase('MIST_GATHER');
    setMode('PROPOSAL_SEQUENCE');
  }

  function triggerWeddingCelebration() {
    figureOpacity = 0;
    mistIntensity = 0;
    dissolveProgress = 0;
    constellationRevealProgress = 1.0;
    celebrationProgress = Math.max(celebrationProgress, 0.08);
    weddingAnimTime = 0;
    hasCompletedProposalOnce = true;
    setProposalPhase('FINAL_HOLD');
    setMode('NONE');
  }

  function stopWeddingCelebration() {
    figureOpacity = 0;
    mistIntensity = 0;
    dissolveProgress = 0;
    celebrationProgress = 0;
    weddingAnimTime = 0;
    setProposalPhase('IDLE');
    setMode('NONE');
  }

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
      if (currentMode === 'TELESCOPE' && d < 0.27) {
        discoveredMask |= 1 << i;
      }
    }

    const bestNode = STARGAZING_SKY_SEQUENCE[bestIdx];
    focusedNodeIndex = bestNode.index;
    connectedNodesCount = countBits8(discoveredMask);

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
    if (prev === 'PROPOSAL_SEQUENCE' && nextMode === 'NONE') {
      // If user exits early via Esc before completion, cleanly hide figure and restore state
      if (proposalPhase !== 'FINAL_HOLD') {
        figureOpacity = 0;
        mistIntensity = 0;
        dissolveProgress = 0;
        if (hasCompletedProposalOnce) {
          constellationRevealProgress = 1.0;
          setProposalPhase('FINAL_HOLD');
        } else {
          setProposalPhase('IDLE');
        }
      }
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

  // 3. Connected Proposal Garden: Central Proposal Stage ("E  Open the proposal message")
  registerInteraction({
    id: 'proposal-stage',
    keyLabel: 'E',
    actionLabel: () =>
      hasCompletedProposalOnce
        ? 'Replay the proposal & wedding celebration'
        : 'Open the proposal message',
    radius: 3.5,
    getPosition: () => ({
      x: PROPOSAL_STAGE_POS.x,
      z: PROPOSAL_STAGE_POS.z,
    }),
    onInteract: () => {
      startOrReplayProposalSequence();
    },
  });

  // 4. Stargazing Sanctuary: Return Portal Gate ("E  Return to Heart Island")
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
        const resolvedAction =
          typeof bestTarget.actionLabel === 'function'
            ? bestTarget.actionLabel(playerX, playerZ)
            : bestTarget.actionLabel;
        nearestPrompt = {
          id: bestTarget.id,
          keyLabel,
          actionLabel: resolvedAction,
          fullPrompt: `${keyLabel}  ${resolvedAction}`,
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
      return currentMode === 'TELESCOPE' || currentMode === 'SEATED_LOVESEAT';
    },

    handleKeyE(playerX: number, playerZ: number): boolean {
      // In PROPOSAL_SEQUENCE mode, E advances the message while allowing full free movement
      if (currentMode === 'PROPOSAL_SEQUENCE') {
        return this.advanceProposalMessage();
      }
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
      const isBestDiscovered =
        (discoveredMask & (1 << (evalRes.bestNode.index - 1))) !== 0;
      return {
        yaw: telescopeYaw,
        pitch: telescopePitch,
        constellationName: isBestDiscovered
          ? evalRes.bestNode.text
          : 'Searching the Night Sky',
        constellationSubtitle: isBestDiscovered
          ? evalRes.bestNode.subtitle
          : 'Uncharted Star Cluster',
        highlightStrength: evalRes.highlightStrength,
        connectedNodesCount: evalRes.connectedCount,
        focusedNodeIndex,
        discoveredMask,
      };
    },

    updateProposalSequence(delta: number): ProposalSequenceState {
      if (proposalPhase === 'MIST_GATHER') {
        proposalPhaseTimer += delta;
        const t = THREE.MathUtils.clamp(
          proposalPhaseTimer / MIST_GATHER_DURATION,
          0,
          1,
        );
        mistIntensity = smoothstep(0.0, 0.55, t);
        figureOpacity = smoothstep(0.18, 1.0, t);
        dissolveProgress = 0;
        celebrationProgress = 0;

        if (proposalPhaseTimer >= MIST_GATHER_DURATION) {
          figureOpacity = 1.0;
          mistIntensity = 1.0;
          setProposalPhase('MESSAGE');
        }
      } else if (proposalPhase === 'MESSAGE') {
        proposalPhaseTimer += delta;
        figureOpacity = 1.0;
        mistIntensity = 1.0;
        dissolveProgress = 0;
        celebrationProgress = 0;
      } else if (proposalPhase === 'FIGURE_DISSOLVE') {
        proposalPhaseTimer += delta;
        celebrationProgress = 0;
        // Brief 0.9s pause after final message before dissolving
        if (proposalPhaseTimer <= 0.9) {
          figureOpacity = 1.0;
          mistIntensity = 1.0;
          dissolveProgress = 0;
        } else {
          const dissolveT = THREE.MathUtils.clamp(
            (proposalPhaseTimer - 0.9) / (FIGURE_DISSOLVE_DURATION - 0.9),
            0,
            1,
          );
          const smoothD = smoothstep(0.0, 1.0, dissolveT);
          figureOpacity = 1.0 - smoothD;
          mistIntensity = 1.0 - smoothD * 0.85;
          dissolveProgress = smoothD;
        }

        if (proposalPhaseTimer >= FIGURE_DISSOLVE_DURATION) {
          figureOpacity = 0;
          mistIntensity = 0;
          dissolveProgress = 1.0;
          setProposalPhase('CONSTELLATION_REVEAL');
        }
      } else if (proposalPhase === 'CONSTELLATION_REVEAL') {
        proposalPhaseTimer += delta;
        figureOpacity = 0;
        mistIntensity = 0;
        dissolveProgress = 1.0;
        const revT = THREE.MathUtils.clamp(
          proposalPhaseTimer / CONSTELLATION_REVEAL_DURATION,
          0,
          1,
        );
        constellationRevealProgress = smoothstep(0.0, 1.0, revT);

        // Wait a full 5 seconds after the constellation wording finishes revealing
        // before starting the fireworks, festival illumination, and marriage animation!
        celebrationProgress = 0;
        weddingAnimTime = 0;

        if (
          proposalPhaseTimer >=
          CONSTELLATION_REVEAL_DURATION +
            CONSTELLATION_POST_REVEAL_WAIT_DURATION
        ) {
          constellationRevealProgress = 1.0;
          hasCompletedProposalOnce = true;
          setProposalPhase('FINAL_HOLD');
          setMode('NONE');
        }
      } else if (proposalPhase === 'FINAL_HOLD') {
        proposalPhaseTimer += delta;
        figureOpacity = 0;
        mistIntensity = 0;
        dissolveProgress = 0;
        constellationRevealProgress = 1.0;
        celebrationProgress = THREE.MathUtils.clamp(
          celebrationProgress + delta / CELEBRATION_RAMP_DURATION,
          0,
          1,
        );
        weddingAnimTime += delta;
      }

      return this.getProposalState();
    },

    advanceProposalMessage(): boolean {
      if (currentMode !== 'PROPOSAL_SEQUENCE') return false;
      if (proposalPhase === 'MIST_GATHER') {
        // Allow skipping straight to Message 1 if pressed during mist gather
        figureOpacity = 1.0;
        mistIntensity = 1.0;
        setProposalPhase('MESSAGE');
        return true;
      }
      if (proposalPhase === 'MESSAGE') {
        if (proposalMessageIndex < PROPOSAL_MESSAGE_SECTIONS.length - 1) {
          proposalMessageIndex += 1;
          proposalPhaseTimer = 0;
          return true;
        } else {
          // Completed the 6th and final message section -> begin figure dissolution
          setProposalPhase('FIGURE_DISSOLVE');
          return true;
        }
      }
      return false;
    },

    triggerWeddingCelebration,
    stopWeddingCelebration,

    getProposalState(): ProposalSequenceState {
      return {
        phase: proposalPhase,
        messageIndex: proposalMessageIndex,
        totalMessages: PROPOSAL_MESSAGE_SECTIONS.length,
        currentMessageText:
          proposalPhase === 'MESSAGE'
            ? PROPOSAL_MESSAGE_SECTIONS[proposalMessageIndex]
            : null,
        figureOpacity,
        mistIntensity,
        dissolveProgress,
        constellationRevealProgress,
        celebrationProgress,
        weddingAnimTime,
        hasCompletedOnce: hasCompletedProposalOnce,
      };
    },
  };
}

/**
 * Helper returning the seated camera pose for the Stargazing Loveseat at (-1.8, 3.48, -3.1).
 * Frames both Harsha (right cushion) and her silver-blue mist companion (left cushion)
 * gazing up together toward the MANDU star constellation in the eastern night sky.
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
      camPos: new THREE.Vector3(-4.15, deckY + 1.46, -3.28),
      lookAt: new THREE.Vector3(26.0, deckY + 12.2, -2.5),
      avatarPos: new THREE.Vector3(-1.72, deckY + 0.02, -3.46),
      avatarYaw: STARGAZING_LOVESEAT_POS.seatFacingYaw + 0.16,
    };
  }
  return null;
}
