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
    target: THREE.Vector3;
    position: THREE.Vector3;
    fov?: number;
    duration: number;
    elapsed: number;
  } | null = null;

  public hasTriggeredEntranceReveal: boolean = false;
  public hasTriggeredRooftopReveal: boolean = false;

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

  public isNearEntranceDoors(playerPos: THREE.Vector3): boolean {
    const { lx, lz } = this.worldToLocal(playerPos.x, playerPos.z);
    const dist = Math.hypot(lx - this.doorCenterLocalX, lz - this.doorCenterLocalZ);
    return dist <= this.doorProximityRange && Math.abs(playerPos.y - (this.baseY + 0.25)) <= 3.5;
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

  public triggerEntranceCinematicTilt(playerPos: THREE.Vector3) {
    if (this.hasTriggeredEntranceReveal) return;
    this.hasTriggeredEntranceReveal = true;

    // Upward tilt showing towering atrium, chandelier, and twin sweeping staircases
    this.activeCameraFocus = {
      position: new THREE.Vector3(playerPos.x, playerPos.y + 1.8, playerPos.z - 2.8),
      target: new THREE.Vector3(this.originX, this.baseY + 9.5, this.originZ + 2.0),
      fov: 64,
      duration: 2.8,
      elapsed: 0,
    };
  }

  public triggerRooftopPanoramicPan(playerPos: THREE.Vector3) {
    if (this.hasTriggeredRooftopReveal) return;
    this.hasTriggeredRooftopReveal = true;

    // Panoramic 360 sweeping pan from the rooftop terrace
    this.activeCameraFocus = {
      position: new THREE.Vector3(this.originX, this.baseY + 17.5, this.originZ - 5.0),
      target: new THREE.Vector3(this.originX - 35.0, this.baseY + 12.0, this.originZ + 15.0),
      fov: 65,
      duration: 3.8,
      elapsed: 0,
    };
  }

  public skipCameraFocus() {
    this.activeCameraFocus = null;
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    // 1. Door opening state machine
    if (this.doorState === 'OPENING') {
      this.doorOpenRatio = Math.min(1.0, this.doorOpenRatio + delta * 0.65);
      this.doorHandleAngle = Math.min(0.6, this.doorHandleAngle + delta * 1.8);
      if (this.doorOpenRatio >= 1.0) {
        this.doorState = 'OPEN';
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
