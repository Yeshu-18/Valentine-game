import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRoomTextures } from './cell04Textures';
import { buildRoomProps } from './cell04Props';
import { cell04SoundEngine } from './cell04SoundEngine';

export type InteractionTarget = 'phone' | 'door' | null;

export interface RoomSceneCallbacks {
  onTargetChange: (target: InteractionTarget, distance: number) => void;
  onPhoneInteracted: () => void;
  onDoorInteracted: (phoneAnswered: boolean) => void;
  onPointerLockChange: (locked: boolean) => void;
}

export interface RoomSceneController {
  triggerInteract: () => void;
  triggerPhoneDirectly: () => void;
  resetPrototype: () => void;
  requestPointerLock: () => void;
  setLookSensitivity: (sens: number) => void;
  dispose: () => void;
}

interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Pre-allocated math helpers outside the render loop (Zero GC in tick)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _phoneWorldPos = new THREE.Vector3();
const _doorWorldPos = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

const _ambientNormalColor = new THREE.Color(0x526478);
const _ambientSuspenseColor = new THREE.Color(0x3a0b0b);
const _overheadNormalColor = new THREE.Color(0xffdba8);
const _overheadSuspenseColor = new THREE.Color(0xff2919);
const _deskNormalColor = new THREE.Color(0xffbe73);
const _deskSuspenseColor = new THREE.Color(0xff4518);

