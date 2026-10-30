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
  AuroraDialogueLine,
  DialogueAdvanceSource,
  DialogueProgressionController,
} from './cinematics/auroraDialogueData';
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
  castleFountainCaption: string | null;
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
  selectElevatorFloor: (floorNum: number) => boolean;
  selectDanceSong: (songIndex: number) => void;
  performManualDance: (key: string) => void;
  performPredefinedDance: (stepIndex: number) => void;
  setGalleryFrameImage: (frameIndex: number, imageSource: string) => void;
  setCustomPortraitBackdrop: (imageSource: string) => void;
  triggerTakePortrait: () => boolean;
  interactCreativeWingKey: (key: string) => boolean;
  getGalleryFrames: () => readonly {
    index: number;
    title: string;
    sub: string;
    hasCustomImage: boolean;
    customImageSrc?: string;
  }[];
  getDanceStudioState: () => {
    active: boolean;
    activeSongIndex: number;
    songTitle: string;
    genre: string;
    activeDanceName: string;
    songs: readonly { title: string; genre: string }[];
  } | null;
  performCarnivalGameAction: () => void;
  getCurrentDialogue: () => AuroraDialogueLine | null;
  getDialogueRevealFullSignal: () => number;
  notifyDialogueTypingComplete: (dialogueId: string) => void;
  requestDialogueAdvance: (source?: DialogueAdvanceSource) => void;
  advanceDialogue: () => void;
  skipDialogueOrCinematic: () => void;
  getTelemetry: () => PlayerTelemetry;
  getFastHudState: () => {
    x: number;
    y: number;
    z: number;
    speed: number;
    altitudeAboveGround: number;
    statusLabel: string;
    isFlyingOrMounting: boolean;
  };
  isCompletelyIdle: () => boolean;
  getPosition: () => THREE.Vector3;
  dispose: () => void;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _targetVelocity = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _broomWorldPos = new THREE.Vector3();
