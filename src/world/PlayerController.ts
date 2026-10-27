import * as THREE from 'three';
import { BroomLifecycleState, MagicFlightBundle } from './MagicFlight';
import {
  CastleGateState,
  MagicMysteryBoxBundle,
  MysteryCinematicCaption,
  MysteryPromptMode,
} from './MagicMysteryBox';
import { PlayerAvatarBundle } from './PlayerCharacter';
import { CircleCollider } from './VegetationSystem';
import {
  SchoolBannerNotification,
  SchoolPromptInfo,
  WizardingSchoolBundle,
} from './WizardingSchool';
import {
  AuroraCinematicBundle,
  AuroraUndergroundCinematicBundle,
} from './cinematics/AuroraUndergroundCinematic';
import {
  CarnivalActiveOverlay,
  CarnivalDistrictBundle,
  CarnivalProximityPrompt,
} from './carnival/CarnivalState';
import { DreamCastleBundle } from './dreamscape/DreamCastle';
import {
  BROOM_STAND_POS,
  CASTLE_KEEP_POS,
  CASTLE_TERRACE_POS,
  FOREST_LAKE_LOCAL_POS,
  ISLAND_BOUNDS,
  castleLocalToWorld,
  dampAlpha,
  dampValue,
  getHeartIslandMask,
  getRegionAtPosition,
  getTerrainHeight,
  isWalkablePosition,
} from './terrainMath';

export type CameraMode = 'third-person' | 'first-person';
export type LocomotionState =
  | 'walk'
  | 'mounting'
  | 'flight'
  | 'mystery_cinematic';
export type BroomPromptMode = 'none' | 'pickup' | 'dismount' | 'returning';

export interface FlightStoryCaption {
  line: string;
  headline?: string;
  stepIndex: number;
  totalSteps: number;
}

export interface PlayerTelemetry {
  x: number;
  y: number;
  z: number;
  speed: number;
  altitudeAboveGround: number;
  isSprinting: boolean;
  isBoosting: boolean;
  locomotionState: LocomotionState;
  broomState: BroomLifecycleState;
  broomPromptMode: BroomPromptMode;
  mysteryPromptMode: MysteryPromptMode;
  mysteryCaption: MysteryCinematicCaption | null;
  flightCaption: FlightStoryCaption | null;
  schoolPrompt: SchoolPromptInfo;
  schoolBanner: SchoolBannerNotification | null;
  hasHarshaKey: boolean;
  castleGateState: CastleGateState;
  castleAwaitsBanner: boolean;
  cinematicTime: number;
  isOverCastleTerrace: boolean;
  cameraMode: CameraMode;
  cameraDistance: number;
  regionName: string;
  regionSubtitle: string;
  isPointerLocked: boolean;
  auroraPrompt: string | null;
  carnivalPrompt: CarnivalProximityPrompt | null;
  carnivalOverlay: CarnivalActiveOverlay | null;
  carnivalPrizesCount: number;
  castlePrompt: string | null;
}

export interface PlayerControllerBundle {
  update: (delta: number, elapsedTime: number) => void;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => CameraMode;
  setCameraDistance: (dist: number) => void;
  teleportTo: (x: number, z: number, yawRadians?: number) => void;
  triggerBroomAction: () => void;
  triggerMysteryAction: () => void;
  triggerSchoolAction: () => void;
  triggerAuroraAction: () => void;
  triggerCarnivalAction: () => void;
  triggerCastleAction: () => boolean;
  performCarnivalGameAction: () => void;
  advanceDialogue: () => void;
  skipDialogueOrCinematic: () => void;
  getTelemetry: () => PlayerTelemetry;
  getPosition: () => THREE.Vector3;
  dispose: () => void;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _broomWorldPos = new THREE.Vector3();
const _rightHandWorldPos = new THREE.Vector3();
const _shakeOffset = new THREE.Vector3();

function wrapAnglePi(a: number): number {
  let r = (a + Math.PI) % (2.0 * Math.PI);
  if (r < 0) r += 2.0 * Math.PI;
  return r - Math.PI;
}

export function createPlayerController(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  avatar: PlayerAvatarBundle,
  magicFlight: MagicFlightBundle,
  mysteryBox: MagicMysteryBoxBundle,
  wizardingSchool: WizardingSchoolBundle,
  auroraCinematic: AuroraCinematicBundle,
  carnivalDistrict: CarnivalDistrictBundle,
  colliders: CircleCollider[],
  onTelemetryChange?: (telemetry: PlayerTelemetry) => void,
  dreamCastle?: DreamCastleBundle,
): PlayerControllerBundle {
  // Spawn at the NW edge of Central Plaza (-16, +16), facing the NW Ancient Realm Gateway,
  // Ancient Realm Signboard, Broom Travel Stand (-28.5, +26.0), and Castle (-85, +75) on the mountain crag!
  const spawnX = -16.5;
  const spawnZ = 16.0;
  const playerPos = new THREE.Vector3(
    spawnX,
    getTerrainHeight(spawnX, spawnZ),
    spawnZ,
  );
  const playerVelocity = new THREE.Vector3();

  const initialYaw = Math.atan2(
    BROOM_STAND_POS.x - spawnX,
    BROOM_STAND_POS.z - spawnZ,
  );

  let cameraYaw = initialYaw;
  let cameraPitch = 0.14;
  let facingYaw = initialYaw;

  let locomotionState: LocomotionState = 'walk';
  let cameraMode: CameraMode = 'third-person';
  let targetCameraDistance = 6.2;
  let currentCameraDistance = 6.2;

  const currentCamPos = new THREE.Vector3(
    spawnX - Math.sin(initialYaw) * 6.2,
    playerPos.y + 2.8,
    spawnZ - Math.cos(initialYaw) * 6.2,
  );
  const currentLookAt = new THREE.Vector3(
    spawnX,
    playerPos.y + 1.4,
    spawnZ,
  );

  // Flight physics state (Phase B & C spec)
  let flightForwardSpeed = 0; // W = 15 m/s, Shift+W = 22 m/s, S = -3 m/s
  let flightVerticalSpeed = 0; // Space = ascend, Ctrl/C/Q/Z = descend
  let flightYaw = initialYaw;
  let flightYawRate = 0;
  let flightVisualPitch = 0;
  let flightVisualRoll = 0;
  let lastMouseMoveElapsed = -10;
  let currentElapsedTime = 0;

  // Walk jump state
  let verticalVel = 0;
  let isGrounded = true;

  // Input state
  const keys = new Set<string>();
  let isDragging = false;
  let isPointerLocked = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let telemetryTimer = 0;
  let wasCarnivalActive = false;
  let currentRegion = getRegionAtPosition(playerPos.x, playerPos.z);

  const WALK_SPEED = 8.2;
  const SPRINT_SPEED = 14.2;
  const WALK_ACCEL = 11.5;
  const WALK_DECEL = 10.5;
  const PLAYER_RADIUS = 0.48;
  const EYE_HEIGHT = 1.66;

  // Flight Physics Constants (Requirement 2)
  const FLIGHT_CRUISE_SPEED = 15.0; // W = Forward cruise (15 m/s)
  const FLIGHT_BOOST_SPEED = 22.0; // Shift + W = Boost (22 m/s)
  const FLIGHT_REVERSE_SPEED = -3.0; // S = Brake / slow reverse (-3 m/s)
  const FLIGHT_VERTICAL_MAX = 7.8; // Space / Ctrl vertical climb/descent rate
  const FLIGHT_YAW_RATE_MAX = THREE.MathUtils.degToRad(105); // Smooth yaw turn rate
  const FLIGHT_GROUND_CLEARANCE = 1.2; // getTerrainHeight(x, z) + 1.2m
  const FLIGHT_MAX_ALTITUDE = 98.0;

  /**
   * Finds a safe walkable landing spot on or near (x, z) when dismounting the broom.
   */
  function findSafeWalkableGround(x: number, z: number): { x: number; z: number } {
    // If near the Castle Landing Terrace (-74, +64), snap inside the terrace deck if over cliff edge
    const dTerrace = Math.hypot(
      x - CASTLE_TERRACE_POS.x,
      z - CASTLE_TERRACE_POS.z,
    );
    if (dTerrace <= CASTLE_TERRACE_POS.radius + 4.0) {
      if (dTerrace > CASTLE_TERRACE_POS.radius - 1.2) {
        const ang = Math.atan2(
          z - CASTLE_TERRACE_POS.z,
          x - CASTLE_TERRACE_POS.x,
        );
        return {
          x: CASTLE_TERRACE_POS.x + Math.cos(ang) * (CASTLE_TERRACE_POS.radius - 1.5),
          z: CASTLE_TERRACE_POS.z + Math.sin(ang) * (CASTLE_TERRACE_POS.radius - 1.5),
        };
      }
      return { x, z };
    }

    if (isWalkablePosition(x, z)) {
      return { x, z };
    }

    // Search concentric rings for nearest walkable terrain
    for (let r = 2.0; r <= 36.0; r += 2.5) {
      for (let a = 0; a < 16; a++) {
        const theta = (a * Math.PI * 2) / 16;
        const tx = x + Math.cos(theta) * r;
        const tz = z + Math.sin(theta) * r;
        if (isWalkablePosition(tx, tz)) {
          return { x: tx, z: tz };
        }
      }
    }
    return { x: BROOM_STAND_POS.x + 1.8, z: BROOM_STAND_POS.z - 1.8 };
  }

  /**
   * Dismounts the player onto walkable ground and sends the broom into its
   * 'RETURNING' state to fly along a high curved arc back to its Travel Stand.
   */
  function dismountBroomAndReturnToStand() {
    if (locomotionState !== 'flight' && locomotionState !== 'mounting') return;

    const broomDeparturePos = magicFlight.broomRoot.position.clone();
    const safeSpot = findSafeWalkableGround(playerPos.x, playerPos.z);
    const groundY = getTerrainHeight(safeSpot.x, safeSpot.z);

    // 1. Place player cleanly onto walkable ground in Third-Person Walking mode
    playerPos.set(safeSpot.x, groundY, safeSpot.z);
    playerVelocity.set(0, 0, 0);
    verticalVel = 0;
    isGrounded = true;

    facingYaw = flightYaw;
    cameraYaw = flightYaw;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch, 0.08, 0.45);

    locomotionState = 'walk';
    flightDialogueActive = false;
    flightForwardSpeed = 0;
    flightVerticalSpeed = 0;
    flightVisualPitch = 0;
    flightVisualRoll = 0;

    avatar.group.position.copy(playerPos);
    avatar.group.rotation.set(0, facingYaw, 0);
    avatar.setShadowVisible(true);
    avatar.updateAnimation(0.016, 0, false, currentElapsedTime, false);

    // 2. Trigger the Broom's Return-to-Home self-flying arc back to the Travel Stand
    magicFlight.startReturnToHome(broomDeparturePos, flightYaw);

    onTelemetryChange?.(buildTelemetry());
  }

