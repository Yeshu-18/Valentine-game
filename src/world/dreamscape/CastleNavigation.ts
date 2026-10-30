import * as THREE from 'three';
import {
  AuroraDialogueLine,
  CASTLE_ENTRANCE_DIALOGUE,
} from '../cinematics/auroraDialogueData';
import { getTerrainHeight } from '../terrainMath';

export const CASTLE_ORIGIN_X = 88.0;
export const CASTLE_ORIGIN_Z = 18.0;

export interface CastleFloorDef {
  id: number;
  name: string;
  shortName: string;
  keyLabel: string;
  elevOffset: number;
}

export const CASTLE_FLOOR_DEFS: ReadonlyArray<CastleFloorDef> = [
  { id: -1, name: 'Basement Vault & Secret Wardrobe', shortName: 'Basement', keyLabel: '0', elevOffset: -4.5 },
  { id: 1, name: 'Grand Entrance Hall & Crystal Fountain', shortName: 'Grand Hall', keyLabel: '1', elevOffset: 0.25 },
  { id: 2, name: 'Mezzanine & Haute Couture Gallery', shortName: 'Fashion Overlook', keyLabel: '2', elevOffset: 5.25 },
  { id: 3, name: 'Dream Wing & Starlight Salon', shortName: 'Dream Wing', keyLabel: '3', elevOffset: 10.25 },
  { id: 4, name: 'Rooftop Panoramic Observatory', shortName: 'Rooftop Terrace', keyLabel: '4', elevOffset: 15.25 },
];

export interface StairBounds2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CastleStaircaseConfig {
  id: 'f1_to_f2_west' | 'f1_to_f2_east' | 'f2_to_f3_east' | 'f3_to_f4_west' | 'f1_to_basement';
  label: string;
  fromFloorId: number;
  toFloorId: number;
  startX: number;
  startZ: number;
  startY: number;
  endX: number;
  endZ: number;
  endY: number;
  stepCount: number;
  stepWidth: number;
  stepDepth: number;
  stepHeight: number;
  stairWidth: number;
  railInnerX: number;
  railOuterX: number;
  openingBounds: StairBounds2D;
  bottomLandingBounds: StairBounds2D;
  topLandingBounds: StairBounds2D;
  hasLoveRibbon: boolean;
}

/**
 * Single Source of Truth for every staircase in the Dream Castle.
 * Drives visual step meshes, landings, floor slab cutouts, Love Ribbon curves,
 * simplified side-rail collision, and continuous surface height navigation.
 */
export const CASTLE_STAIRCASE_CONFIGS: readonly CastleStaircaseConfig[] = [
  {
    id: 'f1_to_f2_west',
    label: 'Floor 1 -> Floor 2 West Grand Staircase',
    fromFloorId: 1,
    toFloorId: 2,
    startX: -6.9,
    startZ: -6.0,
    startY: 0.25,
    endX: -6.9,
    endZ: 6.0,
    endY: 5.25,
    stepCount: 18,
    stepWidth: 3.4,
    stepDepth: 12.0 / 18,
    stepHeight: 5.0 / 18,
    stairWidth: 3.4,
    railOuterX: -8.35,
    railInnerX: -5.45,
    openingBounds: { minX: -8.6, maxX: -5.2, minZ: -6.0, maxZ: 6.0 },
    bottomLandingBounds: { minX: -8.6, maxX: -5.2, minZ: -8.2, maxZ: -6.0 },
    topLandingBounds: { minX: -8.6, maxX: -5.2, minZ: 6.0, maxZ: 8.4 },
    hasLoveRibbon: true,
  },
  {
    id: 'f1_to_f2_east',
    label: 'Floor 1 -> Floor 2 East Grand Staircase',
    fromFloorId: 1,
    toFloorId: 2,
    startX: 6.9,
    startZ: -6.0,
    startY: 0.25,
    endX: 6.9,
    endZ: 6.0,
    endY: 5.25,
    stepCount: 18,
    stepWidth: 3.4,
    stepDepth: 12.0 / 18,
    stepHeight: 5.0 / 18,
    stairWidth: 3.4,
    railInnerX: 5.45,
    railOuterX: 8.35,
    openingBounds: { minX: 5.2, maxX: 8.6, minZ: -6.0, maxZ: 6.0 },
    bottomLandingBounds: { minX: 5.2, maxX: 8.6, minZ: -8.2, maxZ: -6.0 },
    topLandingBounds: { minX: 5.2, maxX: 8.6, minZ: 6.0, maxZ: 8.4 },
    hasLoveRibbon: true,
  },
  {
    id: 'f2_to_f3_east',
    label: 'Floor 2 -> Floor 3 East Gallery Staircase',
    fromFloorId: 2,
    toFloorId: 3,
    startX: 7.5,
    startZ: 6.5,
    startY: 5.25,
    endX: 7.5,
    endZ: 13.0,
    endY: 10.25,
    stepCount: 14,
    stepWidth: 3.4,
    stepDepth: 6.5 / 14,
    stepHeight: 5.0 / 14,
    stairWidth: 3.4,
    railInnerX: 6.0,
    railOuterX: 9.0,
    openingBounds: { minX: 5.8, maxX: 9.2, minZ: 6.5, maxZ: 13.0 },
    bottomLandingBounds: { minX: 5.2, maxX: 9.2, minZ: 5.6, maxZ: 6.5 },
    topLandingBounds: { minX: 5.8, maxX: 9.2, minZ: 13.0, maxZ: 15.2 },
    hasLoveRibbon: true,
  },
  {
    id: 'f3_to_f4_west',
    label: 'Floor 3 -> Floor 4 West Gallery Staircase',
    fromFloorId: 3,
    toFloorId: 4,
    startX: -7.5,
    startZ: 6.5,
    startY: 10.25,
    endX: -7.5,
    endZ: 13.0,
    endY: 15.25,
    stepCount: 14,
    stepWidth: 3.4,
    stepDepth: 6.5 / 14,
    stepHeight: 5.0 / 14,
    stairWidth: 3.4,
    railOuterX: -9.0,
    railInnerX: -6.0,
    openingBounds: { minX: -9.2, maxX: -5.8, minZ: 6.5, maxZ: 13.0 },
    bottomLandingBounds: { minX: -9.2, maxX: -5.8, minZ: 4.8, maxZ: 6.5 },
    topLandingBounds: { minX: -9.2, maxX: -5.8, minZ: 13.0, maxZ: 15.2 },
    hasLoveRibbon: true,
  },
  {
    id: 'f1_to_basement',
    label: 'Floor 1 -> Basement -1 Service Staircase',
    fromFloorId: 1,
    toFloorId: -1,
    startX: -3.95,
    startZ: 11.5,
    startY: 0.25,
    endX: -3.95,
    endZ: 15.2,
    endY: -4.5,
    stepCount: 16,
    stepWidth: 2.7,
    stepDepth: 3.7 / 16,
    stepHeight: -4.75 / 16,
    stairWidth: 2.7,
    railOuterX: -5.25,
    railInnerX: -2.65,
    openingBounds: { minX: -5.3, maxX: -2.6, minZ: 11.5, maxZ: 15.2 },
    bottomLandingBounds: { minX: -5.3, maxX: -2.6, minZ: 9.8, maxZ: 11.5 },
    topLandingBounds: { minX: -5.3, maxX: -2.6, minZ: 15.2, maxZ: 16.5 },
    hasLoveRibbon: false,
  },
];

// Preallocated module-scope scratch objects (Zero Per-Frame Allocations)
const _scratchLocal = { lx: 0.0, lz: 0.0 };
const _scratchCollisionPos = { lx: 0.0, lz: 0.0 };
const _scratchWorld = { wx: 0.0, wz: 0.0 };

function smoothStep01(val: number): number {
  const c = THREE.MathUtils.clamp(val, 0, 1);
  return c * c * (3.0 - 2.0 * c);
}

export class CastleNavigationController {
  public originX: number = CASTLE_ORIGIN_X;
  public originZ: number = CASTLE_ORIGIN_Z;
  public baseY: number = 10.0;

  // Elevator State
  public elevatorFloorIndex: number = 1; // 1 = Grand Hall
  public elevatorTargetFloorIndex: number = 1;
  public elevatorCabinY: number = 10.25;
  public elevatorCabinVelocity: number = 0;
  public elevatorDoorsOpenRatio: number = 1.0; // 0 = closed, 1 = fully open
  public elevatorState: 'IDLE' | 'CLOSING' | 'MOVING' | 'OPENING' = 'IDLE';
  public elevatorShaftLocalX: number = 0.0;
  public elevatorShaftLocalZ: number = 8.5;
  public elevatorCabinRadius: number = 1.85;
  public isElevatorFpvActive: boolean = false;

  // Entrance Door State
  public doorOpenRatio: number = 0.0; // 0 = closed, 1 = open
  public doorState: 'CLOSED' | 'OPENING' | 'OPEN' = 'CLOSED';
  public doorHandleAngle: number = 0.0;
  public doorProximityRange: number = 6.2;
  public doorCenterLocalX: number = 0.0;
  public doorCenterLocalZ: number = -16.0;

