import * as THREE from 'three';
import {
  HeartlineTrackSpline,
  LOVE_MEADOW_CENTER,
  DREAM_CASTLE_SPIRE_TARGET,
  createEmptyTrackFrame,
} from './HeartlineTrackSpline';
import { HeartlineTrainSolver } from './HeartlineTrainSolver';

export interface HeartlineCameraState {
  readonly position: THREE.Vector3;
  readonly lookTarget: THREE.Vector3;
  readonly up: THREE.Vector3;
  readonly fov: number;
  readonly zoneLabel: string;
}

export interface HeartlineCameraRig {
  resetForBoarding: () => void;
  applyLookDelta: (yawDeltaRad: number, pitchDeltaRad: number) => void;
  update: (dt: number, elapsedTime: number) => HeartlineCameraState;
  getState: () => HeartlineCameraState;
}

const _worldUp = new THREE.Vector3(0, 1, 0);
const _scratchSeatEye = new THREE.Vector3();
const _scratchLookAheadPos = new THREE.Vector3();
const _scratchForwardDir = new THREE.Vector3();
const _scratchPoiDir = new THREE.Vector3();
const _scratchBlendedDir = new THREE.Vector3();
const _scratchRight = new THREE.Vector3();
const _scratchUp = new THREE.Vector3();
const _scratchQuatYaw = new THREE.Quaternion();
const _scratchQuatPitch = new THREE.Quaternion();