  let currentCinematicTime = 0;
  let lastIsReceivingKey = false;
  let flightDialogueActive = false;
  let flightDialogueStep = 0;

  const FLIGHT_DIALOGUE_STEPS: Array<{ line: string; headline?: string }> = [
    { line: '"Harsha, look."' },
    {
      line: '"We’ve already come this far. And there’s still so much left to explore."',
    },
    {
      line: '"More places. More stupid arguments. More laughing at things nobody else would find funny. More memories."',
    },
    {
      line: '"I don’t know exactly where life is going to take us. But I know who I want beside me."',
    },
    {
      line: '"I know who I want beside me."',
      headline: 'YOU. ❤️',
    },
  ];

  function getFlightStoryCaption(): FlightStoryCaption | null {
    if (locomotionState !== 'flight' || !flightDialogueActive) return null;
    const step = FLIGHT_DIALOGUE_STEPS[flightDialogueStep];
    if (!step) return null;
    return {
      line: step.line,
      headline: step.headline,
      stepIndex: flightDialogueStep + 1,
      totalSteps: FLIGHT_DIALOGUE_STEPS.length,
    };
  }

  function restoreGameplayFromMysteryCinematic() {
    if (locomotionState !== 'mystery_cinematic') return;
    locomotionState = 'walk';
    lastIsReceivingKey = false;
    camera.fov = 60.0;
    camera.updateProjectionMatrix();

    const horizDist = Math.cos(cameraPitch) * currentCameraDistance;
    const vertOffset = Math.sin(cameraPitch) * currentCameraDistance + 1.55;
    currentCamPos.set(
      playerPos.x - Math.sin(cameraYaw) * horizDist,
      playerPos.y + vertOffset,
      playerPos.z - Math.cos(cameraYaw) * horizDist,
    );
    currentLookAt.set(playerPos.x, playerPos.y + 1.38, playerPos.z);
    camera.position.copy(currentCamPos);
    camera.lookAt(currentLookAt);
    avatar.setFirstPersonVisibility(cameraMode === 'first-person');
  }

  function skipAuroraCinematicAndRestorePlayer() {
    auroraCinematic.skipCinematic();
    const surfY = getTerrainHeight(0, 55);
    playerPos.set(0, surfY, 55);
    playerVelocity.set(0, 0, 0);
    verticalVel = 0;
    isGrounded = true;

    const horizDist = Math.cos(cameraPitch) * currentCameraDistance;
    const vertOffset = Math.sin(cameraPitch) * currentCameraDistance + 1.55;
    currentCamPos.set(
      playerPos.x - Math.sin(cameraYaw) * horizDist,
      playerPos.y + vertOffset,
      playerPos.z - Math.cos(cameraYaw) * horizDist,
    );
    currentLookAt.set(playerPos.x, playerPos.y + 1.38, playerPos.z);
    camera.position.copy(currentCamPos);
    camera.lookAt(currentLookAt);

    avatar.setFirstPersonVisibility(cameraMode === 'first-person');
    avatar.setShadowVisible(true);
    avatar.group.position.copy(playerPos);
    avatar.updateAnimation(
      0.016,
      0,
      false,
      currentElapsedTime,
      false,
      false,
      0,
      0,
      false,
    );
    onTelemetryChange?.(buildTelemetry());
  }

  /**
   * Advances the currently active dialogue by exactly one line when the player presses Enter.
   */
  function handleAdvanceDialogue() {
    if (auroraCinematic.isActive()) {
      auroraCinematic.advanceDialogue();
      onTelemetryChange?.(buildTelemetry());
      return;
    }

    if (carnivalDistrict.isActive()) {
      carnivalDistrict.advanceCinematicOrPrize(camera);
      onTelemetryChange?.(buildTelemetry());
      return;
    }

    if (mysteryBox.isDialogueActive()) {
      mysteryBox.advanceDialogue();
      if (
        locomotionState === 'mystery_cinematic' &&
        !mysteryBox.isCinematicCameraActive()
      ) {
        restoreGameplayFromMysteryCinematic();
      }
      onTelemetryChange?.(buildTelemetry());
      return;
    }

    if (locomotionState === 'flight' && flightDialogueActive) {
      if (flightDialogueStep < FLIGHT_DIALOGUE_STEPS.length - 1) {
        flightDialogueStep += 1;
      } else {
        flightDialogueActive = false;
      }
      onTelemetryChange?.(buildTelemetry());
      return;
    }

    if (wizardingSchool.isDialogueActive()) {
      wizardingSchool.advanceDialogue();
      onTelemetryChange?.(buildTelemetry());
      return;
    }
  }

