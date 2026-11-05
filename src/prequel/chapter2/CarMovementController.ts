import * as THREE from 'three';
import {
  CHAPTER_2_DESTINATION_STOP_Z,
  CHAPTER_2_ROUTE_SEGMENTS,
  RoadSurfaceType,
} from './Chapter2Config';
import { Chapter2StateId } from './Chapter2StateMachine';

export interface VehicleTelemetry {
  worldX: number;
  worldZ: number;
  yaw: number;
  speedMs: number;
  longitudinalAccel: number;
  lateralAccel: number;
  suspensionPitch: number;
  suspensionRoll: number;
  wheelSpinDelta: number;
  steeringAngle: number;
  surface: RoadSurfaceType;
  streetlightSpacing: number;
  engineRunning: boolean;
  indicatorActive: boolean;
  indicatorBlinkOn: boolean;
  rearRightDoorOpenRatio: number;
  headlightIntensity: number;
  brakeLightIntensity: number;
  hitRoadJointBump: boolean;
}

/**
 * Chapter 2: Authored Route Vehicle Kinematics & Suspension Controller
 * Moves the car along the continuous 600m route with authentic acceleration,
 * turns, road-surface vibration, braking pitch, and door articulation.
 */
export class CarMovementController {
  private worldX = 1.65;
  private worldZ = -4.0;
  private yaw = 0;
  private speedMs = 0;
  private prevSpeedMs = 0;
  private suspensionPitch = 0;
  private suspensionRoll = 0;
  private steeringAngle = 0;
  private doorOpenRatio = 0;
  private lastRoadJointIndex = 0;

  public snapToState(stateId: Chapter2StateId, defaultCarZ: number): void {
    this.worldZ = defaultCarZ;
    this.worldX = 1.65;
    this.yaw = 0;
    this.lastRoadJointIndex = Math.floor(Math.abs(this.worldZ) / 18);

    if (stateId === 'SCENE_1_DOOR_CLOSES') {
      this.speedMs = 0;
      this.doorOpenRatio = 0.85;
    } else if (stateId === 'SCENE_1_ENGINE_START') {
      this.speedMs = 0.5;
      this.doorOpenRatio = 0;
    } else if (
      stateId === 'SCENE_4_WHEEL_STOP_ENGINE_OFF' ||
      stateId === 'SCENE_4_DOOR_OPENS' ||
      stateId === 'SCENE_5_PERSPECTIVE_PUSH_IN' ||
      stateId === 'SCENE_5_CONTROLLED_BLACKOUT' ||
      stateId === 'SCENE_5_CELL_04_AWAKENING'
    ) {
      this.worldZ = CHAPTER_2_DESTINATION_STOP_Z;
      this.speedMs = 0;
      this.doorOpenRatio =
        stateId === 'SCENE_4_DOOR_OPENS' || stateId === 'SCENE_5_PERSPECTIVE_PUSH_IN'
          ? 0.92
          : 0;
    } else {
      this.speedMs = 9.8;
      this.doorOpenRatio = 0;
    }
    this.prevSpeedMs = this.speedMs;
  }