export function initRoomScene(
  container: HTMLElement,
  callbacksRef: { current: RoomSceneCallbacks },
): RoomSceneController {
  // 1. Software WebGL Guard & Renderer Setup
  const isSoftwareGl = (() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  })();

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
  );
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c10);
  scene.fog = new THREE.FogExp2(0x0b0c10, 0.11);

  // Studio environment reflections for metallic door & bakelite phone
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;
  pmremGenerator.dispose();

  // 2. First-Person Camera Setup (Player wakes up beside the bed facing the desk & door)
  const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 30);
  const EYE_HEIGHT = 1.65;
  let yaw = -0.82; // Looking from the bed toward the desk and north door
  let pitch = -0.06;
  let wakeProgress = 0; // Smooth wake-up head-raise transition on initial spawn

  camera.position.set(-1.15, EYE_HEIGHT - 0.35, 0.95);
  _euler.set(pitch, yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(_euler);

  // 3. Atmospheric Lighting Rig (<= 3 shadow casters)
  const hemiLight = new THREE.HemisphereLight(0x526478, 0x1b1917, 0.45);
  scene.add(hemiLight);

  // Main overhead bulb PointLight
  const overheadLight = new THREE.PointLight(0xffdba8, 3.6, 9.5, 1.8);
  overheadLight.position.set(0, 2.82, 0);
  overheadLight.castShadow = !isSoftwareGl;
  if (!isSoftwareGl) {
    overheadLight.shadow.mapSize.set(1024, 1024);
    overheadLight.shadow.bias = -0.002;
    overheadLight.shadow.normalBias = 0.02;
  }
  scene.add(overheadLight);

  // Desk SpotLight illuminating the telephone and desk surface
  const deskSpotLight = new THREE.SpotLight(
    0xffbe73,
    5.2,
    5.0,
    Math.PI / 3.2,
    0.65,
    1.6,
  );
  deskSpotLight.position.set(2.08, 1.18, -0.62);
  deskSpotLight.target.position.set(2.04, 0.8, -0.05);
  deskSpotLight.castShadow = !isSoftwareGl;
  if (!isSoftwareGl) {
    deskSpotLight.shadow.mapSize.set(512, 512);
    deskSpotLight.shadow.bias = -0.001;
  }
  scene.add(deskSpotLight);
  scene.add(deskSpotLight.target);

  // 4. Build Procedural Textures & Room Props
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const textures = createRoomTextures(maxAnisotropy);
  const props = buildRoomProps(scene, textures);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // 5. Collision AABBs for Furniture & Room Bounds
  // Room interior walls are at x = +-3.0, z = +-3.0. Player radius = 0.34m.
  const ROOM_BOUND = 2.64;
  const PLAYER_RADIUS = 0.34;

  const furnitureColliders: BoxCollider[] = [
    // Bed (West wall: x in [-2.85, -1.55], z in [0.12, 2.18])
    { minX: -2.9, maxX: -1.56, minZ: 0.12, maxZ: 2.18 },
    // Desk (East wall: x in [1.72, 2.65], z in [-1.02, 0.62])
    { minX: 1.72, maxX: 2.9, minZ: -1.02, maxZ: 0.62 },
    // Chair (Near desk: x in [1.08, 1.56], z in [-0.60, -0.10])
    { minX: 1.08, maxX: 1.56, minZ: -0.6, maxZ: -0.1 },
  ];

  function resolveCollisions(nextX: number, nextZ: number): [number, number] {
    let rx = THREE.MathUtils.clamp(nextX, -ROOM_BOUND, ROOM_BOUND);
    let rz = THREE.MathUtils.clamp(nextZ, -ROOM_BOUND, ROOM_BOUND);

    for (let i = 0; i < furnitureColliders.length; i++) {
      const box = furnitureColliders[i];
      const closestX = THREE.MathUtils.clamp(rx, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(rz, box.minZ, box.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = PLAYER_RADIUS - dist;
          rx += (dx / dist) * overlap;
          rz += (dz / dist) * overlap;
        } else {
          // Inside box fallback: push out toward room center
          rx -= Math.sign(rx) * 0.1;
        }
      }
    }

    rx = THREE.MathUtils.clamp(rx, -ROOM_BOUND, ROOM_BOUND);
    rz = THREE.MathUtils.clamp(rz, -ROOM_BOUND, ROOM_BOUND);
    return [rx, rz];
  }

  // 6. Controls & Interaction State
  const keys: Record<string, boolean> = {};
  const velocity = new THREE.Vector3();
  let lookSensitivity = 0.0022;
  let isPointerLocked = false;
  let isDraggingLook = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let currentTarget: InteractionTarget = null;
  let phoneAnswered = false;
  let suspenseTime = -1; // >= 0 once phone is answered
  let doorRattleTime = -1;
  let walkBobTimer = 0;
  let lastFootstepBob = 0;

  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.1;
  raycaster.far = 2.6;

  // Check proximity and gaze for Phone and Door
  function evaluateInteractionTarget(): {
    target: InteractionTarget;
    dist: number;
  } {
    props.phoneGroup.getWorldPosition(_phoneWorldPos);
    _phoneWorldPos.y += 0.12;

    props.doorGroup.getWorldPosition(_doorWorldPos);
    _doorWorldPos.y = 1.25;

    const distToPhone = camera.position.distanceTo(_phoneWorldPos);
    const distToDoor = camera.position.distanceTo(_doorWorldPos);

    camera.getWorldDirection(_rayDir);

    // 1. Center-screen raycast check
    _rayOrigin.copy(camera.position);
    raycaster.set(_rayOrigin, _rayDir);
    const hits = raycaster.intersectObjects(props.interactables, false);
    if (hits.length > 0) {
      const hitType = hits[0].object.userData
        ?.interactType as InteractionTarget;
      if (hitType === 'phone' && distToPhone < 2.35) {
        return { target: 'phone', dist: distToPhone };
      }
      if (hitType === 'door' && distToDoor < 2.35) {
        return { target: 'door', dist: distToDoor };
      }
    }

    // 2. Forgiving proximity + view cone check so pressing E near the phone or door always works
    if (distToPhone < 2.1) {
      _moveDir.copy(_phoneWorldPos).sub(camera.position).normalize();
      if (_rayDir.dot(_moveDir) > 0.42 || distToPhone < 1.35) {
        return { target: 'phone', dist: distToPhone };
      }
    }

    if (distToDoor < 2.1) {
      _moveDir.copy(_doorWorldPos).sub(camera.position).normalize();
      if (_rayDir.dot(_moveDir) > 0.45 || distToDoor < 1.35) {
        return { target: 'door', dist: distToDoor };
      }
    }

    return { target: null, dist: Infinity };
  }

  function activatePhoneInteraction() {
    phoneAnswered = true;
    suspenseTime = 0;
    cell04SoundEngine.playSuspenseMoment();
    callbacksRef.current.onPhoneInteracted();
  }

  function activateDoorInteraction() {
    doorRattleTime = 0;
    cell04SoundEngine.playLockedDoorRattle();
    callbacksRef.current.onDoorInteracted(phoneAnswered);
  }

  function triggerInteract() {
    if (currentTarget === 'phone') {
      activatePhoneInteraction();
    } else if (currentTarget === 'door') {
      activateDoorInteraction();
    } else {
      // If player presses E slightly outside strict cone, check distance to phone first
      props.phoneGroup.getWorldPosition(_phoneWorldPos);
      if (camera.position.distanceTo(_phoneWorldPos) < 2.35) {
        activatePhoneInteraction();
      } else {
        props.doorGroup.getWorldPosition(_doorWorldPos);
        if (camera.position.distanceTo(_doorWorldPos) < 2.35) {
          activateDoorInteraction();
        }
      }
    }
  }

  // Event Listeners
  const onKeyDown = (e: KeyboardEvent) => {
    keys[e.code] = true;
    if (e.code === 'KeyE') {
      e.preventDefault();
      triggerInteract();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (isPointerLocked) {
      yaw -= e.movementX * lookSensitivity;
      pitch = THREE.MathUtils.clamp(
        pitch - e.movementY * lookSensitivity,
        -Math.PI / 2.2,
        Math.PI / 2.2,
      );
    } else if (isDraggingLook) {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      yaw -= dx * lookSensitivity * 1.35;
      pitch = THREE.MathUtils.clamp(
        pitch - dy * lookSensitivity * 1.35,
        -Math.PI / 2.2,
        Math.PI / 2.2,
      );
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingLook = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  };

  const onMouseUp = () => {
    isDraggingLook = false;
  };

  const onCanvasClick = () => {
    if (!isPointerLocked && renderer.domElement.requestPointerLock) {
      try {
        renderer.domElement.requestPointerLock();
      } catch {
        // Fallback drag-look remains active if iframe blocks pointer lock
      }
    }
  };

  const onPointerLockChange = () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
    callbacksRef.current.onPointerLockChange(isPointerLocked);
  };

  const onResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('click', onCanvasClick);

  // 7. Continuous Animation Loop with Software-WebGL Pacing
  const clock = new THREE.Clock();
  let frameId = 0;
  let isDisposed = false;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (isDisposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function tick() {
    if (isDisposed) return;

    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.getElapsedTime();

    // Smooth wake-up camera rise over first 1.5 seconds
    if (wakeProgress < 1) {
      wakeProgress = Math.min(1, wakeProgress + delta * 0.85);
    }
    const wakeOffset =
      (1 - THREE.MathUtils.smoothstep(wakeProgress, 0, 1)) * -0.35;

    // First-person WASD / Arrow movement on XZ plane
    const moveForward =
      (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
      (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    const moveRight =
      (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
      (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);

    _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    _right.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();

    _moveDir.set(0, 0, 0);
    _moveDir.addScaledVector(_forward, moveForward);
    _moveDir.addScaledVector(_right, moveRight);
    if (_moveDir.lengthSq() > 0) {
      _moveDir.normalize();
    }

    const isSprint = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
    const WALK_SPEED = isSprint ? 3.55 : 2.65;
    velocity.x = THREE.MathUtils.damp(
      velocity.x,
      _moveDir.x * WALK_SPEED,
      10,
      delta,
    );
    velocity.z = THREE.MathUtils.damp(
      velocity.z,
      _moveDir.z * WALK_SPEED,
      10,
      delta,
    );

    const [resolvedX, resolvedZ] = resolveCollisions(
      camera.position.x + velocity.x * delta,
      camera.position.z + velocity.z * delta,
    );
    camera.position.x = resolvedX;
    camera.position.z = resolvedZ;

    // Subtle head-bob and footstep trigger when moving
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > 0.25) {
      walkBobTimer += delta * (isSprint ? 10.5 : 8.5);
      const bobCycle = Math.sin(walkBobTimer);
      if (bobCycle < -0.8 && lastFootstepBob >= -0.8) {
        cell04SoundEngine.playFootstep();
      }
      lastFootstepBob = bobCycle;
      camera.position.y = EYE_HEIGHT + wakeOffset + bobCycle * 0.032;
    } else {
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        EYE_HEIGHT + wakeOffset,
        8,
        delta,
      );
    }

    _euler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(_euler);

    // Phone ringing animation & LED pulse before answered
    if (!phoneAnswered) {
      const ringBurst = Math.sin(elapsed * 2.4) > 0.35;
      if (ringBurst) {
        props.phoneHandset.position.y = 0.158 + Math.sin(elapsed * 55) * 0.004;
        props.phoneHandset.rotation.z = Math.sin(elapsed * 48) * 0.045;
        props.phoneLedMat.emissiveIntensity = 4.2;
        cell04SoundEngine.playPhoneRingPulse();
      } else {
        props.phoneHandset.position.y = 0.155;
        props.phoneHandset.rotation.z = 0;
        props.phoneLedMat.emissiveIntensity = 0.6;
      }
    } else {
      // Answered: handset rests slightly off-hook on the desk beside the phone
      props.phoneHandset.position.x = THREE.MathUtils.damp(
        props.phoneHandset.position.x,
        0.04,
        6,
        delta,
      );
      props.phoneHandset.position.y = THREE.MathUtils.damp(
        props.phoneHandset.position.y,
        0.185,
        6,
        delta,
      );
      props.phoneHandset.rotation.z = THREE.MathUtils.damp(
        props.phoneHandset.rotation.z,
        0.22,
        6,
        delta,
      );
      props.phoneLedMat.emissiveIntensity = 1.8 + Math.sin(elapsed * 6) * 0.6;
    }

    // Suspenseful lighting sequence triggered after answering the phone
    if (suspenseTime >= 0) {
      suspenseTime += delta;

      if (suspenseTime < 1.1) {
        // Dramatic electrical flicker phase
        const flicker =
          Math.sin(suspenseTime * 62) * Math.cos(suspenseTime * 37) > 0.1
            ? 0.15
            : 2.9;
        overheadLight.intensity = flicker;
        props.overheadBulbMat.emissiveIntensity = flicker * 0.8;
        deskSpotLight.intensity = 2.5 + flicker;
      } else if (suspenseTime < 6.5) {
        // Ominous crimson/amber low-key interrogation lighting
        const t = Math.min(1, (suspenseTime - 1.1) * 1.5);
        overheadLight.color.lerpColors(
          _overheadNormalColor,
          _overheadSuspenseColor,
          t,
        );
        overheadLight.intensity = THREE.MathUtils.lerp(3.6, 0.85, t);
        props.overheadBulbMat.emissive.copy(overheadLight.color);
        props.overheadBulbMat.emissiveIntensity = 0.9;

        hemiLight.color.lerpColors(
          _ambientNormalColor,
          _ambientSuspenseColor,
          t,
        );
        hemiLight.intensity = THREE.MathUtils.lerp(0.45, 0.22, t);

        deskSpotLight.color.lerpColors(
          _deskNormalColor,
          _deskSuspenseColor,
          t,
        );
        deskSpotLight.intensity = THREE.MathUtils.lerp(5.2, 7.8, t);
        renderer.toneMappingExposure = THREE.MathUtils.lerp(1.08, 0.88, t);
      } else {
        // Slowly settle into a moody dim amber-crimson vigilance state
        const recover = Math.min(1, (suspenseTime - 6.5) * 0.4);
        overheadLight.intensity = THREE.MathUtils.lerp(0.85, 1.55, recover);
        renderer.toneMappingExposure = THREE.MathUtils.lerp(
          0.88,
          0.96,
          recover,
        );
      }
    }

    // Locked door handle rattle animation
    if (doorRattleTime >= 0) {
      doorRattleTime += delta;
      if (doorRattleTime < 0.45) {
        props.doorHandlePivot.rotation.z =
          Math.sin(doorRattleTime * 48) * 0.26 * (1 - doorRattleTime / 0.45);
      } else {
        props.doorHandlePivot.rotation.z = 0;
        doorRattleTime = -1;
      }
    }

    // Evaluate what the player can interact with
    const { target, dist } = evaluateInteractionTarget();
    if (target !== currentTarget) {
      currentTarget = target;
      callbacksRef.current.onTargetChange(target, dist);
    }

    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  frameId = requestAnimationFrame(tick);

  return {
    triggerInteract,
    triggerPhoneDirectly: () => {
      // Smoothly orient player toward the desk phone and trigger interaction
      yaw = -1.35;
      pitch = -0.12;
      camera.position.set(1.05, EYE_HEIGHT, -0.08);
      activatePhoneInteraction();
    },
    resetPrototype: () => {
      phoneAnswered = false;
      suspenseTime = -1;
      doorRattleTime = -1;
      wakeProgress = 0;
      yaw = -0.82;
      pitch = -0.06;
      velocity.set(0, 0, 0);
      camera.position.set(-1.15, EYE_HEIGHT - 0.35, 0.95);

      // Restore original lighting
      overheadLight.color.copy(_overheadNormalColor);
      overheadLight.intensity = 3.6;
      props.overheadBulbMat.emissive.setHex(0xffb85c);
      props.overheadBulbMat.emissiveIntensity = 2.2;

      hemiLight.color.copy(_ambientNormalColor);
      hemiLight.intensity = 0.45;

      deskSpotLight.color.copy(_deskNormalColor);
      deskSpotLight.intensity = 5.2;
      renderer.toneMappingExposure = 1.08;

      props.phoneHandset.position.set(0, 0.155, -0.045);
      props.phoneHandset.rotation.set(0, 0, 0);
    },
    requestPointerLock: () => {
      if (renderer.domElement.requestPointerLock) {
        try {
          renderer.domElement.requestPointerLock();
        } catch {
          // Ignore if sandbox blocks pointer lock
        }
      }
    },
    setLookSensitivity: (sens: number) => {
      lookSensitivity = sens;
    },
    dispose: () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      textures.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