  // Cinematic / Camera Focus State
  public activeCameraFocus: {
    mode: 'entrance' | 'rooftop';
    target: THREE.Vector3;
    position: THREE.Vector3;
    fov?: number;
    duration: number;
    elapsed: number;
    blendAlpha: number;
    seatWorldPos?: THREE.Vector3;
    seatYaw?: number;
  } | null = null;

  public hasTriggeredEntranceReveal: boolean = false;
  public hasTriggeredRooftopReveal: boolean = false;

  // Grand Castle Entrance Awakening & Romantic Reveal State (Sections 7, 23, 24, 25)
  public primaryTreeAwake: number = 0.0;
  public secondaryTreeAwake: number = 0.0;
  public castleWindowsAwake: number = 0.0;
  public yeshwanthWalkProgress: number = 0.0;
  public yeshwanthRoseExtend: number = 0.0;
  public entranceRosePresented: boolean = false;
  public activeEntranceCaption: string | null = null;
  private entranceBeatIndex: number = 0;
  private static readonly ENTRANCE_BEAT_STARTS = [
    0.0, 2.2, 5.2, 7.6, 10.2, 12.6, 14.0, 15.95,
  ] as const;
  private static readonly ENTRANCE_BEAT_STOPS = [
    2.15, 5.15, 7.55, 10.15, 12.55, 13.95, 15.4, 16.5,
  ] as const;
  private playedPrimaryTreeChime: boolean = false;
  private playedSecondaryTreeChime: boolean = false;
  private playedWindowsChime: boolean = false;
  private playedDoorsCreak: boolean = false;
  private playedRoseMelody: boolean = false;
  private onEntranceRosePresentedCallback: ((held: boolean) => void) | null = null;

  // Fountain Ripple & Hologram Projector State
  public fountainRippleTimer: number = 0.0;
  public fountainRippleDuration: number = 7.0;
  public fountainHologramActive: boolean = false;
  public fountainHologramTimer: number = 0.0;
  public fountainHologramDuration: number = 7.0;
  public fountainHologramAlpha: number = 0.0;
  public readonly fountainHologramCaption: string =
    '"Our favorite place in the world is right beside you. ♡"';

  // Preallocated rooftop sweep waypoints & entrance pose vectors (Zero Per-Frame Allocations)
  private readonly rooftopSweepWaypoints: THREE.Vector3[];
  private readonly focusCamPos = new THREE.Vector3();
  private readonly focusTargetPos = new THREE.Vector3();
  private readonly entranceSeatWorldPos = new THREE.Vector3();