  /**
   * Immediately skips the active dialogue or cinematic sequence when the player presses Esc,
   * cleanly restoring gameplay controls, camera, and preserving earned state.
   */
  function handleSkipDialogueOrCinematic() {
    if (auroraCinematic.isActive()) {
      skipAuroraCinematicAndRestorePlayer();
      return;
    }

    if (carnivalDistrict.isActive()) {
      carnivalDistrict.skipActiveAttraction();
      avatar.setFirstPersonVisibility(cameraMode === 'first-person');
      avatar.setShadowVisible(true);
      avatar.updateAnimation(
        0.016,
        0,
        false,
        currentElapsedTime,
        false,
        false,
        0,
        0,
        false,
      );
      onTelemetryChange?.(buildTelemetry());
      return;
    }

    if (
      locomotionState === 'mystery_cinematic' ||
      mysteryBox.isDialogueActive()
    ) {
      mysteryBox.skipCinematicOrDialogue();
      restoreGameplayFromMysteryCinematic();
      onTelemetryChange?.(buildTelemetry());
      return;
    }

    if (locomotionState === 'flight' && flightDialogueActive) {
      flightDialogueActive = false;
      onTelemetryChange?.(buildTelemetry());
      return;
    }

    if (wizardingSchool.isDialogueActive()) {
      wizardingSchool.skipDialogue();
      onTelemetryChange?.(buildTelemetry());
      return;
    }
  }

  /**
   * Handles Mystery Box opening (M5B cinematic) or Castle Gate unlocking when on the Castle Landing Terrace.
   */
  function handleInteractMystery(): boolean {
    if (locomotionState !== 'walk') return false;

    const promptMode = mysteryBox.getPromptMode(playerPos, true);
    if (promptMode === 'open_box') {
      const targetPos = new THREE.Vector3();
      const targetYawObj = { value: facingYaw };
      if (
        mysteryBox.startBoxCinematic(
          camera,
          playerPos,
          targetPos,
          targetYawObj,
        )
      ) {
        locomotionState = 'mystery_cinematic';
        currentCinematicTime = 0;
        lastIsReceivingKey = false;
        playerVelocity.set(0, 0, 0);
        verticalVel = 0;
        isGrounded = true;

        // Place player cleanly in front of the Ornate Stone Plinth facing the Mystery Box & Castle Gate
        const groundY = getTerrainHeight(targetPos.x, targetPos.z);
        playerPos.set(targetPos.x, groundY, targetPos.z);
        facingYaw = targetYawObj.value;
        cameraYaw = targetYawObj.value;
        cameraPitch = 0.14;

        avatar.group.position.copy(playerPos);
        avatar.group.rotation.set(0, facingYaw, 0);
        avatar.setFirstPersonVisibility(false);
        avatar.setShadowVisible(true);
        avatar.updateAnimation(0.016, 0, false, currentElapsedTime, false, false);

        onTelemetryChange?.(buildTelemetry());
        return true;
      }
    } else if (promptMode === 'unlock_gate') {
      const targetPos = new THREE.Vector3();
      const targetYawObj = { value: facingYaw };
      if (
        mysteryBox.unlockCastleGate(
          camera,
          playerPos,
          targetPos,
          targetYawObj,
        )
      ) {
        locomotionState = 'mystery_cinematic';
        currentCinematicTime = 0;
        lastIsReceivingKey = true;
        playerVelocity.set(0, 0, 0);
        verticalVel = 0;
        isGrounded = true;

        // Place player cleanly 2.25m in front of the Castle Gate facing the Brass Heart Lock Escutcheon
        const groundY = getTerrainHeight(targetPos.x, targetPos.z);
        playerPos.set(targetPos.x, groundY, targetPos.z);
        facingYaw = targetYawObj.value;
        cameraYaw = targetYawObj.value;
        cameraPitch = 0.14;

        avatar.group.position.copy(playerPos);
        avatar.group.rotation.set(0, facingYaw, 0);
        avatar.setFirstPersonVisibility(false);
        avatar.setShadowVisible(true);
        avatar.updateAnimation(0.016, 0, false, currentElapsedTime, false, true);

        onTelemetryChange?.(buildTelemetry());
        return true;
      }
    }
    return false;
  }

  /**
   * Handles the 7 Wizarding School interactions inside the Great Hall, Library, Potions Wing & Conservatory.
   */
  function handleInteractSchool(): boolean {
    if (locomotionState !== 'walk') return false;
    const gState = mysteryBox.getGateState();
    const isGateOpenOrUnlocking =
      gState === 'OPEN' || gState === 'UNLOCKING';
    const res = wizardingSchool.triggerInteractable(
      playerPos,
      true,
      isGateOpenOrUnlocking,
    );
    if (res.triggeredId !== 'none') {
      onTelemetryChange?.(buildTelemetry());
      return true;
    }
    return false;
  }

  function triggerAuroraAction(): boolean {
    if (locomotionState !== 'walk') return false;
    if (auroraCinematic.isNearStone(playerPos)) {
      playerVelocity.set(0, 0, 0);
      verticalVel = 0;
      isGrounded = true;
      avatar.setFirstPersonVisibility(false);
      avatar.setShadowVisible(true);
      auroraCinematic.triggerCinematic(
        playerPos,
        facingYaw,
        camera.position,
        currentLookAt,
      );
      onTelemetryChange?.(buildTelemetry());
      return true;
    }
    return false;
  }

  function triggerCarnivalAction(): boolean {
    if (locomotionState !== 'walk') return false;
    if (
      carnivalDistrict.triggerNearestAttraction(
        playerPos,
        facingYaw,
        camera.position,
        currentLookAt,
      )
    ) {
      playerVelocity.set(0, 0, 0);
      verticalVel = 0;
      isGrounded = true;
      avatar.setFirstPersonVisibility(true);
      avatar.setShadowVisible(false);
      onTelemetryChange?.(buildTelemetry());
      return true;
    }
    return false;
  }

  function performCarnivalGameAction() {
    if (carnivalDistrict.isActive()) {
      if (carnivalDistrict.performGameAction(camera)) {
        onTelemetryChange?.(buildTelemetry());
      }
    }
  }

  function triggerCastleAction(): boolean {
    if (locomotionState !== 'walk' || !dreamCastle) return false;
    const prompt = dreamCastle.getProximityPrompt(playerPos);
    if (!prompt) return false;

    if (prompt.action === 'door') {
      dreamCastle.nav.openEntranceDoors();
      onTelemetryChange?.(buildTelemetry());
      return true;
    }
    if (prompt.action === 'call_elevator') {
      const callInfo = dreamCastle.nav.isNearElevatorFloorCall(playerPos);
      if (callInfo) {
        dreamCastle.nav.callElevatorToFloor(callInfo.floor.id);
        onTelemetryChange?.(buildTelemetry());
        return true;
      }
    }
    if (prompt.action === 'telescope') {
      dreamCastle.nav.triggerRooftopPanoramicPan(playerPos);
      onTelemetryChange?.(buildTelemetry());
      return true;
    }
    return false;
  }

  /**
   * Initiates mounting when within 3.2m of the Travel Stand, or dismounting when flying.
   */
  function handleInteractBroom() {
    if (locomotionState === 'walk') {
      if (auroraCinematic.isNearStone(playerPos)) {
        triggerAuroraAction();
        return;
      }
      if (triggerCarnivalAction()) {
        return;
      }
      if (triggerCastleAction()) {
        return;
      }
      if (handleInteractMystery()) {
        return;
      }
      if (handleInteractSchool()) {
        return;
      }
      if (magicFlight.isWithinStandProximity(playerPos)) {
        locomotionState = 'mounting';
        flightDialogueActive = true;
        flightDialogueStep = 0;
        playerVelocity.set(0, 0, 0);
        verticalVel = 0;

        // Orient player toward the NW Castle crag (-85, +75) for a dramatic launch sightline
        const castleAimYaw = Math.atan2(
          CASTLE_KEEP_POS.x - playerPos.x,
          CASTLE_KEEP_POS.z - playerPos.z,
        );
        facingYaw = castleAimYaw;
        flightYaw = castleAimYaw;
        cameraYaw = castleAimYaw;
        cameraPitch = 0.08;

        magicFlight.startMounting(playerPos, facingYaw);
        avatar.setShadowVisible(false);
        onTelemetryChange?.(buildTelemetry());
      }
    } else if (locomotionState === 'flight') {
      dismountBroomAndReturnToStand();
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    keys.add(e.code);

    // Master Dialogue / Cinematic Input Rules:
    // - Enter advances one dialogue line (never auto-advances, ignores held key repeat)
    // - Esc immediately skips the active dialogue/cinematic sequence and restores gameplay
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (!e.repeat) {
        e.preventDefault();
        handleAdvanceDialogue();
      }
      return;
    }

    if (e.code === 'Escape') {
      if (!e.repeat) {
        if (dreamCastle?.nav.activeCameraFocus) {
          e.preventDefault();
          dreamCastle.nav.skipCameraFocus();
          return;
        }
        if (auroraCinematic.isActive() || carnivalDistrict.isActive()) {
          e.preventDefault();
          handleSkipDialogueOrCinematic();
          return;
        }
        if (
          locomotionState === 'mystery_cinematic' ||
          mysteryBox.isDialogueActive() ||
          wizardingSchool.isDialogueActive() ||
          (locomotionState === 'flight' && flightDialogueActive)
        ) {
          e.preventDefault();
          handleSkipDialogueOrCinematic();
          return;
        }
        if (locomotionState === 'flight') {
          e.preventDefault();
          dismountBroomAndReturnToStand();
          return;
        }
      }
      return;
    }

    if (carnivalDistrict.isActive()) {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        performCarnivalGameAction();
      } else if (!e.repeat && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Numpad1' || e.code === 'Numpad2' || e.code === 'Numpad3')) {
        e.preventDefault();
        const digit = parseInt(e.code.replace('Digit', '').replace('Numpad', ''), 10);
        (carnivalDistrict as any).selectOption?.(digit);
      }
      return;
    }

