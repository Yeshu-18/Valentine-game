/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CircleCollider } from '../VegetationSystem';

/**
 * Common Attraction State Machine (Section 6):
 * IDLE -> ACTIVATING -> PLAYING -> WIN -> CINEMATIC -> PRIZE_REVEAL -> RECOVERY -> IDLE
 */
export type CarnivalAttractionState =
  | 'IDLE'
  | 'ACTIVATING'
  | 'PLAYING'
  | 'WIN'
  | 'CINEMATIC'
  | 'PRIZE_REVEAL'
  | 'RECOVERY';

export type CarnivalAttractionId =
  | 'heartshot'
  | 'ring_toss'
  | 'prize_knockdown'
  | 'frog_launch'
  | 'mystery_egg'
  | 'carousel'
  | 'ferris_wheel'
  | 'quiet_garden'
  | 'photo_booth'
  | 'waters_edge_bench'
  | 'starlight_wish_jar'
  | 'curiosity_cabinet'
  | 'climax_ticket_cabinet';

export type CarnivalPromptVerb =
  | 'E Play'
  | 'E Ride'
  | 'E Enter'
  | 'E Memory'
  | 'E Enter Photo Booth'
  | 'E Sit Together & Listen'
  | 'E Make a Starlight Wish'
  | 'E Inspect Cabinet'
  | 'E Place Stamped Tickets';

export interface CarnivalPrizeDefinition {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  caption: string;
}

export interface CarnivalProximityPrompt {
  attractionId: CarnivalAttractionId;
  title: string;
  verb: CarnivalPromptVerb;
}

export interface CarnivalActiveOverlay {
  attractionId: CarnivalAttractionId;
  title: string;
  subtitle: string;
  state: CarnivalAttractionState;
  instruction?: string;
  progressText?: string;
  powerMeter?: number; // 0..1 for Frog Launch timing bar or charge meter
  chargePower?: number; // 0..1 current power charge level
  isChargingPower?: boolean;
  attemptsLeft?: number;
  sweetSpotStart?: number;
  sweetSpotEnd?: number;
  photoBoothStep?: 'select' | 'countdown' | 'flash' | 'developing';
  selectedEmotion?: 'romantic' | 'playful' | 'treasured';
  countdownValue?: number;
  captionLine?: string;
  prizeName?: string;
  prizeCategory?: string;
  requiresEnterToContinue: boolean;
  showReticle?: boolean;
  reticleHovered?: boolean;
}

export interface CarnivalCameraFocus {
  active: boolean;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  playerPos?: THREE.Vector3;
  playerYaw?: number;
  isSitting?: boolean;
  hidePlayerAvatar?: boolean;
}

export interface CarnivalDistrictBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  getProximityPrompt: (playerPos: THREE.Vector3) => CarnivalProximityPrompt | null;
  getActiveOverlay: () => CarnivalActiveOverlay | null;
  getEarnedPrizeIds: () => string[];
  isActive: () => boolean;
  isMovementLocked: () => boolean;
  triggerNearestAttraction: (
    playerPos: THREE.Vector3,
    playerYaw: number,
    camPos: THREE.Vector3,
    lookPos: THREE.Vector3,
  ) => boolean;
  performGameAction: (camera?: THREE.PerspectiveCamera) => boolean;
  advanceCinematicOrPrize: (camera?: THREE.PerspectiveCamera) => boolean;
  skipActiveAttraction: () => void;
  applyMouseLookDelta: (dx: number, dy: number) => void;
  applyZoomDelta?: (delta: number) => void;
  selectOption?: (index: number) => void;
  getCameraFocus: () => CarnivalCameraFocus | null;
  update: (
    dt: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
    camera?: THREE.PerspectiveCamera,
    keys?: Set<string>,
  ) => void;
  dispose: () => void;
}

export const CARNIVAL_CENTER = {
  x: 0.0,
  z: -65.0,
} as const;
