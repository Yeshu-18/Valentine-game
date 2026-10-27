import * as THREE from 'three';
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

export interface StairRampDef {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  elevStart: number;
  elevEnd: number;
  isZAxis: boolean;
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
  } | null = null;

  public hasTriggeredEntranceReveal: boolean = false;
  public hasTriggeredRooftopReveal: boolean = false;

  // Fountain Ripple & Hologram Projector State
  public fountainRippleTimer: number = 0.0;
  public fountainRippleDuration: number = 7.0;
  public fountainHologramActive: boolean = false;
  public fountainHologramTimer: number = 0.0;
  public fountainHologramDuration: number = 7.0;
  public fountainHologramAlpha: number = 0.0;
  public readonly fountainHologramCaption: string =
    '"Our favorite place in the world is right beside you. ♡"';

  // Audio cues
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.baseY = getTerrainHeight(this.originX, this.originZ);
    this.elevatorCabinY = this.baseY + 0.25;
  }

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      // Gentle romantic music-box arpeggio (C5 - E5 - G5 - B5 - C6 - E6)
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        if (!this.audioCtx) return;
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
      });
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
    return {
      lx: wx - this.originX,
      lz: wz - this.originZ,
    };
  }

  public localToWorld(lx: number, lz: number): { wx: number; wz: number } {
    return {
      wx: lx + this.originX,
      wz: lz + this.originZ,
    };
  }

  public isInsideCastleBounds(wx: number, wz: number): boolean {
    const { lx, lz } = this.worldToLocal(wx, wz);
    return Math.abs(lx) <= 22.0 && Math.abs(lz) <= 22.0;
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
    const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
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
      // Push player out along Z (toward exterior porch or interior)
      if (lz <= this.doorCenterLocalZ) {
        playerPos.z = this.originZ + (boxMinZ - playerRadius);
      } else {
        playerPos.z = this.originZ + (boxMaxZ + playerRadius);
      }
      return true;
    }
    return false;
  }

  public isNearEntranceDoors(playerPos: THREE.Vector3): boolean {
    const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
    const dist = Math.hypot(lx - this.doorCenterLocalX, lz - this.doorCenterLocalZ);
    return dist <= this.doorProximityRange && Math.abs(playerPos.y - (this.baseY + 0.25)) <= 3.5;
  }

  public isWithinEntranceFramingZone(playerPos: THREE.Vector3): boolean {
    const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
    const dist = Math.hypot(lx - this.doorCenterLocalX, lz - this.doorCenterLocalZ);
    return dist <= 9.8 && lz <= -14.5 && Math.abs(playerPos.y - (this.baseY + 0.25)) <= 4.0;
  }

  /**
   * Checks if player is within 2.2m of the central marble fountain basin (radius 2.9m -> center dist <= 5.1m).
   */
  public isNearFountain(playerPos: THREE.Vector3): boolean {
    const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
    const dist = Math.hypot(lx, lz);
    return dist <= 5.1 && Math.abs(playerPos.y - (this.baseY + 0.25)) <= 1.8;
  }

  public triggerFountainRipple(): boolean {
    if (this.fountainHologramActive && this.fountainHologramTimer < this.fountainHologramDuration - 0.35) {
      // Pressing E again while active gracefully dissolves the hologram back into water ripples
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
    if (this.fountainHologramActive || this.fountainHologramAlpha > 0.15) {
      return this.fountainHologramCaption;
    }
    return null;
  }

  public isInsideElevatorCabin(playerPos: THREE.Vector3): boolean {
    const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
    const dist = Math.hypot(lx - this.elevatorShaftLocalX, lz - this.elevatorShaftLocalZ);
    return dist <= this.elevatorCabinRadius && Math.abs(playerPos.y - this.elevatorCabinY) <= 1.7;
  }

  public isNearElevatorFloorCall(playerPos: THREE.Vector3): { floor: CastleFloorDef; dist: number } | null {
    const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
    const distToShaft = Math.hypot(lx - this.elevatorShaftLocalX, lz - this.elevatorShaftLocalZ);
    if (distToShaft > 4.4) return null;

    for (const f of CASTLE_FLOOR_DEFS) {
      const floorY = this.baseY + f.elevOffset;
      if (Math.abs(playerPos.y - floorY) <= 1.4) {
        return { floor: f, dist: distToShaft };
      }
    }
    return null;
  }

  public openEntranceDoors(): boolean {
    if (this.doorState === 'CLOSED') {
      this.doorState = 'OPENING';
      this.playDoorCreak();
      return true;
    }
    return false;
  }

  public callElevatorToFloor(floorId: number): boolean {
    const targetDef = CASTLE_FLOOR_DEFS.find((f) => f.id === floorId);
    if (!targetDef) return false;

    if (this.elevatorTargetFloorIndex === floorId && this.elevatorDoorsOpenRatio >= 0.9) {
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
    const order = [1, 2, 3, 4, -1];
    const idx = order.indexOf(this.elevatorTargetFloorIndex);
    const nextFloorId = order[(idx + 1) % order.length];
    return this.callElevatorToFloor(nextFloorId);
  }

  public triggerEntranceCinematicTilt(playerPos: THREE.Vector3) {
    if (this.hasTriggeredEntranceReveal) return;
    this.hasTriggeredEntranceReveal = true;

    // Upward tilt showing towering atrium, chandelier, and twin sweeping staircases
    this.activeCameraFocus = {
      mode: 'entrance',
      position: new THREE.Vector3(playerPos.x, playerPos.y + 1.8, playerPos.z - 2.8),
      target: new THREE.Vector3(this.originX, this.baseY + 9.5, this.originZ + 2.0),
      fov: 64,
      duration: 2.8,
      elapsed: 0,
    };
  }

  public triggerRooftopPanoramicPan(_playerPos: THREE.Vector3, force = false) {
    if (this.hasTriggeredRooftopReveal && !force) return;
    this.hasTriggeredRooftopReveal = true;

    // Panoramic 3.8s sweeping pan from the rooftop terrace across the island landmarks
    this.activeCameraFocus = {
      mode: 'rooftop',
      position: new THREE.Vector3(this.originX, this.baseY + 17.8, this.originZ - 6.5),
      target: new THREE.Vector3(this.originX - 15.5, this.baseY + 26.0, this.originZ - 15.5),
      fov: 65,
      duration: 3.8,
      elapsed: 0,
    };
  }

  public skipCameraFocus() {
    this.activeCameraFocus = null;
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    // 0. Fountain ripple & 7-second hologram projection state machine
    if (this.fountainRippleTimer > 0) {
      this.fountainRippleTimer = Math.max(0, this.fountainRippleTimer - delta);
    }

    if (this.fountainHologramActive) {
      this.fountainHologramTimer = Math.max(0, this.fountainHologramTimer - delta);
      const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
      const distFromFountain = Math.hypot(lx, lz);
      // Dissolve if 7 seconds elapsed or player walks away from fountain
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
      this.doorOpenRatio = Math.min(1.0, this.doorOpenRatio + delta * 0.65);
      // Handle rotates down during 0.0s - 0.5s, then springs gently back
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

    // Check first entry threshold for entrance cinematic reveal
    if (!this.hasTriggeredEntranceReveal && this.doorOpenRatio > 0.4) {
      const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
      if (Math.abs(lx) <= 6.0 && lz >= -15.5 && lz <= -10.0) {
        this.triggerEntranceCinematicTilt(playerPos);
      }
    }

    // Check rooftop arrival for panoramic pan
    if (!this.hasTriggeredRooftopReveal) {
      const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
      if (Math.abs(lx) <= 15.0 && Math.abs(lz) <= 15.0 && playerPos.y >= this.baseY + 14.5) {
        this.triggerRooftopPanoramicPan(playerPos);
      }
    }

    // Camera cinematic animation progress
    if (this.activeCameraFocus) {
      this.activeCameraFocus.elapsed += delta;
      if (this.activeCameraFocus.mode === 'rooftop') {
        // Smoothly sweep target across Castle Spires -> Enchanted Garden -> Central Plaza -> Romantic Carnival -> Aurora Lake -> Sky
        const t = THREE.MathUtils.clamp(
          this.activeCameraFocus.elapsed / this.activeCameraFocus.duration,
          0,
          1,
        );
        const sweepWaypoints = [
          new THREE.Vector3(this.originX - 15.5, this.baseY + 25.0, this.originZ - 15.5), // Castle Spires
          new THREE.Vector3(38.0, 12.0, 42.0), // Enchanted Garden
          new THREE.Vector3(0.0, 11.0, 0.0), // Central Plaza
          new THREE.Vector3(24.0, 14.0, -56.0), // Romantic Carnival Midway
          new THREE.Vector3(-42.0, 12.0, -68.0), // Aurora Lake
          new THREE.Vector3(0.0, 38.0, -30.0), // Starlit Sky above Heart Island
        ];
        const scaled = t * (sweepWaypoints.length - 1);
        const idx = Math.min(Math.floor(scaled), sweepWaypoints.length - 2);
        const frac = scaled - idx;
        this.activeCameraFocus.target.lerpVectors(
          sweepWaypoints[idx],
          sweepWaypoints[idx + 1],
          frac,
        );
      }
      if (this.activeCameraFocus.elapsed >= this.activeCameraFocus.duration) {
        this.activeCameraFocus = null;
      }
    }

    // 2. Elevator state machine
    const targetFloorDef = CASTLE_FLOOR_DEFS.find((f) => f.id === this.elevatorTargetFloorIndex) || CASTLE_FLOOR_DEFS[1];
    const targetY = this.baseY + targetFloorDef.elevOffset;

    switch (this.elevatorState) {
      case 'IDLE':
        // Ensure doors stay open when idle at floor
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
  }

  /**
   * Evaluates the multi-floor surface height at world coordinate (wx, wz) given the player's current vertical Y.
   * Rock-solid resolver prevents snapping through floors or elevator floors.
   */
  public getSurfaceHeight(wx: number, wz: number, playerY: number, defaultGroundY: number): number {
    const { lx, lz } = this.worldToLocal(wx, wz);

    // If completely outside the castle outer grounds, return default terrain height
    if (Math.abs(lx) > 23.0 || Math.abs(lz) > 23.0) {
      return defaultGroundY;
    }

    // 1. Elevator cabin floor
    const distToShaft = Math.hypot(lx - this.elevatorShaftLocalX, lz - this.elevatorShaftLocalZ);
    if (distToShaft <= this.elevatorCabinRadius && Math.abs(playerY - this.elevatorCabinY) <= 1.85) {
      return this.elevatorCabinY;
    }

    // 2. Walkable Staircases & Ramps
    // Exterior entrance steps / ramp: lz [-22, -15.8], lx [-5.8, 5.8]
    if (lz >= -22.0 && lz <= -15.8 && Math.abs(lx) <= 5.8) {
      const rampT = THREE.MathUtils.clamp((lz - (-22.0)) / 6.2, 0, 1);
      const rampY = THREE.MathUtils.lerp(this.baseY - 0.25, this.baseY + 0.25, rampT);
      if (Math.abs(playerY - rampY) <= 1.7) {
        return rampY;
      }
    }

    // Grand Atrium West Sweeping Staircase (Floor 1 -> Floor 2): lx [-8.6, -5.2], lz [-6.0, 6.0]
    if (lx >= -8.6 && lx <= -5.2 && lz >= -6.0 && lz <= 6.0) {
      const stairT = (lz - (-6.0)) / 12.0;
      const rampY = THREE.MathUtils.lerp(this.baseY + 0.25, this.baseY + 5.25, stairT);
      if (Math.abs(playerY - rampY) <= 1.75) {
        return rampY;
      }
    }

    // Grand Atrium East Sweeping Staircase (Floor 1 -> Floor 2): lx [5.2, 8.6], lz [-6.0, 6.0]
    if (lx >= 5.2 && lx <= 8.6 && lz >= -6.0 && lz <= 6.0) {
      const stairT = (lz - (-6.0)) / 12.0;
      const rampY = THREE.MathUtils.lerp(this.baseY + 0.25, this.baseY + 5.25, stairT);
      if (Math.abs(playerY - rampY) <= 1.75) {
        return rampY;
      }
    }

    // East Staircase (Floor 2 -> Floor 3): lx [5.8, 9.2], lz [7.0, 13.5]
    if (lx >= 5.8 && lx <= 9.2 && lz >= 7.0 && lz <= 13.5) {
      const stairT = (lz - 7.0) / 6.5;
      const rampY = THREE.MathUtils.lerp(this.baseY + 5.25, this.baseY + 10.25, stairT);
      if (Math.abs(playerY - rampY) <= 1.75) {
        return rampY;
      }
    }

    // West Staircase (Floor 3 -> Floor 4 Rooftop): lx [-9.2, -5.8], lz [7.0, 13.5]
    if (lx >= -9.2 && lx <= -5.8 && lz >= 7.0 && lz <= 13.5) {
      const stairT = (lz - 7.0) / 6.5;
      const rampY = THREE.MathUtils.lerp(this.baseY + 10.25, this.baseY + 15.25, stairT);
      if (Math.abs(playerY - rampY) <= 1.75) {
        return rampY;
      }
    }

    // Basement Service Stairs (Floor 1 -> Basement -1): lx [-3.2, 3.2], lz [11.5, 16.0]
    if (Math.abs(lx) <= 3.2 && lz >= 11.5 && lz <= 16.0) {
      const stairT = (lz - 11.5) / 4.5;
      const rampY = THREE.MathUtils.lerp(this.baseY + 0.25, this.baseY - 4.5, stairT);
      if (Math.abs(playerY - rampY) <= 1.85) {
        return rampY;
      }
    }

    // 3. Multi-Floor Horizontal Slabs (highest surface <= playerY + 0.85m)
    const validFloorHeights: number[] = [];

    // Level -1: Basement Vault (|lx| <= 14, |lz| <= 14)
    if (Math.abs(lx) <= 14.0 && Math.abs(lz) <= 14.0) {
      validFloorHeights.push(this.baseY - 4.5);
    }

    // Level 1: Grand Entrance Hall (|lx| <= 18, |lz| <= 18)
    if (Math.abs(lx) <= 18.0 && Math.abs(lz) <= 18.0) {
      // Small hole cutout for basement stairs
      const isBasementStairHole = Math.abs(lx) <= 3.0 && lz >= 12.0 && lz <= 16.0;
      if (!isBasementStairHole) {
        validFloorHeights.push(this.baseY + 0.25);
      }
    }

    // Level 2: Mezzanine Gallery (|lx| <= 17, |lz| <= 17 with central atrium cutout)
    if (Math.abs(lx) <= 17.0 && Math.abs(lz) <= 17.0) {
      const isCentralAtriumOpen = Math.abs(lx) < 4.8 && Math.abs(lz) < 4.8;
      if (!isCentralAtriumOpen) {
        validFloorHeights.push(this.baseY + 5.25);
      }
    }

    // Level 3: Dream Wing Gallery (|lx| <= 17, |lz| <= 17 with central atrium cutout)
    if (Math.abs(lx) <= 17.0 && Math.abs(lz) <= 17.0) {
      const isCentralAtriumOpen = Math.abs(lx) < 4.2 && Math.abs(lz) < 4.2;
      if (!isCentralAtriumOpen) {
        validFloorHeights.push(this.baseY + 10.25);
      }
    }

    // Level 4: Rooftop Observatory Terrace (|lx| <= 16, |lz| <= 16)
    if (Math.abs(lx) <= 16.0 && Math.abs(lz) <= 16.0) {
      validFloorHeights.push(this.baseY + 15.25);
    }

    // Find the highest floor surface that is at or beneath player elevation (+0.85m tolerance for stepping)
    let bestSurface = defaultGroundY;
    let foundSlab = false;

    for (const h of validFloorHeights) {
      if (h <= playerY + 0.85) {
        if (!foundSlab || h > bestSurface) {
          bestSurface = h;
          foundSlab = true;
        }
      }
    }

    if (foundSlab) {
      return bestSurface;
    }

    // If player is inside castle footprint but slightly above terrain, ground to Grand Hall Floor 1
    if (Math.abs(lx) <= 18.0 && Math.abs(lz) <= 18.0) {
      return Math.max(defaultGroundY, this.baseY + 0.25);
    }

    return defaultGroundY;
  }
}
