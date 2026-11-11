import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRoomTextures } from './cell04Textures';
import { buildRoomProps } from './cell04Props';
import { cell04SoundEngine } from './cell04SoundEngine';
import {
  Cell04InteractionRegistry,
  Cell04NarrativeState,
  InspectionMode,
  TargetedInteractable,
} from './cell04InteractionSystem';

export interface FinaleVisualState {
  active: boolean;
  blindfoldProgress: number; // 0 = clear, 1 = soft blindfold covering eyes
  warmRevealProgress: number; // 0 = dark blindfold, 1 = warm golden light as second door opens
}

export interface RoomSceneCallbacks {
  onTargetChange: (target: TargetedInteractable | null) => void;
  onNarrativeStateChange: (state: Cell04NarrativeState) => void;
  onPhoneInteracted: () => void;
  onDoorLockedAttempt: (phoneAnswered: boolean) => void;
  onPropNote: (note: string) => void;
  onFinaleUpdate: (finale: FinaleVisualState) => void;
  onFinaleComplete: () => void;
  onPointerLockChange: (locked: boolean) => void;
}

export interface RoomSceneController {
  triggerInteract: () => void;
  cancelInspection: () => void;
  openInspection: (mode: Exclude<InspectionMode, null>) => void;
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

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;
  pmremGenerator.dispose();