  // Audio cues
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.baseY = getTerrainHeight(this.originX, this.originZ);
    this.elevatorCabinY = this.baseY + 0.25;
    this.rooftopSweepWaypoints = [
      new THREE.Vector3(this.originX - 15.5, this.baseY + 25.0, this.originZ - 15.5), // Castle Spires
      new THREE.Vector3(38.0, 12.0, 42.0), // Enchanted Garden
      new THREE.Vector3(0.0, 11.0, 0.0), // Central Plaza
      new THREE.Vector3(24.0, 14.0, -56.0), // Romantic Carnival Midway
      new THREE.Vector3(-42.0, 12.0, -68.0), // Aurora Lake
      new THREE.Vector3(0.0, 38.0, -30.0), // Starlit Sky above Heart Island
    ];
  }

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
  }

  public playChime(freq1 = 523.25, freq2 = 659.25) {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, now);
      osc.frequency.exponentialRampToValueAtTime(freq2, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.7);
    } catch {
      // Audio fallback
    }
  }

  public playMusicBoxMelody() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const now = this.audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5];
      for (let idx = 0; idx < notes.length; idx++) {
        const freq = notes[idx];
        const start = now + idx * 0.16;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.065, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 1.15);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(start);
        osc.stop(start + 1.2);
      }
    } catch {
      // Audio fallback
    }
  }

  public playDoorCreak() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(260, now + 0.4);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch {
      // Audio fallback
    }
  }

  public worldToLocal(wx: number, wz: number): { lx: number; lz: number } {
    _scratchLocal.lx = wx - this.originX;
    _scratchLocal.lz = wz - this.originZ;
    return _scratchLocal;
  }

  public localToWorld(lx: number, lz: number): { wx: number; wz: number } {
    _scratchWorld.wx = lx + this.originX;
    _scratchWorld.wz = lz + this.originZ;
    return _scratchWorld;
  }

  public isInsideCastleBounds(wx: number, wz: number): boolean {
    const lx = wx - this.originX;
    const lz = wz - this.originZ;
    if (Math.hypot(lx - 33.0, lz - 12.0) <= 8.5) {
      return true;
    }
    return Math.abs(lx) <= 22.0 && lz >= -22.0 && lz <= 44.5;
  }

  /**
   * Solid temporary box collision barrier across the doorway threshold while doorState === 'CLOSED'.
   * Immediately stops blocking once the player presses E and doorState transitions to 'OPENING' / 'OPEN'.
   */
  public resolveEntranceDoorBarrier(playerPos: THREE.Vector3, playerRadius = 0.42): boolean {
    if (this.doorState !== 'CLOSED') {
      return false;
    }
    if (Math.abs(playerPos.y - (this.baseY + 0.25)) > 4.2) {
      return false;
    }
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const boxMinX = -2.35;
    const boxMaxX = 2.35;
    const boxMinZ = -16.48;
    const boxMaxZ = -15.52;

    const closestX = THREE.MathUtils.clamp(lx, boxMinX, boxMaxX);
    const closestZ = THREE.MathUtils.clamp(lz, boxMinZ, boxMaxZ);
    const dx = lx - closestX;
    const dz = lz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < playerRadius * playerRadius) {
      if (lz <= this.doorCenterLocalZ) {
        playerPos.z = this.originZ + (boxMinZ - playerRadius);
      } else {
        playerPos.z = this.originZ + (boxMaxZ + playerRadius);
      }
      return true;
    }
    return false;
  }

  /**
   * Resolves circle-vs-AABB collision in castle local coordinates (lx, lz) with minimum wall thickness 0.85m - 1.2m.
   */
  private pushOutLocalBox(
    pos: { lx: number; lz: number },
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    radius: number,
  ): boolean {
    const closestX = THREE.MathUtils.clamp(pos.lx, minX, maxX);
    const closestZ = THREE.MathUtils.clamp(pos.lz, minZ, maxZ);
    const dx = pos.lx - closestX;
    const dz = pos.lz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq >= radius * radius) {
      return false;
    }

    if (distSq > 0.00001) {
      const dist = Math.sqrt(distSq);
      const push = radius - dist;
      pos.lx += (dx / dist) * push;
      pos.lz += (dz / dist) * push;
      return true;
    }

    const penLeft = pos.lx - minX;
    const penRight = maxX - pos.lx;
    const penFront = pos.lz - minZ;
    const penBack = maxZ - pos.lz;
    const minPen = Math.min(penLeft, penRight, penFront, penBack);

    if (minPen === penLeft) {
      pos.lx = minX - radius;
    } else if (minPen === penRight) {
      pos.lx = maxX + radius;
    } else if (minPen === penFront) {
      pos.lz = minZ - radius;
    } else {
      pos.lz = maxZ + radius;
    }
    return true;
  }

  /**
   * Enforces solid 0.88m - 1.2m thick wall barriers across all exterior castle perimeter walls,
   * Floor 1 interior room partition walls, the central elevator shaft, and simplified staircase railings.
   * Decorative Love Ribbon meshes never interfere with player collision.
   */
  public resolveCastleWallCollisions(playerPos: THREE.Vector3, playerRadius = 0.48): void {
    if (this.isElevatorFpvActive) {
      playerPos.x = this.originX + this.elevatorShaftLocalX;
      playerPos.z = this.originZ + this.elevatorShaftLocalZ;
      return;
    }

    _scratchCollisionPos.lx = playerPos.x - this.originX;
    _scratchCollisionPos.lz = playerPos.z - this.originZ;
    const pos = _scratchCollisionPos;

    // Connected Little Dream World circular plateau boundary (center lx = 33.0, lz = 12.0, radius = 7.95m)
    const dwDx = pos.lx - 33.0;
    const dwDz = pos.lz - 12.0;
    const dwDist = Math.hypot(dwDx, dwDz);
    if (dwDist <= 9.5 && Math.abs(playerPos.y - (this.baseY + 5.25)) <= 2.2) {
      const maxR = 7.85 - playerRadius;
      if (dwDist > maxR && dwDist > 0.001) {
        pos.lx = 33.0 + (dwDx / dwDist) * maxR;
        pos.lz = 12.0 + (dwDz / dwDist) * maxR;
        playerPos.x = this.originX + pos.lx;
        playerPos.z = this.originZ + pos.lz;
      }
      return;
    }

    if (Math.abs(pos.lx) > 19.5 || Math.abs(pos.lz) > 19.5) {
      return;
    }

    const relY = playerPos.y - this.baseY;
    const isFloor1 = Math.abs(relY - 0.25) <= 2.35;
    const isFloor2 = Math.abs(relY - 5.25) <= 2.25;
    const isFloor4 = relY >= 14.0;
    const isBasement = relY <= -1.5;

    // 1. Exterior Perimeter Walls (1.2m thickness: [-16.6, -15.4] and [15.4, 16.6])
    if (relY >= -5.2 && relY <= 14.6) {
      // Front Wall (lz = -16.0, open doorway at lx in [-2.08, +2.08] on Floor 1)
      this.pushOutLocalBox(pos, -16.6, -2.08, -16.6, -15.4, playerRadius);
      this.pushOutLocalBox(pos, 2.08, 16.6, -16.6, -15.4, playerRadius);
      if (!isFloor1 || this.doorState === 'CLOSED') {
        this.pushOutLocalBox(pos, -2.25, 2.25, -16.6, -15.4, playerRadius);
      }

      // Rear Wall (lz = +16.0, open Rear Center Garden Portal at lx in [-2.22, +2.22] on Floor 1)
      this.pushOutLocalBox(pos, -16.6, -2.22, 15.4, 16.6, playerRadius);
      this.pushOutLocalBox(pos, 2.22, 16.6, 15.4, 16.6, playerRadius);
      if (!isFloor1) {
        this.pushOutLocalBox(pos, -2.35, 2.35, 15.4, 16.6, playerRadius);
      }

      // West & East Exterior Side Walls (lx = -16.0 and lx = +16.0, 1.2m thickness)
      this.pushOutLocalBox(pos, -16.6, -15.4, -16.6, 16.6, playerRadius);
      this.pushOutLocalBox(pos, 15.4, 16.6, -16.6, 16.6, playerRadius);
    }

    // Basement Vault Inner Perimeter Retaining Walls (1.0m thickness at |lx| = 13.5, |lz| = 13.5)
    if (isBasement) {
      this.pushOutLocalBox(pos, -14.8, 14.8, -14.6, -13.6, playerRadius);
      this.pushOutLocalBox(pos, -14.8, 14.8, 13.6, 14.6, playerRadius);
      this.pushOutLocalBox(pos, -14.6, -13.6, -14.8, 14.8, playerRadius);
      this.pushOutLocalBox(pos, 13.6, 14.6, -14.8, 14.8, playerRadius);
    }

    // Rooftop Observatory Perimeter Balustrade Railings (placed at ±15.35m so North landing lz = 13.0..15.2 is wide and unobstructed)
    if (isFloor4) {
      this.pushOutLocalBox(pos, -15.8, 15.8, -15.65, -15.1, playerRadius);
      this.pushOutLocalBox(pos, -15.8, 15.8, 15.1, 15.65, playerRadius);
      this.pushOutLocalBox(pos, -15.65, -15.1, -15.8, 15.8, playerRadius);
      this.pushOutLocalBox(pos, 15.1, 15.65, -15.8, 15.8, playerRadius);
    }

    // 2. Floor 1 Interior Room Partition Walls (0.88m thickness at lz = -7.6 and lz = +7.6, |lx| >= 9.2)
    if (isFloor1 && relY <= 3.6) {
      // West Wing Partitions (lz = -7.6 & +7.6, |lx| >= 9.2)
      this.pushOutLocalBox(pos, -15.6, -13.4, -8.04, -7.16, playerRadius);
      this.pushOutLocalBox(pos, -11.0, -9.2, -8.04, -7.16, playerRadius);
      this.pushOutLocalBox(pos, -15.6, -13.4, 7.16, 8.04, playerRadius);
      this.pushOutLocalBox(pos, -11.0, -9.2, 7.16, 8.04, playerRadius);

      // East Wing Partitions (lz = -7.6 & +7.6, |lx| >= 9.2)
      this.pushOutLocalBox(pos, 9.2, 11.0, -8.04, -7.16, playerRadius);
      this.pushOutLocalBox(pos, 13.4, 15.6, -8.04, -7.16, playerRadius);
      this.pushOutLocalBox(pos, 9.2, 11.0, 7.16, 8.04, playerRadius);
      this.pushOutLocalBox(pos, 13.4, 15.6, 7.16, 8.04, playerRadius);

      // Basement Service Stairwell Side Guard Walls
      this.pushOutLocalBox(pos, -5.85, -5.05, 11.8, 15.4, playerRadius);
      this.pushOutLocalBox(pos, -2.85, -2.05, 11.8, 15.4, playerRadius);
      this.pushOutLocalBox(pos, -5.85, -2.05, 14.95, 15.75, playerRadius);
    }

      // 2B. Floor 2 West Wing Partition Walls (lz = -6.0 and lz = +6.0, open doorway at lx in [-12.8, -10.6])
    if (isFloor2 && relY <= 8.8) {
      this.pushOutLocalBox(pos, -15.5, -12.8, -6.22, -5.78, playerRadius);
      this.pushOutLocalBox(pos, -10.6, -9.2, -6.22, -5.78, playerRadius);
      this.pushOutLocalBox(pos, -15.5, -12.8, 5.78, 6.22, playerRadius);
      this.pushOutLocalBox(pos, -10.6, -9.2, 5.78, 6.22, playerRadius);

      // Floor 2 East Wing Creative Wing Partition Walls
      // South-East wall at lz = -6.2 (doorway at lx in [10.8, 13.2])
      this.pushOutLocalBox(pos, 8.8, 10.8, -6.38, -5.98, playerRadius);
      this.pushOutLocalBox(pos, 13.2, 15.5, -6.38, -5.98, playerRadius);
      // Photography Studio west wall at lx = 8.8 (doorway at lz in [-11.8, -9.4])
      this.pushOutLocalBox(pos, 8.58, 9.02, -15.2, -11.8, playerRadius);
      this.pushOutLocalBox(pos, 8.58, 9.02, -9.4, -6.2, playerRadius);
      // North-East wall at lz = +6.2 (doorway at lx in [10.8, 13.2])
      this.pushOutLocalBox(pos, 9.2, 10.8, 5.98, 6.38, playerRadius);
      this.pushOutLocalBox(pos, 13.2, 15.5, 5.98, 6.38, playerRadius);
      // Doll Playroom west wall (lx = 9.2, lz in [6.2, 14.8])
      this.pushOutLocalBox(pos, 8.95, 9.42, 6.2, 14.8, playerRadius);
      // Boutique west facade at lx = 8.8 (doorway at lz in [-1.2, +1.2])
      this.pushOutLocalBox(pos, 8.58, 9.02, -5.8, -1.2, playerRadius);
      this.pushOutLocalBox(pos, 8.58, 9.02, 1.2, 5.8, playerRadius);

      // Floor 2 Central Atrium Balustrade Guardrails (prevents falling into Grand Hall atrium after exiting elevator)
      this.pushOutLocalBox(pos, -5.3, 5.3, -6.15, -5.85, playerRadius);
      this.pushOutLocalBox(pos, -5.3, 5.3, 3.65, 3.98, playerRadius);
      this.pushOutLocalBox(pos, -5.35, -5.05, 3.65, 5.65, playerRadius);
      this.pushOutLocalBox(pos, 5.05, 5.35, 3.65, 5.65, playerRadius);
      this.pushOutLocalBox(pos, -8.75, -8.45, -6.0, 5.72, playerRadius);
      this.pushOutLocalBox(pos, 8.45, 8.75, -6.0, 5.72, playerRadius);
    }

    // 2C. Floor 3 Central Atrium Balustrade Guardrails (prevents falling into atrium after exiting elevator on Floor 3)
    const isFloor3 = Math.abs(relY - 10.25) <= 2.25;
    if (isFloor3) {
      this.pushOutLocalBox(pos, -5.3, 5.3, -5.35, -5.05, playerRadius);
      this.pushOutLocalBox(pos, -5.3, 5.3, 3.65, 3.98, playerRadius);
      this.pushOutLocalBox(pos, -5.35, -5.05, -5.3, 3.98, playerRadius);
      this.pushOutLocalBox(pos, 5.05, 5.35, -5.3, 3.98, playerRadius);
    }

    // 3. Central Elevator Shaft Walls & Doorway Guard (Shaft center: lx = 0.0, lz = 8.5)
    this.pushOutLocalBox(pos, -2.25, -1.4, 6.65, 10.45, playerRadius);
    this.pushOutLocalBox(pos, 1.4, 2.25, 6.65, 10.45, playerRadius);
    this.pushOutLocalBox(pos, -2.2, 2.2, 9.65, 10.5, playerRadius);

    // Front elevator entrance (lz = 6.7): solid barrier if cabin is on another floor or doors are closed
    const isCabinAtPlayerFloor = Math.abs(playerPos.y - this.elevatorCabinY) <= 1.25;
    const isElevatorDoorWalkable = isCabinAtPlayerFloor && this.elevatorDoorsOpenRatio >= 0.65;
    if (!isElevatorDoorWalkable) {
      this.pushOutLocalBox(pos, -1.75, 1.75, 6.3, 7.15, playerRadius);
    }

    // 4. Unified Staircase Side-Rail & Upper-Floor Stairwell Opening Guardrails (driven by CASTLE_STAIRCASE_CONFIGS)
    // Never blocks bottom or top staircase entries; keeps player strictly centered on steps during climb
    for (let i = 0; i < CASTLE_STAIRCASE_CONFIGS.length; i++) {
      const sc = CASTLE_STAIRCASE_CONFIGS[i];
      if (!sc.hasLoveRibbon) continue;

      const minY = Math.min(sc.startY, sc.endY);
      const maxY = Math.max(sc.startY, sc.endY);
      const leftRailX = Math.min(sc.railInnerX, sc.railOuterX);
      const rightRailX = Math.max(sc.railInnerX, sc.railOuterX);
      const zMinGuard = sc.startZ + 0.35;
      const zMaxGuard = sc.endZ - 0.25;

      // While climbing/descending the staircase or walking beside the stairwell opening on the upper floor:
      // enforce thin side rail barriers at leftRailX and rightRailX so the player can never slip off the side of a step
      if (relY >= minY + 0.35 && relY <= maxY + 1.25) {
        this.pushOutLocalBox(pos, leftRailX - 0.24, leftRailX + 0.06, zMinGuard, zMaxGuard, playerRadius);
        this.pushOutLocalBox(pos, rightRailX - 0.06, rightRailX + 0.24, zMinGuard, zMaxGuard, playerRadius);
      }

      // On the upper destination floor (Floor 3 for f2_to_f3_east, Floor 4 for f3_to_f4_west),
      // add a protective south-end guardrail at startZ so a player walking on the upper floor
      // cannot accidentally step backward into the deep end of the stairwell opening
      if (
        (sc.id === 'f2_to_f3_east' || sc.id === 'f3_to_f4_west') &&
        relY >= maxY - 0.35 &&
        relY <= maxY + 1.5
      ) {
        this.pushOutLocalBox(
          pos,
          leftRailX - 0.15,
          rightRailX + 0.15,
          sc.startZ - 0.22,
          sc.startZ + 0.12,
          playerRadius,
        );
      }
    }

    playerPos.x = this.originX + pos.lx;
    playerPos.z = this.originZ + pos.lz;
  }

  public isNearEntranceDoors(playerPos: THREE.Vector3): boolean {
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const dist = Math.hypot(lx - this.doorCenterLocalX, lz - this.doorCenterLocalZ);
    return dist <= this.doorProximityRange && Math.abs(playerPos.y - (this.baseY + 0.25)) <= 3.5;
  }

  public isWithinEntranceFramingZone(playerPos: THREE.Vector3): boolean {
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const dist = Math.hypot(lx - this.doorCenterLocalX, lz - this.doorCenterLocalZ);
    return dist <= 9.8 && lz <= -14.5 && Math.abs(playerPos.y - (this.baseY + 0.25)) <= 4.0;
  }

  /**
   * Checks if player is within 2.2m of the central marble fountain basin (radius 2.9m -> center dist <= 5.1m).
   */
  public isNearFountain(playerPos: THREE.Vector3): boolean {
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const dist = Math.hypot(lx, lz);
    return dist <= 5.1 && Math.abs(playerPos.y - (this.baseY + 0.25)) <= 1.8;
  }

  public triggerFountainRipple(): boolean {
    if (this.fountainHologramActive && this.fountainHologramTimer < this.fountainHologramDuration - 0.35) {
      this.fountainHologramActive = false;
      this.fountainHologramTimer = 0.0;
      this.fountainRippleTimer = 2.2;
      this.playChime(659.25, 523.25);
      return true;
    }
    this.fountainHologramActive = true;
    this.fountainHologramTimer = this.fountainHologramDuration;
    this.fountainRippleTimer = this.fountainHologramDuration;
    this.playMusicBoxMelody();
    return true;
  }

  public isFountainHologramVisible(): boolean {
    return this.fountainHologramActive || this.fountainHologramAlpha > 0.01;
  }

  public getActiveFountainCaption(): string | null {
    if (this.activeEntranceCaption) {
      return this.activeEntranceCaption;
    }
    if (this.fountainHologramActive || this.fountainHologramAlpha > 0.15) {
      return this.fountainHologramCaption;
    }
    return null;
  }

  public setEntranceRoseCallback(cb: (held: boolean) => void) {
    this.onEntranceRosePresentedCallback = cb;
  }

  public isInsideElevatorCabin(playerPos: THREE.Vector3): boolean {
    if (this.isElevatorFpvActive) return true;
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const dist = Math.hypot(lx - this.elevatorShaftLocalX, lz - this.elevatorShaftLocalZ);
    return dist <= this.elevatorCabinRadius + 0.35 && Math.abs(playerPos.y - this.elevatorCabinY) <= 1.7;
  }

  /**
   * Checks if the player is standing near the Royal Crystal Elevator entrance on any floor.
   */
  public getNearbyElevatorFloor(playerPos: THREE.Vector3): CastleFloorDef | null {
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const distToShaft = Math.hypot(lx - this.elevatorShaftLocalX, lz - this.elevatorShaftLocalZ);
    if (distToShaft > 4.4) return null;

    for (let i = 0; i < CASTLE_FLOOR_DEFS.length; i++) {
      const f = CASTLE_FLOOR_DEFS[i];
      const floorY = this.baseY + f.elevOffset;
      if (Math.abs(playerPos.y - floorY) <= 1.45) {
        return f;
      }
    }
    return null;
  }

  public isNearElevatorFloorCall(playerPos: THREE.Vector3): { floor: CastleFloorDef; dist: number } | null {
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const distToShaft = Math.hypot(lx - this.elevatorShaftLocalX, lz - this.elevatorShaftLocalZ);
    if (distToShaft > 4.4) return null;

    const floor = this.getNearbyElevatorFloor(playerPos);
    if (!floor) return null;
    return { floor, dist: distToShaft };
  }

  /**
   * Enters the Royal Crystal Elevator in First-Person View (FPV):
   * 1. Opens elevator doors & brings cabin to the player's floor.
   * 2. Moves player to cabin center.
   * 3. Switches to FPV (eye height = cabinY + 1.55m) with full 360° look.
   */
  public enterElevatorFpv(playerPos: THREE.Vector3): boolean {
    const floor = this.getNearbyElevatorFloor(playerPos);
    const targetFloorId = floor ? floor.id : this.elevatorFloorIndex;
    const floorDef =
      CASTLE_FLOOR_DEFS.find((f) => f.id === targetFloorId) || CASTLE_FLOOR_DEFS[1];
    const floorY = this.baseY + floorDef.elevOffset;

    this.elevatorFloorIndex = floorDef.id;
    this.elevatorTargetFloorIndex = floorDef.id;
    this.elevatorCabinY = floorY;
    this.elevatorDoorsOpenRatio = 1.0;
    this.elevatorState = 'IDLE';
    this.isElevatorFpvActive = true;

    playerPos.set(
      this.originX + this.elevatorShaftLocalX,
      this.elevatorCabinY,
      this.originZ + this.elevatorShaftLocalZ,
    );
    this.playChime(587.33, 880.0);
    return true;
  }

  /**
   * Exits the Royal Crystal Elevator FPV mode and steps the player cleanly onto the current/target floor landing.
   */
  public exitElevatorFpv(playerPos: THREE.Vector3): boolean {
    if (!this.isElevatorFpvActive && !this.isInsideElevatorCabin(playerPos)) {
      return false;
    }

    // Ensure the cabin is snapped to the target floor slab if the player steps out while arriving/moving
    const targetDef =
      CASTLE_FLOOR_DEFS.find((f) => f.id === this.elevatorTargetFloorIndex) ||
      CASTLE_FLOOR_DEFS.find((f) => f.id === this.elevatorFloorIndex) ||
      CASTLE_FLOOR_DEFS[1];
    this.elevatorFloorIndex = targetDef.id;
    this.elevatorTargetFloorIndex = targetDef.id;
    this.elevatorCabinY = this.baseY + targetDef.elevOffset;

    this.isElevatorFpvActive = false;
    this.elevatorDoorsOpenRatio = 1.0;
    this.elevatorState = 'IDLE';

    // Place player at lz = 5.85 (0.8m south of the elevator doors at lz = 6.65),
    // squarely on the solid Elevator Lobby slab on all 5 floors.
    playerPos.set(
      this.originX + this.elevatorShaftLocalX,
      this.elevatorCabinY,
      this.originZ + 5.85,
    );
    this.playChime(659.25, 523.25);
    return true;
  }

  public openEntranceDoors(): boolean {
    if (this.doorState === 'CLOSED' && !this.hasTriggeredEntranceReveal) {
      this.triggerEntranceCinematicTilt();
      return true;
    }
    if (this.doorState === 'CLOSED') {
      this.doorState = 'OPENING';
      this.playDoorCreak();
      return true;
    }
    return false;
  }

  public getCurrentEntranceDialogue(): AuroraDialogueLine | null {
    if (
      !this.activeCameraFocus ||
      this.activeCameraFocus.mode !== 'entrance' ||
      this.entranceBeatIndex < 0 ||
      this.entranceBeatIndex >= CASTLE_ENTRANCE_DIALOGUE.length
    ) {
      return null;
    }
    return CASTLE_ENTRANCE_DIALOGUE[this.entranceBeatIndex] ?? null;
  }

  public advanceEntranceCinematicBeat(): boolean {
    if (!this.activeCameraFocus || this.activeCameraFocus.mode !== 'entrance') {
      return false;
    }
    if (this.entranceBeatIndex < 6) {
      this.entranceBeatIndex += 1;
      this.activeCameraFocus.elapsed =
        CastleNavigationController.ENTRANCE_BEAT_STARTS[this.entranceBeatIndex];
      if (this.entranceBeatIndex >= 4 && this.doorState === 'CLOSED') {
        this.doorState = 'OPENING';
        this.playDoorCreak();
      }
      return true;
    }
    if (this.entranceBeatIndex === 6) {
      this.entranceBeatIndex = 7;
      this.finalizeEntranceAwakeningState();
      this.activeCameraFocus.elapsed =
        CastleNavigationController.ENTRANCE_BEAT_STARTS[7];
      return true;
    }
    this.skipCameraFocus();
    return true;
  }

  public callElevatorToFloor(floorId: number): boolean {
    let targetDef: CastleFloorDef | undefined;
    for (let i = 0; i < CASTLE_FLOOR_DEFS.length; i++) {
      if (CASTLE_FLOOR_DEFS[i].id === floorId) {
        targetDef = CASTLE_FLOOR_DEFS[i];
        break;
      }
    }
    if (!targetDef) return false;

    if (
      this.elevatorTargetFloorIndex === floorId &&
      Math.abs(this.elevatorCabinY - (this.baseY + targetDef.elevOffset)) <= 0.15 &&
      this.elevatorDoorsOpenRatio >= 0.9
    ) {
      return false;
    }

    this.elevatorTargetFloorIndex = floorId;
    if (this.elevatorDoorsOpenRatio > 0.05) {
      this.elevatorState = 'CLOSING';
    } else {
      this.elevatorState = 'MOVING';
    }
    return true;
  }

  public cycleElevatorFloor(): boolean {
    return false;
  }

  private focusYawOffset = 0;
  private focusPitchOffset = 0;

  public applyFocusLookDelta(deltaYaw: number, deltaPitch: number) {
    if (!this.activeCameraFocus) return;
    this.focusYawOffset -= deltaYaw;
    this.focusPitchOffset = THREE.MathUtils.clamp(
      this.focusPitchOffset + deltaPitch,
      -0.85,
      0.85,
    );
  }

  public triggerEntranceCinematicTilt(_playerPos?: THREE.Vector3) {
    if (this.hasTriggeredEntranceReveal) return;
    this.hasTriggeredEntranceReveal = true;
    this.entranceBeatIndex = 0;
    this.activeEntranceCaption = null;
    this.focusYawOffset = 0;
    this.focusPitchOffset = 0;

    this.entranceSeatWorldPos.set(this.originX - 0.52, this.baseY + 0.18, this.originZ - 19.25);
    // Pass A Requirement: Initial camera begins from front-left / 3/4 cinematic angle showing Harsha, entrance steps, heart lanterns & doorway
    this.focusCamPos.set(this.originX - 3.4, this.baseY + 2.15, this.originZ - 23.6);
    this.focusTargetPos.set(this.originX - 0.4, this.baseY + 2.4, this.originZ - 17.5);
    this.activeCameraFocus = {
      mode: 'entrance',
      position: this.focusCamPos,
      target: this.focusTargetPos,
      fov: 56,
      duration: 16.5,
      elapsed: 0,
      blendAlpha: 0,
      seatWorldPos: this.entranceSeatWorldPos,
      seatYaw: 0.28,
    };
  }

  public triggerRooftopPanoramicPan(_playerPos: THREE.Vector3, force = false) {
    if (this.hasTriggeredRooftopReveal && !force) return;
    this.hasTriggeredRooftopReveal = true;
    this.focusYawOffset = 0;
    this.focusPitchOffset = 0;

    this.focusCamPos.set(this.originX, this.baseY + 17.8, this.originZ - 6.5);
    this.focusTargetPos.set(this.originX - 15.5, this.baseY + 26.0, this.originZ - 15.5);
    this.activeCameraFocus = {
      mode: 'rooftop',
      position: this.focusCamPos,
      target: this.focusTargetPos,
      fov: 65,
      duration: 3.8,
      elapsed: 0,
      blendAlpha: 0,
    };
  }

  private finalizeEntranceAwakeningState() {
    this.primaryTreeAwake = 1.0;
    this.secondaryTreeAwake = 1.0;
    this.castleWindowsAwake = 1.0;
    this.doorState = 'OPEN';
    this.doorOpenRatio = 1.0;
    this.doorHandleAngle = 0.0;
    this.yeshwanthWalkProgress = 1.0;
    this.yeshwanthRoseExtend = 0.35;
    this.activeEntranceCaption = null;
    if (!this.entranceRosePresented) {
      this.entranceRosePresented = true;
      if (this.onEntranceRosePresentedCallback) {
        this.onEntranceRosePresentedCallback(true);
      }
    }
  }

  public skipCameraFocus() {
    if (!this.activeCameraFocus) return;
    if (this.activeCameraFocus.mode === 'entrance') {
      this.entranceBeatIndex = 7;
      this.finalizeEntranceAwakeningState();
    }
    this.activeCameraFocus.elapsed = Math.max(
      this.activeCameraFocus.elapsed,
      this.activeCameraFocus.duration - 0.4,
    );
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;

    // 0. Fountain ripple & 7-second hologram projection state machine
    if (this.fountainRippleTimer > 0) {
      this.fountainRippleTimer = Math.max(0, this.fountainRippleTimer - delta);
    }

    if (this.fountainHologramActive) {
      this.fountainHologramTimer = Math.max(0, this.fountainHologramTimer - delta);
      const distFromFountain = Math.hypot(lx, lz);
      if (
        this.fountainHologramTimer <= 0 ||
        distFromFountain > 6.5 ||
        Math.abs(playerPos.y - (this.baseY + 0.25)) > 2.5
      ) {
        this.fountainHologramActive = false;
        this.fountainHologramTimer = 0;
      }
    }

    const shouldShowHologram =
      this.fountainHologramActive && this.fountainHologramTimer > 0.5;
    if (shouldShowHologram) {
      this.fountainHologramAlpha = Math.min(
        1.0,
        this.fountainHologramAlpha + delta * 2.2,
      );
    } else {
      this.fountainHologramAlpha = Math.max(
        0.0,
        this.fountainHologramAlpha - delta * 1.6,
      );
    }

    // 1. Door opening state machine
    if (this.doorState === 'OPENING') {
      this.doorOpenRatio = Math.min(1.0, this.doorOpenRatio + delta * 0.52);
      if (this.doorOpenRatio < 0.35) {
        this.doorHandleAngle = Math.min(0.65, this.doorHandleAngle + delta * 2.4);
      } else {
        this.doorHandleAngle = Math.max(0.0, this.doorHandleAngle - delta * 1.5);
      }
      if (this.doorOpenRatio >= 1.0) {
        this.doorState = 'OPEN';
        this.doorHandleAngle = 0.0;
      }
    }

    // Check rooftop arrival for panoramic pan
    if (!this.hasTriggeredRooftopReveal) {
      if (Math.abs(lx) <= 15.0 && Math.abs(lz) <= 15.0 && playerPos.y >= this.baseY + 14.5) {
        this.triggerRooftopPanoramicPan(playerPos);
      }
    }

    // Camera cinematic animation progress
    if (this.activeCameraFocus) {
      if (this.activeCameraFocus.mode === 'entrance') {
        const stopT =
          CastleNavigationController.ENTRANCE_BEAT_STOPS[this.entranceBeatIndex] ??
          this.activeCameraFocus.duration;
        this.activeCameraFocus.elapsed = Math.min(
          stopT,
          this.activeCameraFocus.elapsed + delta,
        );
      } else {
        this.activeCameraFocus.elapsed += delta;
      }
      const totalDur = this.activeCameraFocus.duration;
      const e = this.activeCameraFocus.elapsed;
      const u = THREE.MathUtils.clamp(e / totalDur, 0, 1);

      const entryAlpha = smoothStep01(e / 0.55);
      const remaining = Math.max(0, totalDur - e);
      const exitAlpha = smoothStep01(remaining / 0.65);
      this.activeCameraFocus.blendAlpha = Math.min(entryAlpha, exitAlpha);

      if (this.activeCameraFocus.mode === 'entrance') {
        // Multi-beat Romantic Grand Castle Entrance Sequence (7 explicit player-confirmed beats)
        this.activeEntranceCaption = null;
        this.primaryTreeAwake = smoothStep01((e - 2.1) / 1.4);
        this.secondaryTreeAwake = smoothStep01((e - 3.5) / 1.4);
        this.castleWindowsAwake = smoothStep01((e - 5.1) / 2.2);

        if (e >= 2.2 && !this.playedPrimaryTreeChime) {
          this.playedPrimaryTreeChime = true;
          this.playChime(523.25, 659.25);
        }
        if (e >= 3.6 && !this.playedSecondaryTreeChime) {
          this.playedSecondaryTreeChime = true;
          this.playChime(659.25, 783.99);
        }
        if (e >= 5.2 && !this.playedWindowsChime) {
          this.playedWindowsChime = true;
          this.playChime(783.99, 1046.5);
        }
        if (e >= 7.5 && !this.playedDoorsCreak) {
          this.playedDoorsCreak = true;
          if (this.doorState === 'CLOSED') {
            this.doorState = 'OPENING';
            this.playDoorCreak();
          }
        }

        // Yeshwanth walks from Grand Hall threshold (lz = -15.4) to entrance steps (lz = -18.35)
        this.yeshwanthWalkProgress = smoothStep01((e - 9.8) / 2.4);

        // Rose presentation gesture (12.4s -> 14.0s, then subtle hold)
        if (e < 12.4) {
          this.yeshwanthRoseExtend = 0.0;
        } else if (e < 14.2) {
          this.yeshwanthRoseExtend = smoothStep01((e - 12.4) / 1.1);
        } else {
          this.yeshwanthRoseExtend = THREE.MathUtils.lerp(1.0, 0.35, smoothStep01((e - 14.2) / 1.2));
        }

        if (e >= 13.2 && !this.entranceRosePresented) {
          this.entranceRosePresented = true;
          if (!this.playedRoseMelody) {
            this.playedRoseMelody = true;
            this.playMusicBoxMelody();
          }
          if (this.onEntranceRosePresentedCallback) {
            this.onEntranceRosePresentedCallback(true);
          }
        }

        // Camera Choreography across the 7 romantic beats (captions rendered via AuroraDialogueCard):
        let camLX = 0;
        let camLY = 2.2;
        let camLZ = -24.5;
        let lookLX = 0;
        let lookLY = 2.8;
        let lookLZ = -16.0;
        let fov = 56;

        if (e < 2.2) {
          // Beat 1: CASTLE APPROACH & FRONT-LEFT 3/4 ANGLE (0.0s - 2.15s)
          // Starts strictly front-left / 3/4 (not rear follow): Harsha, entrance steps, heart lanterns and doorway are all visible
          const b = smoothStep01(e / 2.15);
          camLX = THREE.MathUtils.lerp(-3.4, -3.8, b);
          camLY = THREE.MathUtils.lerp(2.15, 2.45, b);
          camLZ = THREE.MathUtils.lerp(-23.6, -24.2, b);
          lookLX = THREE.MathUtils.lerp(-0.4, -1.2, b);
          lookLY = THREE.MathUtils.lerp(2.4, 3.2, b);
          lookLZ = THREE.MathUtils.lerp(-17.5, -17.2, b);
          fov = 56;
        } else if (e < 5.2) {
          // Beat 2: HEART TREE & GARDEN FLOWER AWAKENING (2.2s - 5.15s: Twin trees bloom in warm light)
          if (e < 3.7) {
            const b = smoothStep01((e - 2.2) / 1.5);
            camLX = THREE.MathUtils.lerp(-3.8, -3.2, b);
            camLY = THREE.MathUtils.lerp(2.45, 2.85, b);
            camLZ = THREE.MathUtils.lerp(-24.2, -25.8, b);
            lookLX = THREE.MathUtils.lerp(-1.2, -6.5, b);
            lookLY = THREE.MathUtils.lerp(3.2, 4.2, b);
            lookLZ = THREE.MathUtils.lerp(-17.2, -19.0, b);
          } else {
            const b = smoothStep01((e - 3.7) / 1.45);
            camLX = THREE.MathUtils.lerp(-3.2, 1.8, b);
            camLY = THREE.MathUtils.lerp(2.85, 3.15, b);
            camLZ = THREE.MathUtils.lerp(-25.8, -26.5, b);
            lookLX = THREE.MathUtils.lerp(-6.5, 6.5, b);
            lookLY = THREE.MathUtils.lerp(4.2, 4.4, b);
            lookLZ = THREE.MathUtils.lerp(-19.0, -19.0, b);
          }
          fov = 56;
        } else if (e < 7.6) {
          // Beat 3: PROGRESSIVE LIGHTING & SLOW CINEMATIC DOLLY-OUT (5.2s - 7.55s)
          // Camera slowly pulls backward and rises slightly to reveal the entire illuminated facade, crystals & spires
          const b = smoothStep01((e - 5.2) / 2.35);
          camLX = THREE.MathUtils.lerp(1.8, -0.6, b);
          camLY = THREE.MathUtils.lerp(3.15, 4.45, b); // slight upward rise
          camLZ = THREE.MathUtils.lerp(-26.5, -29.2, b); // slow backward dolly-out
          lookLX = THREE.MathUtils.lerp(6.5, 0.0, b);
          lookLY = THREE.MathUtils.lerp(4.4, 6.5, b);
          lookLZ = THREE.MathUtils.lerp(-19.0, -16.0, b);
          fov = 58;
        } else if (e < 10.2) {
          // Beat 4: GRAND DOORS OPEN & FULL CASTLE WIDE SHOT (7.6s - 10.15s)
          // Holds the wide castle reveal while doors open revealing Chandelier Hall inside, then glides toward profile two-shot
          const b = smoothStep01((e - 7.6) / 2.55);
          camLX = THREE.MathUtils.lerp(-0.6, -2.45, b);
          camLY = THREE.MathUtils.lerp(4.45, 2.25, b);
          camLZ = THREE.MathUtils.lerp(-29.2, -21.4, b);
          lookLX = THREE.MathUtils.lerp(0.0, 0.0, b);
          lookLY = THREE.MathUtils.lerp(6.5, 2.65, b);
          lookLZ = THREE.MathUtils.lerp(-16.0, -9.5, b);
          fov = THREE.MathUtils.lerp(58, 54, b);
        } else if (e < 12.6) {
          // Beat 5: Yeshwanth APPEARS & DIALOGUE (10.2s - 12.55s)
          // Camera glides smoothly into a romantic profile two-shot showing Harsha, doorway & Yeshwanth
          const b = smoothStep01((e - 10.2) / 2.35);
          camLX = THREE.MathUtils.lerp(-1.65, -2.65, b);
          camLY = THREE.MathUtils.lerp(2.25, 1.55, b);
          camLZ = THREE.MathUtils.lerp(-21.2, -21.4, b);
          lookLX = THREE.MathUtils.lerp(0.0, 0.05, b);
          lookLY = THREE.MathUtils.lerp(2.65, 1.38, b);
          lookLZ = THREE.MathUtils.lerp(-6.0, -18.7, b);
          fov = THREE.MathUtils.lerp(54, 43, b);
        } else if (e < 14.0) {
          // Beat 6: ROSE PROPOSAL & PRESENTATION (12.6s - 13.95s)
          // Unobstructed, intimate two-shot: Harsha on left profile, glowing rose in center, Yeshwanth on right
          const b = smoothStep01((e - 12.6) / 1.35);
          camLX = THREE.MathUtils.lerp(-2.65, -2.85, b);
          camLY = THREE.MathUtils.lerp(1.55, 1.48, b);
          camLZ = THREE.MathUtils.lerp(-21.4, -21.6, b);
          lookLX = THREE.MathUtils.lerp(0.05, 0.05, b);
          lookLY = THREE.MathUtils.lerp(1.38, 1.34, b);
          lookLZ = THREE.MathUtils.lerp(-18.7, -18.7, b);
          fov = 43;
        } else {
          // Beat 7: FINAL ROMANTIC SHOT (14.0s - 15.4s hold, then 15.95s - 16.5s exit release)
          // Gentle slow cinematic drift maintaining clear view of both lovers and the glowing rose
          const b = smoothStep01((e - 14.0) / 1.4);
          camLX = THREE.MathUtils.lerp(-2.85, -3.15, b);
          camLY = THREE.MathUtils.lerp(1.48, 1.62, b);
          camLZ = THREE.MathUtils.lerp(-21.6, -22.4, b);
          lookLX = 0.05;
          lookLY = THREE.MathUtils.lerp(1.34, 1.42, b);
          lookLZ = -18.7;
          fov = THREE.MathUtils.lerp(43, 46, b);
        }

        this.activeCameraFocus.position.set(
          this.originX + camLX,
          this.baseY + camLY,
          this.originZ + camLZ,
        );
        this.activeCameraFocus.target.set(
          this.originX + lookLX,
          this.baseY + lookLY,
          this.originZ + lookLZ,
        );
        this.activeCameraFocus.fov = fov;
      } else if (this.activeCameraFocus.mode === 'rooftop') {
        const sweepEase = smoothStep01(u);
        const wpLen = this.rooftopSweepWaypoints.length;
        const scaled = sweepEase * (wpLen - 1);
        const idx = Math.min(Math.floor(scaled), wpLen - 2);
        const frac = scaled - idx;
        this.activeCameraFocus.target.lerpVectors(
          this.rooftopSweepWaypoints[idx],
          this.rooftopSweepWaypoints[idx + 1],
          frac,
        );
      }

      if (Math.abs(this.focusYawOffset) > 0.0001 || Math.abs(this.focusPitchOffset) > 0.0001) {
        const dx = this.activeCameraFocus.target.x - this.activeCameraFocus.position.x;
        const dy = this.activeCameraFocus.target.y - this.activeCameraFocus.position.y;
        const dz = this.activeCameraFocus.target.z - this.activeCameraFocus.position.z;
        const dist = Math.hypot(dx, dy, dz) || 1.0;
        const baseYaw = Math.atan2(dx, dz);
        const basePitch = Math.asin(THREE.MathUtils.clamp(-dy / dist, -0.96, 0.96));
        const finalYaw = baseYaw + this.focusYawOffset;
        const finalPitch = THREE.MathUtils.clamp(basePitch + this.focusPitchOffset, -0.92, 0.92);
        this.activeCameraFocus.target.set(
          this.activeCameraFocus.position.x + Math.sin(finalYaw) * Math.cos(finalPitch) * dist,
          this.activeCameraFocus.position.y - Math.sin(finalPitch) * dist,
          this.activeCameraFocus.position.z + Math.cos(finalYaw) * Math.cos(finalPitch) * dist,
        );
      }

      if (this.activeCameraFocus.elapsed >= totalDur) {
        if (this.activeCameraFocus.mode === 'entrance') {
          this.finalizeEntranceAwakeningState();
        }
        this.activeCameraFocus = null;
        this.focusYawOffset = 0;
        this.focusPitchOffset = 0;
      }
    }

    // 2. Elevator state machine
    let targetFloorDef = CASTLE_FLOOR_DEFS[1];
    for (let i = 0; i < CASTLE_FLOOR_DEFS.length; i++) {
      if (CASTLE_FLOOR_DEFS[i].id === this.elevatorTargetFloorIndex) {
        targetFloorDef = CASTLE_FLOOR_DEFS[i];
        break;
      }
    }
    const targetY = this.baseY + targetFloorDef.elevOffset;

    switch (this.elevatorState) {
      case 'IDLE':
        this.elevatorDoorsOpenRatio = Math.min(1.0, this.elevatorDoorsOpenRatio + delta * 1.5);
        break;

      case 'CLOSING':
        this.elevatorDoorsOpenRatio = Math.max(0.0, this.elevatorDoorsOpenRatio - delta * 1.6);
        if (this.elevatorDoorsOpenRatio <= 0.01) {
          this.elevatorDoorsOpenRatio = 0.0;
          this.elevatorState = 'MOVING';
        }
        break;

      case 'MOVING': {
        const dist = targetY - this.elevatorCabinY;
        const speed = 3.6;
        if (Math.abs(dist) < 0.08) {
          this.elevatorCabinY = targetY;
          this.elevatorFloorIndex = this.elevatorTargetFloorIndex;
          this.elevatorState = 'OPENING';
          this.playChime();
        } else {
          const dir = Math.sign(dist);
          this.elevatorCabinY += dir * speed * delta;
        }
        break;
      }

      case 'OPENING':
        this.elevatorDoorsOpenRatio = Math.min(1.0, this.elevatorDoorsOpenRatio + delta * 1.5);
        if (this.elevatorDoorsOpenRatio >= 0.99) {
          this.elevatorDoorsOpenRatio = 1.0;
          this.elevatorState = 'IDLE';
        }
        break;
    }

    // Keep player anchored at cabin center while in Elevator FPV mode
    if (this.isElevatorFpvActive) {
      playerPos.x = this.originX + this.elevatorShaftLocalX;
      playerPos.z = this.originZ + this.elevatorShaftLocalZ;
      playerPos.y = this.elevatorCabinY;
    }
  }

  /**
   * Evaluates the multi-floor surface height at world coordinate (wx, wz) given the player's current vertical Y.
   * Zero per-frame allocations; exact match with visual staircase geometry.
   */
  public getSurfaceHeight(wx: number, wz: number, playerY: number, defaultGroundY: number): number {
    if (this.isElevatorFpvActive) {
      return this.elevatorCabinY;
    }

    const lx = wx - this.originX;
    const lz = wz - this.originZ;

    // Connected Little Dream World circular plateau (center lx = 33.0, lz = 12.0, radius <= 8.25m at Floor 2 height)
    if (
      Math.hypot(lx - 33.0, lz - 12.0) <= 8.25 &&
      Math.abs(playerY - (this.baseY + 5.25)) <= 2.5
    ) {
      return this.baseY + 5.25;
    }

    if (Math.abs(lx) > 23.0 || lz < -23.0 || lz > 45.0) {
      return defaultGroundY;
    }

    // Rear Castle Garden: Arched Footbridge over Reflective Pond (lz: 24.0..29.2, |lx| <= 1.45)
    if (lz >= 24.0 && lz <= 29.2 && Math.abs(lx) <= 1.45) {
      const bridgeU = THREE.MathUtils.clamp((lz - 24.0) / 5.2, 0, 1);
      const archH = Math.sin(bridgeU * Math.PI) * 0.55;
      return defaultGroundY + archH + 0.1;
    }

    // Rear Castle Garden: Central Belvedere Gazebo Floor (lz = 32.5, radius <= 3.95m)
    const distToGazebo = Math.hypot(lx, lz - 32.5);
    if (distToGazebo <= 3.95) {
      const gazGround = getTerrainHeight(this.originX, this.originZ + 32.5);
      return gazGround + 0.48;
    }

    // Rear Garden Promenade Steps (lz: 16.0..18.5, |lx| <= 3.5)
    if (lz > 16.0 && lz <= 18.5 && Math.abs(lx) <= 3.5) {
      const stepT = THREE.MathUtils.clamp((lz - 16.0) / 2.5, 0, 1);
      return THREE.MathUtils.lerp(this.baseY + 0.25, defaultGroundY + 0.06, stepT);
    }

    if (lz > 18.0) {
      return defaultGroundY;
    }

    // 1. Elevator cabin floor & doorway threshold pad
    const distToShaft = Math.hypot(lx - this.elevatorShaftLocalX, lz - this.elevatorShaftLocalZ);
    if (distToShaft <= this.elevatorCabinRadius + 0.95 && Math.abs(playerY - this.elevatorCabinY) <= 1.85) {
      return this.elevatorCabinY;
    }

    // 2. Walkable Staircases & Ramps (Single Source of Truth via CASTLE_STAIRCASE_CONFIGS)
    // Exterior entrance steps / ramp: lz [-22, -15.8], lx [-5.8, 5.8]
    if (lz >= -22.0 && lz <= -15.8 && Math.abs(lx) <= 5.8) {
      const rampT = THREE.MathUtils.clamp((lz - -22.0) / 6.2, 0, 1);
      const rampY = THREE.MathUtils.lerp(this.baseY - 0.25, this.baseY + 0.25, rampT);
      if (Math.abs(playerY - rampY) <= 1.7) {
        return rampY;
      }
    }

    // Evaluate all interior staircases from CASTLE_STAIRCASE_CONFIGS with overlapping landing buffers
    // so bottom landing -> steps -> top landing -> destination floor slab is 100% continuous with zero gaps
    for (let i = 0; i < CASTLE_STAIRCASE_CONFIGS.length; i++) {
      const sc = CASTLE_STAIRCASE_CONFIGS[i];
      const ob = sc.openingBounds;
      if (
        lx >= ob.minX - 0.08 &&
        lx <= ob.maxX + 0.08 &&
        lz >= sc.startZ - 0.25 &&
        lz <= sc.endZ + 0.25
      ) {
        const spanZ = sc.endZ - sc.startZ;
        const stairT = THREE.MathUtils.clamp((lz - sc.startZ) / spanZ, 0, 1);
        const rampY = THREE.MathUtils.lerp(this.baseY + sc.startY, this.baseY + sc.endY, stairT);
        if (Math.abs(playerY - rampY) <= 1.95) {
          return rampY;
        }
      }
    }

    // 3. Multi-Floor Horizontal Slabs (evaluated inline with zero array allocation)
    let bestSurface = defaultGroundY;
    let foundSlab = false;

    // Level -1: Basement Vault (|lx| <= 14, |lz| <= 14)
    if (Math.abs(lx) <= 14.0 && Math.abs(lz) <= 14.0) {
      const h = this.baseY - 4.5;
      if (h <= playerY + 0.85) {
        bestSurface = h;
        foundSlab = true;
      }
    }

    // Level 1: Grand Entrance Hall (|lx| <= 18, |lz| <= 18)
    if (Math.abs(lx) <= 18.0 && Math.abs(lz) <= 18.0) {
      const bOpen = CASTLE_STAIRCASE_CONFIGS[4].openingBounds;
      const isBasementStairHole =
        lx > bOpen.minX + 0.02 &&
        lx < bOpen.maxX - 0.02 &&
        lz > bOpen.minZ + 0.1 &&
        lz < bOpen.maxZ - 0.05;
      if (!isBasementStairHole) {
        const h = this.baseY + 0.25;
        if (h <= playerY + 0.85 && (!foundSlab || h > bestSurface)) {
          bestSurface = h;
          foundSlab = true;
        }
      }
    }

    // Level 2: Mezzanine Gallery (|lx| <= 17, |lz| <= 17; clear opening above central atrium & twin staircases,
    // with solid Elevator Lobby Bridge at |lx| <= 5.2, lz >= 3.8 so stepping out of the elevator never drops down)
    if (Math.abs(lx) <= 17.0 && Math.abs(lz) <= 17.0) {
      const isTwinStair12Open =
        Math.abs(lx) >= 5.18 && Math.abs(lx) < 8.58 && lz > -5.95 && lz < 5.92;
      const isCentralAtrium2Open =
        Math.abs(lx) < 5.18 && lz > -5.95 && lz < 3.8;
      if (!isTwinStair12Open && !isCentralAtrium2Open) {
        const h = this.baseY + 5.25;
        if (h <= playerY + 0.85 && (!foundSlab || h > bestSurface)) {
          bestSurface = h;
          foundSlab = true;
        }
      }
    }

    // Level 3: Dream Wing Gallery (|lx| <= 17, |lz| <= 17; clear opening above central atrium & East Stair 2->3,
    // with solid Elevator Lobby Bridge at |lx| <= 5.2, lz >= 3.8)
    if (Math.abs(lx) <= 17.0 && Math.abs(lz) <= 17.0) {
      const isCentralAtriumOpen = Math.abs(lx) < 5.15 && lz > -5.15 && lz < 3.8;
      const s23 = CASTLE_STAIRCASE_CONFIGS[2].openingBounds;
      const isStair23Open =
        lx > s23.minX + 0.02 &&
        lx < s23.maxX - 0.02 &&
        lz > s23.minZ + 0.05 &&
        lz < s23.maxZ - 0.05;
      if (!isCentralAtriumOpen && !isStair23Open) {
        const h = this.baseY + 10.25;
        if (h <= playerY + 0.85 && (!foundSlab || h > bestSurface)) {
          bestSurface = h;
          foundSlab = true;
        }
      }
    }

    // Level 4: Rooftop Observatory Terrace (|lx| <= 16, |lz| <= 16; clear opening above West Stair 3->4)
    if (Math.abs(lx) <= 16.0 && Math.abs(lz) <= 16.0) {
      const s34 = CASTLE_STAIRCASE_CONFIGS[3].openingBounds;
      const isStair34Open =
        lx > s34.minX + 0.02 &&
        lx < s34.maxX - 0.02 &&
        lz > s34.minZ + 0.05 &&
        lz < s34.maxZ - 0.05;
      if (!isStair34Open) {
        const h = this.baseY + 15.25;
        if (h <= playerY + 0.85 && (!foundSlab || h > bestSurface)) {
          bestSurface = h;
          foundSlab = true;
        }
      }
    }

    if (foundSlab) {
      return bestSurface;
    }

    if (Math.abs(lx) <= 18.0 && Math.abs(lz) <= 18.0) {
      return Math.max(defaultGroundY, this.baseY + 0.25);
    }

    return defaultGroundY;
  }

  /**
   * Returns the world Y height of the ceiling slab directly above the player's current floor at (wx, wz),
   * or null if the sky/atrium/stairwell is open above. Prevents head-bonking or ceiling camera clipping.
   */
  public getCeilingHeight(wx: number, wz: number, playerY: number): number | null {
    const lx = wx - this.originX;
    const lz = wz - this.originZ;
    if (Math.abs(lx) > 16.5 || Math.abs(lz) > 16.5) {
      return null;
    }

    const relY = playerY - this.baseY;

    // Basement (-4.5m) -> Ceiling is Floor 1 slab (-0.15m bottom face, open at basement stairwell)
    if (relY < -1.0) {
      const bOpen = CASTLE_STAIRCASE_CONFIGS[4].openingBounds;
      if (lx >= bOpen.minX && lx <= bOpen.maxX && lz >= bOpen.minZ && lz <= bOpen.maxZ) {
        return this.baseY + 4.9;
      }
      return this.baseY - 0.15;
    }

    // Floor 1 (+0.25m) -> Open above central atrium and twin sweeping staircases (|lx| < 8.8, |lz| < 6.2)
    if (relY < 4.6) {
      if (Math.abs(lx) < 8.8 && Math.abs(lz) < 6.2) {
        return this.baseY + 15.0;
      }
      return this.baseY + 4.9;
    }

    // Floor 2 (+5.25m) -> Open above central atrium and East Stair 2->3
    if (relY < 9.6) {
      const s23 = CASTLE_STAIRCASE_CONFIGS[2].openingBounds;
      if (
        (Math.abs(lx) < 5.2 && Math.abs(lz) < 5.2) ||
        (lx >= s23.minX - 0.2 && lx <= s23.maxX + 0.2 && lz >= s23.minZ - 0.2 && lz <= s23.maxZ + 0.2)
      ) {
        return this.baseY + 15.0;
      }
      return this.baseY + 9.9;
    }

    // Floor 3 (+10.25m) -> Open above West Stair 3->4
    if (relY < 14.2) {
      const s34 = CASTLE_STAIRCASE_CONFIGS[3].openingBounds;
      if (lx >= s34.minX - 0.2 && lx <= s34.maxX + 0.2 && lz >= s34.minZ - 0.2 && lz <= s34.maxZ + 0.2) {
        return null;
      }
      return this.baseY + 14.8;
    }

    // Floor 4 Rooftop (+15.25m) -> Open sky
    return null;
  }

  /**
   * Validates that every staircase in CASTLE_STAIRCASE_CONFIGS physically connects its source and
   * destination floor slabs with exact top-surface Y alignment, horizontal landing overlap,
   * stairwell opening containment, and >= 2.4m vertical headroom clearance.
   */
  public validateStaircaseConnections(): boolean {
    let allValid = true;
    for (let i = 0; i < CASTLE_STAIRCASE_CONFIGS.length; i++) {
      const sc = CASTLE_STAIRCASE_CONFIGS[i];
      const fromFloor = CASTLE_FLOOR_DEFS.find((f) => f.id === sc.fromFloorId);
      const toFloor = CASTLE_FLOOR_DEFS.find((f) => f.id === sc.toFloorId);

      if (!fromFloor || !toFloor) {
        console.error(`[STAIRCASE ERROR] ${sc.id}: Missing floor definition`);
        allValid = false;
        continue;
      }

      // 1. Check bottom step Y matches source floor surface Y
      if (Math.abs(sc.startY - fromFloor.elevOffset) > 0.02) {
        console.error(
          `[STAIRCASE ERROR] ${sc.id}: startY (${sc.startY}) != sourceFloorY (${fromFloor.elevOffset})`,
        );
        allValid = false;
      }

      // 2. Check final step top Y matches destination floor surface Y
      const computedEndY = sc.startY + sc.stepCount * sc.stepHeight;
      if (Math.abs(computedEndY - toFloor.elevOffset) > 0.02 || Math.abs(sc.endY - toFloor.elevOffset) > 0.02) {
        console.error(
          `[STAIRCASE ERROR] ${sc.id}: lastStep.topY (${computedEndY}) != destinationFloorY (${toFloor.elevOffset})`,
        );
        allValid = false;
      }

      // 3. Check horizontal landing overlap at bottom (startZ) and top (endZ)
      const bottomTouchesStart =
        sc.bottomLandingBounds.maxZ >= sc.startZ - 0.02 &&
        sc.bottomLandingBounds.minZ <= sc.startZ + 0.02;
      const topTouchesEnd =
        sc.topLandingBounds.minZ <= sc.endZ + 0.02 &&
        sc.topLandingBounds.maxZ >= sc.endZ - 0.02;
      if (!bottomTouchesStart || !topTouchesEnd) {
        console.error(
          `[STAIRCASE ERROR] ${sc.id}: Landing horizontal discontinuity at startZ=${sc.startZ} or endZ=${sc.endZ}`,
        );
        allValid = false;
      }

      // 4. Check stairwell opening width >= stairWidth
      const openingWidth = sc.openingBounds.maxX - sc.openingBounds.minX;
      if (openingWidth + 0.01 < sc.stairWidth) {
        console.error(
          `[STAIRCASE ERROR] ${sc.id}: openingWidth (${openingWidth}) < stairWidth (${sc.stairWidth})`,
        );
        allValid = false;
      }

      // 5. Check headroom clearance along the staircase climb
      for (let s = 1; s <= sc.stepCount; s++) {
        const u = (s - 0.5) / sc.stepCount;
        const stepZ = THREE.MathUtils.lerp(sc.startZ, sc.endZ, u);
        const stepTopY = this.baseY + THREE.MathUtils.lerp(sc.startY, sc.endY, u);
        const ceilY = this.getCeilingHeight(this.originX + sc.startX, this.originZ + stepZ, stepTopY);
        if (ceilY !== null && ceilY - stepTopY < 2.4) {
          console.error(
            `[STAIRCASE ERROR] ${sc.id}: Insufficient headroom (${(ceilY - stepTopY).toFixed(2)}m) at step ${s}`,
          );
          allValid = false;
          break;
        }
      }
    }
    return allValid;
  }
}
