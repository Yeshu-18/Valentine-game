import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CHAPTER_2_STATES,
  Chapter2StateId,
  getChapter2StateMeta,
  JourneyCameraShot,
} from './Chapter2StateMachine';
import { Chapter2AudioController } from './Chapter2Audio';
import { createChapter2CharacterPerformance } from './CharacterPerformance';
import { createCarInteriorLighting } from './CarInteriorLighting';
import { createCarInteriorScene } from './CarInteriorScene';
import { createCarJourneyEnvironment } from './CarJourneyEnvironment';
import { CarMovementController } from './CarMovementController';
import { createJourneyCameraDirector } from './JourneyCameraDirector';

interface Chapter2ControllerProps {
  onCompleteToCell04?: () => void;
  onSwitchToChapter1?: () => void;
  onExitToDreamWorld?: () => void;
}

type ObservationFocus = 'NEUTRAL' | 'LEFT' | 'FORWARD' | 'RIGHT' | 'DOWN';

const CAMERA_SHOT_LABELS: { id: JourneyCameraShot; label: string; shortLabel: string }[] = [
  { id: 'INTERIOR_FIXED_WIDE', label: '1 · Rear Cabin Wide', shortLabel: 'Cabin Wide' },
  { id: 'LOW_DASHBOARD_ANGLE', label: '2 · Dashboard & Driver', shortLabel: 'Dashboard' },
  { id: 'SIDE_PROFILE_CLOSEUP', label: '3 · Harsha Side Profile', shortLabel: 'Side Profile' },
  { id: 'WINDOW_POV', label: '4 · First-Person Window POV', shortLabel: 'Window POV' },
  { id: 'FACIAL_REACTION_CLOSEUP', label: '5 · Harsha Close-Up', shortLabel: 'Face Close-Up' },
  { id: 'EXTERIOR_TRACKING_SHOT', label: '6 · Exterior Tracking', shortLabel: 'Exterior Track' },
  { id: 'FRONT_THREE_QUARTER_SHOT', label: '7 · Front 3/4 Approach', shortLabel: 'Front 3/4' },
  { id: 'WHEEL_LEVEL_SHOT', label: '8 · Low Wheel Stop', shortLabel: 'Wheel Stop' },
  { id: 'INTERIOR_OVER_SHOULDER', label: '9 · Door Open Over-Shoulder', shortLabel: 'Over-Shoulder' },
  { id: 'CONTROLLED_PUSH_IN', label: '10 · Perspective Push-In', shortLabel: 'Push-In' },
  { id: 'CELL_04_AWAKENING_PULLBACK', label: '11 · Cell 04 Awakening', shortLabel: 'Cell 04' },
];

const STAGE_LABELS: Record<string, string> = {
  STAGE_A_NEIGHBOURHOOD: 'Environment A · Familiar Neighbourhood',
  STAGE_B_MAIN_ROAD: 'Environment B · Main Road',
  STAGE_C_ISOLATED_ROUTE: 'Environment C · Isolated Route',
  DESTINATION_ENTRANCE: 'Environment C · Concealed Destination Entrance',
  CELL_04_CHAMBER: 'Act II · Cell 04: The Awakening',
};