  // 2. First-Person Camera Setup (Player wakes up from the bed pillow and rises to stand beside the bed)
  const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 30);
  const EYE_HEIGHT = 1.65;
  let yaw = -0.82;
  let pitch = -0.06;
  let wakeProgress = 0;

  camera.position.set(-1.72, EYE_HEIGHT - 0.68, 1.18);
  _euler.set(pitch + 0.24, yaw, 0.16, 'YXZ');
  camera.quaternion.setFromEuler(_euler);

  // 3. Atmospheric Lighting Rig (<= 3 shadow casters)
  const hemiLight = new THREE.HemisphereLight(0x526478, 0x1b1917, 0.45);
  scene.add(hemiLight);

  const overheadLight = new THREE.PointLight(0xffdba8, 3.6, 9.5, 1.8);
  overheadLight.position.set(0, 2.82, 0);
  overheadLight.castShadow = !isSoftwareGl;
  if (!isSoftwareGl) {
    overheadLight.shadow.mapSize.set(1024, 1024);
    overheadLight.shadow.bias = -0.002;
    overheadLight.shadow.normalBias = 0.02;
  }
  scene.add(overheadLight);

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
  const ROOM_BOUND = 2.64;
  const PLAYER_RADIUS = 0.34;

  const furnitureColliders: BoxCollider[] = [
    // Bed (West wall)
    { minX: -2.9, maxX: -1.56, minZ: 0.12, maxZ: 2.18 },
    // Desk (East wall)
    { minX: 1.72, maxX: 2.9, minZ: -1.02, maxZ: 0.62 },
    // Chair (Near desk)
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
          rx -= Math.sign(rx) * 0.1;
        }
      }
    }

    rx = THREE.MathUtils.clamp(rx, -ROOM_BOUND, ROOM_BOUND);
    rz = THREE.MathUtils.clamp(rz, -ROOM_BOUND, ROOM_BOUND);
    return [rx, rz];
  }

  // 6. Narrative State & Reusable Interaction Registry
  const narrativeState: Cell04NarrativeState = {
    phoneAnswered: false,
    photographInspected: false,
    memoryHailMaryDiscovered: false,
    memoryPinkyDiscovered: false,
    memoryConfessionDiscovered: false,
    doorUnlocked: false,
    doorOpened: false,
    activeInspection: null,
  };

  let suspenseTime = -1;
  let doorRattleTime = -1;
  let finaleTime = -1;
  let blindfoldSoundPlayed = false;
  let secondDoorSoundPlayed = false;
  let finaleCompleted = false;
  let lastFigureStepIndex = -1;

  function notifyNarrativeState() {
    callbacksRef.current.onNarrativeStateChange({ ...narrativeState });
  }

  /**
   * Checks if all required narrative discoveries are complete:
   * - Telephone answered once
   * - Photograph inspected
   * - All three relationship memories discovered
   * When complete and not inside an inspection overlay, unlocks the steel door with a mechanical sound.
   */
  function evaluateDoorProgression() {
    if (narrativeState.doorUnlocked) return;
    const allDiscovered =
      narrativeState.phoneAnswered &&
      narrativeState.photographInspected &&
      narrativeState.memoryHailMaryDiscovered &&
      narrativeState.memoryPinkyDiscovered &&
      narrativeState.memoryConfessionDiscovered;

    if (allDiscovered && narrativeState.activeInspection === null) {
      narrativeState.doorUnlocked = true;
      props.doorStatusMat.color.setHex(0x34d399);
      props.doorStatusMat.emissive.setHex(0x10b981);
      props.doorStatusMat.emissiveIntensity = 3.2;
      cell04SoundEngine.playDoorUnlock();
      notifyNarrativeState();
    }
  }

  function setInspectionMode(mode: InspectionMode) {
    narrativeState.activeInspection = mode;
    if (mode !== null && document.pointerLockElement === renderer.domElement) {
      document.exitPointerLock?.();
    }
    notifyNarrativeState();
    if (mode === null) {
      evaluateDoorProgression();
    }
  }

  const registry = new Cell04InteractionRegistry();

  // 1) Rotary Telephone (First interaction triggers suspense lighting & call; subsequent interactions re-open the message cleanly)
  registry.register({
    id: 'phone',
    anchorObject: props.phoneGroup,
    anchorOffset: new THREE.Vector3(0, 0.12, 0),
    hitMeshes: props.phoneHitMeshes,
    interactionDistance: 2.35,
    oneTime: false,
    isCompleted: (s) => s.phoneAnswered,
    getPrompt: (s) =>
      s.phoneAnswered ? 'Check Telephone Receiver' : 'Answer Ringing Telephone',
    onInteract: () => {
      if (!narrativeState.phoneAnswered) {
        narrativeState.phoneAnswered = true;
        suspenseTime = 0;
        cell04SoundEngine.playSuspenseMoment();
      } else {
        cell04SoundEngine.playItemInspect();
      }
      notifyNarrativeState();
      callbacksRef.current.onPhoneInteracted();
      evaluateDoorProgression();
    },
  });

  // 2) The Photograph (14 / 02 / 2024) on Desk (Re-inspectable anytime)
  registry.register({
    id: 'photograph',
    anchorObject: props.photographGroup,
    anchorOffset: new THREE.Vector3(0, 0.04, 0),
    hitMeshes: props.photographHitMeshes,
    interactionDistance: 2.25,
    oneTime: false,
    isCompleted: (s) => s.photographInspected,
    getPrompt: () => 'Inspect Photograph (14 / 02 / 2024)',
    onInteract: () => {
      narrativeState.photographInspected = true;
      cell04SoundEngine.playItemInspect();
      setInspectionMode('photograph');
    },
  });

  // 3) Memory I: Project Hail Mary (Glasses & Glass on Desk) — Re-inspectable anytime
  registry.register({
    id: 'memory_hail_mary',
    anchorObject: props.memoryHailMaryGroup,
    anchorOffset: new THREE.Vector3(0, 0.04, 0),
    hitMeshes: props.memoryHailMaryHitMeshes,
    interactionDistance: 2.25,
    oneTime: false,
    isCompleted: (s) => s.memoryHailMaryDiscovered,
    getPrompt: () => 'Examine Eyeglasses on Desk',
    onInteract: () => {
      narrativeState.memoryHailMaryDiscovered = true;
      cell04SoundEngine.playMemoryChord(1);
      setInspectionMode('memory_hail_mary');
    },
  });

  // 4) Memory II: The Pinky Moment (Keepsake on Wooden Chair) — Re-inspectable anytime
  registry.register({
    id: 'memory_pinky',
    anchorObject: props.memoryPinkyGroup,
    anchorOffset: new THREE.Vector3(0, 0.04, 0),
    hitMeshes: props.memoryPinkyHitMeshes,
    interactionDistance: 2.25,
    oneTime: false,
    isCompleted: (s) => s.memoryPinkyDiscovered,
    getPrompt: () => 'Examine Keepsake on Chair',
    onInteract: () => {
      narrativeState.memoryPinkyDiscovered = true;
      cell04SoundEngine.playMemoryChord(2);
      setInspectionMode('memory_pinky');
    },
  });

  // 5) Memory III: The Confession (Smartphone on Bed) — Re-inspectable anytime
  registry.register({
    id: 'memory_confession',
    anchorObject: props.memoryConfessionGroup,
    anchorOffset: new THREE.Vector3(0, 0.04, 0),
    hitMeshes: props.memoryConfessionHitMeshes,
    interactionDistance: 2.35,
    oneTime: false,
    isCompleted: (s) => s.memoryConfessionDiscovered,
    getPrompt: () => 'Examine Phone on Bed',
    onInteract: () => {
      narrativeState.memoryConfessionDiscovered = true;
      props.confessionScreenMat.emissiveIntensity = 0.45;
      cell04SoundEngine.playMemoryChord(3);
      setInspectionMode('memory_confession');
    },
  });

  // 6) Steel Door (Locked until all discoveries complete; opens to trigger Mysterious Figure sequence)
  registry.register({
    id: 'door',
    anchorObject: props.doorGroup,
    anchorOffset: new THREE.Vector3(0, 1.25, 0),
    hitMeshes: props.doorHitMeshes,
    interactionDistance: 2.35,
    oneTime: false,
    isCompleted: (s) => s.doorOpened,
    getPrompt: (s) => {
      if (s.doorOpened) return null;
      return s.doorUnlocked ? 'Open Steel Door' : 'Try Steel Door Handle';
    },
    onInteract: () => {
      if (narrativeState.doorOpened) return;
      if (!narrativeState.doorUnlocked) {
        doorRattleTime = 0;
        cell04SoundEngine.playLockedDoorRattle();
        callbacksRef.current.onDoorLockedAttempt(narrativeState.phoneAnswered);
      } else {
        // Begin Mysterious Figure & Blindfold transition sequence
        narrativeState.doorOpened = true;
        finaleTime = 0;
        props.figureGroup.visible = true;
        props.figureGroup.position.set(0, 0, -4.15);
        cell04SoundEngine.playDoorOpen();
        notifyNarrativeState();
      }
    },
  });

  // 7) Free Exploration Props: Bed, Desk, Chair
  registry.register({
    id: 'bed',
    anchorObject: props.bedGroup,
    anchorOffset: new THREE.Vector3(0, 0.55, 0),
    hitMeshes: props.bedHitMeshes,
    interactionDistance: 2.2,
    oneTime: false,
    isCompleted: () => false,
    getPrompt: () => 'Inspect Iron Bed',
    onInteract: () => {
      cell04SoundEngine.playItemInspect();
      callbacksRef.current.onPropNote(
        'Iron cot with a rumpled slate blanket where you woke up.',
      );
    },
  });

  registry.register({
    id: 'desk',
    anchorObject: props.deskGroup,
    anchorOffset: new THREE.Vector3(0, 0.78, 0),
    hitMeshes: props.deskHitMeshes,
    interactionDistance: 2.2,
    oneTime: false,
    isCompleted: () => false,
    getPrompt: () => 'Inspect Wooden Desk',
    onInteract: () => {
      cell04SoundEngine.playItemInspect();
      callbacksRef.current.onPropNote(
        'Weathered timber desk lit by a warm brass architect lamp.',
      );
    },
  });

  registry.register({
    id: 'chair',
    anchorObject: props.chairGroup,
    anchorOffset: new THREE.Vector3(0, 0.55, 0),
    hitMeshes: props.chairHitMeshes,
    interactionDistance: 2.1,
    oneTime: false,
    isCompleted: () => false,
    getPrompt: () => 'Inspect Wooden Chair',
    onInteract: () => {
      cell04SoundEngine.playItemInspect();
      callbacksRef.current.onPropNote(
        'A solitary wooden chair pulled slightly back from the desk.',
      );
    },
  });

  // 7. First-Person Controls State
  const keys: Record<string, boolean> = {};
  const velocity = new THREE.Vector3();
  let lookSensitivity = 0.0022;
  let isPointerLocked = false;
  let isDraggingLook = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let currentTarget: TargetedInteractable | null = null;
  let walkBobTimer = 0;
  let lastFootstepBob = 0;

  function triggerInteract() {
    registry.triggerInteract(currentTarget, narrativeState);
  }

  // Event Listeners
  const onKeyDown = (e: KeyboardEvent) => {
    keys[e.code] = true;
    if (e.code === 'Escape' && narrativeState.activeInspection !== null) {
      e.preventDefault();
      setInspectionMode(null);
      return;
    }
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (narrativeState.activeInspection !== null) {
        setInspectionMode(null);
      } else {
        triggerInteract();
      }
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (narrativeState.activeInspection !== null) return;
    // Gradually disable look control once the mysterious figure approaches
    const controlFactor =
      finaleTime < 0
        ? 1
        : 1 - THREE.MathUtils.smoothstep(finaleTime, 1.8, 4.2);
    if (controlFactor <= 0.01) return;

    if (isPointerLocked) {
      yaw -= e.movementX * lookSensitivity * controlFactor;
      pitch = THREE.MathUtils.clamp(
        pitch - e.movementY * lookSensitivity * controlFactor,
        -Math.PI / 2.2,
        Math.PI / 2.2,
      );
    } else if (isDraggingLook) {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      yaw -= dx * lookSensitivity * 1.35 * controlFactor;
      pitch = THREE.MathUtils.clamp(
        pitch - dy * lookSensitivity * 1.35 * controlFactor,
        -Math.PI / 2.2,
        Math.PI / 2.2,
      );
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || narrativeState.activeInspection !== null) return;
    isDraggingLook = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  };

  const onMouseUp = () => {
    isDraggingLook = false;
  };

  const onCanvasClick = () => {
    if (narrativeState.activeInspection !== null || narrativeState.doorOpened) {
      return;
    }
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

  // 8. Continuous Animation Loop with Software-WebGL Pacing
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

    if (wakeProgress < 1) {
      // 2.7s awakening rise synced with the eyelid blink sequence
      wakeProgress = Math.min(1, wakeProgress + delta / 2.7);
      const wakeEase = THREE.MathUtils.smoothstep(wakeProgress, 0, 1);
      camera.position.x = THREE.MathUtils.lerp(-1.72, -1.15, wakeEase);
      camera.position.z = THREE.MathUtils.lerp(1.18, 0.95, wakeEase);
    }
    const wakeCompletion = THREE.MathUtils.smoothstep(wakeProgress, 0, 1);
    const wakeOffset = (1 - wakeCompletion) * -0.68;
    const wakePitchOffset = (1 - wakeCompletion) * 0.24;
    const wakeRollOffset = (1 - wakeCompletion) * 0.16;

    // Control damping: freeze movement during awakening blink, inspection mode, or silhouette approach
    const movementWeight =
      wakeProgress < 0.85 || narrativeState.activeInspection !== null
        ? 0
        : finaleTime < 0
          ? 1
          : 1 - THREE.MathUtils.smoothstep(finaleTime, 0.8, 3.4);

    const moveForward =
      ((keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
        (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0)) *
      movementWeight;
    const moveRight =
      ((keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
        (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0)) *
      movementWeight;

    _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    _right.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();

    _moveDir.set(0, 0, 0);
    _moveDir.addScaledVector(_forward, moveForward);
    _moveDir.addScaledVector(_right, moveRight);
    if (_moveDir.lengthSq() > 0) {
      _moveDir.normalize();
    }

    const isSprint = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
    const WALK_SPEED = (isSprint ? 3.55 : 2.65) * movementWeight;
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

    // Subtle head-bob and footstep trigger when walking
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > 0.25 && finaleTime < 0) {
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

    // Step 8: Mysterious Figure & Blindfold Transition Sequence
    if (finaleTime >= 0) {
      finaleTime += delta;

      // 1. Door swings open (0.0s -> 2.0s)
      const doorSwing = THREE.MathUtils.smoothstep(finaleTime, 0.0, 2.0);
      props.doorHingePivot.rotation.y = -doorSwing * 1.35;
      props.corridorLight.intensity = THREE.MathUtils.lerp(
        0,
        4.2,
        THREE.MathUtils.smoothstep(finaleTime, 0.1, 1.6),
      );

      // 2. Mysterious figure approaches in silhouette (1.4s -> 4.6s)
      const approachT = THREE.MathUtils.smoothstep(finaleTime, 1.4, 4.6);
      const targetFigureZ = Math.min(-2.15, camera.position.z - 0.85);
      props.figureGroup.position.z = THREE.MathUtils.lerp(
        -4.15,
        targetFigureZ,
        approachT,
      );
      props.figureGroup.position.x = THREE.MathUtils.lerp(
        0,
        camera.position.x * 0.35,
        approachT,
      );
      // Subtle walking cadence on the silhouette figure
      if (finaleTime >= 1.4 && finaleTime <= 4.6) {
        props.figureGroup.position.y =
          Math.abs(Math.sin((finaleTime - 1.4) * 5.2)) * 0.028;
      } else {
        props.figureGroup.position.y = 0;
      }

      // Gently orient player gaze toward the doorway silhouette as control is disabled
      if (finaleTime > 1.8) {
        const dx = props.figureGroup.position.x - camera.position.x;
        const dz = props.figureGroup.position.z - camera.position.z;
        const targetYaw = Math.atan2(-dx, -dz);
        // Shortest angular interpolation
        let diffYaw = targetYaw - yaw;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        yaw += diffYaw * Math.min(1, delta * 2.8);
        pitch = THREE.MathUtils.damp(pitch, -0.02, 3.0, delta);
      }

      // Footsteps for approaching figure (1.6s -> 4.4s) and guided blindfold walk (5.4s -> 7.6s)
      const stepPhase = Math.floor(finaleTime / 0.68);
      if (
        stepPhase !== lastFigureStepIndex &&
        ((finaleTime >= 1.5 && finaleTime <= 4.4) ||
          (finaleTime >= 5.4 && finaleTime <= 7.6))
      ) {
        lastFigureStepIndex = stepPhase;
        cell04SoundEngine.playFootstep(-14);
      }

      // 3. Soft blindfold transition begins at 4.5s
      if (finaleTime >= 4.5 && !blindfoldSoundPlayed) {
        blindfoldSoundPlayed = true;
        cell04SoundEngine.playBlindfoldCloth();
      }
      const blindfoldProgress = THREE.MathUtils.smoothstep(
        finaleTime,
        4.5,
        6.0,
      );

      // 4. Second door opens at 7.0s, warming the atmosphere before entering Dream World
      if (finaleTime >= 7.0 && !secondDoorSoundPlayed) {
        secondDoorSoundPlayed = true;
        cell04SoundEngine.playSecondDoorWarmReveal();
      }
      const warmRevealProgress = THREE.MathUtils.smoothstep(
        finaleTime,
        7.0,
        8.5,
      );

      callbacksRef.current.onFinaleUpdate({
        active: true,
        blindfoldProgress,
        warmRevealProgress,
      });

      if (finaleTime >= 8.6 && !finaleCompleted) {
        finaleCompleted = true;
        callbacksRef.current.onFinaleComplete();
      }
    }

    _euler.set(pitch + wakePitchOffset, yaw, wakeRollOffset, 'YXZ');
    camera.quaternion.setFromEuler(_euler);

    // Animate 3D Pinky Moment Hands-Holding Hologram & Rose-Gold Embers above the chair keepsake
    const pinkyActive =
      narrativeState.activeInspection === 'memory_pinky' ||
      narrativeState.memoryPinkyDiscovered;
    props.pinkyHandsVfxGroup.visible = pinkyActive;
    if (pinkyActive) {
      const claspT =
        narrativeState.activeInspection === 'memory_pinky'
          ? 1.0
          : 0.65 + Math.sin(elapsed * 1.8) * 0.25;
      props.pinkyLeftHand.position.x = THREE.MathUtils.lerp(
        -0.045,
        -0.011,
        claspT,
      );
      props.pinkyRightHand.position.x = THREE.MathUtils.lerp(
        0.045,
        0.011,
        claspT,
      );
      props.pinkyHandsVfxGroup.position.y =
        0.17 + Math.sin(elapsed * 2.2) * 0.012;
      props.pinkyHandsVfxGroup.rotation.y = elapsed * 0.35;
      props.pinkyEmberPoints.rotation.y = -elapsed * 0.6;
      props.pinkyWarmLight.intensity =
        narrativeState.activeInspection === 'memory_pinky' ? 1.8 : 0.75;
    } else {
      props.pinkyWarmLight.intensity = 0;
    }

    // Phone ringing animation & LED pulse before answered
    if (!narrativeState.phoneAnswered) {
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
      // Answered once: handset rests off-hook beside the phone
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
      props.phoneLedMat.emissiveIntensity = 1.4;
    }

    // Suspenseful lighting sequence triggered after answering the phone
    if (suspenseTime >= 0) {
      suspenseTime += delta;

      if (suspenseTime < 1.1) {
        const flicker =
          Math.sin(suspenseTime * 62) * Math.cos(suspenseTime * 37) > 0.1
            ? 0.15
            : 2.9;
        overheadLight.intensity = flicker;
        props.overheadBulbMat.emissiveIntensity = flicker * 0.8;
        deskSpotLight.intensity = 2.5 + flicker;
      } else if (suspenseTime < 6.5) {
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

    // Evaluate what the player can interact with via the Reusable Interaction Registry
    const nextTarget = registry.evaluateTarget(camera, narrativeState);
    if (
      nextTarget?.id !== currentTarget?.id ||
      nextTarget?.prompt !== currentTarget?.prompt
    ) {
      currentTarget = nextTarget;
      callbacksRef.current.onTargetChange(nextTarget);
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
    cancelInspection: () => {
      setInspectionMode(null);
    },
    openInspection: (mode) => {
      setInspectionMode(mode);
    },
    resetPrototype: () => {
      narrativeState.phoneAnswered = false;
      narrativeState.photographInspected = false;
      narrativeState.memoryHailMaryDiscovered = false;
      narrativeState.memoryPinkyDiscovered = false;
      narrativeState.memoryConfessionDiscovered = false;
      narrativeState.doorUnlocked = false;
      narrativeState.doorOpened = false;
      narrativeState.activeInspection = null;

      suspenseTime = -1;
      doorRattleTime = -1;
      finaleTime = -1;
      blindfoldSoundPlayed = false;
      secondDoorSoundPlayed = false;
      finaleCompleted = false;
      lastFigureStepIndex = -1;
      wakeProgress = 0;
      yaw = -0.82;
      pitch = -0.06;
      velocity.set(0, 0, 0);
      camera.position.set(-1.72, EYE_HEIGHT - 0.68, 1.18);
      props.pinkyHandsVfxGroup.visible = false;
      props.pinkyWarmLight.intensity = 0;

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

      props.doorHingePivot.rotation.y = 0;
      props.doorStatusMat.color.setHex(0xff2a2a);
      props.doorStatusMat.emissive.setHex(0xff1111);
      props.doorStatusMat.emissiveIntensity = 2.8;
      props.corridorLight.intensity = 0;
      props.figureGroup.visible = false;
      props.figureGroup.position.set(0, 0, -4.15);
      props.confessionScreenMat.emissiveIntensity = 0.85;

      notifyNarrativeState();
      callbacksRef.current.onFinaleUpdate({
        active: false,
        blindfoldProgress: 0,
        warmRevealProgress: 0,
      });
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
      registry.clear();
      textures.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
