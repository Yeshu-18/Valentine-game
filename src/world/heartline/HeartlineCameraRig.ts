import * as THREE from 'three';
import {
  HeartlineTrackSpline,
  LOVE_MEADOW_CENTER,
  DREAM_CASTLE_SPIRE_TARGET,
  createEmptyTrackFrame,
} from './HeartlineTrackSpline';
import { HeartlineTrainSolver } from './HeartlineTrainSolver';
import {
  getHuggingFishSpotlightWorldPos,
  UNDERWATER_TEXT_STAGE_SPECS,
  getUnderwaterTextStageWorldPos,
} from './HeartlineUnderwaterReef';

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
const _scratchBaseLookTarget = new THREE.Vector3();
const _scratchForwardDir = new THREE.Vector3();
const _scratchBaseDir = new THREE.Vector3();
const _scratchPoiDir = new THREE.Vector3();
const _scratchBlendedDir = new THREE.Vector3();
const _scratchHuggingCouplePos = new THREE.Vector3();
const _scratchStageWorldPos = new THREE.Vector3();
const _scratchRight = new THREE.Vector3();
const _scratchUp = new THREE.Vector3();
const _scratchQuatYaw = new THREE.Quaternion();
const _scratchQuatPitch = new THREE.Quaternion();

function wrapAnglePi(rad: number): number {
  let a = (rad + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

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
  const smoothedBaseDir = new THREE.Vector3(1, 0, 0);
  const smoothedUp = new THREE.Vector3(0, 1, 0);
  const lookAheadFrame = createEmptyTrackFrame();

  let userYawOffset = 0;
  let userPitchOffset = 0;
  let timeSinceLastLookInput = 10.0;
  let enteredCrestReveal = false;
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
    timeSinceLastLookInput = 10.0;
    enteredCrestReveal = false;
    currentFov = 50;
    initialized = false;
  }

  function applyLookDelta(yawDeltaRad: number, pitchDeltaRad: number): void {
    timeSinceLastLookInput = 0;
    // Full 360° horizontal rotational freedom + generous vertical pitch (-68° down to +60° up)
    userYawOffset = wrapAnglePi(userYawOffset - yawDeltaRad);
    userPitchOffset = THREE.MathUtils.clamp(
      userPitchOffset - pitchDeltaRad,
      -1.18,
      1.05
    );
  }

  function update(dt: number, elapsedTime: number): HeartlineCameraState {
    const clampedDt = Math.min(dt, 0.05);
    timeSinceLastLookInput += clampedDt;

    const frame = train.leadCarFrame;
    const zone = frame.zone;
    const u = frame.u;
    currentZoneLabel = zone.label;
    let effectiveTargetFov = zone.targetFov;

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

    // 4. Base Forward Track Tangent Look-Ahead
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
      let revealWeight = 0;
      if (u < 0.24) {
        revealWeight = THREE.MathUtils.smoothstep(u, 0.215, 0.24);
      } else if (u <= 0.308) {
        revealWeight = 1.0;
      } else {
        revealWeight = 1.0 - THREE.MathUtils.smoothstep(u, 0.308, 0.325);
      }

      if (!enteredCrestReveal) {
        enteredCrestReveal = true;
      }
      if (timeSinceLastLookInput > 0.35) {
        userYawOffset = THREE.MathUtils.lerp(userYawOffset, 0, Math.min(1, clampedDt * 4.5));
        userPitchOffset = THREE.MathUtils.lerp(userPitchOffset, 0, Math.min(1, clampedDt * 4.5));
      }

      // Aim base cinematic view directly at LOVE_MEADOW_CENTER
      _scratchPoiDir.copy(LOVE_MEADOW_CENTER).sub(_scratchSeatEye).normalize();
      _scratchBlendedDir.lerp(_scratchPoiDir, revealWeight * 0.98).normalize();
    } else {
      enteredCrestReveal = false;
      if (u >= 0.43 && u <= 0.545) {
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
      } else if (u >= 0.555 && u <= 0.775) {
        // Underwater Coral Reef, Marine Life Spotlights & Heartline Element ("I LOVE YOU ❤️")
        let reefWeight = 1.0;
        if (u < 0.575) {
          reefWeight = THREE.MathUtils.smoothstep(u, 0.555, 0.575);
        } else if (u > 0.755) {
          reefWeight = 1.0 - THREE.MathUtils.smoothstep(u, 0.755, 0.775);
        }
        _scratchBlendedDir.y += 0.045 * reefWeight;
        _scratchBlendedDir.normalize();

        // Dedicated Camera Movements for each Underwater Reef Alcove, Hugging Fish Couple & Heartline Arch:
        // The camera turns 100% onto each focal point while the train slows and pauses, centering the entire romantic text!
        for (let sIdx = 0; sIdx < UNDERWATER_TEXT_STAGE_SPECS.length; sIdx++) {
          const spec = UNDERWATER_TEXT_STAGE_SPECS[sIdx];
          if (u >= spec.camStartU && u <= spec.camEndU) {
            let stageCamWeight = 0;
            if (u < spec.camHoldStartU) {
              stageCamWeight = THREE.MathUtils.smoothstep(
                u,
                spec.camStartU,
                spec.camHoldStartU
              );
            } else if (u <= spec.camHoldEndU) {
              stageCamWeight = 1.0;
            } else {
              stageCamWeight =
                1.0 -
                THREE.MathUtils.smoothstep(u, spec.camHoldEndU, spec.camEndU);
            }

            if (timeSinceLastLookInput > 0.35) {
              userYawOffset = THREE.MathUtils.lerp(
                userYawOffset,
                0,
                Math.min(1, clampedDt * 6.5)
              );
              userPitchOffset = THREE.MathUtils.lerp(
                userPitchOffset,
                0,
                Math.min(1, clampedDt * 6.5)
              );
            }

            if (sIdx === 2) {
              // Stage 2 (u = 0.625): Frame the entire quote AND the Hugging Fish Couple right beneath it!
              getHuggingFishSpotlightWorldPos(spline, _scratchHuggingCouplePos);
              getUnderwaterTextStageWorldPos(spline, sIdx, _scratchStageWorldPos);
              _scratchStageWorldPos.lerp(_scratchHuggingCouplePos, 0.36);
            } else {
              getUnderwaterTextStageWorldPos(spline, sIdx, _scratchStageWorldPos);
            }

            _scratchPoiDir
              .copy(_scratchStageWorldPos)
              .sub(_scratchSeatEye)
              .normalize();
            // Turn 100% toward the target stage during the hold so the entire text is centered in the viewport
            _scratchBlendedDir
              .lerp(_scratchPoiDir, stageCamWeight)
              .normalize();
            effectiveTargetFov = THREE.MathUtils.lerp(
              zone.targetFov,
              spec.targetFov,
              stageCamWeight
            );
            currentZoneLabel = spec.zoneLabel;
            break;
          }
        }
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
    }

    // Save the base coaster look direction (before user head rotation) so the short blue nose tip stays anchored to the car's front
    _scratchBaseDir.copy(_scratchBlendedDir);

    // 6. Apply player rotational look-around offset (only drifts gently back toward center after 3.0s of no input)
    if (timeSinceLastLookInput > 3.0) {
      userYawOffset = THREE.MathUtils.lerp(userYawOffset, 0, Math.min(1, clampedDt * 0.55));
      userPitchOffset = THREE.MathUtils.lerp(userPitchOffset, 0, Math.min(1, clampedDt * 0.55));
    }

    if (Math.abs(userYawOffset) > 1e-4 || Math.abs(userPitchOffset) > 1e-4) {
      _scratchRight.crossVectors(_scratchBlendedDir, _scratchUp).normalize();
      _scratchQuatYaw.setFromAxisAngle(_scratchUp, userYawOffset);
      _scratchBlendedDir.applyQuaternion(_scratchQuatYaw).normalize();
      _scratchRight.applyQuaternion(_scratchQuatYaw).normalize();
      _scratchQuatPitch.setFromAxisAngle(_scratchRight, userPitchOffset);
      _scratchBlendedDir.applyQuaternion(_scratchQuatPitch).normalize();
    }

    // 7. Responsive exponential smoothing for zero-snap C2 camera motion
    if (!initialized) {
      smoothedDir.copy(_scratchBlendedDir);
      smoothedBaseDir.copy(_scratchBaseDir);
      smoothedUp.copy(_scratchUp);
      currentFov = effectiveTargetFov;
      initialized = true;
    } else {
      const isUnderwater = u >= 0.545 && u <= 0.778;
      // Smoothly turn and lock onto each underwater text stage during the 1-second pause hold
      const dirDamp = 1.0 - Math.exp(-(isUnderwater ? 6.2 : 12.0) * clampedDt);
      const baseDamp = 1.0 - Math.exp(-(isUnderwater ? 5.5 : 8.5) * clampedDt);
      const upDamp = 1.0 - Math.exp(-(isUnderwater ? 4.5 : 6.5) * clampedDt);
      const fovDamp = 1.0 - Math.exp(-(isUnderwater ? 4.5 : 6.0) * clampedDt);
      smoothedDir.lerp(_scratchBlendedDir, dirDamp).normalize();
      smoothedBaseDir.lerp(_scratchBaseDir, baseDamp).normalize();
      smoothedUp.lerp(_scratchUp, upDamp).normalize();
      currentFov = THREE.MathUtils.lerp(currentFov, effectiveTargetFov, fovDamp);
    }

    up.copy(smoothedUp);
    lookTarget.copy(position).addScaledVector(smoothedDir, 20.0);
    _scratchBaseLookTarget.copy(position).addScaledVector(smoothedBaseDir, 20.0);

    // Anchor the short sleek blue nose tip to the base coaster view so turning your head looks freely around the world!
    train.syncRiderNoseToCamera(position, _scratchBaseLookTarget, up);

    return state;
  }

  return {
    resetForBoarding,
    applyLookDelta,
    update,
    getState: () => state,
  };
}