export const Chapter2Controller: React.FC<Chapter2ControllerProps> = ({
  onCompleteToCell04,
  onSwitchToChapter1,
  onExitToDreamWorld,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [sceneState, setSceneState] = useState<Chapter2StateId>('SCENE_1_DOOR_CLOSES');
  const [activeCameraShot, setActiveCameraShot] =
    useState<JourneyCameraShot>('INTERIOR_FIXED_WIDE');
  const [manualShotOverride, setManualShotOverride] =
    useState<JourneyCameraShot | null>(null);
  const [freeOrbitMode, setFreeOrbitMode] = useState<boolean>(false);
  const [autoAdvancePaused, setAutoAdvancePaused] = useState<boolean>(false);
  const [observationFocus, setObservationFocus] =
    useState<ObservationFocus>('NEUTRAL');
  const [carSpeedKmh, setCarSpeedKmh] = useState<number>(0);
  const [progressRatio, setProgressRatio] = useState<number>(0);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);
  const [devHudOpen, setDevHudOpen] = useState<boolean>(false);
  const [blackoutAlpha, setBlackoutAlpha] = useState<number>(0);
  const [showPhoneMessage, setShowPhoneMessage] = useState<boolean>(false);

  const stateIdRef = useRef<Chapter2StateId>('SCENE_1_DOOR_CLOSES');
  const stateElapsedRef = useRef<number>(0);
  const transitionToStateRef = useRef<((target: Chapter2StateId) => void) | null>(
    null,
  );
  const audioRef = useRef<Chapter2AudioController | null>(null);
  const manualShotOverrideRef = useRef<JourneyCameraShot | null>(null);
  const freeOrbitModeRef = useRef<boolean>(false);
  const autoAdvancePausedRef = useRef<boolean>(false);
  const observationOverrideRef = useRef<{
    yaw: number;
    pitch: number;
    focus: ObservationFocus;
  } | null>(null);
  const resetLookRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 1. Scene & Atmospheric Night Lighting
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.011);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.06, 240);

    const hemiLight = new THREE.HemisphereLight(0x526b96, 0x1e1814, 0.95);
    scene.add(hemiLight);

    const moonLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
    moonLight.position.set(16, 30, -24);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    scene.add(moonLight);

    // 2. Build Connected 3-Stage Route Environment, Car Interior, Lighting, Character Rig & Camera Director
    const journeyEnv = createCarJourneyEnvironment();
    scene.add(journeyEnv.environmentGroup);

    const carInterior = createCarInteriorScene();
    scene.add(carInterior.carRootGroup);
    scene.add(carInterior.cell04RoomGroup);

    const carLighting = createCarInteriorLighting();
    carInterior.cabinInteriorGroup.add(carLighting.lightingGroup);

    const performance = createChapter2CharacterPerformance();
    carInterior.rearPassengerSeatAnchor.add(performance.seatAnchorGroup);

    const carMovement = new CarMovementController();
    const cameraDirector = createJourneyCameraDirector(camera);

    const audio = new Chapter2AudioController();
    audioRef.current = audio;

    // 3. State Transition Manager
    let inCell04Anchor = false;
    let closeDoorPlayed = false;

    const transitionToState = (nextState: Chapter2StateId) => {
      const meta = getChapter2StateMeta(nextState);
      stateIdRef.current = nextState;
      stateElapsedRef.current = 0;
      setSceneState(nextState);
      setShowPhoneMessage(
        nextState === 'SCENE_3_THE_TURN_AND_DRIVER' ||
          nextState === 'SCENE_3_PASSING_HEADLIGHTS',
      );

      carMovement.snapToState(nextState, meta.defaultCarZ);

      if (nextState === 'SCENE_1_DOOR_CLOSES') {
        closeDoorPlayed = false;
      } else if (nextState === 'SCENE_4_DOOR_OPENS') {
        audio.playCarDoorThud(true);
      } else if (nextState === 'SCENE_5_CONTROLLED_BLACKOUT') {
        audio.playBlackoutTransitionSequence();
      }

      // Reparent Harsha between Rear Passenger Seat (Scenes 1–5.1) and Cell 04 Iron Cot (Scenes 5.2–5.3)
      const shouldBeInCell04 =
        nextState === 'SCENE_5_CONTROLLED_BLACKOUT' ||
        nextState === 'SCENE_5_CELL_04_AWAKENING';

      if (shouldBeInCell04 && !inCell04Anchor) {
        carInterior.cell04BedAnchor.add(performance.seatAnchorGroup);
        performance.seatAnchorGroup.position.set(0, 0, 0);
        performance.seatAnchorGroup.rotation.set(0, 0, 0);
        inCell04Anchor = true;
      } else if (!shouldBeInCell04 && inCell04Anchor) {
        carInterior.rearPassengerSeatAnchor.add(performance.seatAnchorGroup);
        performance.seatAnchorGroup.position.set(0, 0, 0);
        performance.seatAnchorGroup.rotation.set(0, 0, 0);
        inCell04Anchor = false;
      }
    };

    transitionToStateRef.current = transitionToState;
    transitionToState('SCENE_1_DOOR_CLOSES');

    // 4. Interactive Camera & Observation Controls (360° Mouse Drag, Scroll Zoom, WASD, Hotkeys)
    const keys: Record<string, boolean> = {};
    let mouseLookYaw = 0;
    let mouseLookPitch = 0;
    let zoomScale = 1.0;
    let isPointerDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    resetLookRef.current = () => {
      mouseLookYaw = 0;
      mouseLookPitch = 0;
      zoomScale = 1.0;
      observationOverrideRef.current = null;
    };

    const ensureAudioStarted = () => {
      audio.startCabinSoundscape();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      ensureAudioStarted();
      const k = e.key.toLowerCase();
      keys[k] = true;

      if (
        k === 'w' ||
        k === 'a' ||
        k === 's' ||
        k === 'd' ||
        k === 'arrowup' ||
        k === 'arrowdown' ||
        k === 'arrowleft' ||
        k === 'arrowright'
      ) {
        observationOverrideRef.current = null;
      }

      if (k === 'f' && !e.repeat) {
        const nextOrbit = !freeOrbitModeRef.current;
        freeOrbitModeRef.current = nextOrbit;
        setFreeOrbitMode(nextOrbit);
      } else if (k === 'v' && !e.repeat) {
        // Cycle through the 11 authored camera angles
        freeOrbitModeRef.current = false;
        setFreeOrbitMode(false);
        const curShot =
          manualShotOverrideRef.current ||
          getChapter2StateMeta(stateIdRef.current).defaultCameraShot;
        const idx = CAMERA_SHOT_LABELS.findIndex((s) => s.id === curShot);
        const nextShot =
          CAMERA_SHOT_LABELS[(idx + 1) % CAMERA_SHOT_LABELS.length].id;
        manualShotOverrideRef.current = nextShot;
        setManualShotOverride(nextShot);
      } else if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        const nextPaused = !autoAdvancePausedRef.current;
        autoAdvancePausedRef.current = nextPaused;
        setAutoAdvancePaused(nextPaused);
      } else if (e.key === '`') {
        setDevHudOpen((prev) => !prev);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      ensureAudioStarted();
      isPointerDown = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isPointerDown = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isPointerDown) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        mouseLookYaw = THREE.MathUtils.clamp(
          mouseLookYaw - dx * 0.0055,
          -1.45,
          1.45,
        );
        mouseLookPitch = THREE.MathUtils.clamp(
          mouseLookPitch - dy * 0.0045,
          -0.75,
          0.75,
        );
        observationOverrideRef.current = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      zoomScale = THREE.MathUtils.clamp(
        zoomScale + e.deltaY * 0.0012,
        0.55,
        1.85,
      );
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
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);

    // 5. Continuous Render & Narrative Progression Loop
    const clock = new THREE.Clock();
    let rafId = 0;
    let uiThrottle = 0;
    const faceWorldPos = new THREE.Vector3();

    const totalChapterDuration = CHAPTER_2_STATES.reduce(
      (acc, s) => acc + s.duration,
      0,
    );

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      if (!autoAdvancePausedRef.current) {
        stateElapsedRef.current += dt;
      }
      const curState = stateIdRef.current;
      const stateTime = stateElapsedRef.current;
      const curMeta = getChapter2StateMeta(curState);

      // Door closing thud in Scene 1.1 once door reaches closed latch at t = 1.25s
      if (
        curState === 'SCENE_1_DOOR_CLOSES' &&
        stateTime >= 1.25 &&
        !closeDoorPlayed
      ) {
        closeDoorPlayed = true;
        audio.playCarDoorThud(false);
      }

      // Advance automatically to next state when state duration completes (unless paused)
      if (!autoAdvancePausedRef.current && stateTime >= curMeta.duration) {
        const curIdx = CHAPTER_2_STATES.findIndex((s) => s.id === curState);
        if (curIdx >= 0 && curIdx < CHAPTER_2_STATES.length - 1) {
          transitionToState(CHAPTER_2_STATES[curIdx + 1].id);
        }
      }

      // Update Vehicle Kinematics along the 600m route
      const telemetry = carMovement.update(dt, elapsed, curState, stateTime);
      const driverGlanceRatio =
        curState === 'SCENE_3_THE_TURN_AND_DRIVER' ||
        curState === 'SCENE_2_STAGE_C_ISOLATED'
          ? 1.0
          : 0.25;

      carInterior.setVehicleKinematics({
        worldX: telemetry.worldX,
        worldZ: telemetry.worldZ,
        yaw: telemetry.yaw,
        suspensionPitch: telemetry.suspensionPitch,
        suspensionRoll: telemetry.suspensionRoll,
        wheelSpinDelta: telemetry.wheelSpinDelta,
        steeringAngle: telemetry.steeringAngle,
        rearRightDoorOpenRatio: telemetry.rearRightDoorOpenRatio,
        engineVibrationAmp: telemetry.engineRunning ? 1.0 : 0.0,
        headlightIntensity: telemetry.headlightIntensity,
        brakeLightIntensity: telemetry.brakeLightIntensity,
        indicatorBlinkOn: telemetry.indicatorBlinkOn,
        driverLookAtMirrorRatio: driverGlanceRatio,
      });

      if (telemetry.hitRoadJointBump) {
        audio.playSuspensionBump();
      }

      // Animate Exterior Masked Figure walking toward rear right door in Scene 4.3 / 5.1
      let figureWalkProgress = 0;
      if (
        curState === 'SCENE_4_DOOR_OPENS' ||
        curState === 'SCENE_5_PERSPECTIVE_PUSH_IN'
      ) {
        journeyEnv.approachingFigureGroup.visible = true;
        figureWalkProgress = THREE.MathUtils.clamp(stateTime / 2.6, 0, 1);
        journeyEnv.approachingFigureGroup.position.set(
          telemetry.worldX +
            THREE.MathUtils.lerp(2.7, 1.38, figureWalkProgress),
          0,
          telemetry.worldZ +
            THREE.MathUtils.lerp(-0.9, 0.52, figureWalkProgress),
        );
        journeyEnv.approachingFigureGroup.rotation.y = -Math.PI * 0.46;
      } else {
        journeyEnv.approachingFigureGroup.visible = false;
      }

      // Update Connected 3-Stage Route Environment & Oncoming Headlights
      const envTelemetry = journeyEnv.updateEnvironment(
        dt,
        elapsed,
        telemetry.worldZ,
        curState === 'SCENE_3_PASSING_HEADLIGHTS',
        figureWalkProgress,
      );

      if (envTelemetry.oncomingJustPassed) {
        audio.playPassingVehicleWhoosh();
      }

      // Update Dynamic Car Interior Streetlight Sweeps & Dashboard Glow
      const lightMetrics = carLighting.updateLighting(
        dt,
        elapsed,
        telemetry.worldZ,
        telemetry.speedMs,
        telemetry.streetlightSpacing,
        envTelemetry.passingVehicleFlashIntensity,
        telemetry.rearRightDoorOpenRatio,
        telemetry.engineRunning,
      );

      // Compute Player Observation Look Offsets (WASD continuous pan or Quick-Look buttons)
      if (keys['a'] || keys['arrowleft']) {
        mouseLookYaw = THREE.MathUtils.clamp(mouseLookYaw - dt * 1.4, -1.35, 1.35);
      }
      if (keys['d'] || keys['arrowright']) {
        mouseLookYaw = THREE.MathUtils.clamp(mouseLookYaw + dt * 1.4, -1.35, 1.35);
      }
      if (keys['w'] || keys['arrowup']) {
        mouseLookPitch = THREE.MathUtils.clamp(mouseLookPitch + dt * 1.1, -0.65, 0.65);
      }
      if (keys['s'] || keys['arrowdown']) {
        mouseLookPitch = THREE.MathUtils.clamp(mouseLookPitch - dt * 1.1, -0.65, 0.65);
      }

      let obsYaw = mouseLookYaw;
      let obsPitch = mouseLookPitch;
      let detectedFocus: ObservationFocus = 'NEUTRAL';

      if (observationOverrideRef.current) {
        obsYaw = observationOverrideRef.current.yaw;
        obsPitch = observationOverrideRef.current.pitch;
        detectedFocus = observationOverrideRef.current.focus;
      } else if (Math.abs(obsYaw) > 0.25 || Math.abs(obsPitch) > 0.2) {
        if (obsYaw < -0.25) detectedFocus = 'LEFT';
        else if (obsYaw > 0.25) detectedFocus = 'RIGHT';
        else if (obsPitch > 0.2) detectedFocus = 'FORWARD';
        else if (obsPitch < -0.2) detectedFocus = 'DOWN';
      }

      // Update Harsha's Seated or Cell 04 Awakening Performance
      performance.updatePerformance(
        dt,
        elapsed,
        curMeta.performanceState,
        stateTime,
        telemetry.lateralAccel,
        telemetry.longitudinalAccel,
        lightMetrics.passingLightAngle,
        obsYaw,
        obsPitch,
      );

      // Update Continuous Spatial Cabin Foley & Cell 04 Room Tone
      const inCell04 =
        curState === 'SCENE_5_CONTROLLED_BLACKOUT' ||
        curState === 'SCENE_5_CELL_04_AWAKENING';

      audio.updateVehicleFoley(
        dt,
        telemetry.speedMs,
        telemetry.surface,
        telemetry.engineRunning,
        telemetry.indicatorActive,
        inCell04,
      );

      // Update Authored & Interactive 360° Orbit Camera Director
      performance.getFaceCenterWorldPosition(faceWorldPos);
      cameraDirector.setOverrideShot(manualShotOverrideRef.current);
      cameraDirector.updateCamera({
        dt,
        elapsed,
        authoredShot: curMeta.defaultCameraShot,
        stateElapsed: stateTime,
        carRootGroup: carInterior.carRootGroup,
        harshaFaceWorldPos: faceWorldPos,
        playerLookYaw: obsYaw,
        playerLookPitch: obsPitch,
        zoomScale,
        freeOrbitMode: freeOrbitModeRef.current,
        suspensionPitch: telemetry.suspensionPitch,
        suspensionRoll: telemetry.suspensionRoll,
      });

      // Controlled Blackout Curtain Alpha (Scene 5.1 Push-In -> 5.2 Blackout -> 5.3 Eye-Opening)
      let targetBlackout = 0;
      if (curState === 'SCENE_5_PERSPECTIVE_PUSH_IN' && stateTime > 3.2) {
        targetBlackout = THREE.MathUtils.clamp((stateTime - 3.2) / 1.2, 0, 1);
      } else if (curState === 'SCENE_5_CONTROLLED_BLACKOUT') {
        targetBlackout = 1.0;
      } else if (curState === 'SCENE_5_CELL_04_AWAKENING' && stateTime < 1.5) {
        targetBlackout = THREE.MathUtils.clamp(1.0 - stateTime / 1.5, 0, 1);
      }

      renderer.toneMappingExposure =
        1.22 + lightMetrics.streetlampSweepIntensity * 0.025;
      renderer.render(scene, camera);

      // Sync React HUD at ~10Hz
      uiThrottle += dt;
      if (uiThrottle >= 0.1) {
        uiThrottle = 0;
        setCarSpeedKmh(Math.round(telemetry.speedMs * 3.6));
        setActiveCameraShot(cameraDirector.getCurrentShot());
        setObservationFocus(detectedFocus);
        setBlackoutAlpha(targetBlackout);

        const curIdx = CHAPTER_2_STATES.findIndex((s) => s.id === curState);
        const completedBefore = CHAPTER_2_STATES.slice(
          0,
          Math.max(0, curIdx),
        ).reduce((acc, s) => acc + s.duration, 0);
        setProgressRatio(
          Math.min(
            1,
            (completedBefore + Math.min(stateTime, curMeta.duration)) /
              Math.max(1, totalChapterDuration),
          ),
        );
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      audio.dispose();
      performance.dispose();
      carLighting.dispose();
      carInterior.dispose();
      journeyEnv.dispose();
      renderer.dispose();
    };
  }, []);

  const currentMeta = getChapter2StateMeta(sceneState);
  const stageTitle =
    STAGE_LABELS[currentMeta.environmentStage] ||
    'Chapter 2 · The Unknown Journey';

  const handleSelectSceneState = (targetState: Chapter2StateId) => {
    audioRef.current?.startCabinSoundscape();
    manualShotOverrideRef.current = null;
    setManualShotOverride(null);
    transitionToStateRef.current?.(targetState);
  };

  const handleAdvanceNextBeat = () => {
    audioRef.current?.startCabinSoundscape();
    const curIdx = CHAPTER_2_STATES.findIndex(
      (s) => s.id === stateIdRef.current,
    );
    const nextIdx = (curIdx + 1) % CHAPTER_2_STATES.length;
    transitionToStateRef.current?.(CHAPTER_2_STATES[nextIdx].id);
  };

  const handleSelectCameraShot = (shot: JourneyCameraShot | null) => {
    freeOrbitModeRef.current = false;
    setFreeOrbitMode(false);
    manualShotOverrideRef.current = shot;
    setManualShotOverride(shot);
  };

  const handleToggleFreeOrbit = () => {
    const next = !freeOrbitMode;
    freeOrbitModeRef.current = next;
    setFreeOrbitMode(next);
  };

  const handleTogglePause = () => {
    const next = !autoAdvancePaused;
    autoAdvancePausedRef.current = next;
    setAutoAdvancePaused(next);
  };

  const handleQuickLook = (focus: ObservationFocus) => {
    audioRef.current?.startCabinSoundscape();
    if (focus === 'NEUTRAL') {
      resetLookRef.current?.();
      setObservationFocus('NEUTRAL');
      return;
    }
    const map: Record<
      Exclude<ObservationFocus, 'NEUTRAL'>,
      { yaw: number; pitch: number; focus: ObservationFocus }
    > = {
      LEFT: { yaw: -0.78, pitch: 0.04, focus: 'LEFT' },
      FORWARD: { yaw: 0.18, pitch: 0.28, focus: 'FORWARD' },
      RIGHT: { yaw: 0.78, pitch: -0.02, focus: 'RIGHT' },
      DOWN: { yaw: 0.0, pitch: -0.52, focus: 'DOWN' },
    };
    observationOverrideRef.current = map[focus];
    setObservationFocus(focus);
  };

  const toggleMute = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    audioRef.current?.setMuted(next);
  };

  const isCell04Scene =
    sceneState === 'SCENE_5_CONTROLLED_BLACKOUT' ||
    sceneState === 'SCENE_5_CELL_04_AWAKENING';

  return (
    <div className="relative w-full h-screen bg-[#07090e] overflow-hidden select-none font-sans text-slate-100">
      {/* 3D WebGL Viewport */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Subtle Cinematic Vignette Bars */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/80 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 to-transparent z-10" />

      {/* Controlled Blackout Overlay (Scene 5.2 Audio-Driven Transition) */}
      <div
        className="pointer-events-none absolute inset-0 bg-[#040508] transition-opacity duration-300 z-20 flex flex-col items-center justify-center px-6 text-center"
        style={{ opacity: blackoutAlpha }}
      >
        {sceneState === 'SCENE_5_CONTROLLED_BLACKOUT' && (
          <div className="max-w-lg space-y-3 animate-pulse">
            <div className="text-[11px] uppercase tracking-[0.35em] text-amber-400/80">
              Scene 5.2 · Controlled Blackout
            </div>
            <p className="text-lg md:text-xl font-serif italic text-slate-200/95">
              &ldquo;The car door closes. Footsteps echo across concrete, a heavy mechanical latch unlocks in the distance, and the footsteps fade into silence...&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Top Narrative Header */}
      <div className="absolute top-3 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 bg-slate-950/85 border border-slate-800/80 backdrop-blur-md px-3.5 py-2 rounded-lg shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400">
                {isCell04Scene
                  ? 'Act II · Chapter 3 Opening: Cell 04'
                  : 'Chapter 02 · The Unknown Journey'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {currentMeta.emotionTag}
              </span>
            </div>
            <div className="text-xs text-slate-300 font-medium mt-0.5">
              {currentMeta.label} &middot;{' '}
              <span className="text-slate-400">{stageTitle}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-1" />

          <div className="text-[11px] font-mono text-slate-400">
            {isCell04Scene ? 'CELL 04 · LOCKED' : `${carSpeedKmh} KM/H`}
          </div>
        </div>

        {/* Right Controls: Chapter Switcher, Free Orbit, Pause, Audio, Scene Drawer & Dream World */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {onSwitchToChapter1 && (
            <button
              type="button"
              onClick={onSwitchToChapter1}
              className="px-3 py-1.5 rounded-md bg-slate-900/85 hover:bg-slate-800 text-slate-300 border border-slate-700/70 text-xs font-medium transition cursor-pointer"
            >
              &larr; Ch 1: Ordinary Night
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleFreeOrbit}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
              freeOrbitMode
                ? 'bg-sky-500/30 text-sky-200 border-sky-400/60'
                : 'bg-slate-900/85 hover:bg-slate-800 text-slate-200 border-slate-700/70'
            }`}
          >
            {freeOrbitMode ? '360° Free Orbit: ON [F]' : '360° Free Orbit [F]'}
          </button>

          <button
            type="button"
            onClick={handleTogglePause}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
              autoAdvancePaused
                ? 'bg-amber-500/30 text-amber-200 border-amber-400/60'
                : 'bg-slate-900/85 hover:bg-slate-800 text-slate-200 border-slate-700/70'
            }`}
          >
            {autoAdvancePaused ? 'Scene Hold: PAUSED [Space]' : 'Hold Scene [Space]'}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="px-3 py-1.5 rounded-md bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/70 text-xs font-medium transition cursor-pointer"
          >
            {audioMuted ? 'Audio: Muted' : 'Audio: Active'}
          </button>

          <button
            type="button"
            onClick={() => setDevHudOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium transition cursor-pointer"
          >
            {devHudOpen ? 'Hide All Beats' : 'All 14 Scene Beats'}
          </button>

          {onExitToDreamWorld && (
            <button
              type="button"
              onClick={onExitToDreamWorld}
              className="px-3 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition cursor-pointer"
            >
              Skip to 3D Dream World &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Subtle Phone Notification Cue during Scene 3 */}
      {showPhoneMessage && (
        <div className="pointer-events-none absolute top-20 right-6 z-30 bg-slate-950/90 border border-amber-500/40 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl max-w-xs">
          <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400/90">
            13 Feb 2027 · 10:42 PM
          </div>
          <div className="text-sm font-medium text-slate-100 mt-1">
            &ldquo;Almost there.&rdquo;
          </div>
        </div>
      )}

      {/* Scene & Camera Director Drawer */}
      {devHudOpen && (
        <div className="absolute top-16 right-4 z-30 w-96 max-h-[76vh] overflow-y-auto bg-slate-950/95 border border-slate-800/90 backdrop-blur-xl rounded-xl p-4 shadow-2xl space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2">
              Jump to Scene Beat (Scenes 1 &rarr; 5 &rarr; Cell 04)
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {CHAPTER_2_STATES.map((cfg) => {
                const active = cfg.id === sceneState;
                return (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => handleSelectSceneState(cfg.id)}
                    className={`text-left px-2.5 py-1.5 rounded text-xs transition cursor-pointer flex items-center justify-between ${
                      active
                        ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50 font-semibold'
                        : 'bg-slate-900/70 hover:bg-slate-800/80 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <span className="truncate">{cfg.label}</span>
                    <span className="text-[10px] font-mono text-slate-400 ml-2">
                      {cfg.duration}s
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Narrative Caption + Instant Camera Angle Bar + Rear-Seat Observation Controls */}
      <div className="absolute bottom-3 left-4 right-4 z-30 flex flex-col items-center gap-2 pointer-events-none">
        {/* Subtitle / Narrative Caption */}
        <div className="max-w-2xl text-center bg-slate-950/85 border border-slate-800/80 backdrop-blur-md px-5 py-2 rounded-xl shadow-2xl">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-400/85 mb-0.5">
            {stageTitle}
          </div>
          <p className="text-sm md:text-base text-slate-100 font-serif tracking-wide">
            {currentMeta.subtitle}
          </p>
        </div>

        {/* Always-Visible Instant Camera Switcher Bar */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 bg-slate-950/90 border border-slate-800/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xl">
          <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 mr-1">
            Camera [V]:
          </span>
          {CAMERA_SHOT_LABELS.map((s) => {
            const isSelected = !freeOrbitMode && activeCameraShot === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectCameraShot(s.id)}
                className={`px-2 py-1 rounded text-[11px] transition cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/30 text-sky-200 border border-sky-400/50 font-medium'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                {s.shortLabel}
              </button>
            );
          })}
          {manualShotOverride && (
            <button
              type="button"
              onClick={() => handleSelectCameraShot(null)}
              className="px-2 py-1 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer"
            >
              Auto Director
            </button>
          )}
        </div>

        {/* Interactive Player Observation Controls + Timeline Progress */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 bg-slate-950/90 border border-slate-800/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg shadow-xl">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 mr-1">
            Drag Mouse to Orbit &middot; Scroll to Zoom &middot; Look:
          </span>

          <button
            type="button"
            onClick={() => handleQuickLook('LEFT')}
            className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
              observationFocus === 'LEFT'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            [A] Left Window
          </button>

          <button
            type="button"
            onClick={() => handleQuickLook('FORWARD')}
            className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
              observationFocus === 'FORWARD'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            [W] Driver &amp; Dashboard
          </button>

          <button
            type="button"
            onClick={() => handleQuickLook('RIGHT')}
            className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
              observationFocus === 'RIGHT'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            [D] Right Door
          </button>

          <button
            type="button"
            onClick={() => handleQuickLook('DOWN')}
            className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
              observationFocus === 'DOWN'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            [S] Hands &amp; Lap
          </button>

          <button
            type="button"
            onClick={() => handleQuickLook('NEUTRAL')}
            className="px-2 py-1 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 cursor-pointer"
          >
            Reset View
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={handleAdvanceNextBeat}
            className="px-2.5 py-1 rounded text-xs bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 cursor-pointer"
          >
            Next Beat &rarr;
          </button>

          {sceneState === 'SCENE_5_CELL_04_AWAKENING' && onCompleteToCell04 && (
            <button
              type="button"
              onClick={onCompleteToCell04}
              className="px-3 py-1 rounded text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold cursor-pointer"
            >
              Enter Dream World &rarr;
            </button>
          )}
        </div>

        {/* Route Progress Bar */}
        <div className="w-72 h-1 bg-slate-800/90 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-150"
            style={{ width: `${Math.min(100, Math.round(progressRatio * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
export default Chapter2Controller;