export function createHeartlineCameraRig(
  spline: HeartlineTrackSpline,
  train: HeartlineTrainSolver
): HeartlineCameraRig {
  const position = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let currentFov = 50;
  let currentZoneLabel = 'Sapphire & Pearl Station';

  const smoothedDir = new THREE.Vector3(1, 0, 0);
  const smoothedUp = new THREE.Vector3(0, 1, 0);
  const lookAheadFrame = createEmptyTrackFrame();

  let userYawOffset = 0;
  let userPitchOffset = 0;
  let initialized = false;

  const state: HeartlineCameraState = {
    position,
    lookTarget,
    up,
    get fov() {
      return currentFov;
    },
    get zoneLabel() {
      return currentZoneLabel;
    },
  };

  function resetForBoarding(): void {
    userYawOffset = 0;
    userPitchOffset = 0;
    currentFov = 50;
    initialized = false;
  }

  function applyLookDelta(yawDeltaRad: number, pitchDeltaRad: number): void {
    const zoneId = train.leadCarFrame.zone.id;
    // Lock camera on Love Reveal as requested; allow subtle look elsewhere
    if (zoneId === 'CREST_REVEAL' || zoneId === 'CREST_APPROACH') {
      return;
    }
    userYawOffset = THREE.MathUtils.clamp(userYawOffset - yawDeltaRad, -0.48, 0.48);
    userPitchOffset = THREE.MathUtils.clamp(userPitchOffset - pitchDeltaRad, -0.32, 0.32);
  }

  function update(dt: number, elapsedTime: number): HeartlineCameraState {
    const clampedDt = Math.min(dt, 0.05);
    const frame = train.leadCarFrame;
    const zone = frame.zone;
    const u = frame.u;
    currentZoneLabel = zone.label;

    // 1. Base physical seat eye position inside Lead Car (Car 0)
    train.getSeatEyeWorldPosition(_scratchSeatEye);

    // 2. Subtle high-speed track micro-vibration (zero during Boarding and Crest Reveal)
    const speedFactor = THREE.MathUtils.clamp(train.getSpeed() / 24.0, 0, 1.2);
    const shakeAmp = zone.shakeStrength * speedFactor * 0.025;
    if (shakeAmp > 0.0005) {
      const shakeX = Math.sin(elapsedTime * 37.0) * shakeAmp;
      const shakeY = Math.cos(elapsedTime * 43.0) * shakeAmp;
      _scratchSeatEye.addScaledVector(frame.binormal, shakeX);
      _scratchSeatEye.addScaledVector(frame.normal, shakeY);
    }
    position.copy(_scratchSeatEye);

    // 3. Horizon-stabilized Up vector (blends track normal with World Up per zone.horizonLockFactor)
    _scratchUp.copy(frame.normal).lerp(_worldUp, zone.horizonLockFactor).normalize();

    // 4. Base Forward Track Tangent Look-Ahead (12m ahead along the spline)
    const lookAheadMeters = zone.id === 'CRYSTAL_TUNNEL' ? 9.5 : 13.5;
    spline.evaluateAtS(frame.s + lookAheadMeters, lookAheadFrame);
    _scratchForwardDir.copy(lookAheadFrame.pos).sub(_scratchSeatEye);
    if (_scratchForwardDir.lengthSq() < 1e-4) {
      _scratchForwardDir.copy(frame.tangent);
    } else {
      _scratchForwardDir.normalize();
    }

    // 5. Additive Cinematic Framing Layer per Coaster Zone
    _scratchBlendedDir.copy(_scratchForwardDir);

    if (u >= 0.215 && u <= 0.325) {
      // ACT 5–7: 45m Summit "I LOVE YOU ❤️" Meadow Reveal
      // Smoothly ramp weight to 1.0 across CREST_APPROACH (0.215..0.24), hold 1.0 across CREST_REVEAL (0.24..0.31), and release into MAJOR_DROP
      let revealWeight = 0;
      if (u < 0.24) {
        revealWeight = THREE.MathUtils.smoothstep(u, 0.215, 0.24);
      } else if (u <= 0.308) {
        revealWeight = 1.0;
      } else {
        revealWeight = 1.0 - THREE.MathUtils.smoothstep(u, 0.308, 0.325);
      }

      // Smoothly damp out any manual look offset so the "I LOVE YOU ❤️" reveal is guaranteed centered
      userYawOffset = THREE.MathUtils.lerp(userYawOffset, 0, Math.min(1, clampedDt * 8.0));
      userPitchOffset = THREE.MathUtils.lerp(userPitchOffset, 0, Math.min(1, clampedDt * 8.0));

      // Aim directly at LOVE_MEADOW_CENTER so the meadow fills the screen and only the tiny blue nose tip sits at the bottom edge
      _scratchPoiDir.copy(LOVE_MEADOW_CENTER).sub(_scratchSeatEye).normalize();
      _scratchBlendedDir.lerp(_scratchPoiDir, revealWeight * 0.98).normalize();
    } else if (u >= 0.43 && u <= 0.545) {
      // ACT 10–11: Sweeping Dream Castle Flyby (soft 0.42 look blend toward Castle spires)
      let castleWeight = 0;
      if (u < 0.46) {
        castleWeight = THREE.MathUtils.smoothstep(u, 0.43, 0.46);
      } else if (u <= 0.52) {
        castleWeight = 1.0;
      } else {
        castleWeight = 1.0 - THREE.MathUtils.smoothstep(u, 0.52, 0.545);
      }
      _scratchPoiDir.copy(DREAM_CASTLE_SPIRE_TARGET).sub(_scratchSeatEye).normalize();
      _scratchBlendedDir.lerp(_scratchPoiDir, castleWeight * 0.42).normalize();
    } else if (u >= 0.83 && u <= 0.915) {
      // ACT 16: Final Panoramic Helix (distant romantic callback view toward the Love Meadow)
      let helixWeight = 0;
      if (u < 0.855) {
        helixWeight = THREE.MathUtils.smoothstep(u, 0.83, 0.855);
      } else if (u <= 0.895) {
        helixWeight = 1.0;
      } else {
        helixWeight = 1.0 - THREE.MathUtils.smoothstep(u, 0.895, 0.915);
      }
      _scratchPoiDir.copy(LOVE_MEADOW_CENTER).sub(_scratchSeatEye).normalize();
      _scratchBlendedDir.lerp(_scratchPoiDir, helixWeight * 0.34).normalize();
    }

    // 6. Apply subtle player mouse/trackpad look-around offset (damped gently back toward center over time)
    userYawOffset = THREE.MathUtils.lerp(userYawOffset, 0, Math.min(1, clampedDt * 0.85));
    userPitchOffset = THREE.MathUtils.lerp(userPitchOffset, 0, Math.min(1, clampedDt * 0.85));

    if (Math.abs(userYawOffset) > 1e-4 || Math.abs(userPitchOffset) > 1e-4) {
      _scratchRight.crossVectors(_scratchBlendedDir, _scratchUp).normalize();
      _scratchQuatYaw.setFromAxisAngle(_scratchUp, userYawOffset);
      _scratchQuatPitch.setFromAxisAngle(_scratchRight, userPitchOffset);
      _scratchBlendedDir.applyQuaternion(_scratchQuatYaw).applyQuaternion(_scratchQuatPitch).normalize();
    }

    // 7. Exponential smoothing for zero-snap C2 camera motion
    if (!initialized) {
      smoothedDir.copy(_scratchBlendedDir);
      smoothedUp.copy(_scratchUp);
      currentFov = zone.targetFov;
      initialized = true;
    } else {
      const dirDamp = 1.0 - Math.exp(-8.5 * clampedDt);
      const upDamp = 1.0 - Math.exp(-6.5 * clampedDt);
      const fovDamp = 1.0 - Math.exp(-5.0 * clampedDt);
      smoothedDir.lerp(_scratchBlendedDir, dirDamp).normalize();
      smoothedUp.lerp(_scratchUp, upDamp).normalize();
      currentFov = THREE.MathUtils.lerp(currentFov, zone.targetFov, fovDamp);
    }

    up.copy(smoothedUp);
    lookTarget.copy(position).addScaledVector(smoothedDir, 20.0);

    // Anchor the tiny sleek blue nose tip to the bottom-center of the rider's camera view
    train.syncRiderNoseToCamera(position, lookTarget, up);

    return state;
  }

  return {
    resetForBoarding,
    applyLookDelta,
    update,
    getState: () => state,
  };
}
