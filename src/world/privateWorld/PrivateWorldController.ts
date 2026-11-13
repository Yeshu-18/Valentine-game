import * as THREE from 'three';
import { PlayerAvatarBundle } from '../PlayerCharacter';
import { CircleCollider } from '../VegetationSystem';
import { dampAlpha, dampValue } from '../terrainMath';
import {
  PRIVATE_WORLD_ANCHORS,
  getPrivatePlayerGroundHeight,
  getPrivateRegionAtPosition,
  getPrivateTerrainHeight,
  isNearPrivateReturnGate,
  isPrivateWalkablePosition,
} from './privateWorldMath';
import {
  PrivateInteractionMode,
  PrivateInteractionPrompt,
  STARGAZING_TELESCOPE_POS,
  TelescopeViewState,
  createPrivateWorldInteractionSystem,
  getSeatedCameraPose,
} from './PrivateWorldInteractionSystem';
import { TrailDestinationId } from './PrivateTrailSignSystem';

export interface PrivateWorldTelemetry {
  x: number;
  y: number;
  z: number;
  terrainElevation: number;
  speed: number;
  isSprinting: boolean;
  regionName: string;
  regionSubtitle: string;
  nearReturnGate: boolean;
  isTopDownView: boolean;
  debugOverlayEnabled: boolean;
  activeInteractionPrompt: PrivateInteractionPrompt | null;
  interactionMode: PrivateInteractionMode;
  telescopeView: TelescopeViewState | null;
  connectedSkyNodesCount: number;
  discoveredLettersMask?: number;
  routeDistances?: Record<TrailDestinationId, number>;
}

export interface PrivateWorldControllerCallbacks {
  onReturnGateInteract?: () => void;
  onTouchPondWater?: (waterX: number, waterZ: number) => void;
  onTelescopeStateChange?: (
    active: boolean,
    highlightStrength: number,
    enteringOrExiting?: boolean,
    connectedSkyNodesCount?: number,
    focusedNodeIndex?: number,
    discoveredLettersMask?: number,
  ) => void;
  onSeatedStateChange?: (sitting: boolean) => void;
  getRouteDistanceTo?: (
    playerX: number,
    playerZ: number,
    destinationId: TrailDestinationId,
  ) => number;
}

