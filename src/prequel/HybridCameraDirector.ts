import * as THREE from 'three';
import { Chapter1StateId, HybridCameraState } from './chapter1StateMachine';
import { HarshaCharacterBundle } from './HarshaStreetCharacter';

export interface HybridCameraDirector {
  update: (
    dt: number,
    elapsed: number,
    stateId: Chapter1StateId,
    stateElapsed: number,
    harsha: HarshaCharacterBundle,
    carWorldPos: THREE.Vector3,
    playerYawOffset: number,
    playerPitchOffset: number,
    moveSpeedRatio: number,
  ) => void;
  getCurrentCameraState: () => HybridCameraState;
  snapToHarsha: (harsha: HarshaCharacterBundle) => void;
}

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();

/**
 * Implements the 4-State Hybrid Camera System for Prologue · Chapter 1: The Ordinary Night:
 * - FOLLOW: Third-person slight diagonal behind and slightly above Harsha
 * - PHONE_CINEMATIC: Over-the-shoulder close framing shifting focus to the 3D phone screen
 * - LOOK_AROUND: Player-controlled camera with gentle limits and subtle headlight assist
 * - CAR_CINEMATIC: Directed multi-angle blend (behind -> low-angle wheel/headlight -> side profile with car silhouette)
 */
export function createHybridCameraDirector(
  camera: THREE.PerspectiveCamera,
): HybridCameraDirector {
  const currentPos = new THREE.Vector3(1.2, 2.4, 4.2);
  const currentLook = new THREE.Vector3(0, 1.35, -3.0);
  let activeCameraState: HybridCameraState = 'FOLLOW';
  let currentFov = 50;

  return {
    getCurrentCameraState() {
      return activeCameraState;
    },
    snapToHarsha(harsha) {
      const p = harsha.group.position;
      currentPos.set(p.x + 0.68, p.y + 1.68, p.z + 3.25);
      currentLook.set(p.x - 0.12, p.y + 1.32, p.z - 4.0);
      camera.position.copy(currentPos);
      camera.lookAt(currentLook);
    },
    update(
      dt,
      elapsed,
      stateId,
      stateElapsed,
      harsha,
      carWorldPos,
      playerYawOffset,
      playerPitchOffset,
      moveSpeedRatio,
    ) {
      const hPos = harsha.group.position;
      let posDamp = 4.2;
      let lookDamp = 5.0;
      let targetFov = 50;

      // Opening crane-down reveal in SCENE_START / OPENING_CINEMATIC
      if (stateId === 'SCENE_START' || stateId === 'OPENING_CINEMATIC') {
        activeCameraState = 'FOLLOW';
        const progress =
          stateId === 'SCENE_START'
            ? 0
            : Math.min(1, stateElapsed / 3.8);
        const smoothT = progress * progress * (3 - 2 * progress);

        // Crane down from high wide residential street establishing shot into diagonal FOLLOW
        _desiredPos.set(
          THREE.MathUtils.lerp(2.4, hPos.x + 0.68, smoothT),
          THREE.MathUtils.lerp(4.2, hPos.y + 1.66, smoothT),
          THREE.MathUtils.lerp(hPos.z + 6.4, hPos.z + 3.25, smoothT),
        );
        _desiredLook.set(
          THREE.MathUtils.lerp(0.0, hPos.x - 0.1, smoothT),
          THREE.MathUtils.lerp(1.8, hPos.y + 1.35, smoothT),
          THREE.MathUtils.lerp(hPos.z - 12.0, hPos.z - 4.5, smoothT),
        );
        posDamp = 2.8;
        lookDamp = 3.2;
      } else if (
        stateId === 'PHONE_VIBRATION' ||
        stateId === 'PHONE_CINEMATIC' ||
        stateId === 'MESSAGE_READ'
      ) {
        // PHONE_CINEMATIC: Over-the-shoulder easing closer -> focusing on the 3D phone screen
        activeCameraState = 'PHONE_CINEMATIC';
        const shoulder = harsha.shoulderWorldPos;
        const phonePos = harsha.phoneAnchorWorldPos;

        if (stateId === 'PHONE_VIBRATION') {
          // Step 1 & 2: Phone vibrates, camera eases closer toward her right shoulder
          _desiredPos.set(hPos.x + 0.52, hPos.y + 1.56, hPos.z + 1.65);
          _desiredLook.set(shoulder.x - 0.08, shoulder.y - 0.05, shoulder.z - 0.8);
          targetFov = 45;
          posDamp = 3.6;
          lookDamp = 4.2;
        } else {
          // Step 3, 4, 5: Over her right shoulder focused on the glowing phone screen in her hand
          _desiredPos.set(
            shoulder.x + 0.16,
            shoulder.y + 0.08,
            shoulder.z + 0.58,
          );
          _desiredLook.set(
            phonePos.x - 0.02,
            phonePos.y + 0.01,
            phonePos.z - 0.12,
          );
          targetFov = 38;
          posDamp = 4.0;
          lookDamp = 5.2;
        }
      } else if (
        stateId === 'CAR_APPROACHING' ||
        stateId === 'CAR_STOPPED' ||
        stateId === 'CHAPTER_END' ||
        stateId === 'TRANSITION_TO_CHAPTER_2'
      ) {
        // CAR_CINEMATIC: Directed multi-angle sequence with smooth transitions
        activeCameraState = 'CAR_CINEMATIC';

        if (stateId === 'CAR_APPROACHING') {
          if (stateElapsed < 2.2) {
            // 1. Shift behind Harsha toward the approaching headlights down the road
            _desiredPos.set(hPos.x + 0.55, hPos.y + 1.52, hPos.z + 2.85);
            _desiredLook.set(
              carWorldPos.x * 0.5,
              0.85,
              carWorldPos.z + 4.0,
            );
            targetFov = 46;
            posDamp = 3.5;
            lookDamp = 4.0;
          } else {
            // 2. Low-angle shot of the dark sedan's wheels and bright headlights rolling closer
            _desiredPos.set(hPos.x + 0.85, 0.58, hPos.z + 1.9);
            _desiredLook.set(carWorldPos.x, 0.52, carWorldPos.z + 1.5);
            targetFov = 42;
            posDamp = 3.2;
            lookDamp = 4.5;
          }
        } else if (stateId === 'CAR_STOPPED') {
          // 3. Car slows & stops nearby; camera moves toward Harsha's side profile with red brake glow
          _desiredPos.set(hPos.x + 1.95, hPos.y + 1.32, hPos.z + 0.65);
          _desiredLook.set(
            (hPos.x + carWorldPos.x) * 0.5,
            hPos.y + 1.08,
            (hPos.z + carWorldPos.z) * 0.5,
          );
          targetFov = 44;
          posDamp = 3.0;
          lookDamp = 3.8;
        } else {
          // 4. CHAPTER_END: Side profile composition — Harsha in foreground, dark car silhouette & red tail lights in background
          _desiredPos.set(hPos.x + 1.75, hPos.y + 1.28, hPos.z - 0.35);
          _desiredLook.set(
            carWorldPos.x + 0.25,
            0.96,
            carWorldPos.z - 0.4,
          );
          targetFov = 41;
          posDamp = 2.6;
          lookDamp = 3.2;
        }
      } else {
        // FOLLOW & LOOK_AROUND (Normal playable exploration in PLAYER_WALKING, PLAYER_WALKING_2, CAR_VISIBLE)
        activeCameraState =
          stateId === 'CAR_VISIBLE' || Math.abs(playerYawOffset) > 0.08
            ? 'LOOK_AROUND'
            : 'FOLLOW';

        // Gentle clamped mouse-look yaw & pitch
        const clampedYaw = THREE.MathUtils.clamp(playerYawOffset, -0.85, 0.85);
        const clampedPitch = THREE.MathUtils.clamp(playerPitchOffset, -0.35, 0.38);

        // Slight diagonal offset behind and slightly above Harsha + subtle walking response
        const walkSwayX = Math.sin(elapsed * 4.8) * 0.025 * moveSpeedRatio;
        const walkBobY = Math.cos(elapsed * 9.6) * 0.018 * moveSpeedRatio;

        const radius = 3.28;
        const camX =
          hPos.x + 0.68 + Math.sin(clampedYaw) * radius + walkSwayX;
        const camZ = hPos.z + Math.cos(clampedYaw) * radius;
        const camY = hPos.y + 1.66 + clampedPitch * 0.85 + walkBobY;

        _desiredPos.set(camX, camY, camZ);

        // Look target ahead of Harsha, with gentle assist toward headlights in CAR_VISIBLE
        let lookTargetX = hPos.x - 0.15 - Math.sin(clampedYaw) * 4.2;
        let lookTargetY = hPos.y + 1.34 - clampedPitch * 1.6;
        let lookTargetZ = hPos.z - 4.8;

        if (stateId === 'CAR_VISIBLE') {
          // Subtle camera assist toward the distant headlights without forcing a full lock
          lookTargetX = THREE.MathUtils.lerp(lookTargetX, carWorldPos.x * 0.6, 0.28);
          lookTargetY = THREE.MathUtils.lerp(lookTargetY, 1.05, 0.22);
        }

        _desiredLook.set(lookTargetX, lookTargetY, lookTargetZ);
        posDamp = 5.2;
        lookDamp = 6.0;
      }

      // Frame-rate independent exponential damping for silky camera blending
      currentPos.x = THREE.MathUtils.damp(currentPos.x, _desiredPos.x, posDamp, dt);
      currentPos.y = THREE.MathUtils.damp(currentPos.y, _desiredPos.y, posDamp, dt);
      currentPos.z = THREE.MathUtils.damp(currentPos.z, _desiredPos.z, posDamp, dt);

      currentLook.x = THREE.MathUtils.damp(currentLook.x, _desiredLook.x, lookDamp, dt);
      currentLook.y = THREE.MathUtils.damp(currentLook.y, _desiredLook.y, lookDamp, dt);
      currentLook.z = THREE.MathUtils.damp(currentLook.z, _desiredLook.z, lookDamp, dt);

      currentFov = THREE.MathUtils.damp(currentFov, targetFov, 4.0, dt);
      if (Math.abs(camera.fov - currentFov) > 0.05) {
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }

      camera.position.copy(currentPos);
      camera.lookAt(currentLook);
    },
  };
}
