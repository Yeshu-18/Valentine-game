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
import { createResidentialStreetScene } from './ResidentialStreetScene';
import { createHybridCameraDirector } from './HybridCameraDirector';

export interface PrequelGameProps {
  /** Direct testing shortcut to enter the 3D Dream World immediately */
  onEnterDreamWorld: () => void;
  /** Optional shortcut to jump to the Private World Epilogue */
  onJumpToEpilogue?: () => void;
}

/**
 * Standalone Playable 3D Prequel Experience (located in /src/prequel outside /src/world)
 * Implements Prologue · Chapter 1: The Ordinary Night (13 FEBRUARY 2027 · 10:30 PM)
 * - 5-beat playable & cinematic flow
 * - 4-state Hybrid Camera System (FOLLOW, PHONE_CINEMATIC, LOOK_AROUND, CAR_CINEMATIC)
 * - 8-state Character Animation Blender with gradual slowdown on phone vibration
 * - Event-driven 12-stage state machine + Developer State Jumper & Direct Dream World Shortcut
 */
export const PrequelGame: React.FC<PrequelGameProps> = ({
  onEnterDreamWorld,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<Chapter1StateId>('SCENE_START');
  const [cameraState, setCameraState] = useState<HybridCameraState>('FOLLOW');
  const [animState, setAnimState] = useState<HarshaAnimState>('WALK');
  const [fadeBlackOpacity, setFadeBlackOpacity] = useState(1);
  const [showOpeningDateCard, setShowOpeningDateCard] = useState(true);
  const [showPhoneCloseup, setShowPhoneCloseup] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);

  // Refs for synchronous WebGL loop access without re-mounting the canvas
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

    // Warm/Cool Nighttime Illumination
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

    // 3. Build Residential Street, Harsha Character, Camera Director & Audio Controller
    const street = createResidentialStreetScene();
    scene.add(street.group);

    const harsha = createHarshaStreetCharacter();
    harsha.group.position.set(1.55, 0, 0); // Walking on the right-side pedestrian lane/road edge facing -Z
    scene.add(harsha.group);

    const cameraDirector = createHybridCameraDirector(camera);
    cameraDirector.snapToHarsha(harsha);

    const audio = new Chapter1AudioController();
    audioControllerRef.current = audio;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 4. Input Handling (WASD Walk, Shift Faster Walk, E Interact, Mouse Look)
    const keys: Record<string, boolean> = {};
    let playerYawOffset = 0;
    let playerPitchOffset = 0;
    let isPointerDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Velocity & Car Spline State
    let currentWalkSpeed = 1.65; // Relaxed grounded walk speed (m/s)
    let carZ = -125;
    let carSpeed = 0;
    let putAwaySubTimer = 0;
    let doorUnlockPlayed = false;

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
      }

      // Configure audio, car position, and overlays per state
      switch (nextState) {
        case 'SCENE_START': {
          harsha.group.position.set(1.55, 0, 0);
          currentWalkSpeed = 1.55;
          carZ = -125;
          carSpeed = 0;
          doorUnlockPlayed = false;
          setShowOpeningDateCard(true);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(1);
          audio.setTrafficPresence('normal');
          audio.updateCarEngineAudio(false, 100, 0);
          street.setCarTransform(-125, -1.35, 0, 0, 0);
          cameraDirector.snapToHarsha(harsha);
          break;
        }
        case 'OPENING_CINEMATIC': {
          setShowOpeningDateCard(true);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.startNightAmbience();
          audio.setTrafficPresence('normal');
          break;
        }
        case 'PLAYER_WALKING': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.startNightAmbience();
          audio.setTrafficPresence('normal');
          break;
        }
        case 'PHONE_VIBRATION': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.startNightAmbience();
          audio.playPhoneVibration();
          break;
        }
        case 'PHONE_CINEMATIC': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          currentWalkSpeed = 0;
          break;
        }
        case 'MESSAGE_READ': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(true);
          setFadeBlackOpacity(0);
          currentWalkSpeed = 0;
          putAwaySubTimer = 0;
          audio.playPhoneScreenWake();
          break;
        }
        case 'PLAYER_WALKING_2': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.setTrafficPresence('quiet');
          break;
        }
        case 'CAR_VISIBLE': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          audio.setTrafficPresence('quiet');
          if (carZ < -95 || snapPosition) {
            carZ = harsha.group.position.z - 52;
          }
          carSpeed = 5.4;
          break;
        }
        case 'CAR_APPROACHING': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          if (snapPosition || carZ < harsha.group.position.z - 28) {
            carZ = harsha.group.position.z - 22;
          }
          carSpeed = 6.2;
          break;
        }
        case 'CAR_STOPPED': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          if (snapPosition) {
            carZ = harsha.group.position.z - 1.2;
          }
          audio.playCarBrakeStop();
          break;
        }
        case 'CHAPTER_END': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(0);
          carZ = harsha.group.position.z - 1.2;
          carSpeed = 0;
          doorUnlockPlayed = false;
          audio.setTrafficPresence('silent');
          break;
        }
        case 'TRANSITION_TO_CHAPTER_2': {
          setShowOpeningDateCard(false);
          setShowPhoneCloseup(false);
          setFadeBlackOpacity(1);
          audio.updateCarEngineAudio(false, 100, 0);
          break;
        }
      }
    };

    jumpToStateRef.current = (target: Chapter1StateId) => {
      transitionToState(target, true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      audio.startNightAmbience();

      if (
        (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') &&
        (stateRef.current === 'MESSAGE_READ' ||
          stateRef.current === 'PHONE_CINEMATIC')
      ) {
        e.preventDefault();
        if (putAwaySubTimer === 0) {
          putAwaySubTimer = 0.01; // Start smooth PHONE_PUT_AWAY transition
          setShowPhoneCloseup(false);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      isPointerDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      audio.startNightAmbience();
    };

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.movementX || (isPointerDragging ? e.clientX - lastMouseX : 0);
      const dy = e.movementY || (isPointerDragging ? e.clientY - lastMouseY : 0);
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      const meta = getChapter1StateMeta(stateRef.current);
      if (meta.playerControlAllowed && (isPointerDragging || document.pointerLockElement)) {
        playerYawOffset -= dx * 0.0032;
        playerPitchOffset = THREE.MathUtils.clamp(
          playerPitchOffset + dy * 0.0024,
          -0.35,
          0.38,
        );
      }
    };

    const onMouseUp = () => {
      isPointerDragging = false;
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
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    // Start Chapter 1 at SCENE_START
    transitionToState('SCENE_START', true);

    // 5. Continuous Game Loop with Software-WebGL Frame Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;
    let uiSyncTimer = 0;
    const carWorldVec = new THREE.Vector3();

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

      // State Machine Progression & Character Movement Logic
      let targetSpeed = 0;
      let targetLateralX = harsha.group.position.x;
      let desiredAnim: HarshaAnimState = 'IDLE';

      switch (st) {
        case 'SCENE_START': {
          // Beat 01: Fade in from black while Harsha walks gently into the streetlight pool
          targetSpeed = 1.45;
          desiredAnim = 'WALK';
          if (stTime >= 1.4) {
            transitionToState('OPENING_CINEMATIC');
          }
          break;
        }
        case 'OPENING_CINEMATIC': {
          // Camera slowly reveals Harsha walking along the quiet residential street
          targetSpeed = 1.5;
          desiredAnim = 'WALK';
          if (stTime >= 3.8) {
            transitionToState('PLAYER_WALKING');
          }
          break;
        }
        case 'PLAYER_WALKING':
        case 'PLAYER_WALKING_2':
        case 'CAR_VISIBLE': {
          // Player-controlled grounded walking (WASD / Arrow keys, Shift to walk slightly faster)
          const moveForward =
            keys['KeyW'] || keys['ArrowUp'] ? 1 : keys['KeyS'] || keys['ArrowDown'] ? -0.6 : 0;
          const moveSide =
            keys['KeyD'] || keys['ArrowRight'] ? 1 : keys['KeyA'] || keys['ArrowLeft'] ? -1 : 0;
          const isFastWalk = keys['ShiftLeft'] || keys['ShiftRight'];

          const baseWalk = isFastWalk ? 2.45 : 1.75;
          if (moveForward !== 0 || moveSide !== 0) {
            targetSpeed = moveForward !== 0 ? moveForward * baseWalk : baseWalk * 0.65;
            targetLateralX = THREE.MathUtils.clamp(
              harsha.group.position.x + moveSide * dt * 1.15,
              0.55,
              2.65,
            );
            desiredAnim = 'WALK';
            // Gently recenter camera yaw as she walks
            playerYawOffset = THREE.MathUtils.damp(playerYawOffset, 0, 1.8, dt);
          } else {
            targetSpeed = 0;
            desiredAnim = 'IDLE';
          }

          // Spatial Event Triggers along the Street
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
          // Crucial detail from spec: Harsha does NOT freeze abruptly.
          // Her walking gradually slows down over ~1.1s, then stops naturally.
          const decelFactor = Math.max(0, 1 - stTime / 1.05);
          targetSpeed = 1.55 * decelFactor;
          desiredAnim = 'PHONE_NOTICE';
          if (stTime >= 1.15) {
            transitionToState('PHONE_CINEMATIC');
          }
          break;
        }
        case 'PHONE_CINEMATIC': {
          // Hand moves toward pocket and raises the 3D phone
          targetSpeed = 0;
          desiredAnim = 'PHONE_TAKE_OUT';
          if (stTime >= 1.1) {
            transitionToState('MESSAGE_READ');
          }
          break;
        }
        case 'MESSAGE_READ': {
          // Hold on "Are you home yet?" long enough to read, then put phone away
          targetSpeed = 0;
          if (putAwaySubTimer > 0) {
            putAwaySubTimer += dt;
            desiredAnim = 'PHONE_PUT_AWAY';
            if (putAwaySubTimer >= 1.05) {
              transitionToState('PLAYER_WALKING_2');
            }
          } else {
            desiredAnim = 'PHONE_READ';
            // Automatically begin putting phone away after holding 4.2s on the message
            if (stTime >= 4.2) {
              putAwaySubTimer = 0.01;
              setShowPhoneCloseup(false);
            }
          }
          break;
        }
        case 'CAR_APPROACHING': {
          // Harsha slows her walk and glances back as headlights sweep past
          const slowWalk = Math.max(0, 1 - stTime / 2.2) * 1.1;
          targetSpeed = slowWalk;
          desiredAnim = stTime > 1.4 ? 'LOOK_BACK' : 'WALK';
          if (stTime >= 3.8 || carZ >= harsha.group.position.z - 1.4) {
            transitionToState('CAR_STOPPED');
          }
          break;
        }
        case 'CAR_STOPPED': {
          // Car slows to a stop nearby with red brake lights illuminating the road
          targetSpeed = 0;
          desiredAnim = 'LOOK_BACK';
          if (stTime >= 2.8) {
            transitionToState('CHAPTER_END');
          }
          break;
        }
        case 'CHAPTER_END': {
          // Beat 05: Side profile hold on the car's silhouette -> door unlock sound -> cut to black
          targetSpeed = 0;
          desiredAnim = 'STOP';
          if (stTime >= 2.2 && !doorUnlockPlayed) {
            doorUnlockPlayed = true;
            audio.playCarDoorUnlockAndEndTone();
          }
          if (stTime >= 2.55) {
            // Instant cut to black right after the door unlock sound
            transitionToState('TRANSITION_TO_CHAPTER_2');
          }
          break;
        }
        case 'TRANSITION_TO_CHAPTER_2': {
          targetSpeed = 0;
          desiredAnim = 'STOP';
          break;
        }
      }

      // Smooth velocity damping for Harsha
      currentWalkSpeed = THREE.MathUtils.damp(
        currentWalkSpeed,
        targetSpeed,
        6.5,
        dt,
      );
      harsha.group.position.z -= currentWalkSpeed * dt;
      harsha.group.position.x = THREE.MathUtils.damp(
        harsha.group.position.x,
        targetLateralX,
        6.0,
        dt,
      );

      // Update Approaching Dark Sedan Spline & Lighting
      let headlightPower = 0;
      let brakeLightPower = 0;

      if (
        st === 'CAR_VISIBLE' ||
        st === 'CAR_APPROACHING' ||
        st === 'CAR_STOPPED' ||
        st === 'CHAPTER_END'
      ) {
        const stopTargetZ = harsha.group.position.z - 0.8;
        if (st === 'CAR_VISIBLE') {
          carSpeed = THREE.MathUtils.damp(carSpeed, 4.8, 2.0, dt);
          carZ = Math.min(stopTargetZ - 14.0, carZ + carSpeed * dt);
          headlightPower = 3.2;
          brakeLightPower = 0.6;
        } else if (st === 'CAR_APPROACHING') {
          const distRemaining = Math.max(0, stopTargetZ - carZ);
          carSpeed = THREE.MathUtils.clamp(distRemaining * 1.45, 0.8, 7.5);
          carZ = Math.min(stopTargetZ, carZ + carSpeed * dt);
          headlightPower = 5.4;
          brakeLightPower = distRemaining < 6.0 ? 2.4 : 0.8;
        } else if (st === 'CAR_STOPPED') {
          carZ = THREE.MathUtils.damp(carZ, stopTargetZ, 4.5, dt);
          carSpeed = THREE.MathUtils.damp(carSpeed, 0, 5.0, dt);
          headlightPower = 4.2;
          brakeLightPower = 3.6; // Red brake lights illuminate the road
        } else if (st === 'CHAPTER_END') {
          carZ = stopTargetZ;
          carSpeed = 0;
          headlightPower = 2.8;
          brakeLightPower = 3.8; // Red tail lights against the dark street
        }

        const carPullInX =
          st === 'CAR_STOPPED' || st === 'CHAPTER_END'
            ? THREE.MathUtils.lerp(-1.35, -0.35, Math.min(1, stTime * 0.7))
            : -1.15;

        street.setCarTransform(
          carZ,
          carPullInX,
          headlightPower,
          brakeLightPower,
          (carSpeed * dt) / 0.34,
        );

        const distToHarsha = Math.abs(harsha.group.position.z - carZ);
        audio.updateCarEngineAudio(
          true,
          distToHarsha,
          Math.min(1, carSpeed / 7.0),
        );
      } else {
        street.setCarTransform(-125, -1.35, 0, 0, 0);
        audio.updateCarEngineAudio(false, 100, 0);
      }

      // Update Harsha 8-State Character Animation Blender & Synchronized Footsteps
      harsha.setAnimationState(desiredAnim);
      const speedRatio = Math.min(1.3, Math.abs(currentWalkSpeed) / 1.75);
      harsha.update(dt, elapsed, speedRatio, (isLeft, ratio) => {
        audio.playFootstep(isLeft, ratio);
      });

      // Update 4-State Hybrid Camera Director
      carWorldVec.copy(street.carGroup.position);
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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);

      audio.dispose();
      harsha.dispose();
      street.dispose();
      renderer.dispose();
    };
  }, []);

  const currentMeta = getChapter1StateMeta(gameState);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#06080e] text-slate-100 select-none font-sans">
      {/* Dedicated 3D WebGL Viewport */}
      <div
        ref={canvasMountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
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
        <div className="pointer-events-none absolute top-10 left-10 z-20 transition-opacity duration-1000">
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
        <div className="pointer-events-auto absolute bottom-12 right-10 md:right-16 z-30 w-72 rounded-3xl bg-slate-950/95 border border-slate-700/80 p-5 shadow-2xl">
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

      {/* Minimal Grounded Controls Hint (Only shown while walking, zero HUD clutter) */}
      {currentMeta.playerControlAllowed && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-300 flex items-center gap-3">
          <span>
            <strong className="text-white font-medium">WASD</strong> Walk
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="text-white font-medium">Shift</strong> Walk Faster
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="text-white font-medium">Mouse Drag</strong> Look Around
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
              &ldquo;That message was strange. Why is that car here?&rdquo;
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
                onClick={onEnterDreamWorld}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Continue / Shortcut to 3D Dream World &rarr;</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrequelGame;
