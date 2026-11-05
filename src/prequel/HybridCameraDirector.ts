import * as THREE from 'three';
import { Chapter1StateId, HybridCameraState } from './chapter1StateMachine';
import { HarshaCharacterBundle } from './HarshaStreetCharacter';

export interface HybridCameraOptions {
  shoulderSide?: 1 | -1;
  zoomDistance?: number;
  isCrouching?: boolean;
  isJogging?: boolean;
  quickLookBack?: boolean;
  kidnapperWorldPos?: THREE.Vector3;
}

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
    options?: HybridCameraOptions,
  ) => void;
  getCurrentCameraState: () => HybridCameraState;
  snapToHarsha: (harsha: HarshaCharacterBundle) => void;
}

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();

/**
 * AAA 4-State Hybrid Camera Director (The Last of Us Part II inspired):
 * - FOLLOW / LOOK_AROUND: Immersive 360° Pointer-Lock Mouse Orbit with Over-the-Shoulder Side Swap [V],
 *   Scroll-Wheel Zoom, Crouch Height Adaptation [C], Jog FOV Expansion [Shift], and Quick Look-Back [Q].
 * - PHONE_CINEMATIC: Close over-the-shoulder framing shifting focus to the 3D smartphone in Harsha's hand.
 * - CAR_CINEMATIC: Directed multi-angle thriller choreography for the approaching sedan, the Masked Man
 *   stepping out, the kidnap capture into the rear cabin, and the sudden fishtail drift getaway.
 */