const _rightHandWorldPos = new THREE.Vector3();
const _shakeOffset = new THREE.Vector3();
const _cameraRaycaster = new THREE.Raycaster();
const _camRayDir = new THREE.Vector3();
const _camRayIntersects: THREE.Intersection[] = [];
const MIN_CAMERA_DISTANCE = 1.2;

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
  if (dreamCastle) {
    dreamCastle.floor2Rooms.setAvatarCallbacks({
      setOutfitPalette: (idx) => avatar.setOutfitPalette(idx),
      cycleHairColor: () => avatar.cycleHairColor(),
      toggleTiara: () => avatar.toggleTiara(),
      setActivityPose: (pose) => avatar.setActivityPose(pose),
      getAppearanceSummary: () => avatar.getAppearanceSummary(),
    });
    dreamCastle.floor3Rooms.setAvatarCallbacks({
      setActivityPose: (pose) => avatar.setActivityPose(pose),
      resetNeutralPose: () => avatar.resetNeutralPose?.(),
    });
    dreamCastle.floor2CreativeWing.setAvatarBridge({
      getRingAttachmentWorldPos: (out) => avatar.getRingAttachmentWorldPos(out),
      getNecklaceAttachmentWorldPos: (out) =>
        avatar.getNecklaceAttachmentWorldPos(out),
      getCrownAttachmentWorldPos: (out) => avatar.getCrownAttachmentWorldPos(out),
      setJewelleryEquipped: (state) => avatar.setJewelleryEquipped(state),
      getJewelleryEquipped: () => avatar.getJewelleryEquipped(),
      setRaisingHand: (raising) => avatar.setRaisingHand(raising),
      setRoseHeld: (held) => avatar.setRoseHeld(held),
      isRoseHeld: () => avatar.isRoseHeld(),
      setActivityPose: (pose) => avatar.setActivityPose(pose),
      resetNeutralPose: () => avatar.resetNeutralPose?.(),
    });
    dreamCastle.setAvatarRoseCallback((held) => avatar.setRoseHeld(held));
  }

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
  let obstructedCameraDistance = 6.2;

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

  // Input & idle state
  const keys = new Set<string>();
  let isDragging = false;
  let isPointerLocked = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let idleTimer = 0;
  let smoothedFrameDt = 1 / 60;

  let telemetryTimer = 0;
  let wasCarnivalActive = false;
  let currentRegion = getRegionAtPosition(playerPos.x, playerPos.z);

  const WALK_SPEED = 8.2;
  const SPRINT_SPEED = 14.2;
  const WALK_ACCEL = 11.5;
  const WALK_DECEL = 10.5;
  const PLAYER_RADIUS = 0.48;
  const EYE_HEIGHT = 1.66;

  // ==========================================================================
  // 2D SPATIAL HASH GRID FOR FAST O(1) COLLIDER QUERIES (Cell Size = 12.0m)
  // ==========================================================================
  const SPATIAL_CELL_SIZE = 12.0;
  const spatialGrid = new Map<number, CircleCollider[]>();
  const _nearbyColliders: CircleCollider[] = [];
  const _visitedColliders = new Set<CircleCollider>();

  function getSpatialHashKey(cx: number, cz: number): number {
    return ((cx & 0xffff) << 16) | (cz & 0xffff);
  }

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const reach = c.radius + 1.5;
    const minCx = Math.floor((c.x - reach) / SPATIAL_CELL_SIZE);
    const maxCx = Math.floor((c.x + reach) / SPATIAL_CELL_SIZE);
    const minCz = Math.floor((c.z - reach) / SPATIAL_CELL_SIZE);
    const maxCz = Math.floor((c.z + reach) / SPATIAL_CELL_SIZE);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = getSpatialHashKey(cx, cz);
        let bucket = spatialGrid.get(key);
        if (!bucket) {
          bucket = [];
          spatialGrid.set(key, bucket);
        }
        bucket.push(c);
      }
    }
  }

  function queryNearbyColliders(wx: number, wz: number): CircleCollider[] {
    _nearbyColliders.length = 0;
    _visitedColliders.clear();
    const baseCx = Math.floor(wx / SPATIAL_CELL_SIZE);
    const baseCz = Math.floor(wz / SPATIAL_CELL_SIZE);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = spatialGrid.get(getSpatialHashKey(baseCx + dx, baseCz + dz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const c = bucket[i];
          if (!_visitedColliders.has(c)) {
            _visitedColliders.add(c);
            _nearbyColliders.push(c);
          }
        }
      }
    }
    return _nearbyColliders;
  }

  const _emptySchoolPrompt: SchoolPromptInfo = {
    id: 'none',
    title: '',
    actionLabel: '',
  };
  let lastDiscreteSignature = '';

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

  const dialogueController = new DialogueProgressionController();
  let wasDialogueActiveLastFrame = false;

  function getActiveAuroraDialogue(): AuroraDialogueLine | null {
    return (
      auroraCinematic.getCurrentDialogue() ??
      dreamCastle?.nav.getCurrentEntranceDialogue() ??
      dreamCastle?.floor2CreativeWing.tabletopWorld.getCurrentDialogue() ??
      null
    );
  }

  function performAuroraStyleDialogueAdvance(): AuroraDialogueLine | null {
    if (auroraCinematic.getCurrentDialogue()) {
      auroraCinematic.advanceDialogue();
      onTelemetryChange?.(buildTelemetry());
      return getActiveAuroraDialogue();
    }
    if (dreamCastle?.nav.getCurrentEntranceDialogue()) {
      dreamCastle.nav.advanceEntranceCinematicBeat();
      onTelemetryChange?.(buildTelemetry());
      return getActiveAuroraDialogue();
    }
    if (dreamCastle?.floor2CreativeWing.tabletopWorld.getCurrentDialogue()) {
      dreamCastle.floor2CreativeWing.tabletopWorld.advanceOrContinueCinematic();
      onTelemetryChange?.(buildTelemetry());
      return getActiveAuroraDialogue();
    }
    return null;
  }

  function requestDialogueAdvance(
    source: DialogueAdvanceSource = 'keyboard_enter',
  ) {
    const activeDial = getActiveAuroraDialogue();
    if (activeDial) {
      dialogueController.syncActiveDialogue(activeDial);
      dialogueController.requestDialogueAdvance(
        source,
        () => {
          performAuroraStyleDialogueAdvance();
        },
        () => getActiveAuroraDialogue(),
      );
      return;
    }
    handleAdvanceDialogue();
  }

  /**
   * Advances the currently active dialogue by exactly one line when the player presses Enter or clicks Continue.
   */
  function handleAdvanceDialogue() {
    if (getActiveAuroraDialogue()) {
      requestDialogueAdvance('keyboard_enter');
      return;
    }

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

    if (dreamCastle?.nav.activeCameraFocus) {
      dreamCastle.nav.skipCameraFocus();
      restoreExplorationControls();
      onTelemetryChange?.(buildTelemetry());
      return;
    }

    if (dreamCastle?.floor2CreativeWing.tabletopWorld.isTransitionActive()) {
      dreamCastle.floor2CreativeWing.tabletopWorld.skipCinematic();
      restoreExplorationControls();
      onTelemetryChange?.(buildTelemetry());
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

  let lastFreeMouseX: number | null = null;
  let lastFreeMouseY: number | null = null;
  let wasAnyCastleActivityCamActive = false;

  function restoreExplorationControls() {
    isDragging = false;
    lastFreeMouseX = null;
    lastFreeMouseY = null;
    playerVelocity.set(0, 0, 0);
    verticalVel = 0;
    isGrounded = true;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch, -0.58, 0.85);
    avatar.setFirstPersonVisibility(cameraMode === 'first-person');
    avatar.setShadowVisible(true);
    avatar.resetNeutralPose?.();
  }

  function triggerCastleAction(): boolean {
    if (locomotionState !== 'walk' || !dreamCastle) return false;
    const wasInElevatorFpv = dreamCastle.nav.isElevatorFpvActive;
    const wasCamActive =
      dreamCastle.floor1Rooms.getCameraState().active ||
      dreamCastle.floor2Rooms.getCameraState().active ||
      dreamCastle.floor2CreativeWing.getCameraState().active ||
      dreamCastle.floor3Rooms.getCameraState().active;
    dreamCastle.floor2CreativeWing.capturePlayerPose(
      playerPos,
      currentCamPos,
      currentLookAt,
      facingYaw,
      cameraPitch,
    );
    if (dreamCastle.interact(playerPos)) {
      const nowCamActive =
        dreamCastle.floor1Rooms.getCameraState().active ||
        dreamCastle.floor2Rooms.getCameraState().active ||
        dreamCastle.floor2CreativeWing.getCameraState().active ||
        dreamCastle.floor3Rooms.getCameraState().active;
      if (!wasInElevatorFpv && dreamCastle.nav.isElevatorFpvActive) {
        // Entering Royal Crystal Elevator FPV: face toward the front crystal doors & control panel (-Z / Grand Hall)
        cameraYaw = Math.PI;
        facingYaw = Math.PI;
        cameraPitch = 0.04;
        playerVelocity.set(0, 0, 0);
        verticalVel = 0;
        isGrounded = true;
        avatar.setFirstPersonVisibility(true);
      } else if (wasInElevatorFpv && !dreamCastle.nav.isElevatorFpvActive) {
        // Stepping out of Royal Crystal Elevator: restore third-person/current camera visibility on solid floor slab
        cameraYaw = Math.PI;
        facingYaw = Math.PI;
        cameraPitch = 0.14;
        restoreExplorationControls();
      } else if (wasCamActive && !nowCamActive) {
        restoreExplorationControls();
      } else {
        isDragging = false;
        lastFreeMouseX = null;
        lastFreeMouseY = null;
        playerVelocity.set(0, 0, 0);
        verticalVel = 0;
        isGrounded = true;
      }
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
    idleTimer = 0;

    // Decouple input polling from browser key-repeat events:
    // Continuous movement is read from `keys` Set every frame; discrete actions ignore repeat events.
    if (e.repeat) {
      return;
    }

    // Master Dialogue / Cinematic Input Rules:
    // - Enter advances one dialogue line (if typing, reveals full text first; if waiting_for_input, advances to next beat)
    // - Esc immediately skips the active dialogue/cinematic sequence and restores gameplay
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (getActiveAuroraDialogue()) {
        requestDialogueAdvance('keyboard_enter');
        return;
      }
      if (dreamCastle?.nav.activeCameraFocus) {
        dreamCastle.nav.skipCameraFocus();
        return;
      }
      if (dreamCastle) {
        dreamCastle.floor2CreativeWing.capturePlayerPose(
          playerPos,
          currentCamPos,
          currentLookAt,
          facingYaw,
          cameraPitch,
        );
      }
      if (
        dreamCastle &&
        (dreamCastle.floor3Rooms.handleKeyAction(e.code) ||
          dreamCastle.floor2Rooms.handleKeyAction(e.code) ||
          dreamCastle.floor2CreativeWing.handleKeyAction(e.key) ||
          dreamCastle.floor1Rooms.handleKeyAction(e.code))
      ) {
        onTelemetryChange?.(buildTelemetry());
        return;
      }
      handleAdvanceDialogue();
      return;
    }

    if (e.code === 'Escape') {
      if (!e.repeat) {
        if (dreamCastle?.nav.isElevatorFpvActive) {
          e.preventDefault();
          dreamCastle.nav.exitElevatorFpv(playerPos);
          restoreExplorationControls();
          onTelemetryChange?.(buildTelemetry());
          return;
        }
        if (dreamCastle?.nav.activeCameraFocus) {
          e.preventDefault();
          dreamCastle.nav.skipCameraFocus();
          restoreExplorationControls();
          onTelemetryChange?.(buildTelemetry());
          return;
        }
        if (dreamCastle?.floor3Rooms.getCameraState().active) {
          e.preventDefault();
          dreamCastle.floor3Rooms.exitActiveCameraMode(playerPos);
          restoreExplorationControls();
          onTelemetryChange?.(buildTelemetry());
          return;
        }
        if (dreamCastle?.floor2Rooms.getCameraState().active) {
          e.preventDefault();
          dreamCastle.floor2Rooms.exitActiveCameraMode(playerPos);
          restoreExplorationControls();
          onTelemetryChange?.(buildTelemetry());
          return;
        }
        if (dreamCastle?.floor2CreativeWing.getCameraState().active) {
          e.preventDefault();
          dreamCastle.floor2CreativeWing.exitActiveCameraMode();
          restoreExplorationControls();
          onTelemetryChange?.(buildTelemetry());
          return;
        }
        if (dreamCastle?.floor1Rooms.getCameraState().active) {
          e.preventDefault();
          dreamCastle.floor1Rooms.exitActiveCameraMode(playerPos);
          restoreExplorationControls();
          onTelemetryChange?.(buildTelemetry());
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

    // Section 8 & Pass A: While a cinematic dialogue card is active,
    // only block non-dialogue modal hotkeys (like elevator floor buttons or mystery box interactions),
    // but preserve WASD/Arrows, Numpad, and rotation keys so the player can walk, look, and inspect freely!
    if (getActiveAuroraDialogue()) {
      if (
        e.code === 'KeyE' ||
        e.code === 'KeyV' ||
        e.code === 'KeyF' ||
        e.code === 'Space' ||
        e.code === 'Digit1' ||
        e.code === 'Digit2' ||
        e.code === 'Digit3' ||
        e.code === 'Digit4' ||
        e.code === 'Digit0'
      ) {
        return;
      }
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

    // Elevator Floor Selection inside Dream Castle Cabin (FPV or standing in cabin)
    if (
      dreamCastle &&
      (dreamCastle.nav.isElevatorFpvActive || dreamCastle.nav.isInsideElevatorCabin(playerPos)) &&
      !e.repeat
    ) {
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
      if (e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'KeyB') {
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
    } else if (e.code === 'Space' && dreamCastle?.nav.activeCameraFocus) {
      e.preventDefault();
      dreamCastle.nav.skipCameraFocus();
      restoreExplorationControls();
      onTelemetryChange?.(buildTelemetry());
    } else if (
      dreamCastle &&
      (() => {
        dreamCastle.floor2CreativeWing.capturePlayerPose(
          playerPos,
          currentCamPos,
          currentLookAt,
          facingYaw,
          cameraPitch,
        );
        return (
          dreamCastle.floor3Rooms.handleKeyAction(e.code) ||
          dreamCastle.floor2Rooms.handleKeyAction(e.code) ||
          dreamCastle.floor2CreativeWing.handleKeyAction(e.key) ||
          dreamCastle.floor1Rooms.handleKeyAction(e.code)
        );
      })()
    ) {
      e.preventDefault();
      const isAnyCamActive =
        dreamCastle.floor1Rooms.getCameraState().active ||
        dreamCastle.floor2Rooms.getCameraState().active ||
        dreamCastle.floor2CreativeWing.getCameraState().active ||
        dreamCastle.floor3Rooms.getCameraState().active;
      if (!isAnyCamActive) {
        restoreExplorationControls();
      }
      onTelemetryChange?.(buildTelemetry());
    } else if (e.code === 'Space' && locomotionState === 'walk' && isGrounded) {
      e.preventDefault();
      verticalVel = 7.2;
      isGrounded = false;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };

  const onWindowBlur = () => {
    keys.clear();
    isDragging = false;
    lastFreeMouseX = null;
    lastFreeMouseY = null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    idleTimer = 0;
    if (carnivalDistrict.isActive()) {
      performCarnivalGameAction();
    }
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastFreeMouseX = e.clientX;
    lastFreeMouseY = e.clientY;
  };

  const onPointerMove = (e: PointerEvent) => {
    idleTimer = 0;
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

    const rawFreeDx =
      lastFreeMouseX !== null ? e.clientX - lastFreeMouseX : e.movementX || 0;
    const rawFreeDy =
      lastFreeMouseY !== null ? e.clientY - lastFreeMouseY : e.movementY || 0;
    const freeDx = THREE.MathUtils.clamp(rawFreeDx, -65, 65);
    const freeDy = THREE.MathUtils.clamp(rawFreeDy, -65, 65);
    lastFreeMouseX = e.clientX;
    lastFreeMouseY = e.clientY;

    if (
      locomotionState === 'mystery_cinematic' ||
      wizardingSchool.isLakeMemoryActive()
    )
      return;
    const isCastleFocusActive = Boolean(dreamCastle?.nav.activeCameraFocus);
    const floor1Cam = dreamCastle?.floor1Rooms.getCameraState();
    const isFloor1CamActive = Boolean(floor1Cam?.active);
    const floor2Cam = dreamCastle?.floor2Rooms.getCameraState();
    const isFloor2CamActive = Boolean(floor2Cam?.active);
    const creativeCam = dreamCastle?.floor2CreativeWing.getCameraState();
    const isCreativeCamActive = Boolean(creativeCam?.active);
    const floor3Cam = dreamCastle?.floor3Rooms.getCameraState();
    const isFloor3CamActive = Boolean(floor3Cam?.active);

    const isOverInteractiveHudControl =
      e.target instanceof HTMLElement &&
      Boolean(e.target.closest('button, input, label, a, select, textarea'));

    let lookDx = 0;
    let lookDy = 0;
    let yawSensitivity = 0.0034;
    let pitchSensitivity = 0.0028;

    if (isPointerLocked) {
      lookDx = e.movementX || 0;
      lookDy = e.movementY || 0;
      yawSensitivity = 0.003;
      pitchSensitivity = 0.0024;
    } else if (isDragging) {
      lookDx = e.clientX - lastPointerX;
      lookDy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      yawSensitivity = 0.0052;
      pitchSensitivity = 0.0044;
    } else if (!isOverInteractiveHudControl) {
      lookDx = freeDx;
      lookDy = freeDy;
      yawSensitivity = 0.0038;
      pitchSensitivity = 0.003;
    } else {
      return;
    }

    if (Math.abs(lookDx) < 0.0001 && Math.abs(lookDy) < 0.0001) return;

    if (isFloor1CamActive) {
      dreamCastle?.floor1Rooms.applySeatedLookDelta(
        lookDx * 0.0044,
        lookDy * 0.0036,
      );
    }
    if (isFloor2CamActive) {
      dreamCastle?.floor2Rooms.applyLookDelta(
        lookDx * 0.0044,
        lookDy * 0.0036,
      );
    }
    if (isCreativeCamActive) {
      dreamCastle?.floor2CreativeWing.applyLookDelta(
        lookDx * 0.0046,
        lookDy * 0.0036,
      );
    }
    if (isFloor3CamActive) {
      dreamCastle?.floor3Rooms.applyLookDelta(
        lookDx * 0.0044,
        lookDy * 0.0036,
      );
    }
    if (isCastleFocusActive) {
      dreamCastle?.nav.applyFocusLookDelta(
        lookDx * 0.0042,
        lookDy * 0.0034,
      );
    }

    cameraYaw = wrapAnglePi(cameraYaw - lookDx * yawSensitivity);
    cameraPitch = THREE.MathUtils.clamp(
      cameraPitch + lookDy * pitchSensitivity,
      -0.68,
      1.15,
    );
    lastMouseMoveElapsed = currentElapsedTime;
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  const onWheel = (e: WheelEvent) => {
    idleTimer = 0;
    if (carnivalDistrict.isActive()) {
      carnivalDistrict.applyZoomDelta?.(e.deltaY);
      return;
    }
    if (
      locomotionState === 'mystery_cinematic' ||
      wizardingSchool.isLakeMemoryActive() ||
      auroraCinematic.isActive()
    )
      return;

    const isCastleFocusActive = Boolean(dreamCastle?.nav.activeCameraFocus);
    const isFloor1CamActive = Boolean(dreamCastle?.floor1Rooms.getCameraState().active);
    const isFloor2CamActive = Boolean(dreamCastle?.floor2Rooms.getCameraState().active);
    const isCreativeCamActive = Boolean(dreamCastle?.floor2CreativeWing.getCameraState().active);
    const isFloor3CamActive = Boolean(dreamCastle?.floor3Rooms.getCameraState().active);

    // Support laptop two-finger touchpad horizontal swipe (deltaX) for smooth 360° camera rotation
    if (Math.abs(e.deltaX) > 0.25) {
      const panDx = THREE.MathUtils.clamp(e.deltaX, -60, 60);
      cameraYaw = wrapAnglePi(cameraYaw - panDx * 0.0042);
      if (isFloor1CamActive) dreamCastle?.floor1Rooms.applySeatedLookDelta(panDx * 0.0045, 0);
      if (isFloor2CamActive) dreamCastle?.floor2Rooms.applyLookDelta(panDx * 0.0045, 0);
      if (isCreativeCamActive) dreamCastle?.floor2CreativeWing.applyLookDelta(panDx * 0.0045, 0);
      if (isFloor3CamActive) dreamCastle?.floor3Rooms.applyLookDelta(panDx * 0.0045, 0);
      if (isCastleFocusActive) dreamCastle?.nav.applyFocusLookDelta(panDx * 0.0042, 0);
      lastMouseMoveElapsed = currentElapsedTime;
    }

    if (
      isFloor1CamActive ||
      isFloor2CamActive ||
      isCreativeCamActive ||
      isFloor3CamActive ||
      isCastleFocusActive
    ) {
      const panDy = THREE.MathUtils.clamp(e.deltaY, -60, 60);
      if (isFloor1CamActive) dreamCastle?.floor1Rooms.applySeatedLookDelta(0, panDy * 0.0032);
      if (isFloor2CamActive) dreamCastle?.floor2Rooms.applyLookDelta(0, panDy * 0.0032);
      if (isCreativeCamActive) dreamCastle?.floor2CreativeWing.applyLookDelta(0, panDy * 0.0032);
      if (isFloor3CamActive) dreamCastle?.floor3Rooms.applyLookDelta(0, panDy * 0.0032);
      if (isCastleFocusActive) dreamCastle?.nav.applyFocusLookDelta(0, panDy * 0.0032);
      return;
    }

    if (cameraMode !== 'third-person') return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      targetCameraDistance = THREE.MathUtils.clamp(
        targetCameraDistance + e.deltaY * 0.005,
        2.8,
        14.5,
      );
    }
  };

  const onPointerLockChange = () => {
    isPointerLocked = document.pointerLockElement === domElement;
    onTelemetryChange?.(buildTelemetry());
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);
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

    // District Bounding-Radius Gated Proximity Checks
    const isWalk = locomotionState === 'walk';
    const distToTerrace = Math.hypot(
      playerPos.x - CASTLE_TERRACE_POS.x,
      playerPos.z - CASTLE_TERRACE_POS.z,
    );
    const mysteryPromptMode: MysteryPromptMode =
      isWalk && distToTerrace <= 30.0
        ? mysteryBox.getPromptMode(playerPos, true)
        : 'none';

    const gState = mysteryBox.getGateState();
    const isNearSchoolOrForest =
      (playerPos.z > 8.0 && playerPos.x < 35.0) ||
      wizardingSchool.isDialogueActive();
    const schoolPrompt: SchoolPromptInfo =
      isWalk && isNearSchoolOrForest
        ? wizardingSchool.getPromptInfo(
            playerPos,
            true,
            gState === 'OPEN' || gState === 'UNLOCKING',
          )
        : _emptySchoolPrompt;

    const distToAurora = Math.hypot(playerPos.x - 0.0, playerPos.z - 58.0);
    const auroraPrompt =
      isWalk && distToAurora <= 28.0
        ? auroraCinematic.getInteractionPrompt(playerPos)
        : null;

    const distToCarnival = Math.hypot(playerPos.x - 2.0, playerPos.z - (-62.0));
    const carnivalPrompt =
      isWalk && distToCarnival <= 58.0 && !auroraCinematic.isActive()
        ? carnivalDistrict.getProximityPrompt(playerPos)
        : null;

    const distToDreamCastle = Math.hypot(playerPos.x - 88.0, playerPos.z - 18.0);
    const castlePrompt =
      isWalk && dreamCastle && distToDreamCastle <= 52.0
        ? dreamCastle.getProximityPrompt(playerPos)?.prompt ?? null
        : null;
    const castleFountainCaption =
      isWalk && dreamCastle && distToDreamCastle <= 52.0
        ? dreamCastle.nav.getActiveFountainCaption() ??
          dreamCastle.floor2CreativeWing.getActiveRoomCaption() ??
          dreamCastle.floor2Rooms.getActiveRoomCaption() ??
          dreamCastle.floor3Rooms.getActiveRoomCaption() ??
          dreamCastle.floor1Rooms.getActiveRoomCaption()
        : null;

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
        isWalk &&
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
      isOverCastleTerrace:
        locomotionState === 'flight' && distToTerrace <= CASTLE_TERRACE_POS.radius + 6.0
          ? magicFlight.isOverCastleTerrace(playerPos)
          : false,
      cameraMode,
      cameraDistance: Math.round(targetCameraDistance * 10) / 10,
      regionName: currentRegion.name,
      regionSubtitle: currentRegion.subtitle,
      isPointerLocked,
      auroraPrompt,
      carnivalPrompt,
      carnivalOverlay: carnivalDistrict.getActiveOverlay(),
      carnivalPrizesCount: carnivalDistrict.getEarnedPrizeIds().length,
      castlePrompt,
      castleFountainCaption,
    };
  }

  function emitTelemetryIfDiscreteChanged(force = false) {
    if (!onTelemetryChange) return;
    const next = buildTelemetry();
    const ov = next.carnivalOverlay;
    const meterBucket =
      ov && typeof ov.powerMeter === 'number'
        ? Math.round(ov.powerMeter * 25)
        : -1;
    const sig = [
      next.locomotionState,
      next.broomState,
      next.broomPromptMode,
      next.mysteryPromptMode,
      next.mysteryCaption?.line ?? '',
      next.mysteryCaption?.stepIndex ?? -1,
      next.flightCaption?.line ?? '',
      next.flightCaption?.stepIndex ?? -1,
      next.schoolPrompt.id,
      next.schoolPrompt.actionLabel,
      next.schoolBanner?.title ?? '',
      next.schoolBanner?.message ?? '',
      next.schoolBanner?.stepIndex ?? -1,
      next.hasHarshaKey ? 1 : 0,
      next.castleGateState,
      next.castleAwaitsBanner ? 1 : 0,
      next.isOverCastleTerrace ? 1 : 0,
      next.cameraMode,
      next.cameraDistance,
      next.regionName,
      next.isPointerLocked ? 1 : 0,
      next.auroraPrompt ?? '',
      next.carnivalPrompt?.attractionId ?? '',
      next.carnivalPrompt?.verb ?? '',
      ov?.title ?? '',
      ov?.state ?? '',
      ov?.captionLine ?? '',
      ov?.progressText ?? '',
      ov?.instruction ?? '',
      ov?.prizeName ?? '',
      ov?.showReticle ? 1 : 0,
      ov?.reticleHovered ? 1 : 0,
      ov?.requiresEnterToContinue ? 1 : 0,
      meterBucket,
      next.carnivalPrizesCount,
      next.castlePrompt ?? '',
      next.castleFountainCaption ?? '',
    ].join('|');

    if (force || sig !== lastDiscreteSignature) {
      lastDiscreteSignature = sig;
      onTelemetryChange(next);
    }
  }

  function getFastHudState() {
    const groundY = getTerrainHeight(playerPos.x, playerPos.z);
    const altitudeAboveGround = Math.max(0, playerPos.y - groundY);
    const horizSpeed =
      locomotionState === 'flight'
        ? Math.hypot(flightForwardSpeed, flightVerticalSpeed)
        : Math.hypot(playerVelocity.x, playerVelocity.z);
    const isSprinting =
      locomotionState === 'walk' &&
      (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
      horizSpeed > 0.5;
    const isBoosting =
      locomotionState === 'flight' &&
      (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
      flightForwardSpeed > 15.5;
    const statusLabel =
      locomotionState === 'flight'
        ? isBoosting
          ? 'Broom Boost (22 m/s)'
          : 'Broom Flight'
        : locomotionState === 'mounting'
          ? 'Mounting Broom'
          : isSprinting
            ? 'Sprinting'
            : horizSpeed > 0.3
              ? 'Walking'
              : 'Standing';

    return {
      x: playerPos.x,
      y: playerPos.y,
      z: playerPos.z,
      speed: horizSpeed,
      altitudeAboveGround,
      statusLabel,
      isFlyingOrMounting:
        locomotionState === 'flight' || locomotionState === 'mounting',
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
    selectElevatorFloor: (floorNum: number) => {
      if (locomotionState !== 'walk' || !dreamCastle) return false;
      if (dreamCastle.handleElevatorFloorSelect(floorNum)) {
        onTelemetryChange?.(buildTelemetry());
        return true;
      }
      return false;
    },
    selectDanceSong: (songIndex: number) => {
      dreamCastle?.floor2Rooms.selectDanceSong(songIndex);
      onTelemetryChange?.(buildTelemetry());
    },
    performManualDance: (key: string) => {
      dreamCastle?.floor2Rooms.performManualDance(key);
      onTelemetryChange?.(buildTelemetry());
    },
    performPredefinedDance: (stepIndex: number) => {
      dreamCastle?.performPredefinedDance(stepIndex);
      onTelemetryChange?.(buildTelemetry());
    },
    setGalleryFrameImage: (frameIndex: number, imageSource: string) => {
      dreamCastle?.setGalleryFrameImage(frameIndex, imageSource);
      onTelemetryChange?.(buildTelemetry());
    },
    setCustomPortraitBackdrop: (imageSource: string) => {
      dreamCastle?.floor2CreativeWing.setCustomPhotoBackdrop(imageSource);
      onTelemetryChange?.(buildTelemetry());
    },
    triggerTakePortrait: () => {
      if (!dreamCastle) return false;
      dreamCastle.floor2CreativeWing.capturePlayerPose(
        playerPos,
        currentCamPos,
        currentLookAt,
        facingYaw,
        cameraPitch,
      );
      const ok = dreamCastle.floor2CreativeWing.triggerTakePortrait();
      if (ok) {
        onTelemetryChange?.(buildTelemetry());
      }
      return ok;
    },
    interactCreativeWingKey: (key: string) => {
      if (!dreamCastle) return false;
      dreamCastle.floor2CreativeWing.capturePlayerPose(
        playerPos,
        currentCamPos,
        currentLookAt,
        facingYaw,
        cameraPitch,
      );
      const ok = dreamCastle.floor2CreativeWing.handleKeyAction(key);
      if (ok) {
        onTelemetryChange?.(buildTelemetry());
      }
      return ok;
    },
    getGalleryFrames: () => dreamCastle?.getGalleryFrames() ?? [],
    getDanceStudioState: () => dreamCastle?.floor2Rooms.getDanceStudioState() ?? null,
    performCarnivalGameAction,
    getCurrentDialogue: getActiveAuroraDialogue,
    getDialogueRevealFullSignal: () =>
      dialogueController.getRevealFullSignal(),
    notifyDialogueTypingComplete: (dialogueId: string) => {
      dialogueController.markTypingCompleted(dialogueId);
    },
    requestDialogueAdvance,
    advanceDialogue: handleAdvanceDialogue,
    skipDialogueOrCinematic: handleSkipDialogueOrCinematic,
    getTelemetry: buildTelemetry,
    getFastHudState,
    isCompletelyIdle: () => idleTimer > 1.0,
    getPosition: () => playerPos,

    update(rawDelta: number, elapsedTime: number) {
      const smoothDt = Math.min(rawDelta, 0.05);
      smoothedFrameDt = THREE.MathUtils.lerp(smoothedFrameDt, smoothDt, 0.42);
      const dt = smoothedFrameDt;
      currentElapsedTime = elapsedTime;

      auroraCinematic.update(smoothDt, elapsedTime);
      carnivalDistrict.update(smoothDt, elapsedTime, playerPos, camera, keys);

      const activeDialNow = getActiveAuroraDialogue();
      dialogueController.syncActiveDialogue(activeDialNow);
      const isDialActive = activeDialNow !== null;
      if (isDialActive && !wasDialogueActiveLastFrame && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      wasDialogueActiveLastFrame = isDialActive;

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
        emitTelemetryIfDiscreteChanged();
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
        emitTelemetryIfDiscreteChanged();
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

        // 6. Cylinder Obstacle Sliding via 2D Spatial Hash Grid
        const flightNearby = queryNearbyColliders(playerPos.x, playerPos.z);
        for (let i = 0; i < flightNearby.length; i++) {
          const c = flightNearby[i];
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
        const isElevatorFpv = Boolean(dreamCastle?.nav.isElevatorFpvActive);
        const isCastleFocusActive = Boolean(dreamCastle?.nav.activeCameraFocus);
        const rotLeft =
          !lakeMemoryActive &&
          (keys.has('KeyQ') ||
            keys.has('Numpad4') ||
            ((isElevatorFpv || isCastleFocusActive) &&
              (keys.has('KeyA') || keys.has('ArrowLeft'))));
        const rotRight =
          !lakeMemoryActive &&
          (keys.has('KeyR') ||
            keys.has('Numpad6') ||
            ((isElevatorFpv || isCastleFocusActive) &&
              (keys.has('KeyD') || keys.has('ArrowRight'))));
        if (rotLeft) {
          cameraYaw = wrapAnglePi(cameraYaw + 1.85 * dt);
          if (isCastleFocusActive) dreamCastle?.nav.applyFocusLookDelta(-1.35 * dt, 0);
        }
        if (rotRight) {
          cameraYaw = wrapAnglePi(cameraYaw - 1.85 * dt);
          if (isCastleFocusActive) dreamCastle?.nav.applyFocusLookDelta(1.35 * dt, 0);
        }

        const pitchUp =
          keys.has('Numpad8') ||
          ((isElevatorFpv || isCastleFocusActive) &&
            (keys.has('KeyW') || keys.has('ArrowUp')));
        const pitchDown =
          keys.has('Numpad2') ||
          ((isElevatorFpv || isCastleFocusActive) &&
            (keys.has('KeyS') || keys.has('ArrowDown')));
        if (pitchUp) {
          cameraPitch = THREE.MathUtils.clamp(cameraPitch - 1.15 * dt, -0.68, 1.15);
          if (isCastleFocusActive) dreamCastle?.nav.applyFocusLookDelta(0, -1.05 * dt);
        }
        if (pitchDown) {
          cameraPitch = THREE.MathUtils.clamp(cameraPitch + 1.15 * dt, -0.68, 1.15);
          if (isCastleFocusActive) dreamCastle?.nav.applyFocusLookDelta(0, 1.05 * dt);
        }

        if (dreamCastle) {
          const pendingTp =
            dreamCastle.floor2CreativeWing.tabletopWorld.consumePendingTeleport();
          if (pendingTp) {
            playerPos.copy(pendingTp.pos);
            facingYaw = pendingTp.yaw;
            cameraYaw = pendingTp.yaw;
            cameraPitch = 0.14;
            restoreExplorationControls();
            avatar.group.position.copy(playerPos);
            avatar.group.rotation.set(0, facingYaw, 0);
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
            onTelemetryChange?.(buildTelemetry());
          }

          const pendingPhotoCtx =
            dreamCastle.floor2CreativeWing.consumePendingPhotoReturn();
          if (pendingPhotoCtx) {
            playerPos.copy(pendingPhotoCtx.worldPosition);
            facingYaw = pendingPhotoCtx.playerYaw;
            cameraYaw = pendingPhotoCtx.playerYaw;
            cameraPitch = pendingPhotoCtx.playerPitch;
            restoreExplorationControls();
            avatar.group.position.copy(playerPos);
            avatar.group.rotation.set(0, facingYaw, 0);
            currentCamPos.copy(pendingPhotoCtx.cameraPosition);
            currentLookAt.copy(pendingPhotoCtx.cameraTarget);
            camera.position.copy(currentCamPos);
            camera.lookAt(currentLookAt);
            onTelemetryChange?.(buildTelemetry());
          }
        }

        const floor1Mode = dreamCastle?.floor1Rooms.getCameraState().mode ?? 'none';
        const floor1Active = Boolean(dreamCastle?.floor1Rooms.getCameraState().active);
        const floor2Active = Boolean(dreamCastle?.floor2Rooms.getCameraState().active);
        const creativeWingActive = Boolean(
          dreamCastle?.floor2CreativeWing.getCameraState().active,
        );
        const floor3Active = Boolean(dreamCastle?.floor3Rooms.getCameraState().active);

        const anyCastleActivityCamActive =
          isElevatorFpv ||
          isCastleFocusActive ||
          floor1Active ||
          floor2Active ||
          creativeWingActive ||
          floor3Active;
        if (wasAnyCastleActivityCamActive && !anyCastleActivityCamActive) {
          restoreExplorationControls();
        }
        wasAnyCastleActivityCamActive = anyCastleActivityCamActive;

        // Pass A Requirement: WASD, looking, and rotating are preserved during ordinary dialogue.
        // Movement is only locked during strictly seated cameras, active elevator FPV, or specific instrument inspect modes.
        const isInstrumentOrInspectLocked =
          isElevatorFpv ||
          isCastleFocusActive ||
          floor2Active ||
          creativeWingActive ||
          floor3Active ||
          floor1Mode === 'sofa_sit' ||
          floor1Mode === 'piano_play' ||
          floor1Mode === 'guitar_play' ||
          floor1Mode === 'couture_inspect';

        const moveForward =
          !lakeMemoryActive &&
          !isInstrumentOrInspectLocked &&
          (keys.has('KeyW') || keys.has('ArrowUp'));
        const moveBackward =
          !lakeMemoryActive &&
          !isInstrumentOrInspectLocked &&
          (keys.has('KeyS') || keys.has('ArrowDown'));
        const moveLeft =
          !lakeMemoryActive &&
          !isInstrumentOrInspectLocked &&
          (keys.has('KeyA') || keys.has('ArrowLeft'));
        const moveRight =
          !lakeMemoryActive &&
          !isInstrumentOrInspectLocked &&
          (keys.has('KeyD') || keys.has('ArrowRight'));
        const isSprinting =
          !lakeMemoryActive &&
          !isInstrumentOrInspectLocked &&
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
          _targetVelocity.set(_moveDir.x * maxSpeed, 0, _moveDir.z * maxSpeed);

          const targetFacing = Math.atan2(_moveDir.x, _moveDir.z);
          const diff = wrapAnglePi(targetFacing - facingYaw);
          facingYaw = wrapAnglePi(
            facingYaw + diff * (1 - Math.exp(-12.0 * smoothDt)),
          );
        } else {
          _targetVelocity.set(0, 0, 0);
        }

        // Smooth player velocity transitions using organic exponential dampening
        playerVelocity.lerp(_targetVelocity, 1 - Math.exp(-14 * smoothDt));
        if (!hasInput && playerVelocity.lengthSq() < 0.0001) {
          playerVelocity.set(0, 0, 0);
        }

        // Sub-stepped movement & collision resolution (4 sub-steps per tick) so fast sprinting never tunnels through walls
        const COLLISION_SUB_STEPS = 4;
        const subDt = dt / COLLISION_SUB_STEPS;
        for (let step = 0; step < COLLISION_SUB_STEPS; step++) {
          const nextX = playerPos.x + playerVelocity.x * subDt;
          const nextZ = playerPos.z + playerVelocity.z * subDt;

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

          const walkNearby = queryNearbyColliders(playerPos.x, playerPos.z);
          for (let i = 0; i < walkNearby.length; i++) {
            const c = walkNearby[i];
            // Vertical elevation filtering: ignore obstacles located on other floors or levels
            if (c.y !== undefined) {
              const ch = c.height ?? 3.8;
              if (playerPos.y < c.y - 0.5 || playerPos.y > c.y + ch + 0.3) {
                continue;
              }
            } else if (dreamCastle && dreamCastle.isInsideCastle(playerPos.x, playerPos.z)) {
              // Terrain/Ground colliders without explicit y: skip if player is on upper floors or basement
              const relY = playerPos.y - dreamCastle.nav.baseY;
              if ((relY > 2.8 || relY < -2.0) && c.radius < 3.5) {
                continue;
              }
            }

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

          // Enforce solid temporary box collision barrier across closed Castle Entrance Doors
          // plus 0.88m-1.2m thick exterior/interior castle walls, elevator shaft, and stair railings
          if (dreamCastle) {
            dreamCastle.nav.resolveEntranceDoorBarrier(playerPos, PLAYER_RADIUS);
            dreamCastle.nav.resolveCastleWallCollisions(playerPos, PLAYER_RADIUS);
          }
        }

        const groundY = getTerrainHeight(playerPos.x, playerPos.z);
        const surfaceY = dreamCastle
          ? dreamCastle.getSurfaceHeight(playerPos.x, playerPos.z, playerPos.y, groundY)
          : groundY;
        if (isElevatorFpv && dreamCastle) {
          playerPos.y = dreamCastle.nav.elevatorCabinY;
          verticalVel = 0;
          isGrounded = true;
        } else if (!isGrounded) {
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

        const castleFocusNow = dreamCastle?.getCameraFocus();
        const isCastleSitting = Boolean(castleFocusNow?.isSitting);
        const isCastlePosed = Boolean(castleFocusNow?.seatWorldPos);
        if (isCastlePosed && castleFocusNow?.seatWorldPos) {
          avatar.group.position.copy(castleFocusNow.seatWorldPos);
          if (castleFocusNow.seatYaw !== undefined) {
            facingYaw = castleFocusNow.seatYaw;
          }
          avatar.group.rotation.set(0, facingYaw, 0);
        } else {
          avatar.group.position.copy(playerPos);
          avatar.group.rotation.set(0, facingYaw, 0);
        }
        avatar.setFirstPersonVisibility(
          cameraMode === 'first-person' ||
            isElevatorFpv ||
            Boolean(castleFocusNow?.isFirstPersonSeated),
        );
        avatar.updateAnimation(
          dt,
          isCastlePosed ? 0 : horizSpeed,
          isSprinting && hasInput && !isCastlePosed,
          elapsedTime,
          false,
          false,
          embraceAlpha,
          kissAlpha,
          isCastleSitting,
        );

        const isCastleEntranceFraming =
          dreamCastle?.nav.isWithinEntranceFramingZone(playerPos) ?? false;
        const isCastleGazeboVista =
          dreamCastle?.rearGarden.isWithinGazeboVista(playerPos) ?? false;
        const isRidingCastleElevator =
          dreamCastle?.nav.isInsideElevatorCabin(playerPos) ?? false;
        const framingDistanceBonus = isCastleEntranceFraming
          ? 1.35
          : isRidingCastleElevator
            ? 0.85
            : isCastleGazeboVista
              ? 0.75
              : 0.0;

        currentCameraDistance = THREE.MathUtils.lerp(
          currentCameraDistance,
          targetCameraDistance + framingDistanceBonus,
          1 - Math.exp(-10 * dt),
        );

        if ((cameraMode === 'first-person' || isElevatorFpv) && !lakeMemoryActive) {
          const fpvEyeHeight =
            isElevatorFpv && dreamCastle
              ? dreamCastle.nav.elevatorCabinY - playerPos.y + 1.55
              : EYE_HEIGHT;
          const eyePos = _desiredCamPos.set(
            playerPos.x,
            playerPos.y + fpvEyeHeight,
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
          _desiredLookAt.set(
            playerPos.x,
            playerPos.y + (isCastleEntranceFraming ? 1.85 : 1.38),
            playerPos.z,
          );

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
            ? Math.max(
                camGround,
                dreamCastle.getSurfaceHeight(_desiredCamPos.x, _desiredCamPos.z, playerPos.y, camGround),
              )
            : camGround;
          if (_desiredCamPos.y < camSurface + 0.75) {
            _desiredCamPos.y = camSurface + 0.75;
          }
          if (dreamCastle) {
            const ceilY = dreamCastle.nav.getCeilingHeight(
              _desiredCamPos.x,
              _desiredCamPos.z,
              playerPos.y,
            );
            if (ceilY !== null && _desiredCamPos.y > ceilY - 0.42) {
              _desiredCamPos.y = Math.max(camSurface + 0.75, ceilY - 0.42);
            }
          }

          // Dynamic Raycast Camera Obstruction Resolver (cast ray from player head/look target back toward ideal camera orbit position)
          let effectiveTargetDist = _desiredCamPos.distanceTo(_desiredLookAt);
          if (effectiveTargetDist > 0.001) {
            _camRayDir.subVectors(_desiredCamPos, _desiredLookAt).divideScalar(effectiveTargetDist);
          } else {
            _camRayDir.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
          }

          if (dreamCastle) {
            const partMeshes = dreamCastle.interiorPartitionMeshes;
            for (let i = 0; i < partMeshes.length; i++) {
              const mat = partMeshes[i].material as THREE.MeshStandardMaterial;
              if (mat && mat.opacity < 0.99) {
                mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1.0, 1 - Math.exp(-10 * dt));
                if (mat.opacity >= 0.98) {
                  mat.opacity = 1.0;
                  mat.transparent = false;
                }
              }
            }

            if (
              Math.abs(playerPos.x - dreamCastle.nav.originX) <= 26.0 &&
              Math.abs(playerPos.z - dreamCastle.nav.originZ) <= 26.0
            ) {
              _cameraRaycaster.set(_desiredLookAt, _camRayDir);
              _cameraRaycaster.near = 0.2;
              _cameraRaycaster.far = effectiveTargetDist + 0.35;
              _camRayIntersects.length = 0;
              _cameraRaycaster.intersectObjects(
                dreamCastle.cameraOccluders,
                false,
                _camRayIntersects,
              );

              for (let i = 0; i < _camRayIntersects.length; i++) {
                const hit = _camRayIntersects[i];
                const hitMesh = hit.object as THREE.Mesh;
                if (partMeshes.includes(hitMesh)) {
                  // Interior partition wall: fade opacity to 0.2 and smoothly pull camera in
                  const mat = hitMesh.material as THREE.MeshStandardMaterial;
                  if (mat) {
                    mat.transparent = true;
                    mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.2, 1 - Math.exp(-16 * dt));
                  }
                  if (hit.distance < effectiveTargetDist) {
                    effectiveTargetDist = Math.max(
                      MIN_CAMERA_DISTANCE,
                      Math.min(effectiveTargetDist, hit.distance - 0.25),
                    );
                  }
                } else if (hit.distance < effectiveTargetDist) {
                  // Exterior wall, tower, or ceiling slab: clamp camera forward toward player
                  effectiveTargetDist = Math.max(MIN_CAMERA_DISTANCE, hit.distance - 0.35);
                  break;
                }
              }
            }
          }

          effectiveTargetDist = Math.max(MIN_CAMERA_DISTANCE, effectiveTargetDist);
          const distLerpRate = effectiveTargetDist < obstructedCameraDistance ? 18.0 : 9.0;
          obstructedCameraDistance = THREE.MathUtils.lerp(
            obstructedCameraDistance,
            effectiveTargetDist,
            1 - Math.exp(-distLerpRate * dt),
          );
          obstructedCameraDistance = Math.max(MIN_CAMERA_DISTANCE, obstructedCameraDistance);

          _desiredCamPos.copy(_desiredLookAt).addScaledVector(_camRayDir, obstructedCameraDistance);
          if (_desiredCamPos.y < camSurface + 0.72) {
            _desiredCamPos.y = camSurface + 0.72;
          }

          // Gentle non-locking camera focus when watching Sorting Hat, Compendium 3D pages, Mirror of Desire, or Lake Memory
          const recentlyMovedMouse = currentElapsedTime - lastMouseMoveElapsed <= 0.65;
          if (lakeMemoryActive || (!hasInput && !isDragging && !recentlyMovedMouse)) {
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
              if (dreamCastle.nav.activeCameraFocus?.mode === 'entrance') {
                // Smoothly align underlying follow camera yaw/pitch toward the Grand Hall fountain
                // so the 0.4s exit lerp returns to gameplay with zero camera pop
                cameraYaw = wrapAnglePi(
                  cameraYaw + wrapAnglePi(0 - cameraYaw) * (1 - Math.exp(-5.0 * dt)),
                );
                cameraPitch = THREE.MathUtils.lerp(
                  cameraPitch,
                  0.14,
                  1 - Math.exp(-5.0 * dt),
                );
              }
              _desiredCamPos.lerp(castleFocus.position, castleFocus.blendAlpha);
              _desiredLookAt.lerp(castleFocus.target, castleFocus.blendAlpha);
              if (castleFocus.fov) {
                const targetFov = THREE.MathUtils.lerp(60.0, castleFocus.fov, castleFocus.blendAlpha);
                camera.fov = dampValue(camera.fov, targetFov, 6.0, dt);
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

      // Advance the MagicFlight, MagicMysteryBox, WizardingSchool & DreamCastle systems
      magicFlight.update(dt, elapsedTime);
      mysteryBox.update(dt, elapsedTime);
      wizardingSchool.update(dt, elapsedTime, playerPos);
      if (dreamCastle) {
        dreamCastle.update(dt, playerPos, elapsedTime, keys);
        if (dreamCastle.nav.hasTriggeredEntranceReveal) {
          const clx = playerPos.x - dreamCastle.nav.originX;
          const clz = playerPos.z - dreamCastle.nav.originZ;
          const cpy = playerPos.y - dreamCastle.nav.baseY;
          // Player enters the house: inside castle perimeter (lz >= -15.4 to 15.0, |lx| <= 15.0)
          const isInsideHouse =
            Math.abs(clx) <= 15.0 &&
            clz >= -15.4 &&
            clz <= 15.0 &&
            cpy >= -0.5;
          if (isInsideHouse && !avatar.isHairRoseVisible?.()) {
            avatar.setHairRoseVisible?.(true);
            avatar.setRoseHeld(false);
          }
        }
      }

      // Apply Castle Gate physical camera shake (Stage 2 seal break shudder & Stage 3 heavy inertia rumble/thud)
      if (locomotionState === 'walk') {
        mysteryBox.getCameraShakeOffset(_shakeOffset);
        if (_shakeOffset.lengthSq() > 1e-8) {
          camera.position.add(_shakeOffset);
        }
      }

      // Track idle state (player standing completely still with no camera/input/cinematic activity)
      const isStandingStill =
        locomotionState === 'walk' &&
        keys.size === 0 &&
        !isDragging &&
        currentElapsedTime - lastMouseMoveElapsed > 0.35 &&
        playerVelocity.lengthSq() < 0.0004 &&
        isGrounded &&
        !auroraCinematic.isActive() &&
        !carnivalDistrict.isActive() &&
        !wizardingSchool.isDialogueActive() &&
        !dreamCastle?.nav.activeCameraFocus &&
        !dreamCastle?.nav.isFountainHologramVisible();

      if (isStandingStill) {
        idleTimer += smoothDt;
      } else {
        idleTimer = 0;
      }

      telemetryTimer += smoothDt;
      if (telemetryTimer >= 0.08) {
        telemetryTimer = 0;
        currentRegion = getRegionAtPosition(playerPos.x, playerPos.z);
        emitTelemetryIfDiscreteChanged();
      }
    },

    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      auroraCinematic.dispose();
    },
  };
}
