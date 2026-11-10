import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Compass,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Sliders,
  MousePointer,
} from 'lucide-react';
import {
  CHAPTER_1_STATES,
  CHAPTER_1_TRIGGER_Z,
  Chapter1StateId,
  getChapter1StateMeta,
  HarshaAnimState,
  HybridCameraState,
} from './chapter1StateMachine';
import { Chapter1AudioController } from './chapter1Audio';
import { createHarshaStreetCharacter } from './HarshaStreetCharacter';
import { createMaskedKidnapperCharacter } from './MaskedKidnapperCharacter';
import { createResidentialStreetScene } from './ResidentialStreetScene';
import { createHybridCameraDirector } from './HybridCameraDirector';
import { Chapter2Controller } from './chapter2/Chapter2Controller';
import { Cell04Controller } from './cell04/Cell04Controller';

export interface PrequelGameProps {
  /** Direct testing shortcut to enter the 3D Dream World immediately */
  onEnterDreamWorld: () => void;
  /** Optional shortcut to jump to the Private World Epilogue */
  onJumpToEpilogue?: () => void;
}

/**
 * Standalone Playable 3D Prequel Experience (located in /src/prequel outside /src/world)
 * Implements Prologue · Chapter 1: The Ordinary Night (13 FEBRUARY 2027 · 10:30 PM)
 * - AAA Third-Person Controls (Pointer-Lock 360° Mouse Orbit, Camera-Relative WASD, Shift Jog,
 *   C Stealth Crouch, V Shoulder Swap, Q Quick Look-Back, Scroll Zoom)
 * - Multi-Jointed Biomechanical Character Animations + Turn Banking & Camera-Aim Head/Eye Look-Ahead
 * - Dramatic Beat 05 Climax: Masked Man steps out of the dark sedan, captures Harsha into the rear cabin,
 *   doors slam shut, and the sedan executes a sudden high-speed fishtail drift getaway in tire smoke
 */
