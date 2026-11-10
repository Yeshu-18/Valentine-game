import * as THREE from 'three';
import { CELL_04_WORLD_OFFSET } from './Chapter2Config';
import { JourneyCameraShot } from './Chapter2StateMachine';

export interface JourneyCameraDirectorBundle {
  getCurrentShot: () => JourneyCameraShot;
  setOverrideShot: (shot: JourneyCameraShot | null) => void;
  getOverrideShot: () => JourneyCameraShot | null;
  updateCamera: (params: {
    dt: number;
    elapsed: number;
    authoredShot: JourneyCameraShot;
    stateElapsed: number;
    carRootGroup: THREE.Group;
    harshaFaceWorldPos: THREE.Vector3;
    playerLookYaw: number;
    playerLookPitch: number;
    zoomScale: number;
    freeOrbitMode: boolean;
    suspensionPitch: number;
    suspensionRoll: number;
  }) => void;
}

const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _localPos = new THREE.Vector3();
const _localLook = new THREE.Vector3();
const _orbitOffset = new THREE.Vector3();

/**
 * Chapter 2: Authored Cinematic & Interactive 360° Orbit Camera Choreography Director
 *
 * Calibrated for the exact unified cabin coordinates:
 * - Harsha's Seated Head / Eyes in Car Local Space: (x = +0.36, y = 1.30, z = +0.62)
 * - Harsha's Seated Lap / Hands in Car Local Space: (x = +0.36, y = 0.82, z = +0.34)
 * - Masked Driver in Car Local Space:               (x = -0.40, y = 1.24, z = -0.32)
 * - Roof Moonroof Ceiling:                          y = 1.64m
 *
 * Also supports full interactive Mouse Drag / Pointer-Lock 360° Orbit + Scroll Wheel Zoom
 * in EVERY shot (plus a dedicated Free Orbit mode) so the player never feels restricted!
 */