export interface PrivateWorldControllerBundle {
  setActive: (active: boolean) => void;
  isActive: () => boolean;
  resetToArrivalShore: () => void;
  teleportTo: (
    x: number,
    z: number,
    facingYawRadians?: number,
    forcedElevationY?: number,
  ) => void;
  setTopDownView: (topDown: boolean) => void;
  isTopDownView: () => boolean;
  triggerPrimaryInteraction: () => void;
  exitInteractionMode: () => void;
  update: (delta: number, elapsedTime: number) => void;
  getPosition: () => THREE.Vector3;
  getVelocity: () => THREE.Vector3;
  getTelemetry: () => PrivateWorldTelemetry;
  dispose: () => void;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3();

function wrapAnglePi(a: number): number {
  let r = (a + Math.PI) % (2.0 * Math.PI);
  if (r < 0) r += 2.0 * Math.PI;
  return r - Math.PI;
}

export function createPrivateWorldController(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  avatar: PlayerAvatarBundle,
  colliders: CircleCollider[],
  onReturnGateInteractOrCallbacks?:
    | (() => void)
    | PrivateWorldControllerCallbacks,
): PrivateWorldControllerBundle {
  const callbacks: PrivateWorldControllerCallbacks =
    typeof onReturnGateInteractOrCallbacks === 'function'
      ? { onReturnGateInteract: onReturnGateInteractOrCallbacks }
      : (onReturnGateInteractOrCallbacks ?? {});

  let active = false;
  let topDownView = false;

  const arrivalAnchor = PRIVATE_WORLD_ANCHORS.ARRIVAL_SHORE;
  const playerPos = new THREE.Vector3(
    arrivalAnchor.x,
    getPrivatePlayerGroundHeight(arrivalAnchor.x, arrivalAnchor.z),
    arrivalAnchor.z,
  );
  const playerVel = new THREE.Vector3();
  const savedBeforeSeatPos = new THREE.Vector3().copy(playerPos);
  let savedBeforeSeatYaw = arrivalAnchor.defaultFacingYaw;

  let cameraYaw = arrivalAnchor.defaultFacingYaw; // Facing East (+X) toward the Stargazing Sanctuary & sky
  let cameraPitch = -0.14; // Tilted slightly upward so the starry sky & constellations are immediately visible!
  let facingYaw = arrivalAnchor.defaultFacingYaw;
  let cameraDistance = 5.6;

  // Seated camera gentle look-around offsets
  let seatedLookYawOffset = 0;
  let seatedLookPitchOffset = 0;

  const keys: Record<string, boolean> = {};
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

  const interactionSystem = createPrivateWorldInteractionSystem({
    onReturnGateInteract: () => {
      callbacks.onReturnGateInteract?.();
    },
    onModeChanged: (nextMode, prevMode) => {
      Object.keys(keys).forEach((k) => {
        keys[k] = false;
      });
      playerVel.set(0, 0, 0);
      seatedLookYawOffset = 0;
      seatedLookPitchOffset = 0;

      if (nextMode === 'TELESCOPE') {
        avatar.group.visible = false;
        const tState = interactionSystem.getTelescopeState();
        callbacks.onTelescopeStateChange?.(
          true,
          tState.highlightStrength,
          true,
          tState.connectedNodesCount,
          tState.focusedNodeIndex,
          tState.discoveredMask,
        );
      } else if (nextMode === 'SEATED_LOVESEAT') {
        if (prevMode !== 'SEATED_LOVESEAT') {
          savedBeforeSeatPos.copy(playerPos);
          savedBeforeSeatYaw = facingYaw;
        }
        const seatPose = getSeatedCameraPose(nextMode);
        if (seatPose) {
          avatar.group.visible = true;
          avatar.group.position.copy(seatPose.avatarPos);
          avatar.group.rotation.set(0, seatPose.avatarYaw, 0);
        }
        const tState = interactionSystem.getTelescopeState();
        callbacks.onTelescopeStateChange?.(
          false,
          0,
          false,
          tState.connectedNodesCount,
          tState.focusedNodeIndex,
          tState.discoveredMask,
        );
        callbacks.onSeatedStateChange?.(true);
      } else if (nextMode === 'NONE') {
        avatar.group.visible = true;
        const tState = interactionSystem.getTelescopeState();
        if (prevMode === 'TELESCOPE') {
          callbacks.onTelescopeStateChange?.(
            false,
            0,
            true,
            tState.connectedNodesCount,
            tState.focusedNodeIndex,
            tState.discoveredMask,
          );
        } else if (prevMode === 'SEATED_LOVESEAT') {
          callbacks.onTelescopeStateChange?.(
            false,
            0,
            false,
            tState.connectedNodesCount,
            tState.focusedNodeIndex,
            tState.discoveredMask,
          );
          playerPos.copy(savedBeforeSeatPos);
          facingYaw = savedBeforeSeatYaw;
          avatar.group.position.copy(playerPos);
          avatar.group.rotation.set(0, facingYaw, 0);
          callbacks.onSeatedStateChange?.(false);
        }
      }
    },
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (!active) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (e.code === 'Escape') {
      if (interactionSystem.handleKeyEscape()) {
        e.preventDefault();
        return;
      }
    }

    if (e.code === 'KeyE') {
      if (interactionSystem.handleKeyE(playerPos.x, playerPos.z, playerPos.y)) {
        e.preventDefault();
        return;
      }
    }

    if (!interactionSystem.isMovementLocked()) {
      keys[e.code] = true;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  const onMouseDown = (e: MouseEvent) => {
    if (!active || e.button !== 0) return;
    isDragging = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  };

  const onMouseUp = () => {
    isDragging = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!active || topDownView) return;
    const isLocked = document.pointerLockElement === domElement;
    const mode = interactionSystem.getMode();

    if (mode === 'TELESCOPE') {
      const dx = isLocked ? e.movementX : e.clientX - prevMouseX;
      const dy = isLocked ? e.movementY : e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      if (Math.abs(dx) < 120 && Math.abs(dy) < 120) {
        const teleSens = isLocked || isDragging ? 0.0018 : 0.0012;
        interactionSystem.adjustTelescopeLook(-dx * teleSens, -dy * teleSens);
      }
      return;
    }

    if (!isLocked && !isDragging) return;

    const dx = isLocked ? e.movementX : e.clientX - prevMouseX;
    const dy = isLocked ? e.movementY : e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    if (mode === 'SEATED_LOVESEAT') {
      const seatSens = 0.0022;
      seatedLookYawOffset = THREE.MathUtils.clamp(
        seatedLookYawOffset - dx * seatSens,
        -1.15,
        1.15,
      );
      seatedLookPitchOffset = THREE.MathUtils.clamp(
        seatedLookPitchOffset - dy * seatSens,
        -0.35,
        0.65,
      );
      return;
    }

    const sens = 0.0026;
    cameraYaw = wrapAnglePi(cameraYaw - dx * sens);
    cameraPitch = THREE.MathUtils.clamp(
      cameraPitch + dy * sens,
      -0.68,
      1.05,
    );
  };

  const onWheel = (e: WheelEvent) => {
    if (!active || topDownView) return;
    const mode = interactionSystem.getMode();
    if (mode === 'TELESCOPE') {
      interactionSystem.adjustTelescopeLook(
        -e.deltaX * 0.0015,
        -e.deltaY * 0.0015,
      );
      return;
    }
    if (mode !== 'NONE') return;

    if (Math.abs(e.deltaX) > 0.25 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
      const panDx = THREE.MathUtils.clamp(e.deltaX, -60, 60);
      cameraYaw = wrapAnglePi(cameraYaw - panDx * 0.0042);
      return;
    }
    cameraDistance = THREE.MathUtils.clamp(
      cameraDistance + e.deltaY * 0.004,
      2.4,
      11.5,
    );
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  domElement.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('wheel', onWheel, { passive: true });

  function resolveCollisionsAndWalkability(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
  ): { x: number; z: number } {
    let nx = targetX;
    let nz = targetZ;
    const playerRadius = 0.44;

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const dx = nx - c.x;
      const dz = nz - c.z;
      const minDist = c.radius + playerRadius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist && distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        nx += dx * push;
        nz += dz * push;
      }
    }

    if (!isPrivateWalkablePosition(nx, nz)) {
      if (isPrivateWalkablePosition(nx, startZ)) {
        nz = startZ;
      } else if (isPrivateWalkablePosition(startX, nz)) {
        nx = startX;
      } else {
        nx = startX;
        nz = startZ;
      }
    }

    return { x: nx, z: nz };
  }

  function computeCameraHeight(
    camX: number,
    camZ: number,
    vertOffset: number,
  ): number {
    const camTerrainFloor = Math.max(0.85, getPrivateTerrainHeight(camX, camZ) + 0.65);
    return Math.max(playerPos.y + vertOffset, camTerrainFloor);
  }

  function snapCameraBehindPlayer() {
    if (Math.abs(camera.fov - 60) > 0.05) {
      camera.fov = 60;
      camera.updateProjectionMatrix();
    }
    if (topDownView) {
      camera.position.set(0, 48, -6);
      camera.lookAt(0, 3.48, 0);
      _currentLookAt.set(0, 3.48, 0);
      return;
    }
    const horizDist = Math.cos(cameraPitch) * cameraDistance;
    const vertOffset = Math.sin(cameraPitch) * cameraDistance + 1.55;
    const camX = playerPos.x - Math.sin(cameraYaw) * horizDist;
    const camZ = playerPos.z - Math.cos(cameraYaw) * horizDist;
    const camY = computeCameraHeight(camX, camZ, vertOffset);
    camera.position.set(camX, camY, camZ);
    _currentLookAt.set(playerPos.x, playerPos.y + 1.38, playerPos.z);
    camera.lookAt(_currentLookAt);
  }

  function teleportTo(
    x: number,
    z: number,
    facingYawRadians = Math.PI / 2,
  ) {
    interactionSystem.cancelActiveMode();
    const groundY = getPrivatePlayerGroundHeight(x, z);
    playerPos.set(x, groundY, z);
    playerVel.set(0, 0, 0);
    facingYaw = facingYawRadians;
    cameraYaw = facingYawRadians;
    cameraPitch = -0.14;

    avatar.group.visible = true;
    avatar.setFirstPersonVisibility(false);
    avatar.setActivityPose('none');
    avatar.resetNeutralPose?.();
    avatar.group.position.copy(playerPos);
    avatar.group.rotation.set(0, facingYaw, 0);

    interactionSystem.updateProximity(playerPos.x, playerPos.z, playerPos.y);
    snapCameraBehindPlayer();
  }

  return {
    setActive(nextActive: boolean) {
      active = nextActive;
      if (!nextActive) {
        interactionSystem.cancelActiveMode();
        if (Math.abs(camera.fov - 60) > 0.05) {
          camera.fov = 60;
          camera.updateProjectionMatrix();
        }
        Object.keys(keys).forEach((k) => {
          keys[k] = false;
        });
        isDragging = false;
      }
    },

    isActive() {
      return active;
    },

    resetToArrivalShore() {
      teleportTo(
        arrivalAnchor.x,
        arrivalAnchor.z,
        arrivalAnchor.defaultFacingYaw,
      );
    },

    teleportTo,

    setTopDownView(topDown: boolean) {
      if (topDown) {
        interactionSystem.cancelActiveMode();
      }
      topDownView = topDown;
      snapCameraBehindPlayer();
    },

    isTopDownView() {
      return topDownView;
    },

    triggerPrimaryInteraction() {
      if (!active) return;
      interactionSystem.handleKeyE(playerPos.x, playerPos.z, playerPos.y);
    },

    exitInteractionMode() {
      interactionSystem.cancelActiveMode();
    },

    update(delta: number, elapsedTime: number) {
      if (!active) return;

      const mode = interactionSystem.getMode();

      const targetFov = mode === 'TELESCOPE' ? 34.0 : 60.0;
      if (Math.abs(camera.fov - targetFov) > 0.02) {
        camera.fov = dampValue(camera.fov, targetFov, 9.5, delta);
        camera.updateProjectionMatrix();
      }

      // 1. Dedicated Telescope Eyepiece Camera Mode
      if (mode === 'TELESCOPE') {
        const teleState = interactionSystem.getTelescopeState();
        callbacks.onTelescopeStateChange?.(
          true,
          teleState.highlightStrength,
          false,
          teleState.connectedNodesCount,
          teleState.focusedNodeIndex,
          teleState.discoveredMask,
        );

        _desiredCamPos.set(
          STARGAZING_TELESCOPE_POS.x - 0.88,
          STARGAZING_TELESCOPE_POS.y + 1.56,
          STARGAZING_TELESCOPE_POS.z,
        );
        const cosP = Math.cos(teleState.pitch);
        const lookDist = 180.0;
        _desiredLookAt.set(
          _desiredCamPos.x + Math.sin(teleState.yaw) * cosP * lookDist,
          _desiredCamPos.y + Math.sin(teleState.pitch) * lookDist,
          _desiredCamPos.z + Math.cos(teleState.yaw) * cosP * lookDist,
        );

        const camAlpha = dampAlpha(11.0, delta);
        camera.position.lerp(_desiredCamPos, camAlpha);
        _currentLookAt.lerp(_desiredLookAt, camAlpha);
        camera.lookAt(_currentLookAt);
        return;
      }

      // 2. Seated Stargazing Loveseat Mode
      if (mode === 'SEATED_LOVESEAT') {
        const seatPose = getSeatedCameraPose(mode);
        if (seatPose) {
          avatar.group.position.copy(seatPose.avatarPos);
          avatar.group.rotation.set(0, seatPose.avatarYaw, 0);
          avatar.updateAnimation(
            delta,
            0,
            false,
            elapsedTime,
            false,
            false,
            0,
            0,
            false,
          );

          _desiredCamPos.copy(seatPose.camPos);
          const baseDir = _desiredLookAt
            .copy(seatPose.lookAt)
            .sub(seatPose.camPos);
          const baseDist = baseDir.length();
          const baseYaw = Math.atan2(baseDir.x, baseDir.z);
          const basePitch = Math.asin(
            THREE.MathUtils.clamp(
              baseDir.y / Math.max(0.1, baseDist),
              -0.9,
              0.9,
            ),
          );

          const adjYaw = baseYaw + seatedLookYawOffset;
          const adjPitch = THREE.MathUtils.clamp(
            basePitch + seatedLookPitchOffset,
            0.12,
            0.95,
          );
          const cosP = Math.cos(adjPitch);
          _desiredLookAt.set(
            _desiredCamPos.x + Math.sin(adjYaw) * cosP * baseDist,
            _desiredCamPos.y + Math.sin(adjPitch) * baseDist,
            _desiredCamPos.z + Math.cos(adjYaw) * cosP * baseDist,
          );

          const tState = interactionSystem.getTelescopeState();
          callbacks.onTelescopeStateChange?.(
            false,
            0,
            false,
            tState.connectedNodesCount,
            tState.focusedNodeIndex,
            tState.discoveredMask,
          );

          const camAlpha = dampAlpha(8.5, delta);
          camera.position.lerp(_desiredCamPos, camAlpha);
          _currentLookAt.lerp(_desiredLookAt, camAlpha);
          camera.lookAt(_currentLookAt);
        }
        return;
      }

      // 3. Normal Third-Person Movement on the Stargazing Sanctuary Deck
      const moveForward = Boolean(keys['KeyW'] || keys['ArrowUp']);
      const moveBackward = Boolean(keys['KeyS'] || keys['ArrowDown']);
      const moveLeft = Boolean(keys['KeyA'] || keys['ArrowLeft']);
      const moveRight = Boolean(keys['KeyD'] || keys['ArrowRight']);
      const isSprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);

      const activeCamYaw = topDownView ? 0 : cameraYaw;
      _forward
        .set(Math.sin(activeCamYaw), 0, Math.cos(activeCamYaw))
        .normalize();
      _right.set(-_forward.z, 0, _forward.x).normalize();

      _moveDir.set(0, 0, 0);
      if (moveForward) _moveDir.add(_forward);
      if (moveBackward) _moveDir.sub(_forward);
      if (moveRight) _moveDir.add(_right);
      if (moveLeft) _moveDir.sub(_right);

      const hasInput = _moveDir.lengthSq() > 0.001;
      if (hasInput) {
        _moveDir.normalize();
      }

      const maxSpeed = isSprinting ? 6.8 : 4.2;
      const targetVx = hasInput ? _moveDir.x * maxSpeed : 0;
      const targetVz = hasInput ? _moveDir.z * maxSpeed : 0;

      const accelAlpha = dampAlpha(hasInput ? 11.0 : 14.0, delta);
      playerVel.x += (targetVx - playerVel.x) * accelAlpha;
      playerVel.z += (targetVz - playerVel.z) * accelAlpha;

      const speed = Math.hypot(playerVel.x, playerVel.z);

      if (speed > 0.02) {
        const nextX = playerPos.x + playerVel.x * delta;
        const nextZ = playerPos.z + playerVel.z * delta;
        const resolved = resolveCollisionsAndWalkability(
          playerPos.x,
          playerPos.z,
          nextX,
          nextZ,
        );
        playerPos.x = resolved.x;
        playerPos.z = resolved.z;

        const desiredFacing = Math.atan2(playerVel.x, playerVel.z);
        const yawDiff = wrapAnglePi(desiredFacing - facingYaw);
        facingYaw = wrapAnglePi(facingYaw + yawDiff * dampAlpha(12.0, delta));
      }

      const targetGroundY = getPrivatePlayerGroundHeight(
        playerPos.x,
        playerPos.z,
      );
      playerPos.y = dampValue(playerPos.y, targetGroundY, 18.0, delta);

      interactionSystem.updateProximity(playerPos.x, playerPos.z, playerPos.y);

      const tState = interactionSystem.getTelescopeState();
      callbacks.onTelescopeStateChange?.(
        false,
        0,
        false,
        tState.connectedNodesCount,
        tState.focusedNodeIndex,
        tState.discoveredMask,
      );

      avatar.group.position.copy(playerPos);
      avatar.group.rotation.set(0, facingYaw, 0);
      avatar.updateAnimation(
        delta,
        speed,
        isSprinting && speed > 4.6,
        elapsedTime,
        false,
        false,
        0,
        0,
        false,
      );

      if (topDownView) {
        _desiredCamPos.set(0, 48, -6);
        _desiredLookAt.set(0, 3.48, 0);
        camera.position.lerp(_desiredCamPos, dampAlpha(8.0, delta));
        _currentLookAt.set(0, 3.48, 0);
        camera.lookAt(_currentLookAt);
      } else {
        const horizDist = Math.cos(cameraPitch) * cameraDistance;
        const vertOffset = Math.sin(cameraPitch) * cameraDistance + 1.55;
        const camX = playerPos.x - Math.sin(cameraYaw) * horizDist;
        const camZ = playerPos.z - Math.cos(cameraYaw) * horizDist;
        const camY = computeCameraHeight(camX, camZ, vertOffset);

        _desiredCamPos.set(camX, camY, camZ);
        _desiredLookAt.set(playerPos.x, playerPos.y + 1.38, playerPos.z);

        const camAlpha = dampAlpha(14.0, delta);
        camera.position.lerp(_desiredCamPos, camAlpha);
        _currentLookAt.lerp(_desiredLookAt, camAlpha);
        camera.lookAt(_currentLookAt);
      }
    },

    getPosition() {
      return playerPos;
    },

    getVelocity() {
      return playerVel;
    },

    getTelemetry(): PrivateWorldTelemetry {
      const reg = getPrivateRegionAtPosition();
      const speed = Math.hypot(playerVel.x, playerVel.z);
      const mode = interactionSystem.getMode();

      return {
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
        terrainElevation: playerPos.y,
        speed,
        isSprinting: !!(keys['ShiftLeft'] || keys['ShiftRight']) && speed > 4.5,
        regionName: reg.name,
        regionSubtitle: reg.subtitle,
        nearReturnGate: isNearPrivateReturnGate(playerPos.x, playerPos.z),
        isTopDownView: topDownView,
        debugOverlayEnabled: false,
        activeInteractionPrompt: interactionSystem.getNearestPrompt(),
        interactionMode: mode,
        telescopeView:
          mode === 'TELESCOPE' ? interactionSystem.getTelescopeState() : null,
        connectedSkyNodesCount: interactionSystem.getConnectedSkyNodesCount(),
        discoveredLettersMask: interactionSystem.getDiscoveredLettersMask(),
      };
    },

    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('wheel', onWheel);
    },
  };
}