export const PrequelGame: React.FC<PrequelGameProps> = ({
  onEnterDreamWorld,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [activeChapter, setActiveChapter] = useState<'CHAPTER_1' | 'CHAPTER_2' | 'CELL_04'>('CHAPTER_1');
  const [gameState, setGameState] = useState<Chapter1StateId>('SCENE_START');
  const [cameraState, setCameraState] = useState<HybridCameraState>('FOLLOW');
  const [animState, setAnimState] = useState<HarshaAnimState>('WALK');
  const [fadeBlackOpacity, setFadeBlackOpacity] = useState(1);
  const [showOpeningDateCard, setShowOpeningDateCard] = useState(true);
  const [showPhoneCloseup, setShowPhoneCloseup] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);

  // Refs for synchronous WebGL loop access
  const stateRef = useRef<Chapter1StateId>('SCENE_START');
  const stateElapsedRef = useRef<number>(0);
  const jumpToStateRef = useRef<((target: Chapter1StateId) => void) | null>(null);
  const audioControllerRef = useRef<Chapter1AudioController | null>(null);

  const handleToggleMute = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    audioControllerRef.current?.setMuted(next);
  };

  const handleDismissPhoneMessage = () => {
    if (
      stateRef.current === 'MESSAGE_READ' ||
      stateRef.current === 'PHONE_CINEMATIC'
    ) {
      jumpToStateRef.current?.('PLAYER_WALKING_2');
    }
  };

  useEffect(() => {
    if (activeChapter !== 'CHAPTER_1') return;
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard & Renderer Initialization
    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
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

    // 2. Scene, Environment Reflection & Night Lighting Rig
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090c14);
    scene.fog = new THREE.FogExp2(0x090c14, 0.019);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 160);

    const hemiLight = new THREE.HemisphereLight(0x3b4c6b, 0x1a1512, 0.65);
    scene.add(hemiLight);

    const moonKeyLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    moonKeyLight.position.set(14, 26, -18);
    moonKeyLight.castShadow = !isSoftwareGl;
    moonKeyLight.shadow.mapSize.set(1024, 1024);
    moonKeyLight.shadow.camera.near = 1;
    moonKeyLight.shadow.camera.far = 90;
    moonKeyLight.shadow.camera.left = -25;
    moonKeyLight.shadow.camera.right = 25;
    moonKeyLight.shadow.camera.top = 25;
    moonKeyLight.shadow.camera.bottom = -25;
    moonKeyLight.shadow.bias = -0.0005;
    scene.add(moonKeyLight);

    // 3. Build Residential Street, Harsha, Masked Kidnapper, Camera Director & Audio
    const street = createResidentialStreetScene();
    scene.add(street.group);

    const harsha = createHarshaStreetCharacter();
    harsha.group.position.set(1.55, 0, 0);
    scene.add(harsha.group);

    const kidnapper = createMaskedKidnapperCharacter();
    scene.add(kidnapper.group);

    const cameraDirector = createHybridCameraDirector(camera);
    cameraDirector.snapToHarsha(harsha);

    const audio = new Chapter1AudioController();
    audioControllerRef.current = audio;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 4. Immersive AAA Controls State (Pointer-Lock Mouse Look, Crouch, Shoulder Swap, Zoom)
    const keys: Record<string, boolean> = {};
    let playerYawOffset = 0;
    let playerPitchOffset = 0.06;
    let shoulderSide: 1 | -1 = 1;
    let zoomDistance = 2.85;
    let isCrouching = false;
    let isPointerDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Harsha Locomotion & Heading State
    let currentMoveSpeed = 1.65;
    let harshaHeadingYaw = 0; // 0 = facing -Z down the street
    let prevHarshaHeadingYaw = 0;
    let turnBankRoll = 0;

    // Car Spline, Drift & Door Kinematics State
    let carZ = -125;
    let carX = -1.35;
    let carYaw = 0;
    let carSpeed = 0;
    let prevCarSpeed = 0;
    let carSteering = 0;
    let carChassisPitch = 0;
    let carChassisRoll = 0;
    let carFrontDoorRatio = 0;
    let carRearDoorRatio = 0;
    let driftSmokeIntensity = 0;

    let putAwaySubTimer = 0;
    let doorUnlockPlayed = false;
    let doorSlamPlayed = false;
    let driftSoundPlayed = false;

    const normalizeAngle = (a: number) => {
      let res = a;
      while (res > Math.PI) res -= Math.PI * 2;
      while (res < -Math.PI) res += Math.PI * 2;
      return res;
    };

    const dampAngle = (current: number, target: number, lambda: number, dt: number) => {
      const delta = normalizeAngle(target - current);
      return normalizeAngle(current + delta * (1 - Math.exp(-lambda * dt)));
    };

    const transitionToState = (
      nextState: Chapter1StateId,
      snapPosition = false,
    ) => {
      stateRef.current = nextState;
      stateElapsedRef.current = 0;
      setGameState(nextState);

      const meta = getChapter1StateMeta(nextState);
      if (snapPosition) {
        harsha.group.position.set(1.55, 0, meta.defaultHarshaZ);
        harsha.group.rotation.y = 0;
        harshaHeadingYaw = 0;
      }

      // Reset visibility Unless inside getaway car
      if (
        nextState !== 'CAR_DRIFT_GETAWAY' &&
        nextState !== 'CHAPTER_END' &&
        nextState !== 'TRANSITION_TO_CHAPTER_2'
      ) {
        harsha.group.visible = true;
      }

      switch (nextState) {
        case 'SCENE_START': {
          harsha.group.position.set(1.55, 0, 0);
          harsha.group.rotation.y = 0;
          harsha.group.visible = true;
          harshaHeadingYaw = 0;
          currentMoveSpeed = 1.55;
          isCrouching = false;
          carZ = -125;
          carX = -1.35;
          carYaw = 0;
          carSpeed = 0;
          prevCarSpeed = 0;
          carSteering = 0;
          carChassisPitch = 0;
          carChassisRoll = 0;
          carFrontDoorRatio = 0;
          carRearDoorRatio = 0;
          driftSmokeIntensity = 0;
          doorUnlockPlayed = false;
          doorSlamPlayed = false;
          driftSoundPlayed = false;
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          setShowOpeningDateCard(true);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(1);
          audio.setTrafficPresence('normal');
          audio.updateCarEngineAudio(false, 100, 0);
          street.setCarTransform(-125, -1.35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
          cameraDirector.snapToHarsha(harsha);
          break;
        }
        case 'OPENING_CINEMATIC': {
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          setShowOpeningDateCard(true);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.startNightAmbience();
          audio.setTrafficPresence('normal');
          break;
        }
        case 'PLAYER_WALKING': {
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.startNightAmbience();
          audio.setTrafficPresence('normal');
          break;
        }
        case 'PHONE_VIBRATION': {
          isCrouching = false;
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.startNightAmbience();
          audio.playPhoneVibration();
          break;
        }
        case 'PHONE_CINEMATIC': {
          currentMoveSpeed = 0;
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          break;
        }
        case 'MESSAGE_READ': {
          currentMoveSpeed = 0;
          putAwaySubTimer = 0;
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(true);
          setFadeBlackOpacity(0);
          audio.playPhoneScreenWake();
          break;
        }
        case 'PLAYER_WALKING_2': {
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.setTrafficPresence('quiet');
          break;
        }
        case 'CAR_VISIBLE': {
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.setTrafficPresence('quiet');
          if (carZ < -95 || snapPosition) {
            carZ = harsha.group.position.z - 52;
            carX = -1.25;
          }
          carYaw = 0;
          carSpeed = 5.4;
          carFrontDoorRatio = 0;
          carRearDoorRatio = 0;
          driftSmokeIntensity = 0;
          break;
        }
        case 'CAR_APPROACHING': {
          isCrouching = false;
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          if (snapPosition || carZ < harsha.group.position.z - 28) {
            carZ = harsha.group.position.z - 22;
            carX = -1.15;
          }
          carYaw = 0;
          carSpeed = 6.2;
          break;
        }
        case 'CAR_STOPPED': {
          isCrouching = false;
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          if (snapPosition) {
            carZ = harsha.group.position.z - 0.8;
            carX = -0.35;
          }
          carYaw = 0;
          doorUnlockPlayed = false;
          audio.playCarBrakeStop();
          break;
        }
        case 'MASKED_MAN_EXITS': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          carZ = harsha.group.position.z - 0.8;
          carX = -0.35;
          carYaw = 0;
          carSpeed = 0;
          kidnapper.setAnimationState('STEP_OUT_OF_CAR');
          kidnapper.group.position.set(carX + 0.95, 0, carZ + 0.15);
          kidnapper.group.rotation.y = -Math.PI / 2; // Facing +X toward Harsha
          audio.setTrafficPresence('silent');
          break;
        }
        case 'KIDNAP_GRAB': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          carZ = harsha.group.position.z - 0.8;
          carX = -0.35;
          carYaw = 0;
          carSpeed = 0;
          doorSlamPlayed = false;
          kidnapper.setAnimationState('GRAB_AND_PULL');
          break;
        }
        case 'CAR_DRIFT_GETAWAY': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          harsha.group.visible = false;
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          carFrontDoorRatio = 0;
          carRearDoorRatio = 0;
          driftSoundPlayed = false;
          break;
        }
        case 'CHAPTER_END': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          harsha.group.visible = false;
          kidnapper.setAnimationState('HIDDEN_IN_CAR');
          audio.setTrafficPresence('silent');
          break;
        }
        case 'TRANSITION_TO_CHAPTER_2': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(1);
          audio.updateCarEngineAudio(false, 100, 0);
          if (document.pointerLockElement === renderer.domElement) {
            document.exitPointerLock?.();
          }
          break;
        }
      }
    };

    jumpToStateRef.current = (target: Chapter1StateId) => {
      transitionToState(target, true);
    };

    // Keyboard & Pointer-Lock Mouse Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      audio.startNightAmbience();

      if (e.code === 'KeyC' && !e.repeat) {
        const meta = getChapter1StateMeta(stateRef.current);
        if (meta.playerControlAllowed) {
          isCrouching = !isCrouching;
        }
      } else if (e.code === 'KeyV' && !e.repeat) {
        // Swap Over-the-Shoulder Camera Side (Left <-> Right like The Last of Us)
        shoulderSide = shoulderSide === 1 ? -1 : 1;
      } else if (
        (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') &&
        (stateRef.current === 'MESSAGE_READ' ||
          stateRef.current === 'PHONE_CINEMATIC')
      ) {
        e.preventDefault();
        if (putAwaySubTimer === 0) {
          putAwaySubTimer = 0.01;
          setShowPhoneCloseup(false);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const onCanvasMouseDown = (e: MouseEvent) => {
      isPointerDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      audio.startNightAmbience();

      // Request immersive Pointer Lock when clicking the 3D viewport
      const meta = getChapter1StateMeta(stateRef.current);
      if (
        meta.playerControlAllowed &&
        document.pointerLockElement !== renderer.domElement
      ) {
        try {
          renderer.domElement.requestPointerLock?.();
        } catch {
          // Fallback to drag if pointer lock is blocked by browser
        }
      }
    };

    const onPointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === renderer.domElement);
    };

    const onMouseMove = (e: MouseEvent) => {
      const isLocked = document.pointerLockElement === renderer.domElement;
      if (!isLocked && !isPointerDragging) return;

      const dx = isLocked ? e.movementX : e.clientX - lastMouseX;
      const dy = isLocked ? e.movementY : e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      const meta = getChapter1StateMeta(stateRef.current);
      if (meta.playerControlAllowed) {
        const sensitivity = isLocked ? 0.0024 : 0.0034;
        playerYawOffset = normalizeAngle(playerYawOffset - dx * sensitivity);
        playerPitchOffset = THREE.MathUtils.clamp(
          playerPitchOffset + dy * sensitivity * 0.85,
          -0.48,
          0.58,
        );
      }
    };

    const onMouseUp = () => {
      isPointerDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      const meta = getChapter1StateMeta(stateRef.current);
      if (meta.playerControlAllowed) {
        zoomDistance = THREE.MathUtils.clamp(
          zoomDistance + e.deltaY * 0.0018,
          1.95,
          4.25,
        );
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousedown', onCanvasMouseDown);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);

    transitionToState('SCENE_START', true);

    // 5. Continuous Game Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;
    let uiSyncTimer = 0;
    const carWorldVec = new THREE.Vector3();
    const kidnapperWorldVec = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
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
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      stateElapsedRef.current += dt;
      const st = stateRef.current;
      const stTime = stateElapsedRef.current;

      let targetSpeed = 0;
      let desiredAnim: HarshaAnimState = 'IDLE';
      const isJogInput = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
      const quickLookBack = Boolean(keys['KeyQ']);

      switch (st) {
        case 'SCENE_START': {
          targetSpeed = 1.45;
          harshaHeadingYaw = dampAngle(harshaHeadingYaw, 0, 8, dt);
          desiredAnim = 'WALK';
          if (stTime >= 1.4) {
            transitionToState('OPENING_CINEMATIC');
          }
          break;
        }
        case 'OPENING_CINEMATIC': {
          targetSpeed = 1.5;
          harshaHeadingYaw = dampAngle(harshaHeadingYaw, 0, 8, dt);
          desiredAnim = 'WALK';
          if (stTime >= 3.8) {
            transitionToState('PLAYER_WALKING');
          }
          break;
        }
        case 'PLAYER_WALKING':
        case 'PLAYER_WALKING_2':
        case 'CAR_VISIBLE': {
          // Camera-Relative 360° WASD Movement (The Last of Us Part II Style)
          const inputForward =
            (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
            (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
          const inputRight =
            (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
            (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);

          const hasMoveInput = inputForward !== 0 || inputRight !== 0;

          if (hasMoveInput) {
            // Stand up from crouch automatically if player holds Shift to Jog
            if (isJogInput && isCrouching) {
              isCrouching = false;
            }

            // Compute desired world movement angle relative to camera's playerYawOffset
            const localInputAngle = Math.atan2(-inputRight, inputForward);
            const targetHeading = normalizeAngle(playerYawOffset + localInputAngle);
            harshaHeadingYaw = dampAngle(harshaHeadingYaw, targetHeading, 10.5, dt);

            targetSpeed = isCrouching
              ? 1.15
              : isJogInput
                ? 3.15
                : 1.78;
            desiredAnim = isCrouching
              ? 'CROUCH_WALK'
              : isJogInput
                ? 'JOG'
                : 'WALK';
          } else {
            targetSpeed = 0;
            desiredAnim = isCrouching ? 'CROUCH_IDLE' : 'IDLE';
          }

          // Spatial Event Triggers along the Street (-Z progression)
          if (
            st === 'PLAYER_WALKING' &&
            harsha.group.position.z <= CHAPTER_1_TRIGGER_Z.PHONE_VIBRATE_Z
          ) {
            transitionToState('PHONE_VIBRATION');
          } else if (
            st === 'PLAYER_WALKING_2' &&
            harsha.group.position.z <= CHAPTER_1_TRIGGER_Z.CAR_VISIBLE_Z
          ) {
            transitionToState('CAR_VISIBLE');
          } else if (
            st === 'CAR_VISIBLE' &&
            (harsha.group.position.z <= CHAPTER_1_TRIGGER_Z.CAR_APPROACHING_Z ||
              carZ >= harsha.group.position.z - 16.0)
          ) {
            transitionToState('CAR_APPROACHING');
          }
          break;
        }
        case 'PHONE_VIBRATION': {
          // Locked spec: 0.85s natural deceleration when phone vibrates
          const decelFactor = Math.max(0, 1 - stTime / 0.85);
          targetSpeed = 1.55 * decelFactor;
          harshaHeadingYaw = dampAngle(harshaHeadingYaw, 0, 7, dt);
          desiredAnim = 'PHONE_NOTICE';
          if (stTime >= 0.95) {
            transitionToState('PHONE_CINEMATIC');
          }
          break;
        }
        case 'PHONE_CINEMATIC': {
          targetSpeed = 0;
          harshaHeadingYaw = dampAngle(harshaHeadingYaw, 0, 8, dt);
          desiredAnim = 'PHONE_TAKE_OUT';
          if (stTime >= 1.1) {
            transitionToState('MESSAGE_READ');
          }
          break;
        }
        case 'MESSAGE_READ': {
          targetSpeed = 0;
          harshaHeadingYaw = dampAngle(harshaHeadingYaw, 0, 8, dt);
          if (putAwaySubTimer > 0) {
            putAwaySubTimer += dt;
            desiredAnim = 'PHONE_PUT_AWAY';
            if (putAwaySubTimer >= 1.05) {
              transitionToState('PLAYER_WALKING_2');
            }
          } else {
            desiredAnim = 'PHONE_READ';
            if (stTime >= 4.2) {
              putAwaySubTimer = 0.01;
              setShowPhoneCloseup(false);
            }
          }
          break;
        }
        case 'CAR_APPROACHING': {
          const slowWalk = Math.max(0, 1 - stTime / 2.2) * 1.1;
          targetSpeed = slowWalk;
          harshaHeadingYaw = dampAngle(harshaHeadingYaw, 0, 7, dt);
          desiredAnim = stTime > 1.3 ? 'LOOK_BACK' : 'WALK';
          if (stTime >= 3.6 || carZ >= harsha.group.position.z - 1.2) {
            transitionToState('CAR_STOPPED');
          }
          break;
        }
        case 'CAR_STOPPED': {
          // Car brakes sharply beside Harsha; door unlatches at 1.25s -> Masked Man steps out!
          targetSpeed = 0;
          desiredAnim = 'LOOK_BACK';
          if (stTime >= 1.25 && !doorUnlockPlayed) {
            doorUnlockPlayed = true;
            audio.playCarDoorUnlockAndEndTone();
          }
          if (stTime >= 1.85) {
            transitionToState('MASKED_MAN_EXITS');
          }
          break;
        }
        case 'MASKED_MAN_EXITS': {
          // Masked Man steps down from the sedan and stalks toward Harsha while she backs away
          targetSpeed = 0;
          desiredAnim = 'BACK_AWAY';
          // Harsha turns slightly toward the car (+X / -X) and steps backward toward the sidewalk
          harshaHeadingYaw = dampAngle(harshaHeadingYaw, 0.55, 6.0, dt);
          if (stTime > 0.45) {
            harsha.group.position.x = THREE.MathUtils.damp(
              harsha.group.position.x,
              2.15,
              2.4,
              dt,
            );
            harsha.group.position.z = THREE.MathUtils.damp(
              harsha.group.position.z,
              carZ - 0.35,
              2.2,
              dt,
            );
          }

          // Update Masked Man stepping out -> stalking toward Harsha
          if (stTime < 0.85) {
            kidnapper.setAnimationState('STEP_OUT_OF_CAR');
            kidnapper.group.position.set(
              THREE.MathUtils.lerp(carX + 0.72, carX + 1.18, stTime / 0.85),
              0,
              carZ + 0.1,
            );
          } else {
            kidnapper.setAnimationState('STALK_WALK');
            const stalkT = Math.min(1, (stTime - 0.85) / 1.55);
            kidnapper.group.position.set(
              THREE.MathUtils.lerp(carX + 1.18, harsha.group.position.x - 0.42, stalkT),
              0,
              THREE.MathUtils.lerp(carZ + 0.1, harsha.group.position.z + 0.08, stalkT),
            );
          }
          kidnapper.group.rotation.y = -Math.PI / 2 + 0.15;
          kidnapper.update(dt, elapsed, stTime / 2.4, () => {
            audio.playHeavyBootStep();
          });

          if (stTime >= 2.45) {
            transitionToState('KIDNAP_GRAB');
          }
          break;
        }
        case 'KIDNAP_GRAB': {
          // Masked Man grabs Harsha from behind/beside and pulls her into the open rear passenger door!
          targetSpeed = 0;
          desiredAnim = 'KIDNAP_STRUGGLE';
          const pullDoorX = carX + 0.78;
          const pullDoorZ = carZ - 0.72; // Rear passenger door opening

          if (stTime < 1.95) {
            const pullT = THREE.MathUtils.smoothstep(stTime, 0.0, 1.95);
            harsha.group.position.x = THREE.MathUtils.lerp(2.15, pullDoorX + 0.12, pullT);
            harsha.group.position.z = THREE.MathUtils.lerp(carZ - 0.35, pullDoorZ, pullT);
            harshaHeadingYaw = dampAngle(harshaHeadingYaw, -Math.PI / 2, 5.5, dt);

            kidnapper.setAnimationState('GRAB_AND_PULL');
            kidnapper.group.position.set(
              harsha.group.position.x - 0.34,
              0,
              harsha.group.position.z + 0.06,
            );
            kidnapper.group.rotation.y = -Math.PI / 2;
            kidnapper.update(dt, elapsed, pullT, () => {
              audio.playHeavyBootStep();
            });
          } else {
            // Both enter the dark sedan and the heavy doors slam shut!
            const enterT = Math.min(1, (stTime - 1.95) / 0.55);
            harsha.group.visible = false;
            kidnapper.setAnimationState('ENTER_CAR');
            kidnapper.group.position.set(
              THREE.MathUtils.lerp(pullDoorX, carX + 0.15, enterT),
              0,
              pullDoorZ,
            );
            kidnapper.update(dt, elapsed, enterT);

            if (!doorSlamPlayed && stTime >= 2.25) {
              doorSlamPlayed = true;
              audio.playCarDoorSlam();
            }
          }

          if (stTime >= 2.65) {
            transitionToState('CAR_DRIFT_GETAWAY');
          }
          break;
        }
        case 'CAR_DRIFT_GETAWAY': {
          // Engine roars, rear tires billow smoke, and the car whips into a sudden drift getaway!
          targetSpeed = 0;
          desiredAnim = 'STOP';
          if (!driftSoundPlayed) {
            driftSoundPlayed = true;
            audio.playEngineRevAndDriftScreech();
          }
          if (stTime >= 2.75) {
            transitionToState('CHAPTER_END');
          }
          break;
        }
        case 'CHAPTER_END': {
          targetSpeed = 0;
          desiredAnim = 'STOP';
          if (stTime >= 1.15) {
            transitionToState('TRANSITION_TO_CHAPTER_2');
          }
          break;
        }
        case 'TRANSITION_TO_CHAPTER_2': {
          targetSpeed = 0;
          desiredAnim = 'STOP';
          if (stTime >= 1.35) {
            setActiveChapter('CELL_04');
          }
          break;
        }
      }

      // Apply Harsha Velocity, 360° Heading & Turn Banking
      currentMoveSpeed = THREE.MathUtils.damp(
        currentMoveSpeed,
        targetSpeed,
        7.5,
        dt,
      );

      if (currentMoveSpeed > 0.01 && st !== 'MASKED_MAN_EXITS' && st !== 'KIDNAP_GRAB') {
        const moveDirX = -Math.sin(harshaHeadingYaw);
        const moveDirZ = -Math.cos(harshaHeadingYaw);
        harsha.group.position.x = THREE.MathUtils.clamp(
          harsha.group.position.x + moveDirX * currentMoveSpeed * dt,
          -3.1,
          3.35,
        );
        harsha.group.position.z = THREE.MathUtils.clamp(
          harsha.group.position.z + moveDirZ * currentMoveSpeed * dt,
          -125,
          6.0,
        );
      }

      const headingYawVel =
        normalizeAngle(harshaHeadingYaw - prevHarshaHeadingYaw) / Math.max(0.001, dt);
      prevHarshaHeadingYaw = harshaHeadingYaw;
      turnBankRoll = THREE.MathUtils.damp(
        turnBankRoll,
        THREE.MathUtils.clamp(-headingYawVel * 0.045 * (currentMoveSpeed / 1.8), -0.18, 0.18),
        8.0,
        dt,
      );
      harsha.group.rotation.y = harshaHeadingYaw;

      // Update Surrounding Street Animations
      const distantTrafficActive =
        st === 'SCENE_START' ||
        st === 'OPENING_CINEMATIC' ||
        st === 'PLAYER_WALKING' ||
        st === 'PHONE_VIBRATION' ||
        st === 'PHONE_CINEMATIC' ||
        st === 'MESSAGE_READ';
      street.updateEnvironment(dt, elapsed, distantTrafficActive);

      // Update Approaching Dark Sedan Spline, Doors & Sudden Drift Getaway Kinematics
      let headlightPower = 0;
      let brakeLightPower = 0;

      if (
        st === 'CAR_VISIBLE' ||
        st === 'CAR_APPROACHING' ||
        st === 'CAR_STOPPED' ||
        st === 'MASKED_MAN_EXITS' ||
        st === 'KIDNAP_GRAB' ||
        st === 'CAR_DRIFT_GETAWAY' ||
        st === 'CHAPTER_END'
      ) {
        const stopTargetZ = -53.2;
        let targetCarX = -1.2;
        let targetCarYaw = 0;
        let targetFrontDoor = 0;
        let targetRearDoor = 0;
        let targetDriftSmoke = 0;

        if (st === 'CAR_VISIBLE') {
          carSpeed = THREE.MathUtils.damp(carSpeed, 4.9, 2.2, dt);
          carZ = Math.min(harsha.group.position.z - 14.0, carZ + carSpeed * dt);
          targetCarX = -1.2;
          headlightPower = 3.4;
          brakeLightPower = 0.6;
        } else if (st === 'CAR_APPROACHING') {
          const approachStopZ = harsha.group.position.z - 0.8;
          const distRemaining = Math.max(0, approachStopZ - carZ);
          carSpeed = THREE.MathUtils.clamp(distRemaining * 1.48, 0.85, 7.6);
          carZ = Math.min(approachStopZ, carZ + carSpeed * dt);
          const pullProgress = THREE.MathUtils.clamp(1 - distRemaining / 14.0, 0, 1);
          targetCarX = THREE.MathUtils.lerp(-1.18, -0.45, pullProgress);
          headlightPower = 5.6;
          brakeLightPower = distRemaining < 6.5 ? 2.6 : 0.8;
        } else if (st === 'CAR_STOPPED') {
          const stopZ = harsha.group.position.z - 0.8;
          carZ = THREE.MathUtils.damp(carZ, stopZ, 4.8, dt);
          carSpeed = THREE.MathUtils.damp(carSpeed, 0, 5.5, dt);
          targetCarX = -0.35;
          headlightPower = 4.2;
          brakeLightPower = 3.8;
          targetFrontDoor = doorUnlockPlayed ? 0.22 : 0;
        } else if (st === 'MASKED_MAN_EXITS') {
          carSpeed = 0;
          targetCarX = -0.35;
          headlightPower = 3.6;
          brakeLightPower = 3.8;
          targetFrontDoor = 1.0; // Front passenger door wide open
          targetRearDoor = stTime > 1.1 ? 1.0 : 0.25; // Rear door opens for capture
        } else if (st === 'KIDNAP_GRAB') {
          carSpeed = 0;
          targetCarX = -0.35;
          headlightPower = 3.6;
          brakeLightPower = 4.0;
          // Doors slam shut at stTime >= 2.15s
          targetFrontDoor = stTime < 2.15 ? 0.85 : 0.0;
          targetRearDoor = stTime < 2.15 ? 1.0 : 0.0;
        } else if (st === 'CAR_DRIFT_GETAWAY') {
          // SUDDEN DRIFT & HIGH-SPEED GETAWAY!
          // Phase 1 (0 - 1.1s): Rear tires break traction, tail whips out (+0.46 rad fishtail drift), smoke billows!
          // Phase 2 (1.1s - 2.75s): Counter-steers, snaps straight, and rockets away down the street!
          if (stTime < 1.05) {
            const driftRamp = Math.sin((stTime / 1.05) * Math.PI);
            targetCarYaw = 0.46 * driftRamp; // Aggressive tail-out drift angle
            targetCarX = -0.35 - Math.sin((stTime / 1.05) * Math.PI * 0.5) * 1.45;
            carSpeed = THREE.MathUtils.lerp(2.5, 14.5, stTime / 1.05);
            targetDriftSmoke = 1.0;
          } else {
            const launchT = Math.min(1, (stTime - 1.05) / 1.5);
            targetCarYaw = THREE.MathUtils.lerp(0.18, -0.06, launchT);
            targetCarX = THREE.MathUtils.lerp(-1.8, -0.6, launchT);
            carSpeed = THREE.MathUtils.lerp(14.5, 24.0, launchT);
            targetDriftSmoke = Math.max(0, 1 - launchT * 0.85);
          }
          carZ += carSpeed * dt;
          headlightPower = 6.2;
          brakeLightPower = stTime < 0.35 ? 4.2 : 1.8;
        } else if (st === 'CHAPTER_END') {
          carSpeed = 25.0;
          carZ += carSpeed * dt;
          targetCarX = -0.5;
          targetCarYaw = 0;
          headlightPower = 5.0;
          brakeLightPower = 2.2;
          targetDriftSmoke = 0;
          void stopTargetZ;
        }

        const prevCarX = carX;
        carX = THREE.MathUtils.damp(carX, targetCarX, 4.8, dt);
        carYaw = THREE.MathUtils.damp(carYaw, targetCarYaw, 7.5, dt);
        const lateralVelX = (carX - prevCarX) / Math.max(0.001, dt);

        // Front wheel steering (counter-steers sharply during CAR_DRIFT_GETAWAY)
        const targetSteer =
          st === 'CAR_DRIFT_GETAWAY' && stTime < 1.15
            ? -0.38
            : THREE.MathUtils.clamp(lateralVelX * 0.32, -0.28, 0.28);
        carSteering = THREE.MathUtils.damp(carSteering, targetSteer, 8.5, dt);

        // Suspension Pitch & Roll (Braking nose-dive vs Drift acceleration rear-squat)
        const accel = (carSpeed - prevCarSpeed) / Math.max(0.001, dt);
        prevCarSpeed = carSpeed;
        const roadRipple =
          Math.sin(carZ * 1.8) * 0.005 * Math.min(1, carSpeed / 3.0);
        const brakeOrSquatPitch =
          st === 'CAR_DRIFT_GETAWAY'
            ? -0.048 // Rear squats down under heavy drift acceleration
            : accel < -0.2
              ? THREE.MathUtils.clamp(-accel * 0.012, 0, 0.052)
              : st === 'CAR_STOPPED' && stTime < 0.7
                ? Math.sin((stTime / 0.7) * Math.PI) * 0.036
                : 0;
        const targetPitch = roadRipple + brakeOrSquatPitch;
        const targetRoll =
          st === 'CAR_DRIFT_GETAWAY'
            ? -carYaw * 0.16
            : THREE.MathUtils.clamp(-lateralVelX * 0.045, -0.04, 0.04);

        carChassisPitch = THREE.MathUtils.damp(carChassisPitch, targetPitch, 8.5, dt);
        carChassisRoll = THREE.MathUtils.damp(carChassisRoll, targetRoll, 8.0, dt);
        carFrontDoorRatio = THREE.MathUtils.damp(carFrontDoorRatio, targetFrontDoor, 11.0, dt);
        carRearDoorRatio = THREE.MathUtils.damp(carRearDoorRatio, targetRearDoor, 11.0, dt);
        driftSmokeIntensity = THREE.MathUtils.damp(
          driftSmokeIntensity,
          targetDriftSmoke,
          6.0,
          dt,
        );

        street.setCarTransform(
          carZ,
          carX,
          headlightPower,
          brakeLightPower,
          (carSpeed * dt) / 0.35,
          carSteering,
          carChassisPitch,
          carChassisRoll,
          carFrontDoorRatio,
          carYaw,
          carRearDoorRatio,
          driftSmokeIntensity,
        );

        const distToHarsha = Math.abs(harsha.group.position.z - carZ);
        audio.updateCarEngineAudio(
          true,
          distToHarsha,
          Math.min(1.4, carSpeed / 7.0),
        );
      } else {
        street.setCarTransform(-125, -1.35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        audio.updateCarEngineAudio(false, 100, 0);
      }

      // Update Harsha Character Animation Blender, Aim Look-Ahead & Footsteps
      harsha.setAnimationState(desiredAnim);
      const speedRatio = Math.min(1.6, Math.abs(currentMoveSpeed) / 1.75);
      const aimYawDelta = normalizeAngle(playerYawOffset - harshaHeadingYaw);
      const aimPitchDelta = -playerPitchOffset;

      harsha.update(
        dt,
        elapsed,
        speedRatio,
        (isLeft, ratio) => {
          audio.playFootstep(isLeft, ratio);
        },
        aimYawDelta,
        aimPitchDelta,
        turnBankRoll,
      );

      // Update 4-State Hybrid Camera Director
      carWorldVec.copy(street.carGroup.position);
      kidnapperWorldVec.copy(kidnapper.group.position);

      cameraDirector.update(
        dt,
        elapsed,
        st,
        stTime,
        harsha,
        carWorldVec,
        playerYawOffset,
        playerPitchOffset,
        speedRatio,
        {
          shoulderSide,
          zoomDistance,
          isCrouching,
          isJogging: desiredAnim === 'JOG',
          quickLookBack,
          kidnapperWorldPos: kidnapperWorldVec,
        },
      );

      // Sync React HUD badges lightly (~5Hz)
      uiSyncTimer += dt;
      if (uiSyncTimer >= 0.2) {
        uiSyncTimer = 0;
        const camMode = cameraDirector.getCurrentCameraState();
        setCameraState((prev) => (prev !== camMode ? camMode : prev));
        setAnimState((prev) => (prev !== desiredAnim ? desiredAnim : prev));
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousedown', onCanvasMouseDown);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);

      audio.dispose();
      harsha.dispose();
      kidnapper.dispose();
      street.dispose();
      renderer.dispose();
    };
  }, [activeChapter]);

  if (activeChapter === 'CELL_04') {
    return (
      <Cell04Controller
        onSwitchToChapter1={() => {
          setActiveChapter('CHAPTER_1');
          setGameState('SCENE_START');
        }}
        onSwitchToChapter2={() => {
          setActiveChapter('CHAPTER_2');
        }}
        onEnterDreamWorld={onEnterDreamWorld}
      />
    );
  }

  if (activeChapter === 'CHAPTER_2') {
    return (
      <Chapter2Controller
        onSwitchToChapter1={() => {
          setActiveChapter('CHAPTER_1');
          setGameState('SCENE_START');
        }}
        onCompleteToCell04={() => setActiveChapter('CELL_04')}
        onExitToDreamWorld={onEnterDreamWorld}
      />
    );
  }

  const currentMeta = getChapter1StateMeta(gameState);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#06080e] text-slate-100 select-none font-sans">
      {/* Dedicated 3D WebGL Viewport */}
      <div
        ref={canvasMountRef}
        className="w-full h-full cursor-crosshair"
        aria-label="Prologue Chapter 1 — The Ordinary Night 3D Viewport"
      />

      {/* Top-Right Persistent Testing Shortcut & Developer State Switcher */}
      <div className="pointer-events-auto absolute top-4 right-5 z-40 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleMute}
            className="px-3 py-1.5 rounded-lg bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-xs text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            {audioMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{audioMuted ? 'Muted' : 'Audio'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDevMenuOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-xs text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-300" />
            <span>Chapter 1 States</span>
            {devMenuOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveChapter('CHAPTER_2')}
            className="px-3 py-1.5 rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 font-semibold text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
          >
            <span>Ch 2: Unknown Journey</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChapter('CELL_04')}
            className="px-3.5 py-1.5 rounded-lg bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 font-semibold text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
          >
            <span>Cell 04: Locked Room &rarr;</span>
          </button>

          <button
            type="button"
            onClick={onEnterDreamWorld}
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Skip to 3D Dream World &rarr;</span>
          </button>
        </div>

        {/* Collapsible Developer State Machine Jumper */}
        {devMenuOpen && (
          <div className="w-80 rounded-xl bg-slate-950/95 border border-white/15 p-3 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <span className="font-semibold text-slate-200">
                Chapter 1 State Machine
              </span>
              <button
                type="button"
                onClick={() => jumpToStateRef.current?.('SCENE_START')}
                className="text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restart</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
              <span>CAM: {cameraState}</span>
              <span>ANIM: {animState}</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {CHAPTER_1_STATES.map((st) => {
                const active = st.id === gameState;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => jumpToStateRef.current?.(st.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between cursor-pointer ${
                      active
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40 font-semibold'
                        : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <span className="truncate">{st.label}</span>
                    <span className="text-[10px] font-mono opacity-75 ml-2 shrink-0">
                      B0{st.beatNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Beat 01: Opening Date & Time Stamp (13 FEBRUARY 2027 · 10:30 PM) */}
      {showOpeningDateCard && (
        <div className="pointer-events-none absolute top-14 left-10 z-20 transition-opacity duration-1000">
          <div className="text-xs font-mono tracking-[0.28em] text-amber-200/90">
            13 FEBRUARY 2027 &middot; 10:30 PM
          </div>
          <div className="mt-1 text-sm text-slate-400 font-serif italic">
            Walking home. An ordinary night.
          </div>
        </div>
      )}

      {/* Beat 02: Readable Cinematic Phone Close-Up ("Are you home yet?") */}
      {showPhoneCloseup && (
        <div className="pointer-events-auto absolute bottom-14 right-10 md:right-16 z-30 w-72 rounded-3xl bg-slate-950/95 border border-slate-700/80 p-5 shadow-2xl">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-3 border-b border-white/10">
            <span>10:30 PM</span>
            <span className="flex items-center gap-1 text-sky-300">
              <Smartphone className="w-3 h-3" />
              <span>Incoming Message</span>
            </span>
          </div>

          <div className="py-5">
            <div className="text-[11px] text-slate-400 mb-1.5">
              Unknown / Familiar Number &middot; Now
            </div>
            <div className="rounded-2xl bg-slate-900 border border-sky-400/30 px-4 py-3.5 text-base font-medium text-white shadow-inner">
              &ldquo;Are you home yet?&rdquo;
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismissPhoneMessage}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-slate-200 font-medium transition cursor-pointer"
          >
            Put Phone Away [E]
          </button>
        </div>
      )}

      {/* AAA Third-Person Controls Bar (Shown during playable exploration) */}
      {currentMeta.playerControlAllowed && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-slate-950/85 border border-white/10 text-xs text-slate-300 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 shadow-xl">
          <span className="flex items-center gap-1 text-amber-300">
            <MousePointer className="w-3 h-3" />
            <strong>{pointerLocked ? 'Mouse Look Active (ESC to free)' : 'Click Scene for Mouse Look'}</strong>
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="text-white font-medium">WASD</strong> 360&deg; Move
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="text-white font-medium">Shift</strong> Jog
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="text-white font-medium">C</strong> Stealth Crouch
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="text-white font-medium">V</strong> Swap Shoulder
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="text-white font-medium">Q</strong> Look Back
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="text-white font-medium">Scroll</strong> Zoom
          </span>
        </div>
      )}

      {/* Fade-In / Cut-to-Black Curtain & Chapter 01 End Card */}
      <div
        className={`fixed inset-0 z-30 bg-black flex flex-col items-center justify-center transition-opacity ${
          gameState === 'TRANSITION_TO_CHAPTER_2'
            ? 'duration-75 pointer-events-auto'
            : 'duration-1000 pointer-events-none'
        }`}
        style={{ opacity: fadeBlackOpacity }}
      >
        {gameState === 'TRANSITION_TO_CHAPTER_2' && (
          <div className="text-center px-6 max-w-lg">
            <div className="text-xs font-mono tracking-[0.32em] text-slate-400 mb-3">
              13 FEBRUARY 2027 &middot; 10:33 PM
            </div>
            <h1 className="text-2xl md:text-3xl font-serif tracking-[0.18em] text-white mb-3">
              CHAPTER 01 &middot; THE ORDINARY NIGHT
            </h1>
            <p className="text-sm text-slate-400 font-serif italic mb-8">
              &ldquo;Almost there.&rdquo;
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => jumpToStateRef.current?.('SCENE_START')}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-slate-200 flex items-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Chapter 01</span>
              </button>

              <button
                type="button"
                onClick={() => jumpToStateRef.current?.('CAR_STOPPED')}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-xs text-rose-200 flex items-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Kidnap &amp; Drift Climax</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChapter('CELL_04')}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Wake Up in Cell 04 &middot; Locked Room &rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChapter('CHAPTER_2')}
                className="px-4 py-2.5 rounded-xl bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-xs text-sky-200 flex items-center gap-2 transition cursor-pointer"
              >
                <span>Ch 02 &middot; The Unknown Journey</span>
              </button>

              <button
                type="button"
                onClick={onEnterDreamWorld}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-slate-300 flex items-center gap-2 transition cursor-pointer"
              >
                <span>Skip to 3D Dream World &rarr;</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrequelGame;