    // Elevator Floor Selection inside Dream Castle Cabin
    if (dreamCastle && dreamCastle.nav.isInsideElevatorCabin(playerPos) && !e.repeat) {
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        dreamCastle.handleElevatorFloorSelect(1);
        onTelemetryChange?.(buildTelemetry());
        return;
      }
      if (e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        dreamCastle.handleElevatorFloorSelect(2);
        onTelemetryChange?.(buildTelemetry());
        return;
      }
      if (e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        dreamCastle.handleElevatorFloorSelect(3);
        onTelemetryChange?.(buildTelemetry());
        return;
      }
      if (e.code === 'Digit4' || e.code === 'Numpad4') {
        e.preventDefault();
        dreamCastle.handleElevatorFloorSelect(4);
        onTelemetryChange?.(buildTelemetry());
        return;
      }
      if (e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        dreamCastle.handleElevatorFloorSelect(-1);
        onTelemetryChange?.(buildTelemetry());
        return;
      }
    }

    if (
      locomotionState === 'mystery_cinematic' ||
      wizardingSchool.isLakeMemoryActive() ||
      auroraCinematic.isActive()
    ) {
      return;
    }

    if (e.code === 'KeyV' && !e.repeat) {
      toggleCameraMode();
    } else if (e.code === 'KeyE' && !e.repeat) {
      e.preventDefault();
      handleInteractBroom();
    } else if (e.code === 'KeyF' && !e.repeat && locomotionState === 'flight') {
      // Pressing F while flying dismounts the broom and sends it home
      dismountBroomAndReturnToStand();
    } else if (e.code === 'Space' && locomotionState === 'walk' && isGrounded) {
      e.preventDefault();
      verticalVel = 7.2;
      isGrounded = false;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (carnivalDistrict.isActive()) {
      performCarnivalGameAction();
    }
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  };

  let lastFreeMouseX: number | null = null;
  let lastFreeMouseY: number | null = null;

  const onPointerMove = (e: PointerEvent) => {
    if (auroraCinematic.isActive()) {
      if (isPointerLocked) {
        auroraCinematic.applyMouseLookDelta(e.movementX, e.movementY);
      } else {
        const dx =
          lastFreeMouseX !== null
            ? e.clientX - lastFreeMouseX
            : e.movementX || 0;
        const dy =
          lastFreeMouseY !== null
            ? e.clientY - lastFreeMouseY
            : e.movementY || 0;
        lastFreeMouseX = e.clientX;
        lastFreeMouseY = e.clientY;
        auroraCinematic.applyMouseLookDelta(dx, dy);
      }
      return;
    }

    if (carnivalDistrict.isActive()) {
      let dx = 0;
      let dy = 0;
      if (isPointerLocked) {
        dx = e.movementX || 0;
        dy = e.movementY || 0;
      } else {
        dx =
          lastFreeMouseX !== null
            ? e.clientX - lastFreeMouseX
            : e.movementX || 0;
        dy =
          lastFreeMouseY !== null
            ? e.clientY - lastFreeMouseY
            : e.movementY || 0;
      }
      lastFreeMouseX = e.clientX;
      lastFreeMouseY = e.clientY;
      carnivalDistrict.applyMouseLookDelta(dx, dy);
      return;
    }

    lastFreeMouseX = e.clientX;
    lastFreeMouseY = e.clientY;

    if (
      locomotionState === 'mystery_cinematic' ||
      wizardingSchool.isLakeMemoryActive()
    )
      return;
    if (isPointerLocked) {
      cameraYaw = wrapAnglePi(cameraYaw - e.movementX * 0.0028);
      cameraPitch = THREE.MathUtils.clamp(
        cameraPitch + e.movementY * 0.0022,
        -0.58,
        1.15,
      );
      lastMouseMoveElapsed = currentElapsedTime;
      return;
    }
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    cameraYaw = wrapAnglePi(cameraYaw - dx * 0.0055);
    cameraPitch = THREE.MathUtils.clamp(
      cameraPitch + dy * 0.0045,
      -0.58,
      1.15,
    );
    lastMouseMoveElapsed = currentElapsedTime;
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  const onWheel = (e: WheelEvent) => {
    if (carnivalDistrict.isActive()) {
      carnivalDistrict.applyZoomDelta?.(e.deltaY);
      return;
    }
    if (
      cameraMode !== 'third-person' ||
      locomotionState === 'mystery_cinematic' ||
      wizardingSchool.isLakeMemoryActive() ||
      auroraCinematic.isActive()
    )
      return;
    targetCameraDistance = THREE.MathUtils.clamp(
      targetCameraDistance + e.deltaY * 0.005,
      2.8,
      14.5,
    );
  };

  const onPointerLockChange = () => {
    isPointerLocked = document.pointerLockElement === domElement;
    onTelemetryChange?.(buildTelemetry());
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('wheel', onWheel, { passive: true });
  document.addEventListener('pointerlockchange', onPointerLockChange);

  function setCameraMode(mode: CameraMode) {
    cameraMode = mode;
    if (locomotionState !== 'mystery_cinematic') {
      avatar.setFirstPersonVisibility(mode === 'first-person');
    }
  }

  function toggleCameraMode(): CameraMode {
    const next = cameraMode === 'third-person' ? 'first-person' : 'third-person';
    setCameraMode(next);
    return next;
  }

  function setCameraDistance(dist: number) {
    targetCameraDistance = THREE.MathUtils.clamp(dist, 2.8, 14.5);
  }

  function teleportTo(x: number, z: number, yawRadians?: number) {
    if (locomotionState === 'mystery_cinematic') {
      return;
    }
    if (carnivalDistrict.isActive()) {
      carnivalDistrict.skipActiveAttraction();
    }
    if (locomotionState === 'flight' || locomotionState === 'mounting') {
      dismountBroomAndReturnToStand();
    }
    const groundY = getTerrainHeight(x, z);
    playerPos.set(x, groundY, z);
    playerVelocity.set(0, 0, 0);
    verticalVel = 0;
    isGrounded = true;

    const targetYaw =
      yawRadians !== undefined ? yawRadians : Math.atan2(-x, -z);
    cameraYaw = targetYaw;
    facingYaw = targetYaw;
    flightYaw = targetYaw;

    avatar.group.position.copy(playerPos);
    avatar.group.rotation.set(0, facingYaw, 0);

    currentCamPos.set(
      x - Math.sin(cameraYaw) * currentCameraDistance,
      groundY + 3.0,
      z - Math.cos(cameraYaw) * currentCameraDistance,
    );
    currentLookAt.set(x, groundY + 1.5, z);
    currentRegion = getRegionAtPosition(x, z);
  }

  function buildTelemetry(): PlayerTelemetry {
    const groundY = getTerrainHeight(playerPos.x, playerPos.z);
    const altitudeAboveGround = Math.max(0, playerPos.y - groundY);
    const bState = magicFlight.getState();

    let broomPromptMode: BroomPromptMode = 'none';
    if (
      locomotionState === 'walk' &&
      magicFlight.isWithinStandProximity(playerPos)
    ) {
      broomPromptMode = 'pickup';
    } else if (locomotionState === 'flight') {
      broomPromptMode = 'dismount';
    } else if (bState === 'RETURNING') {
      broomPromptMode = 'returning';
    }

    const mysteryPromptMode = mysteryBox.getPromptMode(
      playerPos,
      locomotionState === 'walk',
    );
    const gState = mysteryBox.getGateState();
    const schoolPrompt = wizardingSchool.getPromptInfo(
      playerPos,
      locomotionState === 'walk',
      gState === 'OPEN' || gState === 'UNLOCKING',
    );

    const horizSpeed =
      locomotionState === 'flight'
        ? Math.hypot(flightForwardSpeed, flightVerticalSpeed)
        : Math.hypot(playerVelocity.x, playerVelocity.z);

    return {
      x: Math.round(playerPos.x * 10) / 10,
      y: Math.round(playerPos.y * 10) / 10,
      z: Math.round(playerPos.z * 10) / 10,
      speed: Math.round(horizSpeed * 10) / 10,
      altitudeAboveGround: Math.round(altitudeAboveGround * 10) / 10,
      isSprinting:
        locomotionState === 'walk' &&
        (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
        horizSpeed > 0.5,
      isBoosting:
        locomotionState === 'flight' &&
        (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
        flightForwardSpeed > 15.5,
      locomotionState,
      broomState: bState,
      broomPromptMode,
      mysteryPromptMode,
      mysteryCaption: mysteryBox.getActiveCaption(),
      flightCaption: getFlightStoryCaption(),
      schoolPrompt,
      schoolBanner: wizardingSchool.getActiveBanner(),
      hasHarshaKey: mysteryBox.hasKey(),
      castleGateState: gState,
      castleAwaitsBanner: mysteryBox.isCastleAwaitsVisible(),
      cinematicTime: Math.round(currentCinematicTime * 10) / 10,
      isOverCastleTerrace: magicFlight.isOverCastleTerrace(playerPos),
      cameraMode,
      cameraDistance: Math.round(targetCameraDistance * 10) / 10,
      regionName: currentRegion.name,
      regionSubtitle: currentRegion.subtitle,
      isPointerLocked,
      auroraPrompt:
        locomotionState === 'walk'
          ? auroraCinematic.getInteractionPrompt(playerPos)
          : null,
      carnivalPrompt:
        locomotionState === 'walk' && !auroraCinematic.isActive()
          ? carnivalDistrict.getProximityPrompt(playerPos)
          : null,
      carnivalOverlay: carnivalDistrict.getActiveOverlay(),
      carnivalPrizesCount: carnivalDistrict.getEarnedPrizeIds().length,
      castlePrompt:
        locomotionState === 'walk' && dreamCastle
          ? dreamCastle.getProximityPrompt(playerPos)?.prompt ?? null
          : null,
    };
  }

  return {
    setCameraMode,
    toggleCameraMode,
    setCameraDistance,
    teleportTo,
    triggerBroomAction: handleInteractBroom,
    triggerMysteryAction: handleInteractMystery,
    triggerSchoolAction: handleInteractSchool,
    triggerAuroraAction,
    triggerCarnivalAction,
    triggerCastleAction,
    performCarnivalGameAction,
    advanceDialogue: handleAdvanceDialogue,
    skipDialogueOrCinematic: handleSkipDialogueOrCinematic,
    getTelemetry: buildTelemetry,
    getPosition: () => playerPos,

    update(rawDelta: number, elapsedTime: number) {
      const dt = Math.min(rawDelta, 0.05);
      currentElapsedTime = elapsedTime;

      auroraCinematic.update(dt, elapsedTime);
      carnivalDistrict.update(dt, elapsedTime, playerPos, camera, keys);

      const isCarnivalActive = carnivalDistrict.isActive();
      if (wasCarnivalActive && !isCarnivalActive) {
        avatar.setFirstPersonVisibility(cameraMode === 'first-person');
        avatar.setShadowVisible(true);
      }
      wasCarnivalActive = isCarnivalActive;

      if (auroraCinematic.isActive()) {
        const focus = auroraCinematic.getCameraFocus();
        if (focus) {
          camera.position.copy(focus.camWorldPos);
          camera.lookAt(focus.lookWorldPos);
          currentCamPos.copy(focus.camWorldPos);
          currentLookAt.copy(focus.lookWorldPos);
          playerPos.copy(focus.playerPos);
          facingYaw = focus.playerYaw;
          avatar.group.position.copy(focus.playerPos);
          avatar.group.rotation.set(0, focus.playerYaw, 0);
          avatar.updateAnimation(
            dt,
            0,
            false,
            elapsedTime,
            false,
            false,
            0,
            0,
            focus.isSitting,
          );
        }
        onTelemetryChange?.(buildTelemetry());
        return;
      }

      if (carnivalDistrict.isActive()) {
        const cFocus = carnivalDistrict.getCameraFocus();
        if (cFocus && cFocus.active) {
          currentCamPos.lerp(cFocus.camWorldPos, 1 - Math.exp(-18 * dt));
          currentLookAt.lerp(cFocus.lookWorldPos, 1 - Math.exp(-22 * dt));
          camera.position.copy(currentCamPos);
          camera.lookAt(currentLookAt);

          if (cFocus.playerPos) {
            playerPos.copy(cFocus.playerPos);
            avatar.group.position.copy(cFocus.playerPos);
          }
          if (cFocus.playerYaw !== undefined) {
            facingYaw = cFocus.playerYaw;
            avatar.group.rotation.set(0, cFocus.playerYaw, 0);
          }
          avatar.setFirstPersonVisibility(Boolean(cFocus.hidePlayerAvatar));
          avatar.updateAnimation(
            dt,
            0,
            false,
            elapsedTime,
            false,
            false,
            0,
            0,
            Boolean(cFocus.isSitting),
          );
        }
        currentRegion = getRegionAtPosition(playerPos.x, playerPos.z);
        onTelemetryChange?.(buildTelemetry());
        return;
      }

      // ======================================================================
      // STATE 0: M5B MYSTERY BOX STATE-MACHINE CINEMATIC (Manual Enter Steps)
      // ======================================================================
      if (locomotionState === 'mystery_cinematic') {
        if (Math.abs(camera.fov - 50.0) > 0.05) {
          camera.fov = dampValue(camera.fov, 50.0, 6.0, dt);
          camera.updateProjectionMatrix();
        }

        avatar.group.position.copy(playerPos);
        avatar.group.rotation.set(0, facingYaw, 0);

        // Compute target third-person gameplay camera pose for the return
        const horizDist = Math.cos(cameraPitch) * currentCameraDistance;
        const vertOffset = Math.sin(cameraPitch) * currentCameraDistance + 1.55;
        _desiredCamPos.set(
          playerPos.x - Math.sin(cameraYaw) * horizDist,
          playerPos.y + vertOffset,
          playerPos.z - Math.cos(cameraYaw) * horizDist,
        );
        _desiredLookAt.set(playerPos.x, playerPos.y + 1.38, playerPos.z);

        // Update avatar right-hand pose first so rightHandWorldPos is accurate
        avatar.updateAnimation(
          dt,
          0,
          false,
          elapsedTime,
          false,
          lastIsReceivingKey,
        );
        avatar.getRightHandWorldPosition(_rightHandWorldPos);

        const { finished, isReceivingKey, cinematicTime } =
          mysteryBox.updateCinematic(
            dt,
            elapsedTime,
            camera,
            _rightHandWorldPos,
            _desiredCamPos,
            _desiredLookAt,
          );
        currentCinematicTime = cinematicTime;
        lastIsReceivingKey = isReceivingKey;

        if (finished) {
          restoreGameplayFromMysteryCinematic();
          onTelemetryChange?.(buildTelemetry());
        }
      }

      // ======================================================================
      // STATE 1: MOUNTING SEQUENCE (~0.85s smooth lift & mount onto broom)
      // ======================================================================
      else if (locomotionState === 'mounting') {
        const groundY = getTerrainHeight(playerPos.x, playerPos.z);
        const { completed, progress } = magicFlight.updateMounting(
          dt,
          playerPos,
          facingYaw,
        );

        // Smoothly lift player into hover altitude (+1.45m above ground)
        playerPos.y = THREE.MathUtils.lerp(
          groundY,
          groundY + 1.45,
          progress,
        );
        avatar.group.position.set(
          magicFlight.broomRoot.position.x,
          magicFlight.broomRoot.position.y - 0.52,
          magicFlight.broomRoot.position.z,
        );
        avatar.group.rotation.set(0, magicFlight.broomRoot.rotation.y, 0);
        avatar.updateAnimation(dt, 0, false, elapsedTime, progress > 0.35);

        // Transition camera smoothly into Third-Person Flight Mode (~6m behind, ~2.2m above)
        const camD = 6.0;
        const camH = 2.2;
        _desiredCamPos.set(
          playerPos.x - Math.sin(cameraYaw) * camD,
          playerPos.y + camH,
          playerPos.z - Math.cos(cameraYaw) * camD,
        );
        _desiredLookAt.set(
          playerPos.x + Math.sin(cameraYaw) * 3.0,
          playerPos.y + 1.15,
          playerPos.z + Math.cos(cameraYaw) * 3.0,
        );
        currentCamPos.lerp(_desiredCamPos, dampAlpha(7.5, dt));
        currentLookAt.lerp(_desiredLookAt, dampAlpha(9.0, dt));
        camera.position.copy(currentCamPos);
        camera.lookAt(currentLookAt);

        if (completed) {
          locomotionState = 'flight';
          flightForwardSpeed = 7.5; // Smooth initial launch momentum toward the NW trail
          flightVerticalSpeed = 1.2;
          onTelemetryChange?.(buildTelemetry());
        }
      }

      // ======================================================================
      // STATE 2: PHYSICAL BROOM FLIGHT (No Teleporting!)
      // ======================================================================
      else if (locomotionState === 'flight') {
        const moveForward = keys.has('KeyW') || keys.has('ArrowUp');
        const moveBackward = keys.has('KeyS') || keys.has('ArrowDown');
        const turnLeft = keys.has('KeyA') || keys.has('ArrowLeft');
        const turnRight = keys.has('KeyD') || keys.has('ArrowRight');
        const ascend = keys.has('Space');
        const descend =
          keys.has('ControlLeft') ||
          keys.has('ControlRight') ||
          keys.has('KeyC') ||
          keys.has('KeyQ') ||
          keys.has('KeyZ');
        const boost = keys.has('ShiftLeft') || keys.has('ShiftRight');

        // 1. Forward Speed: W = 15 m/s, Shift + W = 22 m/s, S = -3 m/s
        let targetSpeed = 0.0;
        if (moveForward) {
          targetSpeed = boost ? FLIGHT_BOOST_SPEED : FLIGHT_CRUISE_SPEED;
        } else if (moveBackward) {
          targetSpeed = FLIGHT_REVERSE_SPEED;
        }
        const speedK = moveForward || moveBackward ? 4.5 : 3.2;
        flightForwardSpeed = dampValue(
          flightForwardSpeed,
          targetSpeed,
          speedK,
          dt,
        );

        // 2. Yaw Turn & Mouse Aim Alignment
        let turnInput = (turnLeft ? 1 : 0) - (turnRight ? 1 : 0);

        // If the user is steering with the mouse while flying forward, smoothly align broom yaw toward cameraYaw
        const mouseLookDiff = wrapAnglePi(cameraYaw - flightYaw);
        if (
          moveForward &&
          turnInput === 0 &&
          Math.abs(mouseLookDiff) > 0.015
        ) {
          turnInput = THREE.MathUtils.clamp(mouseLookDiff * 1.65, -1.0, 1.0);
        }

        const targetYawRate = turnInput * FLIGHT_YAW_RATE_MAX;
        flightYawRate = dampValue(flightYawRate, targetYawRate, 8.0, dt);
        flightYaw = wrapAnglePi(flightYaw + flightYawRate * dt);

        // If turning with A/D and not actively dragging mouse, let camera follow broom heading smoothly
        if (
          (turnLeft || turnRight) &&
          !isDragging &&
          currentElapsedTime - lastMouseMoveElapsed > 0.6
        ) {
          const camDiff = wrapAnglePi(flightYaw - cameraYaw);
          cameraYaw = wrapAnglePi(cameraYaw + camDiff * dampAlpha(6.0, dt));
        }

        // 3. Vertical Climb / Descent (Space = Ascend, Ctrl/C/Q/Z = Descend)
        let targetVert = 0.0;
        if (ascend && !descend) {
          targetVert = FLIGHT_VERTICAL_MAX;
        } else if (descend && !ascend) {
          targetVert = -FLIGHT_VERTICAL_MAX;
        } else if (moveForward && Math.abs(cameraPitch) > 0.05) {
          // Gentle mouse pitch climb/glide assist when flying forward
          targetVert = THREE.MathUtils.clamp(
            -cameraPitch * flightForwardSpeed * 0.55,
            -5.5,
            5.5,
          );
        }

        // Soft ceiling pushback near max altitude
        if (playerPos.y > FLIGHT_MAX_ALTITUDE - 12.0) {
          const ceilT = THREE.MathUtils.clamp(
            (playerPos.y - (FLIGHT_MAX_ALTITUDE - 12.0)) / 12.0,
            0,
            1,
          );
          targetVert = Math.min(targetVert, (1.0 - ceilT) * 2.0 - ceilT * 4.5);
        }
        flightVerticalSpeed = dampValue(
          flightVerticalSpeed,
          targetVert,
          5.0,
          dt,
        );

        // 4. Integrate 3D Flight Position
        const fwdX = Math.sin(flightYaw);
        const fwdZ = Math.cos(flightYaw);
        playerPos.x += fwdX * flightForwardSpeed * dt;
        playerPos.z += fwdZ * flightForwardSpeed * dt;
        playerPos.y += flightVerticalSpeed * dt;

        // 5. Island Boundary Protection
        const mask = getHeartIslandMask(playerPos.x, playerPos.z);
        if (mask < -0.02) {
          // Smooth inward pushback toward island center
          const len = Math.hypot(playerPos.x, playerPos.z) || 1;
          const pushStrength = THREE.MathUtils.clamp(
            (-0.02 - mask) * 65.0,
            2.0,
            24.0,
          );
          playerPos.x -= (playerPos.x / len) * pushStrength * dt;
          playerPos.z -= (playerPos.z / len) * pushStrength * dt;
        }
        playerPos.x = THREE.MathUtils.clamp(
          playerPos.x,
          ISLAND_BOUNDS.minX + 6,
          ISLAND_BOUNDS.maxX - 6,
        );
        playerPos.z = THREE.MathUtils.clamp(
          playerPos.z,
          ISLAND_BOUNDS.minZ + 6,
          ISLAND_BOUNDS.maxZ - 6,
        );

        // 6. Cylinder Obstacle Sliding (Keep spires, trees, etc.)
        for (let i = 0; i < colliders.length; i++) {
          const c = colliders[i];
          const dx = playerPos.x - c.x;
          const dz = playerPos.z - c.z;
          const dist = Math.hypot(dx, dz);
          const minDist = c.radius + 0.75;
          if (dist < minDist && dist > 0.0001) {
            const groundAtCol = getTerrainHeight(c.x, c.z);
            if (playerPos.y < groundAtCol + 14.0) {
              const push = minDist - dist;
              playerPos.x += (dx / dist) * push;
              playerPos.z += (dz / dist) * push;
            }
          }
        }

        // 7. Ground Clearance (getTerrainHeight(x, z) + 1.2m) & Terrace Landing Detection
        const groundY = getTerrainHeight(playerPos.x, playerPos.z);
        const minFlightY = groundY + FLIGHT_GROUND_CLEARANCE;
        if (playerPos.y < minFlightY) {
          playerPos.y = minFlightY;
          if (flightVerticalSpeed < 0) flightVerticalSpeed = 0;

          // If player intentionally descends onto the Castle Landing Terrace (-74, +64), smoothly land & dismount!
          if (
            descend &&
            magicFlight.isOverCastleTerrace(playerPos) &&
            Math.abs(flightForwardSpeed) < 11.0
          ) {
            dismountBroomAndReturnToStand();
            return;
          }
        }

        // 8. Visual Banking Roll & Pitch
        const targetRoll = THREE.MathUtils.clamp(
          -flightYawRate * 0.44,
          -THREE.MathUtils.degToRad(28),
          THREE.MathUtils.degToRad(28),
        );
        const targetPitch = THREE.MathUtils.clamp(
          -flightVerticalSpeed * 0.042 +
            (flightForwardSpeed / FLIGHT_BOOST_SPEED) * 0.14,
          -THREE.MathUtils.degToRad(22),
          THREE.MathUtils.degToRad(22),
        );
        flightVisualRoll = dampValue(flightVisualRoll, targetRoll, 9.0, dt);
        flightVisualPitch = dampValue(flightVisualPitch, targetPitch, 7.0, dt);

        // Sync Broom & Seated Player Avatar
        _broomWorldPos.set(playerPos.x, playerPos.y + 0.52, playerPos.z);
        magicFlight.syncFlyingPose(
          _broomWorldPos,
          flightYaw,
          flightVisualPitch,
          flightVisualRoll,
          flightForwardSpeed,
          dt,
        );

        avatar.group.position.copy(playerPos);
        avatar.group.rotation.set(
          flightVisualPitch * 0.55,
          flightYaw,
          flightVisualRoll * 0.65,
        );
        avatar.updateAnimation(dt, 0, boost, elapsedTime, true);

        // 9. Third-Person Flight Camera (~6m behind, ~2.2m above, smooth mouse look)
        const boostFactor = THREE.MathUtils.clamp(
          (flightForwardSpeed - FLIGHT_CRUISE_SPEED) /
            (FLIGHT_BOOST_SPEED - FLIGHT_CRUISE_SPEED),
          0,
          1,
        );
        const targetFov = 62.0 + boostFactor * 7.0;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = dampValue(camera.fov, targetFov, 6.0, dt);
          camera.updateProjectionMatrix();
        }

        if (cameraMode === 'first-person') {
          camera.position.set(
            playerPos.x,
            playerPos.y + EYE_HEIGHT * 0.85,
            playerPos.z,
          );
          _desiredLookAt.set(
            playerPos.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * 12,
            playerPos.y +
              EYE_HEIGHT * 0.85 -
              Math.sin(cameraPitch) * 12,
            playerPos.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * 12,
          );
          camera.lookAt(_desiredLookAt);
        } else {
          const flightCamDist = 6.0 + boostFactor * 1.1;
          const flightCamHeight = 2.2 + Math.sin(cameraPitch) * 2.4;
          const horizRadius =
            Math.cos(Math.max(-0.35, cameraPitch * 0.65)) * flightCamDist;

          _desiredCamPos.set(
            playerPos.x - Math.sin(cameraYaw) * horizRadius,
            playerPos.y + flightCamHeight,
            playerPos.z - Math.cos(cameraYaw) * horizRadius,
          );

          const camGround = getTerrainHeight(
            _desiredCamPos.x,
            _desiredCamPos.z,
          );
          if (_desiredCamPos.y < camGround + 0.85) {
            _desiredCamPos.y = camGround + 0.85;
          }

          _desiredLookAt.set(
            playerPos.x + Math.sin(flightYaw) * 2.6,
            playerPos.y + 1.15 - Math.sin(cameraPitch) * 1.6,
            playerPos.z + Math.cos(flightYaw) * 2.6,
          );

          currentCamPos.lerp(_desiredCamPos, dampAlpha(7.5, dt));
          currentLookAt.lerp(_desiredLookAt, dampAlpha(10.0, dt));
          camera.position.copy(currentCamPos);
          camera.lookAt(currentLookAt);
        }
      }

      // ======================================================================
      // STATE 3: STANDARD THIRD-PERSON WALKING MODE
      // ======================================================================
      else {
        if (Math.abs(camera.fov - 60.0) > 0.05) {
          camera.fov = dampValue(camera.fov, 60.0, 6.0, dt);
          camera.updateProjectionMatrix();
        }

        const lakeMemoryActive = wizardingSchool.isLakeMemoryActive();
        const rotLeft = !lakeMemoryActive && keys.has('KeyQ');
        const rotRight = !lakeMemoryActive && keys.has('KeyR');
        if (rotLeft) cameraYaw = wrapAnglePi(cameraYaw + 1.85 * dt);
        if (rotRight) cameraYaw = wrapAnglePi(cameraYaw - 1.85 * dt);

        const moveForward =
          !lakeMemoryActive && (keys.has('KeyW') || keys.has('ArrowUp'));
        const moveBackward =
          !lakeMemoryActive && (keys.has('KeyS') || keys.has('ArrowDown'));
        const moveLeft =
          !lakeMemoryActive && (keys.has('KeyA') || keys.has('ArrowLeft'));
        const moveRight =
          !lakeMemoryActive && (keys.has('KeyD') || keys.has('ArrowRight'));
        const isSprinting =
          !lakeMemoryActive &&
          (keys.has('ShiftLeft') || keys.has('ShiftRight'));

        _forward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw)).normalize();
        _right.set(-_forward.z, 0, _forward.x).normalize();

        _moveDir.set(0, 0, 0);
        if (moveForward) _moveDir.add(_forward);
        if (moveBackward) _moveDir.sub(_forward);
        if (moveRight) _moveDir.add(_right);
        if (moveLeft) _moveDir.sub(_right);

        const hasInput = !lakeMemoryActive && _moveDir.lengthSq() > 0.001;
        if (hasInput) {
          _moveDir.normalize();
          const maxSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
          const targetVx = _moveDir.x * maxSpeed;
          const targetVz = _moveDir.z * maxSpeed;

          playerVelocity.x = THREE.MathUtils.lerp(
            playerVelocity.x,
            targetVx,
            1 - Math.exp(-WALK_ACCEL * dt),
          );
          playerVelocity.z = THREE.MathUtils.lerp(
            playerVelocity.z,
            targetVz,
            1 - Math.exp(-WALK_ACCEL * dt),
          );

          const targetFacing = Math.atan2(_moveDir.x, _moveDir.z);
          const diff = wrapAnglePi(targetFacing - facingYaw);
          facingYaw = wrapAnglePi(
            facingYaw + diff * (1 - Math.exp(-12.0 * dt)),
          );
        } else {
          playerVelocity.x = THREE.MathUtils.lerp(
            playerVelocity.x,
            0,
            1 - Math.exp(-WALK_DECEL * dt),
          );
          playerVelocity.z = THREE.MathUtils.lerp(
            playerVelocity.z,
            0,
            1 - Math.exp(-WALK_DECEL * dt),
          );
        }

        const nextX = playerPos.x + playerVelocity.x * dt;
        const nextZ = playerPos.z + playerVelocity.z * dt;

        const isNextCastle = dreamCastle?.isInsideCastle(nextX, nextZ);
        if (isNextCastle || isWalkablePosition(nextX, nextZ)) {
          playerPos.x = nextX;
          playerPos.z = nextZ;
        } else if (dreamCastle?.isInsideCastle(nextX, playerPos.z) || isWalkablePosition(nextX, playerPos.z)) {
          playerPos.x = nextX;
          playerVelocity.z *= 0.2;
        } else if (dreamCastle?.isInsideCastle(playerPos.x, nextZ) || isWalkablePosition(playerPos.x, nextZ)) {
          playerPos.z = nextZ;
          playerVelocity.x *= 0.2;
        } else {
          playerVelocity.x = 0;
          playerVelocity.z = 0;
        }

        for (let i = 0; i < colliders.length; i++) {
          const c = colliders[i];
          const dx = playerPos.x - c.x;
          const dz = playerPos.z - c.z;
          const dist = Math.hypot(dx, dz);
          const minDist = c.radius + PLAYER_RADIUS;
          if (dist < minDist && dist > 0.0001) {
            const push = minDist - dist;
            playerPos.x += (dx / dist) * push;
            playerPos.z += (dz / dist) * push;
          }
        }

        const groundY = getTerrainHeight(playerPos.x, playerPos.z);
        const surfaceY = dreamCastle
          ? dreamCastle.getSurfaceHeight(playerPos.x, playerPos.z, playerPos.y, groundY)
          : groundY;
        if (!isGrounded) {
          verticalVel -= 19.6 * dt;
          playerPos.y += verticalVel * dt;
          if (playerPos.y <= surfaceY) {
            playerPos.y = surfaceY;
            verticalVel = 0;
            isGrounded = true;
          }
        } else {
          playerPos.y = THREE.MathUtils.lerp(
            playerPos.y,
            surfaceY,
            1 - Math.exp(-22 * dt),
          );
        }

        const horizSpeed = Math.hypot(playerVelocity.x, playerVelocity.z);
        const activeFocus = lakeMemoryActive
          ? wizardingSchool.getCameraFocus()
          : null;
        const embraceAlpha = activeFocus?.embraceAlpha ?? 0;
        const kissAlpha = activeFocus?.kissAlpha ?? 0;

        avatar.group.position.copy(playerPos);
        avatar.group.rotation.set(0, facingYaw, 0);
        avatar.updateAnimation(
          dt,
          horizSpeed,
          isSprinting && hasInput,
          elapsedTime,
          false,
          false,
          embraceAlpha,
          kissAlpha,
        );

        currentCameraDistance = THREE.MathUtils.lerp(
          currentCameraDistance,
          targetCameraDistance,
          1 - Math.exp(-10 * dt),
        );

        if (cameraMode === 'first-person' && !lakeMemoryActive) {
          const eyePos = _desiredCamPos.set(
            playerPos.x,
            playerPos.y + EYE_HEIGHT,
            playerPos.z,
          );
          camera.position.copy(eyePos);
          const lookDist = 10;
          _desiredLookAt.set(
            eyePos.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * lookDist,
            eyePos.y - Math.sin(cameraPitch) * lookDist,
            eyePos.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * lookDist,
          );
          camera.lookAt(_desiredLookAt);
        } else {
          const horizDist =
            Math.cos(cameraPitch) * currentCameraDistance;
          const vertOffset =
            Math.sin(cameraPitch) * currentCameraDistance + 1.55;

          _desiredCamPos.set(
            playerPos.x - Math.sin(cameraYaw) * horizDist,
            playerPos.y + vertOffset,
            playerPos.z - Math.cos(cameraYaw) * horizDist,
          );

          const camGround = getTerrainHeight(
            _desiredCamPos.x,
            _desiredCamPos.z,
          );
          const camSurface = dreamCastle
            ? Math.max(camGround, dreamCastle.getSurfaceHeight(_desiredCamPos.x, _desiredCamPos.z, _desiredCamPos.y, camGround))
            : camGround;
          if (_desiredCamPos.y < camSurface + 0.75) {
            _desiredCamPos.y = camSurface + 0.75;
          }

          _desiredLookAt.set(playerPos.x, playerPos.y + 1.38, playerPos.z);

          // Gentle non-locking camera focus when watching Sorting Hat, Compendium 3D pages, Mirror of Desire, or Lake Memory
          if (lakeMemoryActive || (!hasInput && !isDragging)) {
            const schoolFocus = wizardingSchool.getCameraFocus();
            if (schoolFocus && schoolFocus.active && schoolFocus.blendAlpha > 0.01) {
              if (lakeMemoryActive) {
                // Base yaw faces across the lake; during 8.0s - 11.8s, Harsha smoothly turns
                // toward Yeshwanth as he walks up to hug and kiss her, then turns back toward the lake
                const lakeCenterW = castleLocalToWorld(
                  FOREST_LAKE_LOCAL_POS.localX,
                  FOREST_LAKE_LOCAL_POS.localZ,
                );
                const lakeAimYaw = Math.atan2(
                  lakeCenterW.x - playerPos.x,
                  lakeCenterW.z - playerPos.z,
                );
                const turnAlpha = schoolFocus.playerTurnAlpha ?? 0;
                const embraceYaw =
                  schoolFocus.targetPlayerYaw !== undefined
                    ? schoolFocus.targetPlayerYaw
                    : wrapAnglePi(lakeAimYaw + Math.PI);
                const desiredAvatarYaw = wrapAnglePi(
                  lakeAimYaw + wrapAnglePi(embraceYaw - lakeAimYaw) * turnAlpha,
                );

                facingYaw = wrapAnglePi(
                  facingYaw +
                    wrapAnglePi(desiredAvatarYaw - facingYaw) *
                      (1 - Math.exp(-7.5 * dt)),
                );
                cameraYaw = wrapAnglePi(
                  cameraYaw +
                    wrapAnglePi(lakeAimYaw - cameraYaw) *
                      (1 - Math.exp(-4.5 * dt)),
                );
                cameraPitch = THREE.MathUtils.lerp(
                  cameraPitch,
                  0.22,
                  1 - Math.exp(-3.5 * dt),
                );
                avatar.group.rotation.set(0, facingYaw, 0);
              }
              _desiredCamPos.lerp(schoolFocus.camWorldPos, schoolFocus.blendAlpha);
              _desiredLookAt.lerp(schoolFocus.lookWorldPos, schoolFocus.blendAlpha);
            }
          }

          if (carnivalDistrict.isActive()) {
            const carnivalFocus = carnivalDistrict.getCameraFocus();
            if (carnivalFocus && carnivalFocus.active) {
              _desiredCamPos.lerp(carnivalFocus.camWorldPos, carnivalFocus.blendAlpha);
              _desiredLookAt.lerp(carnivalFocus.lookWorldPos, carnivalFocus.blendAlpha);
            }
          }

          if (dreamCastle) {
            const castleFocus = dreamCastle.getCameraFocus();
            if (castleFocus) {
              _desiredCamPos.lerp(castleFocus.position, 0.85);
              _desiredLookAt.lerp(castleFocus.target, 0.85);
              if (castleFocus.fov) {
                camera.fov = dampValue(camera.fov, castleFocus.fov, 6.0, dt);
                camera.updateProjectionMatrix();
              }
            }
          }

          currentCamPos.lerp(_desiredCamPos, 1 - Math.exp(-10 * dt));
          currentLookAt.lerp(_desiredLookAt, 1 - Math.exp(-12 * dt));

          camera.position.copy(currentCamPos);
          camera.lookAt(currentLookAt);
        }
      }

      // Advance the MagicFlight, MagicMysteryBox, WizardingSchool, CarnivalDistrict & DreamCastle systems
      magicFlight.update(dt, elapsedTime);
      mysteryBox.update(dt, elapsedTime);
      wizardingSchool.update(dt, elapsedTime, playerPos);
      carnivalDistrict.update(dt, elapsedTime, playerPos, camera, keys);
      if (dreamCastle) {
        dreamCastle.update(dt, playerPos);
      }

      // Apply Castle Gate physical camera shake (Stage 2 seal break shudder & Stage 3 heavy inertia rumble/thud)
      if (locomotionState === 'walk') {
        mysteryBox.getCameraShakeOffset(_shakeOffset);
        if (_shakeOffset.lengthSq() > 1e-8) {
          camera.position.add(_shakeOffset);
        }
      }

      telemetryTimer += dt;
      if (telemetryTimer >= 0.08) {
        telemetryTimer = 0;
        currentRegion = getRegionAtPosition(playerPos.x, playerPos.z);
        onTelemetryChange?.(buildTelemetry());
      }
    },

    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      auroraCinematic.dispose();
    },
  };
}