  public update(
    dt: number,
    elapsed: number,
    stateId: Chapter2StateId,
    stateElapsed: number,
  ): VehicleTelemetry {
    // Locate active route segment config
    const seg =
      CHAPTER_2_ROUTE_SEGMENTS.find(
        (s) => this.worldZ <= s.startZ && this.worldZ >= s.endZ,
      ) || CHAPTER_2_ROUTE_SEGMENTS[CHAPTER_2_ROUTE_SEGMENTS.length - 1];

    let targetSpeed = seg.cruiseSpeed;
    let targetWorldX = 1.65;
    let targetYaw = 0;
    let targetDoorOpen = 0;
    let engineRunning = true;
    let indicatorActive = false;
    let headlightIntensity = 4.8;
    let brakeLightIntensity = 1.2;

    switch (stateId) {
      case 'SCENE_1_DOOR_CLOSES': {
        targetSpeed = 0;
        engineRunning = false;
        headlightIntensity = 0.4;
        // Door closes smoothly over first 1.6 seconds
        targetDoorOpen = stateElapsed < 1.35 ? Math.max(0, 0.85 - stateElapsed * 0.65) : 0;
        break;
      }
      case 'SCENE_1_ENGINE_START': {
        engineRunning = stateElapsed > 0.8;
        targetSpeed = stateElapsed < 1.8 ? 0 : THREE.MathUtils.lerp(0, 6.8, (stateElapsed - 1.8) / 3.2);
        headlightIntensity = stateElapsed > 1.0 ? 4.6 : 0.5;
        break;
      }
      case 'SCENE_1_DEPARTURE_NEIGHBOURHOOD':
      case 'SCENE_2_STAGE_A_FAMILIAR': {
        targetSpeed = 9.6;
        break;
      }
      case 'SCENE_2_STAGE_B_MAIN_ROAD': {
        targetSpeed = 13.8;
        targetWorldX = 2.15;
        break;
      }
      case 'SCENE_3_THE_TURN_AND_DRIVER': {
        // Scene 3: Car takes a turn, slows briefly, and her body leans naturally
        indicatorActive = stateElapsed < 5.2;
        const turnWave = Math.sin(
          THREE.MathUtils.clamp((stateElapsed - 0.8) / 4.8, 0, 1) * Math.PI,
        );
        targetSpeed = 11.5 - turnWave * 3.8; // Slows briefly during the turn
        targetYaw = turnWave * 0.22;
        targetWorldX = 2.15 - turnWave * 1.35;
        brakeLightIntensity = turnWave > 0.3 ? 3.2 : 1.2;
        break;
      }
      case 'SCENE_3_PASSING_HEADLIGHTS': {
        targetSpeed = 11.8;
        targetWorldX = 1.85;
        break;
      }
      case 'SCENE_2_STAGE_C_ISOLATED': {
        targetSpeed = 11.2;
        targetWorldX = 1.45 + Math.sin(elapsed * 0.45) * 0.35;
        break;
      }
      case 'SCENE_4_DESTINATION_APPROACH': {
        indicatorActive = stateElapsed < 3.5;
        const distRem = Math.max(0, this.worldZ - CHAPTER_2_DESTINATION_STOP_Z);
        targetSpeed = THREE.MathUtils.clamp(distRem * 0.42, 2.2, 7.5);
        targetWorldX = 1.75;
        brakeLightIntensity = 3.4;
        break;
      }
      case 'SCENE_4_WHEEL_STOP_ENGINE_OFF': {
        targetSpeed = stateElapsed < 1.8 ? Math.max(0, 2.4 - stateElapsed * 1.4) : 0;
        engineRunning = stateElapsed < 3.4; // Engine continues briefly, then switches off
        headlightIntensity = stateElapsed < 3.8 ? 4.2 : 0.6;
        brakeLightIntensity = stateElapsed < 3.2 ? 3.8 : 0.4;
        break;
      }
      case 'SCENE_4_DOOR_OPENS': {
        targetSpeed = 0;
        engineRunning = false;
        headlightIntensity = 0.4;
        brakeLightIntensity = 0.2;
        targetDoorOpen = stateElapsed > 1.4 ? 0.95 : 0;
        break;
      }
      case 'SCENE_5_PERSPECTIVE_PUSH_IN':
      case 'SCENE_5_CONTROLLED_BLACKOUT':
      case 'SCENE_5_CELL_04_AWAKENING': {
        targetSpeed = 0;
        engineRunning = false;
        headlightIntensity = 0;
        brakeLightIntensity = 0;
        targetDoorOpen = stateId === 'SCENE_5_PERSPECTIVE_PUSH_IN' ? 0.95 : 0;
        break;
      }
    }

    // Smoothly integrate vehicle velocity & position along the authored route (-Z)
    this.speedMs = THREE.MathUtils.damp(this.speedMs, targetSpeed, 3.2, dt);
    const longitudinalAccel = (this.speedMs - this.prevSpeedMs) / Math.max(0.001, dt);
    this.prevSpeedMs = this.speedMs;

    if (this.speedMs > 0.01 && this.worldZ > CHAPTER_2_DESTINATION_STOP_Z) {
      this.worldZ = Math.max(
        CHAPTER_2_DESTINATION_STOP_Z,
        this.worldZ - this.speedMs * dt,
      );
    }

    const prevX = this.worldX;
    this.worldX = THREE.MathUtils.damp(this.worldX, targetWorldX, 2.4, dt);
    const lateralVel = (this.worldX - prevX) / Math.max(0.001, dt);
    this.yaw = THREE.MathUtils.damp(this.yaw, targetYaw, 3.5, dt);

    const lateralAccel = this.yaw * this.speedMs * 0.45 + lateralVel * 1.8;
    this.steeringAngle = THREE.MathUtils.damp(
      this.steeringAngle,
      this.yaw * 0.9,
      6.0,
      dt,
    );

    // Subtle road surface suspension movement (never random camera shake)
    const surfaceAmp =
      seg.surface === 'ISOLATED_ROUGH'
        ? 0.0065
        : seg.surface === 'MAIN_HIGHWAY'
          ? 0.0028
          : 0.0042;
    const speedFactor = Math.min(1, this.speedMs / 6.0);
    const roadPitchWave =
      Math.sin(this.worldZ * 1.4) * surfaceAmp * speedFactor +
      THREE.MathUtils.clamp(-longitudinalAccel * 0.008, -0.025, 0.032);
    const roadRollWave =
      Math.cos(this.worldZ * 0.95) * surfaceAmp * 0.8 * speedFactor -
      THREE.MathUtils.clamp(lateralAccel * 0.015, -0.045, 0.045);

    this.suspensionPitch = THREE.MathUtils.damp(
      this.suspensionPitch,
      roadPitchWave,
      8.0,
      dt,
    );
    this.suspensionRoll = THREE.MathUtils.damp(
      this.suspensionRoll,
      roadRollWave,
      7.5,
      dt,
    );
    this.doorOpenRatio = THREE.MathUtils.damp(
      this.doorOpenRatio,
      targetDoorOpen,
      5.5,
      dt,
    );

    // Detect road expansion joints every 24m for subtle suspension foley thump
    const currentJointIdx = Math.floor(Math.abs(this.worldZ) / 24);
    const hitRoadJointBump =
      currentJointIdx !== this.lastRoadJointIndex && this.speedMs > 3.5;
    this.lastRoadJointIndex = currentJointIdx;

    const indicatorBlinkOn =
      indicatorActive && Math.floor(elapsed * 2.4) % 2 === 0;

    return {
      worldX: this.worldX,
      worldZ: this.worldZ,
      yaw: this.yaw,
      speedMs: this.speedMs,
      longitudinalAccel,
      lateralAccel,
      suspensionPitch: this.suspensionPitch,
      suspensionRoll: this.suspensionRoll,
      wheelSpinDelta: (this.speedMs * dt) / 0.35,
      steeringAngle: this.steeringAngle,
      surface: seg.surface,
      streetlightSpacing: seg.streetlightSpacing,
      engineRunning,
      indicatorActive,
      indicatorBlinkOn,
      rearRightDoorOpenRatio: this.doorOpenRatio,
      headlightIntensity,
      brakeLightIntensity,
      hitRoadJointBump,
    };
  }
}