export function createJourneyCameraDirector(
  camera: THREE.PerspectiveCamera,
): JourneyCameraDirectorBundle {
  let activeShot: JourneyCameraShot = 'INTERIOR_FIXED_WIDE';
  let overrideShot: JourneyCameraShot | null = null;
  let lastShot: JourneyCameraShot | null = null;

  const currentPos = new THREE.Vector3();
  const currentLook = new THREE.Vector3();
  let currentFov = 46;

  return {
    getCurrentShot() {
      return activeShot;
    },
    setOverrideShot(shot) {
      overrideShot = shot;
    },
    getOverrideShot() {
      return overrideShot;
    },
    updateCamera({
      dt,
      elapsed,
      authoredShot,
      stateElapsed,
      carRootGroup,
      harshaFaceWorldPos,
      playerLookYaw,
      playerLookPitch,
      zoomScale,
      freeOrbitMode,
      suspensionPitch,
      suspensionRoll,
    }) {
      activeShot = overrideShot || authoredShot;
      const shotChanged = activeShot !== lastShot;
      lastShot = activeShot;

      let targetFov = 45;
      const gentleBreathY = Math.sin(elapsed * 1.6) * 0.004;

      // ======================================================================
      // SHOT 11: CELL 04 AWAKENING PULLBACK (Chapter 3 Opening Preview)
      // Close-up of Harsha's eyes opening on the Cell 04 pillow -> pulls back to reveal the god ray, solitary chair & heavy door
      // ======================================================================
      if (activeShot === 'CELL_04_AWAKENING_PULLBACK') {
        const pullT = THREE.MathUtils.smoothstep(stateElapsed, 1.2, 7.8);
        const startPos = new THREE.Vector3(
          harshaFaceWorldPos.x + 0.12,
          harshaFaceWorldPos.y + 0.38,
          harshaFaceWorldPos.z + 0.24,
        );
        const endPos = new THREE.Vector3(
          CELL_04_WORLD_OFFSET.x + 0.85 + Math.sin(playerLookYaw) * 1.2 * zoomScale,
          CELL_04_WORLD_OFFSET.y + 1.48 + playerLookPitch * 0.55,
          CELL_04_WORLD_OFFSET.z + 1.85 * zoomScale,
        );
        _camTargetPos.lerpVectors(startPos, endPos, pullT);

        const startLook = new THREE.Vector3(
          harshaFaceWorldPos.x,
          harshaFaceWorldPos.y + 0.02,
          harshaFaceWorldPos.z,
        );
        const endLook = new THREE.Vector3(
          CELL_04_WORLD_OFFSET.x - 0.45 + playerLookYaw * 0.65,
          CELL_04_WORLD_OFFSET.y + 1.15 + playerLookPitch * 0.38,
          CELL_04_WORLD_OFFSET.z - 0.75,
        );
        _camTargetLook.lerpVectors(startLook, endLook, pullT);
        targetFov = THREE.MathUtils.lerp(34, 52, pullT);

        if (shotChanged) {
          currentPos.copy(_camTargetPos);
          currentLook.copy(_camTargetLook);
          currentFov = targetFov;
        } else {
          currentPos.lerp(_camTargetPos, 1 - Math.exp(-6.0 * dt));
          currentLook.lerp(_camTargetLook, 1 - Math.exp(-6.5 * dt));
          currentFov = THREE.MathUtils.damp(currentFov, targetFov, 5.0, dt);
        }

        camera.fov = currentFov;
        camera.updateProjectionMatrix();
        camera.position.copy(currentPos);
        camera.lookAt(currentLook);
        return;
      }

      // ======================================================================
      // FREE 360° ORBIT MODE AROUND HARSHA'S FACE / CABIN
      // ======================================================================
      carRootGroup.updateMatrixWorld(true);

      if (freeOrbitMode) {
        const radius = 0.78 * zoomScale;
        const orbitYaw = 0.45 + playerLookYaw * 2.2;
        const orbitPitch = THREE.MathUtils.clamp(
          0.08 + playerLookPitch * 1.1,
          -0.35,
          0.65,
        );
        _orbitOffset.set(
          Math.sin(orbitYaw) * Math.cos(orbitPitch) * radius,
          Math.sin(orbitPitch) * radius,
          -Math.cos(orbitYaw) * Math.cos(orbitPitch) * radius,
        );
        // Center orbit on Harsha's seated face in car local space (0.36, 1.28, 0.60)
        _localLook.set(0.32, 1.26, 0.56);
        _localPos.copy(_localLook).add(_orbitOffset);
        _localPos.y = THREE.MathUtils.clamp(_localPos.y, 0.55, 1.56);

        _camTargetPos.copy(_localPos).applyMatrix4(carRootGroup.matrixWorld);
        _camTargetLook.copy(_localLook).applyMatrix4(carRootGroup.matrixWorld);

        currentPos.lerp(_camTargetPos, 1 - Math.exp(-14.0 * dt));
        currentLook.lerp(_camTargetLook, 1 - Math.exp(-14.0 * dt));
        camera.fov = 46;
        camera.updateProjectionMatrix();
        camera.position.copy(currentPos);
        camera.lookAt(currentLook);
        return;
      }

      // ======================================================================
      // SHOTS 1–10: CAR INTERIOR & EXTERIOR CHOREOGRAPHY (IN CAR LOCAL FRAME)
      // Harsha's Seated Head Center is at (x = +0.36, y = 1.30, z = +0.62)
      // ======================================================================
      switch (activeShot) {
        case 'INTERIOR_FIXED_WIDE': {
          // Iconic The Last of Us Rear-Cabin Perspective (image_900bc9ae.png)
          // Positioned low in the center-rear cabin directly behind Harsha, looking forward
          // between the Driver (left) and Front Passenger (right) through the front windshield
          // at the traffic jam with red glowing brake lights and the overhead green "EXIT 15" sign!
          _localPos.set(
            0.06 + playerLookYaw * 0.35,
            1.16 + gentleBreathY + playerLookPitch * 0.22,
            0.96 * zoomScale,
          );
          _localLook.set(
            0.02 + playerLookYaw * 0.75,
            1.10 + playerLookPitch * 0.55,
            -2.2,
          );
          targetFov = 54;
          break;
        }
        case 'LOW_DASHBOARD_ANGLE': {
          // 2. Dashboard / Center Console angle looking back between the front seats
          // framing the Masked Driver on the right of frame and Harsha clearly in the rear-right seat!
          _localPos.set(
            0.04 + playerLookYaw * 0.22,
            1.16 + gentleBreathY + playerLookPitch * 0.15,
            -0.48 * zoomScale,
          );
          _localLook.set(
            0.32 + playerLookYaw * 0.4,
            1.26 + playerLookPitch * 0.32,
            0.62,
          );
          targetFov = 44;
          break;
        }
        case 'SIDE_PROFILE_CLOSEUP': {
          // 3. Intimate side-profile close-up of Harsha's sculpted face (y = 1.30, z = 0.62)
          // with passing streetlights & city buildings visible through the window behind/beside her
          _localPos.set(
            -0.16 * zoomScale,
            1.31 + gentleBreathY + playerLookPitch * 0.15,
            0.42 + playerLookYaw * 0.25,
          );
          _localLook.set(
            0.36 + playerLookYaw * 0.25,
            1.29 + playerLookPitch * 0.25,
            0.60,
          );
          targetFov = 38;
          break;
        }
        case 'WINDOW_POV': {
          // 4. Over-the-Shoulder / First-Person Rear-Seat Observation Shot:
          // Frames Harsha's profile on the right edge while looking out at the passing neighbourhood,
          // glowing dashboard, Masked Driver, and oncoming traffic!
          // WASD / Mouse pans 180° around the entire cabin & windows!
          _localPos.set(0.18, 1.33 + gentleBreathY, 0.64);
          const lookAngle = -0.35 + playerLookYaw * 1.45; // Pans from Left Window (-X) -> Front Driver/Windshield (-Z) -> Right Window (+X)
          const lookDist = 3.8;
          _localLook.set(
            0.18 + Math.sin(lookAngle) * lookDist,
            1.24 + playerLookPitch * 1.85,
            0.64 - Math.cos(lookAngle) * lookDist,
          );
          targetFov = 52;
          break;
        }
        case 'FACIAL_REACTION_CLOSEUP': {
          // 5. Emotional front-diagonal close-up on Harsha's face & upper body (from clear space at x = +0.18, y = 1.29, z = +0.02,
          // well above the folded front-right passenger seat at y = 0.86m!)
          _localPos.set(
            0.18 + playerLookYaw * 0.22,
            1.29 + gentleBreathY + playerLookPitch * 0.14,
            0.04 * zoomScale,
          );
          _localLook.set(
            0.36 + playerLookYaw * 0.2,
            1.28 + playerLookPitch * 0.22,
            0.62,
          );
          targetFov = 36;
          break;
        }
        case 'EXTERIOR_TRACKING_SHOT': {
          // 6. Sweeping exterior tracking shot gliding alongside the dark sedan on the isolated route,
          // looking in through the clear side windows & moonroof at Harsha and the Masked Driver
          const driftZ = Math.sin(elapsed * 0.5) * 0.65;
          _localPos.set(
            2.35 * zoomScale,
            1.48 + playerLookPitch * 0.4,
            0.25 + driftZ + playerLookYaw * 1.2,
          );
          _localLook.set(0.25, 1.22, 0.35);
          targetFov = 45;
          break;
        }
        case 'FRONT_THREE_QUARTER_SHOT': {
          // 7. Exterior front three-quarter approach shot showing the sedan's headlights illuminating the concealed portico
          _localPos.set(
            -2.45 * zoomScale + playerLookYaw * 1.1,
            1.42 + playerLookPitch * 0.4,
            -4.1 * zoomScale,
          );
          _localLook.set(0.2, 1.12, 0.2);
          targetFov = 44;
          break;
        }
        case 'WHEEL_LEVEL_SHOT': {
          // 8. Low-angle shot at wheel level as the alloy rims & tyres roll to a stop on the courtyard concrete
          _localPos.set(
            1.85 * zoomScale,
            0.48 + playerLookPitch * 0.2,
            -0.55 + playerLookYaw * 0.6,
          );
          _localLook.set(0.75, 0.44, -1.35);
          targetFov = 42;
          break;
        }
        case 'INTERIOR_OVER_SHOULDER': {
          // 9. Interior over-shoulder view from behind the left seat looking past Harsha (y = 1.30)
          // as the rear-right door swings wide open and the exterior figure approaches!
          _localPos.set(
            -0.32,
            1.36 + gentleBreathY + playerLookPitch * 0.15,
            0.78,
          );
          _localLook.set(
            0.65 + playerLookYaw * 0.35,
            1.24 + playerLookPitch * 0.28,
            0.52,
          );
          targetFov = 46;
          break;
        }
        case 'CONTROLLED_PUSH_IN': {
          // 10. Scene 5.1 Perspective Transition: deliberate push-in toward Harsha's eyes (0.36, 1.31, 0.62) before blackout
          const pushT = THREE.MathUtils.clamp(stateElapsed / 4.2, 0, 1);
          _localPos.set(
            THREE.MathUtils.lerp(0.12, 0.28, pushT),
            1.31 + gentleBreathY,
            THREE.MathUtils.lerp(0.08, 0.34, pushT),
          );
          _localLook.set(0.36, 1.30, 0.62);
          targetFov = THREE.MathUtils.lerp(38, 28, pushT);
          break;
        }
      }

      // Add restrained vehicle suspension response to interior shots
      const isInterior =
        activeShot !== 'EXTERIOR_TRACKING_SHOT' &&
        activeShot !== 'FRONT_THREE_QUARTER_SHOT' &&
        activeShot !== 'WHEEL_LEVEL_SHOT';
      if (isInterior) {
        _localPos.y += suspensionPitch * 0.15;
        _localPos.x += suspensionRoll * 0.18;
      }

      // Transform from car local space to world space
      _camTargetPos.copy(_localPos).applyMatrix4(carRootGroup.matrixWorld);
      _camTargetLook.copy(_localLook).applyMatrix4(carRootGroup.matrixWorld);

      if (shotChanged) {
        currentPos.copy(_camTargetPos);
        currentLook.copy(_camTargetLook);
        currentFov = targetFov;
      } else {
        const posDamp = isInterior ? 14.0 : 7.5;
        currentPos.lerp(_camTargetPos, 1 - Math.exp(-posDamp * dt));
        currentLook.lerp(_camTargetLook, 1 - Math.exp(-13.0 * dt));
        currentFov = THREE.MathUtils.damp(currentFov, targetFov, 6.5, dt);
      }

      camera.fov = currentFov;
      camera.updateProjectionMatrix();
      camera.position.copy(currentPos);
      camera.lookAt(currentLook);
    },
  };
}