export function createHybridCameraDirector(
  camera: THREE.PerspectiveCamera,
): HybridCameraDirector {
  const currentPos = new THREE.Vector3(1.2, 2.4, 4.2);
  const currentLook = new THREE.Vector3(0, 1.35, -3.0);
  let activeCameraState: HybridCameraState = 'FOLLOW';
  let currentFov = 50;
  let currentShoulderOffset = 0.58;

  return {
    getCurrentCameraState() {
      return activeCameraState;
    },
    snapToHarsha(harsha) {
      const p = harsha.group.position;
      currentPos.set(p.x + 0.58, p.y + 1.62, p.z + 2.95);
      currentLook.set(p.x - 0.1, p.y + 1.32, p.z - 4.0);
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
      options,
    ) {
      const hPos = harsha.group.position;
      const shoulderSide = options?.shoulderSide ?? 1;
      const zoomDist = options?.zoomDistance ?? 2.85;
      const isCrouching = options?.isCrouching ?? false;
      const isJogging = options?.isJogging ?? false;
      const quickLookBack = options?.quickLookBack ?? false;
      const kidnapperPos = options?.kidnapperWorldPos;

      let posDamp = 5.0;
      let lookDamp = 6.2;
      let targetFov = 50;

      // Smoothly interpolate shoulder side offset (V key swaps left/right shoulder like TLOU2)
      currentShoulderOffset = THREE.MathUtils.damp(
        currentShoulderOffset,
        shoulderSide * 0.54,
        6.5,
        dt,
      );

      // 1. OPENING CRANE-DOWN REVEAL
      if (stateId === 'SCENE_START' || stateId === 'OPENING_CINEMATIC') {
        activeCameraState = 'FOLLOW';
        const progress =
          stateId === 'SCENE_START'
            ? 0
            : Math.min(1, stateElapsed / 3.8);
        const smoothT = progress * progress * (3 - 2 * progress);

        _desiredPos.set(
          THREE.MathUtils.lerp(2.4, hPos.x + currentShoulderOffset, smoothT),
          THREE.MathUtils.lerp(4.2, hPos.y + 1.62, smoothT),
          THREE.MathUtils.lerp(hPos.z + 6.4, hPos.z + zoomDist, smoothT),
        );
        _desiredLook.set(
          THREE.MathUtils.lerp(0.0, hPos.x - 0.08, smoothT),
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
        // 2. PHONE_CINEMATIC: Over-the-shoulder close framing on the 3D smartphone
        activeCameraState = 'PHONE_CINEMATIC';
        const shoulder = harsha.shoulderWorldPos;
        const phonePos = harsha.phoneAnchorWorldPos;

        if (stateId === 'PHONE_VIBRATION') {
          _desiredPos.set(hPos.x + 0.52, hPos.y + 1.54, hPos.z + 1.62);
          _desiredLook.set(shoulder.x - 0.08, shoulder.y - 0.05, shoulder.z - 0.8);
          targetFov = 44;
          posDamp = 3.8;
          lookDamp = 4.5;
        } else {
          _desiredPos.set(
            shoulder.x + 0.16,
            shoulder.y + 0.08,
            shoulder.z + 0.56,
          );
          _desiredLook.set(
            phonePos.x - 0.02,
            phonePos.y + 0.01,
            phonePos.z - 0.12,
          );
          targetFov = 37;
          posDamp = 4.2;
          lookDamp = 5.4;
        }
      } else if (
        stateId === 'CAR_APPROACHING' ||
        stateId === 'CAR_STOPPED' ||
        stateId === 'MASKED_MAN_EXITS' ||
        stateId === 'KIDNAP_GRAB' ||
        stateId === 'CAR_DRIFT_GETAWAY' ||
        stateId === 'CHAPTER_END' ||
        stateId === 'TRANSITION_TO_CHAPTER_2'
      ) {
        // 3. CAR_CINEMATIC: Directed multi-angle thriller sequence
        activeCameraState = 'CAR_CINEMATIC';

        if (stateId === 'CAR_APPROACHING') {
          if (stateElapsed < 2.1) {
            // Shot A: Over Harsha's shoulder toward the approaching headlights down the road
            _desiredPos.set(hPos.x + 0.55, hPos.y + 1.52, hPos.z + 2.75);
            _desiredLook.set(
              carWorldPos.x * 0.5,
              0.85,
              carWorldPos.z + 4.0,
            );
            targetFov = 46;
            posDamp = 3.6;
            lookDamp = 4.2;
          } else {
            // Shot B: Low-angle asphalt shot of the dark sedan's alloy wheels & bright headlights rolling closer
            _desiredPos.set(hPos.x + 0.85, 0.56, hPos.z + 1.85);
            _desiredLook.set(carWorldPos.x, 0.52, carWorldPos.z + 1.5);
            targetFov = 42;
            posDamp = 3.4;
            lookDamp = 4.6;
          }
        } else if (stateId === 'CAR_STOPPED') {
          // Shot C: Car noses down to a sharp stop beside Harsha; red brake glow fills the frame
          _desiredPos.set(hPos.x + 1.85, hPos.y + 1.28, hPos.z + 1.15);
          _desiredLook.set(
            (hPos.x + carWorldPos.x) * 0.5,
            hPos.y + 0.98,
            (hPos.z + carWorldPos.z) * 0.5,
          );
          targetFov = 43;
          posDamp = 3.4;
          lookDamp = 4.2;
        } else if (stateId === 'MASKED_MAN_EXITS') {
          // Shot D: Dramatic low-angle confrontation as the car door swings wide open and the Masked Man steps out and stalks toward Harsha
          const kPos = kidnapperPos ?? carWorldPos;
          const handBreathX = Math.sin(elapsed * 3.8) * 0.03;
          const handBreathY = Math.cos(elapsed * 4.5) * 0.025;
          _desiredPos.set(
            hPos.x + 1.55 + handBreathX,
            0.96 + handBreathY,
            hPos.z + 1.65,
          );
          _desiredLook.set(
            (kPos.x + hPos.x) * 0.5,
            1.18,
            (kPos.z + hPos.z) * 0.5,
          );
          targetFov = 41;
          posDamp = 4.2;
          lookDamp = 5.2;
        } else if (stateId === 'KIDNAP_GRAB') {
          // Shot E: Close thriller tracking shot as the Masked Man intercepts Harsha and pulls her into the open rear passenger door
          const kPos = kidnapperPos ?? carWorldPos;
          const tensionPulseX = Math.sin(elapsed * 8.5) * 0.035;
          const tensionPulseY = Math.cos(elapsed * 9.2) * 0.03;
          _desiredPos.set(
            carWorldPos.x + 2.65 + tensionPulseX,
            1.22 + tensionPulseY,
            carWorldPos.z - 1.95,
          );
          _desiredLook.set(
            (hPos.x + kPos.x) * 0.5,
            1.02,
            (hPos.z + kPos.z) * 0.5,
          );
          targetFov = 44;
          posDamp = 5.0;
          lookDamp = 6.5;
        } else {
          // Shot F (CAR_DRIFT_GETAWAY / CHAPTER_END): Low-angle street camera watching the sedan fishtail in tire smoke and rocket down the street!
          _desiredPos.set(1.25, 0.72, hPos.z - 3.6);
          _desiredLook.set(
            carWorldPos.x,
            0.68,
            Math.max(hPos.z - 2.0, carWorldPos.z - 2.5),
          );
          targetFov = 48;
          posDamp = 4.5;
          lookDamp = 7.5;
        }
      } else {
        // 4. FOLLOW & LOOK_AROUND: AAA 360° Free-Orbit Third-Person Camera (TLOU2 Style)
        activeCameraState =
          stateId === 'CAR_VISIBLE' || Math.abs(playerYawOffset) > 0.12
            ? 'LOOK_AROUND'
            : 'FOLLOW';

        const effectiveYaw = quickLookBack
          ? playerYawOffset + Math.PI
          : playerYawOffset;
        const clampedPitch = THREE.MathUtils.clamp(playerPitchOffset, -0.52, 0.62);

        // Subtle organic handheld walking cadence
        const cadenceFreq = isJogging ? 7.2 : isCrouching ? 4.2 : 5.2;
        const walkSwayX =
          Math.sin(elapsed * cadenceFreq) * 0.022 * moveSpeedRatio;
        const walkBobY =
          Math.cos(elapsed * cadenceFreq * 2) * 0.018 * moveSpeedRatio;

        // Orbit around Harsha with over-the-shoulder right-vector offset
        const baseHeight = isCrouching ? 1.24 : 1.58;
        const radius = zoomDist * Math.cos(clampedPitch * 0.55);

        const forwardX = -Math.sin(effectiveYaw);
        const forwardZ = -Math.cos(effectiveYaw);
        const rightX = Math.cos(effectiveYaw);
        const rightZ = -Math.sin(effectiveYaw);

        const camX =
          hPos.x -
          forwardX * radius +
          rightX * currentShoulderOffset +
          walkSwayX;
        const camZ =
          hPos.z -
          forwardZ * radius +
          rightZ * currentShoulderOffset;
        const camY =
          Math.max(0.42, hPos.y + baseHeight + Math.sin(clampedPitch) * 1.45 + walkBobY);

        _desiredPos.set(camX, camY, camZ);

        // Look target ahead of Harsha along the camera's aim vector
        let lookTargetX =
          hPos.x + forwardX * 5.2 + rightX * (currentShoulderOffset * 0.35);
        let lookTargetY =
          hPos.y + (isCrouching ? 1.02 : 1.36) - Math.sin(clampedPitch) * 2.4;
        let lookTargetZ =
          hPos.z + forwardZ * 5.2 + rightZ * (currentShoulderOffset * 0.35);

        if (stateId === 'CAR_VISIBLE' && !quickLookBack) {
          // Gentle magnetic camera assist toward distant headlights
          lookTargetX = THREE.MathUtils.lerp(lookTargetX, carWorldPos.x * 0.6, 0.22);
          lookTargetY = THREE.MathUtils.lerp(lookTargetY, 1.05, 0.18);
        }

        _desiredLook.set(lookTargetX, lookTargetY, lookTargetZ);
        targetFov = isJogging ? 54 : isCrouching ? 46 : 50;
        posDamp = 7.5;
        lookDamp = 9.0;
      }

      // Frame-rate independent exponential damping
      currentPos.x = THREE.MathUtils.damp(currentPos.x, _desiredPos.x, posDamp, dt);
      currentPos.y = THREE.MathUtils.damp(currentPos.y, _desiredPos.y, posDamp, dt);
      currentPos.z = THREE.MathUtils.damp(currentPos.z, _desiredPos.z, posDamp, dt);

      currentLook.x = THREE.MathUtils.damp(currentLook.x, _desiredLook.x, lookDamp, dt);
      currentLook.y = THREE.MathUtils.damp(currentLook.y, _desiredLook.y, lookDamp, dt);
      currentLook.z = THREE.MathUtils.damp(currentLook.z, _desiredLook.z, lookDamp, dt);

      currentFov = THREE.MathUtils.damp(currentFov, targetFov, 4.5, dt);
      if (Math.abs(camera.fov - currentFov) > 0.05) {
        camera.fov = currentFov;
        camera.updateProjectionMatrix();
      }

      camera.position.copy(currentPos);
      camera.lookAt(currentLook);
    },
  };
}
