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
}

export interface PrivateWorldControllerBundle {
  setActive: (active: boolean) => void;
  isActive: () => boolean;
  resetToArrivalShore: () => void;
  teleportTo: (x: number, z: number, facingYawRadians?: number) => void;
  setTopDownView: (topDown: boolean) => void;
  isTopDownView: () => boolean;
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
  onReturnGateInteract?: () => void,
): PrivateWorldControllerBundle {
  let active = false;
  let topDownView = false;

  const arrivalAnchor = PRIVATE_WORLD_ANCHORS.ARRIVAL_SHORE;
  const playerPos = new THREE.Vector3(
    arrivalAnchor.x,
    getPrivatePlayerGroundHeight(arrivalAnchor.x, arrivalAnchor.z),
    arrivalAnchor.z,
  );
  const playerVel = new THREE.Vector3();

  let cameraYaw = arrivalAnchor.defaultFacingYaw; // 0 = facing North (+Z) inland
  let cameraPitch = 0.16;
  let facingYaw = arrivalAnchor.defaultFacingYaw;
  let cameraDistance = 6.2;

  const keys: Record<string, boolean> = {};
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!active) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    keys[e.code] = true;

    if (
      e.code === 'KeyE' &&
      isNearPrivateReturnGate(playerPos.x, playerPos.z)
    ) {
      e.preventDefault();
      onReturnGateInteract?.();
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
    if (!isLocked && !isDragging) return;

    const dx = isLocked ? e.movementX : e.clientX - prevMouseX;
    const dy = isLocked ? e.movementY : e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    const sens = 0.0026;
    cameraYaw = wrapAnglePi(cameraYaw - dx * sens);
    cameraPitch = THREE.MathUtils.clamp(
      cameraPitch + dy * sens,
      -0.38,
      1.15,
    );
  };

  const onWheel = (e: WheelEvent) => {
    if (!active || topDownView) return;
    if (Math.abs(e.deltaX) > 0.25 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
      const panDx = THREE.MathUtils.clamp(e.deltaX, -60, 60);
      cameraYaw = wrapAnglePi(cameraYaw - panDx * 0.0042);
      return;
    }
    cameraDistance = THREE.MathUtils.clamp(
      cameraDistance + e.deltaY * 0.004,
      2.4,
      12.5,
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
    const playerRadius = 0.45;

    // 1. Circle Collider Push-Out
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

    // 2. Terrain Walkability & Ocean Boundary Check (with axis-sliding fallback)
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

  function snapCameraBehindPlayer() {
    if (topDownView) {
      camera.position.set(0, 395, -24);
      camera.lookAt(0, 0, 0);
      return;
    }
    const horizDist = Math.cos(cameraPitch) * cameraDistance;
    const vertOffset = Math.sin(cameraPitch) * cameraDistance + 1.55;
    camera.position.set(
      playerPos.x - Math.sin(cameraYaw) * horizDist,
      playerPos.y + vertOffset,
      playerPos.z - Math.cos(cameraYaw) * horizDist,
    );
    camera.lookAt(playerPos.x, playerPos.y + 1.38, playerPos.z);
  }

  function teleportTo(x: number, z: number, facingYawRadians = 0) {
    const groundY = getPrivatePlayerGroundHeight(x, z);
    playerPos.set(x, groundY, z);
    playerVel.set(0, 0, 0);
    facingYaw = facingYawRadians;
    cameraYaw = facingYawRadians;
    cameraPitch = 0.16;

    avatar.group.visible = true;
    avatar.setFirstPersonVisibility(false);
    avatar.setActivityPose('none');
    avatar.resetNeutralPose?.();
    avatar.group.position.copy(playerPos);
    avatar.group.rotation.set(0, facingYaw, 0);

    snapCameraBehindPlayer();
  }

  return {
    setActive(nextActive: boolean) {
      active = nextActive;
      if (!nextActive) {
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
      topDownView = topDown;
      snapCameraBehindPlayer();
    },

    isTopDownView() {
      return topDownView;
    },

    update(delta: number, elapsedTime: number) {
      if (!active) return;

      const moveForward = Boolean(keys['KeyW'] || keys['ArrowUp']);
      const moveBackward = Boolean(keys['KeyS'] || keys['ArrowDown']);
      const moveLeft = Boolean(keys['KeyA'] || keys['ArrowLeft']);
      const moveRight = Boolean(keys['KeyD'] || keys['ArrowRight']);
      const isSprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);

      // In top-down view, camera looks toward +Z (yaw = 0); in 3rd-person view, use cameraYaw
      const activeCamYaw = topDownView ? 0 : cameraYaw;
      _forward
        .set(Math.sin(activeCamYaw), 0, Math.cos(activeCamYaw))
        .normalize();
      // Right-hand horizontal vector: _forward × (0, 1, 0) = (-_forward.z, 0, _forward.x)
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

      const maxSpeed = isSprinting ? 8.2 : 4.8;
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

      // Sync shared Harsha avatar position, rotation, and procedural walk/sprint animation
      avatar.group.position.copy(playerPos);
      avatar.group.rotation.set(0, facingYaw, 0);
      avatar.updateAnimation(
        delta,
        speed,
        isSprinting && speed > 5.2,
        elapsedTime,
        false,
        false,
        0,
        0,
        false,
      );

      // Update Camera (Top-Down Debug View vs Smooth Grounded Third-Person View)
      if (topDownView) {
        _desiredCamPos.set(0, 395, -24);
        _desiredLookAt.set(0, 0, 0);
        camera.position.lerp(_desiredCamPos, dampAlpha(8.0, delta));
        camera.lookAt(_desiredLookAt);
      } else {
        const horizDist = Math.cos(cameraPitch) * cameraDistance;
        const vertOffset = Math.sin(cameraPitch) * cameraDistance + 1.55;
        const camX = playerPos.x - Math.sin(cameraYaw) * horizDist;
        const camZ = playerPos.z - Math.cos(cameraYaw) * horizDist;
        const camTerrainFloor = getPrivateTerrainHeight(camX, camZ) + 0.65;
        const camY = Math.max(playerPos.y + vertOffset, camTerrainFloor);

        _desiredCamPos.set(camX, camY, camZ);
        _desiredLookAt.set(playerPos.x, playerPos.y + 1.38, playerPos.z);

        const camAlpha = dampAlpha(14.0, delta);
        camera.position.lerp(_desiredCamPos, camAlpha);
        camera.lookAt(_desiredLookAt);
      }
    },

    getPosition() {
      return playerPos;
    },

    getVelocity() {
      return playerVel;
    },

    getTelemetry(): PrivateWorldTelemetry {
      const reg = getPrivateRegionAtPosition(playerPos.x, playerPos.z);
      const speed = Math.hypot(playerVel.x, playerVel.z);
      return {
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
        terrainElevation: getPrivateTerrainHeight(playerPos.x, playerPos.z),
        speed,
        isSprinting: !!(keys['ShiftLeft'] || keys['ShiftRight']) && speed > 5.0,
        regionName: reg.name,
        regionSubtitle: reg.subtitle,
        nearReturnGate: isNearPrivateReturnGate(playerPos.x, playerPos.z),
        isTopDownView: topDownView,
        debugOverlayEnabled: false,
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
